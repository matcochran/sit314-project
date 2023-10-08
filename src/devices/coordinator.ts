import { Server as WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import {
  CoordinatorConfiguration,
  CoordinatorDatabase,
  Device,
  DeviceType,
  Hub,
  Light,
} from "../models/Device";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import {
  AckMessage,
  ControlMessage,
  Message,
  MessageType,
  RegistrationMessage,
} from "../models/Message";
import { Port } from "../constants";

const COORDINATOR_ID = uuidv4();

const zigbee = new WebSocketServer({ port: Port.WS_COORDINATOR });

const database: CoordinatorDatabase = {
  whitelist: new Map<string, string>(), // installCode -> uuid
  hubs: new Map<string, Hub>(),
  lights: new Map<string, Light>(),
};

const config: CoordinatorConfiguration = {
  installMode: true,
  hub: false,
};

const logs: string[] = [];

const log = (message: string) => {
  console.log(message);
  logs.push(message);
};

const rejectMessage = (
  reason: string,
  relatedMessageId: string
): AckMessage => {
  const rejectMessage: AckMessage = {
    id: uuidv4(),
    type: MessageType.REJECT,
    reason,
    relatedMessageId,
    senderId: COORDINATOR_ID,
    timestamp: new Date().toISOString(),
  };
  return rejectMessage;
};

zigbee.on("connection", (ws) => {
  ws.on("message", (data) => {
    log("Message received from device.");
    const message: Message = JSON.parse(data.toString());

    switch (message.type) {
      case MessageType.REGISTRATION:
        const registrationMessage = message as RegistrationMessage;

        if (
          !config.installMode &&
          !database.whitelist.has(registrationMessage.installCode)
        ) {
          const reject = rejectMessage(
            "Install code is not whitelisted.",
            registrationMessage.id
          );
          ws.send(JSON.stringify(reject));
          return;
        }

        if (registrationMessage.deviceType === DeviceType.LIGHT) {
          // Check if the hub is registered
          if (database.hubs.get(registrationMessage.senderId)) {
            log("Light registering via hub", registrationMessage.id);
            // Hub registering a light, continue
          } else if (!config.hub) {
            // Light registering with coordinator
            const reject = rejectMessage(
              "Only hubs should register with the coordinator.",
              registrationMessage.id
            );
            ws.send(JSON.stringify(reject));
            return;
          }
        }

        const device: Device = {
          id: uuidv4(),
          type: registrationMessage.deviceType,
          manufacturer: registrationMessage.manufacturer,
          model: registrationMessage.model,
          lastUpdated: new Date(),
        };

        if (!config.installMode) {
          switch (device.type) {
            case DeviceType.LIGHT:
              const lightId = database.whitelist.get(
                registrationMessage.installCode
              );
              if (lightId) {
                database.lights.set(lightId, device as Light);
              } else {
                const reject = rejectMessage(
                  "Unregistered install code.",
                  registrationMessage.id
                );
                ws.send(JSON.stringify(reject));
                return;
              }
              break;
            case DeviceType.HUB:
              const hubId = database.whitelist.get(
                registrationMessage.installCode
              );
              if (hubId) {
                database.hubs.set(hubId, device as Hub);
              } else {
                const reject = rejectMessage(
                  "Unregistered install code.",
                  registrationMessage.id
                );
                ws.send(JSON.stringify(reject));
                return;
              }
              break;
          }
        }

        const acceptMessage: AckMessage = {
          id: uuidv4(),
          type: MessageType.ACCEPT,
          reason: uuidv4(),
          relatedMessageId: registrationMessage.id,
          senderId: COORDINATOR_ID,
          timestamp: new Date().toISOString(),
        };
        ws.send(JSON.stringify(acceptMessage));
        if (registrationMessage.deviceType === DeviceType.LIGHT) {
          const light = device as Light;
          light.brightness = 100;
          light.colour = "#ffffff";
          light.on = true;
          database.lights.set(acceptMessage.reason!, light);
        } else if (registrationMessage.deviceType === DeviceType.HUB) {
          database.hubs.set(acceptMessage.reason!, device as Hub);
        }

        log(`${device.type} registered successfully.`);
        log(`Maintaining ${database.hubs.size} hub(s)`);
        log(`Maintaining ${database.lights.size} light(s)`);
        break;
      default:
        log(`Received an unhandled message type: ${message.type}`);
    }
  });
});

log(
  `Coordinator "Zigbee" connection running on ws://localhost:${Port.WS_COORDINATOR}`
);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "interface")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "interface", "index.html"));
});

app.post("/control", (req, res) => {
  log("Received control message.");
  const controlMessage: ControlMessage = req.body;

  const { commands } = controlMessage;
  for (const command of commands) {
    const lights = filterLights(command.filterCriteria);
    lights.forEach((light) => {
      log(light.id);
      Object.assign(light, command.updateDetails);
    });
  }

  zigbee.clients.forEach((client) => {
    client.send(JSON.stringify(controlMessage));
  });

  res.status(200).send("Command processed");
});

app.post("/config", (req, res) => {
  const { installMode, hub } = req.body;
  config.installMode = installMode;
  config.hub = hub;
  res.status(200).send("Configuration updated");
});

app.patch("/whitelist", (req, res) => {
  const { installCode } = req.body;
  database.whitelist.set(installCode, uuidv4());
  res.status(200).send("Install code whitelisted");
});

app.get("/devices", (req, res) => {
  const hubs = [...database.hubs.values()];
  const lights = [...database.lights.values()];

  res.json({
    hubs: hubs,
    lights: lights,
  });
});

app.get("/logs", (req, res) => {
  res.json(logs);
});

app.get("/config", (req, res) => {
  res.json(config);
});

app.listen(Port.HTTP_COORDINATOR, () => {
  log(
    `Coordinator HTTP server running on http://localhost:${Port.HTTP_COORDINATOR}`
  );
});

const filterLights = (filterCriteria: any): Light[] => {
  const lights = [...database.lights.values()];
  const filteredLights = lights.filter((light) => {
    return Object.entries(filterCriteria).every(([key, value]) => {
      return light[key] === value;
    });
  });
  return filteredLights;
};
