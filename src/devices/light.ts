import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";
import {
  AckMessage,
  Message,
  MessageType,
  RegistrationMessage,
  UpdateMessage,
} from "../models/Message";
import { DeviceType, Light, LightConfiguration } from "../models/Device";
import { Port } from "../constants";

const RETRY_INTERVAL = 300000; // 5 minutes

const HUB_WS_URL = `ws://localhost:${Port.WS_HUB}`;

const ws = new WebSocket(HUB_WS_URL);

const INSTALL_CODE = "ABC123";
let deviceId = "";

const config: LightConfiguration = {
  colour: "#ffffff",
  brightness: 100,
  on: true,
};

const sendRegistrationMessage = (): string => {
  const messageId = uuidv4();

  const registrationMessage: RegistrationMessage = {
    id: messageId,
    type: MessageType.REGISTRATION,
    deviceType: DeviceType.LIGHT,
    installCode: INSTALL_CODE,
    manufacturer: "light_manufacturer",
    model: "light_model",
    senderId: "",
    timestamp: new Date().toISOString(),
  };
  ws.send(JSON.stringify(registrationMessage));

  return messageId;
};

const tryRegisteringWithHub = () => {
  let registrationMessageId: string;
  let retryTimeout: NodeJS.Timeout;

  const performRegistration = () => {
    console.log("Attempting to register with hub...");
    registrationMessageId = sendRegistrationMessage();
    // Start (or reset) the retry timer
    clearTimeout(retryTimeout);
    retryTimeout = setTimeout(() => {
      console.log("Retrying registration...");
      performRegistration();
    }, RETRY_INTERVAL);
  };

  ws.on("open", performRegistration);

  ws.on("message", (data) => {
    console.log("Message received from hub.");
    const message: Message = JSON.parse(data.toString());

    if (message.type === MessageType.ACCEPT) {
      const acceptMessage = message as AckMessage;
      if (acceptMessage.relatedMessageId !== registrationMessageId) {
        console.log("Registration accepted, but not for this device.");
        return;
      }

      deviceId = acceptMessage.reason!;

      console.log("Successfully registered with hub, assigned ID:", deviceId);
      clearTimeout(retryTimeout);
      startLightOperations();
    } else if (message.type === MessageType.REJECT) {
      const rejectMessage = message as AckMessage;
      if (rejectMessage.relatedMessageId !== registrationMessageId) {
        console.log("Registration rejected, but not for this device.");
        return;
      }
      console.error(
        "Registration rejected by hub:",
        rejectMessage.reason?.toString() ?? "No reason provided."
      );
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error.message);
  });
};

tryRegisteringWithHub();

function startLightOperations() {
  console.log("Light is now registered and awaiting updates.");

  ws.on("message", (data) => {
    const message = JSON.parse(data.toString());
    if (message.type === MessageType.UPDATE) {
      console.log(`Received update: ${JSON.stringify(message)}`);
      const { updateDetails } = message as UpdateMessage;
      if (updateDetails.id !== deviceId) {
        console.log("Update not for this device.");
        return;
      }
      console.log("Update is for this device.");
      console.log("Updating device with:", updateDetails);
      Object.assign(config, updateDetails);
    } else {
      console.log(`Received an unhandled message type: ${message.type}`);
    }
  });
}
