import { Colour } from "../constants";

export enum DeviceType {
  COORDINATOR = "coordinator",
  LIGHT = "light",
  HUB = "hub",
}

export interface Device {
  id: string;
  type: DeviceType;
  lastUpdated: Date;
  registeredTo?: string;

  manufacturer: string;
  model: string;

  data?: {
    [key: string]: any;
  };
}

export interface Light extends Device {
  on?: boolean;
  brightness?: number;
  colour?: string;
}

export interface Hub extends Device {}

export interface Coordinator extends Device {}

interface DeviceConfiguration {
  [key: string]: any;
}

export interface CoordinatorConfiguration extends DeviceConfiguration {
  installMode?: boolean;
  whitelist?: string[];
}

export interface HubConfiguration extends DeviceConfiguration {}

export interface LightConfiguration extends DeviceConfiguration {
  on?: boolean;
  brightness?: number;
  colour?: string;
}

interface Database {
  [key: string]: Map<string, any>;
}

export interface CoordinatorDatabase extends Database {
  whitelist: Map<string, string>;
  hubs: Map<string, Hub>;
  lights: Map<string, Light>;
}

export interface HubDatabase extends Database {
  lights: Map<string, Light>;
}
