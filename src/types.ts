export type EmitConfigInternal = Record<any, any>;

export type EventError = {
  message: string;
  type: "internal" | "input" | "denied";
};

export type PayloadChainBlock<EventConfig extends EmitConfigInternal> = {
  event: keyof EventConfig;
  timestamp: number;
  data: EventConfig[keyof EventConfig];
  error?: EventError;
  reply?: {
    returnTo: string;
    timeout?: number;
    returnedAt?: number;
    data?: EventConfig[keyof EventConfig];
    error?: EventError;
  };
};

export type EventPayload<EmitConfig extends EmitConfigInternal> = {
  id: string;
  origin: { id: string; name: string };
  event: keyof EmitConfig;
  timestamp: number;
  data: EmitConfig[keyof EmitConfig];
  error?: EventError;
  reply?: {
    returnTo: string;
    timeout?: number;
    returnedAt?: number;
    data?: EmitConfig[keyof EmitConfig];
    error?: EventError;
  };
  // chain: PayloadChainBlock<EmitConfig>[];
};

export type EventAckCallback = (
  eventName: string,
  content: any,
  ackCallback: () => void
) => void;
