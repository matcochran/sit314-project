import { DeviceType } from "./Device";

export enum MessageType {
  ACCEPT = "accept",
  REJECT = "reject",
  CONTROL = "control",
  UPDATE = "update",
  REGISTRATION = "registration",
}

export interface Message {
  id: string;
  type: MessageType;
  senderId: string;
  timestamp: string;
}

export interface RegistrationMessage extends Message {
  installCode: string;
  deviceType: DeviceType;
  manufacturer: string;
  model: string;
}

interface UpdateDetails {
  [key: string]: any;
}

interface ControlCommand {
  filterCriteria: {
    [key: string]: any;
  };
  updateDetails: UpdateDetails;
}

export interface ControlMessage extends Message {
  commands: ControlCommand[];
}

export interface UpdateMessage extends Message {
  updateDetails: UpdateDetails;
}

export interface AckMessage extends Message {
  relatedMessageId: string;
  reason?: string;
}
