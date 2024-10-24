import { Event } from "@/Event";
import { EventEmitter } from "@/EventEmitter";
import { BaseTransmitter } from "@/transmitters/BaseTransmitter";
import { v4 as uuidv4 } from "uuid";
import { EmitConfigInternal, EventPayload } from "./types";

class ReplyEmitter<
  ReplyConfig extends EmitConfigInternal
> extends EventEmitter<ReplyConfig> {
  emitReply(event: ReplyConfig[keyof ReplyConfig]) {
    this.emit("reply", event);
  }
}

type EventErrorType = "internal" | "input" | "timeout";

class EventError extends Error {
  type: EventErrorType;
  constructor(type: EventErrorType, message?: string) {
    super(message);
    this.type = type;
  }
  isInternal() {
    return this.type === "internal";
  }
  isInput() {
    return this.type === "input";
  }
  isTimeout() {
    return this.type === "timeout";
  }
}

export class Nerve<
  EmitConfig extends EmitConfigInternal
> extends EventEmitter<EmitConfig> {
  id: string;
  name: string;
  transmitter: BaseTransmitter;
  replyQueue: Record<string, ReplyEmitter<EmitConfig>>[] = [];

  constructor(
    name: string,
    incommingEventFilter: string[],
    transmitter: BaseTransmitter
  ) {
    super();
    this.id = uuidv4();
    this.name = name;

    if (!(transmitter instanceof BaseTransmitter)) {
      throw new Error(
        "Transmitter provided is not valid. It must extend Transmitter."
      );
    }
    this.transmitter = transmitter;

    this.transmitter.onReadyToAttach(() => {
      this.setupEvents(incommingEventFilter);
    });
  }

  private setupEvents(incommingEventFilter: string[]) {
    incommingEventFilter.map((eventName) => {
      this.transmitter.attachEventListener(
        this.id,
        eventName,
        this.handleIncoming.bind(this)
      );
    });

    this.transmitter.attachDirectEventListener(
      this.id,
      this.handleIncomingDirect.bind(this)
    );
  }

  event(
    eventName: keyof EmitConfig,
    data: EmitConfig[keyof EmitConfig]
  ): Event<EmitConfig> {
    const message = new Event(this);
    return message.new(eventName, data);
  }

  send(eventName: keyof EmitConfig, payload: EventPayload<EmitConfig>) {
    this.transmitter.emitEvent(eventName as string, payload as any);
  }

  sendReply(nerveId: string, message: any) {
    this.transmitter.emitEventToNerve(nerveId, message);
  }

  replyPromise(
    messageId: string,
    timeout?: number
  ): Promise<EmitConfig[keyof EmitConfig] | undefined> {
    if (!timeout) {
      timeout = 30;
    }
    this.replyQueue[messageId] = new ReplyEmitter<EmitConfig>();
    return new Promise((resolve, reject) => {
      this.replyQueue[messageId].on("reply", (event: Event<EmitConfig>) => {
        delete this.replyQueue[event.id];
        if (event.getData()?.error) {
          return reject(new EventError(event.getData()!.error));
        }
        resolve(event.getReply()?.data);
      });
      if (timeout) {
        setTimeout(() => {
          if (messageId in this.replyQueue) {
            delete this.replyQueue[messageId];
            return reject(new EventError("timeout"));
          }
        }, timeout * 1000);
      }
    });
  }

  private handleIncoming(
    eventName: keyof EmitConfig,
    message: any,
    ackCallback: () => void
  ) {
    this.emit(
      eventName,
      new Event(this as Nerve<Record<string, any>>, message, ackCallback)
    );
  }

  private handleIncomingDirect(message: any) {
    const event = new Event(this as Nerve<EmitConfig>, message);
    if (this.replyQueue[event.id]) {
      this.replyQueue[event.id].emitReply(event);
    }
  }
}
