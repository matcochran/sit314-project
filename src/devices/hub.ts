import WebSocket, { Server as WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";
import {
  AckMessage,
  ControlMessage,
  Message,
  MessageType,
  RegistrationMessage,
  UpdateMessage,
} from "../models/Message";
import { Device, DeviceType, Light } from "../models/Device";
import { Port } from "../constants";

class HubManager {
  private readonly RETRY_INTERVAL = 300000; // 5 minutes
  private readonly wsCoordinator: WebSocket;
  private readonly wssHub: WebSocketServer;
  private readonly manufacturer: string = "hub_manufacturer";
  private readonly model: string = "hub_model";
  private readonly installCode: string = "ABC123";
  private deviceId: string = "";
  private lights: Map<string, Device> = new Map<string, Device>();
  private retryTimeout?: NodeJS.Timeout;
  private pendingRegistrationMessageId?: string;
  private pendingLightRegistrationMessageIds: Map<string, string> = new Map<
    string,
    string
  >();

  constructor() {
    const COORDINATOR_WS_URL = `ws://localhost:${Port.WS_COORDINATOR}`;
    this.wsCoordinator = new WebSocket(COORDINATOR_WS_URL);
    this.wssHub = new WebSocketServer({ port: Port.WS_HUB });

    this.setupCoordinatorListeners();
    this.setupHubListeners();
  }

  private setupCoordinatorListeners(): void {
    this.wsCoordinator.on("open", this.registerHub.bind(this));
    this.wsCoordinator.on("message", this.handleCoordinatorMessage.bind(this));
    this.wsCoordinator.on("error", (error) => {
      console.error("WebSocket error:", error.message);
    });
  }

  private setupHubListeners(): void {
    this.wssHub.on("connection", (ws) => {
      ws.on("message", this.handleLightMessage.bind(this));
      console.log(
        `Hub WebSocket server running on ws://localhost:${Port.WS_HUB}`
      );
    });
  }

  private scheduleRetry(callback: () => void): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
    this.retryTimeout = setTimeout(() => {
      console.log("Retrying registration...");
      callback();
    }, this.RETRY_INTERVAL);
  }

  private registerHub(): void {
    const registrationMessageId = this.sendHubRegistrationMessage();
    this.pendingRegistrationMessageId = registrationMessageId;
    this.scheduleRetry(this.registerHub.bind(this));
  }

  private handleCoordinatorMessage(data: string): void {
    const message: Message = JSON.parse(data);
    switch (message.type) {
      case MessageType.ACCEPT:
        const { relatedMessageId, reason } = message as AckMessage;
        console.log({ relatedMessageId, reason });
        if (
          this.pendingRegistrationMessageId &&
          relatedMessageId === this.pendingRegistrationMessageId
        ) {
          console.log("Hub registered with coordinator, assigned ID:", reason);
          this.deviceId = reason!;
          clearTimeout(this.retryTimeout!);
          this.pendingRegistrationMessageId = undefined;
        } else if (
          this.pendingLightRegistrationMessageIds.has(relatedMessageId)
        ) {
          const light = this.lights.get(relatedMessageId)!;
          console.log(
            `Light registered with coordinator, assigned ID:`,
            reason
          );
          this.lights.delete(light.id);
          light.id = reason!;
          this.lights.set(light.id, light);
          this.pendingLightRegistrationMessageIds.delete(relatedMessageId);
          clearTimeout(this.retryTimeout!);
          this.sendLightConfirmationMessage(light, relatedMessageId);
        }
        break;
      case MessageType.CONTROL:
        const controlMessage = message as ControlMessage;
        for (const command of controlMessage.commands) {
          const lights = this.filterLights(command.filterCriteria);
          lights.forEach(([, light]) => {
            Object.assign(light, command.updateDetails);
            this.sendLightUpdateMessage(light as Light);
            console.log("Updating device with:", command.updateDetails);
          });
        }
        break;
      default:
        console.log(`Received an unhandled message type: ${message.type}`);
    }
  }

  private handleLightMessage(data: string): void {
    const message: Message = JSON.parse(data);
    if (message.type === MessageType.REGISTRATION) {
      const registrationMessage = message as RegistrationMessage;
      if (registrationMessage.deviceType !== DeviceType.LIGHT) {
        const rejectMessage: AckMessage = {
          id: uuidv4(),
          type: MessageType.REJECT,
          reason: "Only lights should register with hubs.",
          relatedMessageId: registrationMessage.id,
          senderId: this.deviceId,
          timestamp: new Date().toISOString(),
        };

        this.wssHub.send(JSON.stringify(rejectMessage));
        return;
      }

      const originalMessageId = registrationMessage.id;

      const light: Light = {
        id: originalMessageId,
        type: DeviceType.LIGHT,
        manufacturer: registrationMessage.manufacturer,
        model: registrationMessage.model,
        lastUpdated: new Date(),
      };
      this.lights.set(light.id, light);

      this.sendLightRegistrationMessage(
        light,
        originalMessageId,
        registrationMessage.installCode
      );
      this.pendingLightRegistrationMessageIds.set(originalMessageId, light.id);
      this.scheduleRetry(() =>
        this.sendLightRegistrationMessage(
          light,
          originalMessageId,
          this.installCode
        )
      );
    }
  }

  private sendHubRegistrationMessage(): string {
    const messageId = uuidv4();
    const registrationMessage: RegistrationMessage = {
      id: messageId,
      type: MessageType.REGISTRATION,
      deviceType: DeviceType.HUB,
      installCode: this.installCode,
      manufacturer: this.manufacturer,
      model: this.model,
      senderId: "",
      timestamp: new Date().toISOString(),
    };
    this.wsCoordinator.send(JSON.stringify(registrationMessage));
    return messageId;
  }

  private sendLightRegistrationMessage(
    light: Light,
    originalMessageId: string,
    installCode: string
  ): void {
    const { id, manufacturer, model } = light;
    const registrationMessage: RegistrationMessage = {
      id: originalMessageId,
      type: MessageType.REGISTRATION,
      deviceType: DeviceType.LIGHT,
      installCode: installCode,
      manufacturer: manufacturer,
      model: model,
      senderId: this.deviceId,
      timestamp: new Date().toISOString(),
    };
    this.wsCoordinator.send(JSON.stringify(registrationMessage));
  }

  private sendLightConfirmationMessage(
    light: Light,
    relatedMessageId: string
  ): void {
    const confirmationMessage: AckMessage = {
      id: uuidv4(),
      type: MessageType.ACCEPT,
      reason: light.id,
      relatedMessageId: relatedMessageId,
      senderId: this.deviceId,
      timestamp: new Date().toISOString(),
    };
    this.wssHub.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(confirmationMessage));
      }
    });
  }

  private sendLightUpdateMessage(light: Light): void {
    const updateMessage: UpdateMessage = {
      id: uuidv4(),
      type: MessageType.UPDATE,
      senderId: this.deviceId,
      timestamp: new Date().toISOString(),
      updateDetails: light,
    };
    this.wssHub.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(updateMessage));
      }
    });
  }

  private filterLights(filterCriteria: {
    [key: string]: any;
  }): [string, Light][] {
    return [...this.lights.entries()].filter(([, light]) => {
      return Object.entries(filterCriteria).every(([key, value]) => {
        return light[key] === value;
      });
    });
  }
}

const hubManager = new HubManager();
