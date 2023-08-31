import { Nerve } from "@/Nerve";
import { v4 as uuidv4 } from "uuid";
import { EmitConfigInternal, EventError, EventPayload } from "./types";

export class Event<EmitConfig extends EmitConfigInternal> {
  nerve: Nerve<EmitConfig>;
  payload: EventPayload<EmitConfig> | undefined;
  ackCallback?: () => void;

  constructor(
    nerve: Nerve<EmitConfig>,
    payload?: EventPayload<EmitConfig>,
    ackCallback?: () => void
  ) {
    if (!nerve || typeof nerve == "undefined") {
      throw new Error("Nerve is undefined");
    }
    this.nerve = nerve;
    this.ackCallback = ackCallback;

    if (payload) {
      this.payload = payload;
    }
  }

  get id() {
    if (!this.payload?.id) {
      throw new Error("Event id being accessed without payload");
      /// do this as internal nerve event, like emit('internalError'), so they can be caught like messages
    }
    return this.payload.id;
  }

  new(
    eventName: keyof EmitConfig,
    data: EmitConfig[keyof EmitConfig]
  ): Event<EmitConfig> {
    this.payload = {
      id: uuidv4(),
      origin: { id: this.nerve.id, name: this.nerve.name },
      timestamp: Date.now(),
      event: eventName,
      data: data,
    };

    return this;
  }

  getData() {
    return this.payload?.data;
  }

  getReply() {
    return this.payload?.reply;
  }

  addToCurrent(options: Partial<EventPayload<EmitConfig>>) {
    if (this.payload) {
      Object.keys(options).map((key) => {
        this.payload![key] = options[key];
      });
    }
  }

  ack() {
    this.ackCallback && this.ackCallback();
  }

  emit() {
    if (this.payload) {
      this.nerve.send(this.payload.event, this.payload);
    }
    return this;
  }

  emitForResponse(
    timeout?: number
  ): Promise<EmitConfig[keyof EmitConfig] | undefined> {
    const replyConfig: Pick<EventPayload<EmitConfig>, "reply"> = {
      reply: {
        returnTo: this.nerve.id,
      },
    };
    if (timeout) {
      replyConfig.reply!.timeout = timeout;
    }

    this.addToCurrent(replyConfig);

    const replyPromise = this.nerve.replyPromise(this.payload!.id, timeout);
    this.emit();
    return replyPromise;
  }

  reply() {
    if (this.payload) {
      this.payload.reply!.returnedAt = Date.now();
      this.nerve.sendReply(this.payload.reply!.returnTo, this.payload);
    }

    this.ack();
  }

  addReply(data: EmitConfig[keyof EmitConfig]) {
    this.payload!.reply!.data = data;
  }

  addError(error: EventError) {
    this.payload!.reply!.error = error;
  }

  next(data?: EmitConfig[keyof EmitConfig]) {
    if (data && this.payload?.reply) {
      if (!this.payload.reply.returnedAt) {
        this.addReply(data);
        return this.reply();
      }
    }

    this.ack();

    return true;
  }

  nextError(error: EventError) {
    if (this.payload?.reply) {
      if (!this.payload.reply.returnedAt) {
        this.addError(error);
        return this.reply();
      }
    }

    this.ack();

    return true;
  }

  inputError(error) {
    let message = "";
    if (error instanceof Error) {
      message = error.message;
    } else {
      message = error;
    }
    return this.nextError({ message: message, type: "input" });
  }

  internalError(error) {
    let message = "";
    if (error instanceof Error) {
      message = error.message;
    } else {
      message = error;
    }
    return this.nextError({ message: message, type: "internal" });
  }

  deniedError(error) {
    let message = "";
    if (error instanceof Error) {
      message = error.message;
    } else {
      message = error;
    }
    return this.nextError({ message: message, type: "denied" });
  }
}
