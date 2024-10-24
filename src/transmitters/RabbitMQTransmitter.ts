import amqp from "amqplib";
import { BaseTransmitter } from "@/transmitters/BaseTransmitter";
import { EventAckCallback } from "@/types";

type RabbitMQConfig = {
  autoDelete: boolean;
  durable: boolean;
  noAck: boolean;
};

export class RabbitMQTransmitter extends BaseTransmitter {
  protected connection?: amqp.Connection;
  protected channel?: amqp.Channel;
  protected connectionString: string;
  private eventCallbacks: Record<string, [string, EventAckCallback][]> = {};
  private nerveCallbacks: Record<string, (event: any) => void> = {};
  private assertedExchanges: string[] = [];

  private config: RabbitMQConfig = {
    autoDelete: false,
    durable: false,
    noAck: false,
  };

  onReadyCallbacks: (() => void)[] = [];
  onReadyToAttachCallbacks: (() => void)[] = [];
  onErrorCallbacks: ((error: Error) => void)[] = [];

  constructor(connectionString: string, config: Partial<RabbitMQConfig>) {
    super();
    this.connectionString = connectionString;

    Object.keys(config).map((key) => {
      this.config[key] = config[key];
    });
  }

  async connect() {
    try {
      this.connection = await amqp.connect(this.connectionString);
      this.connection?.on("error", this.handleError.bind(this));
      this.createChannel();
    } catch (error) {
      return this.handleError(error);
    }
  }

  acknowledgeMessage() {}

  handleError(error) {
    if (this.onErrorCallbacks.length) {
      this.callOnError(error);
    } else {
      throw error;
    }
  }

  onReady(callback) {
    this.onReadyCallbacks.push(callback);
    if (this.connection) {
      this.callOnReady();
    }
  }

  onReadyToAttach(callback) {
    this.onReadyToAttachCallbacks.push(callback);
    if (this.connection) {
      this.callOnReadyToAttach();
    }
  }

  onError(callback: (error: Error) => void) {
    this.onErrorCallbacks.push(callback);
  }

  callOnReady() {
    for (let i = 0; i < this.onReadyCallbacks.length; i++) {
      this.onReadyCallbacks[i]();
    }
    this.onReadyCallbacks = [];
  }

  callOnReadyToAttach() {
    for (let i = 0; i < this.onReadyToAttachCallbacks.length; i++) {
      this.onReadyToAttachCallbacks[i]();
    }
    this.onReadyToAttachCallbacks = [];
  }

  callOnError(error: Error) {
    for (let i = 0; i < this.onErrorCallbacks.length; i++) {
      this.onErrorCallbacks[i](error);
    }
  }

  async createChannel() {
    try {
      const channel = await this.connection?.createChannel();
      channel?.on("error", this.handleError.bind(this));
      channel?.on("close", this.handleError.bind(this));
      this.channel = channel;
      this.callOnReadyToAttach();
      this.callOnReady();
    } catch (error) {
      this.handleError(error);
    }
  }

  async assertExchange(exchangeName: string, callback?: () => void) {
    if (exchangeName in this.assertedExchanges) {
      callback && callback();
      return;
    }
    await this.channel?.assertExchange(exchangeName, "topic", {
      durable: this.config.durable,
      autoDelete: this.config.autoDelete,
    });

    this.assertedExchanges.push(exchangeName);
    callback && callback();
    return true;
  }

  async assertDirectExchange(exchangeName: string) {
    await this.channel?.assertExchange(exchangeName, "direct", {
      durable: this.config.durable,
      autoDelete: this.config.autoDelete,
    });
    return true;
  }

  attachEventListener(
    nerveId: string,
    eventName: string,
    callback: EventAckCallback
  ) {
    if (!this.eventCallbacks[eventName]) {
      this.eventCallbacks[eventName] = [];
    }
    this.eventCallbacks[eventName].push([nerveId, callback]);
    this.assertExchange(eventName, () => {
      this.attachIncoming(eventName);
    });
  }

  attachDirectEventListener(nerveId: string, callback: (event: any) => void) {
    this.nerveCallbacks[nerveId] = callback;
    this.assertDirectExchange("nerve-direct");
    this.attachIncomingDirect(nerveId);
  }

  async attachIncoming(eventName: string) {
    try {
      const queue = await this.channel?.assertQueue(eventName, {
        exclusive: false,
        durable: this.config.durable,
      });

      if (queue) {
        await this.channel?.bindQueue(queue.queue, eventName, "#");
        this.channel?.consume(
          queue.queue,
          (payload) => {
            if (payload) {
              this.handleIncoming(eventName, payload);
            }
          },
          {
            noAck: this.config.noAck,
          }
        );
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  async attachIncomingDirect(nerveId) {
    try {
      const queue = await this.channel?.assertQueue("nerve-direct", {
        exclusive: false,
        durable: this.config.durable,
      });
      if (queue) {
        this.channel?.bindQueue(queue.queue, "nerve-direct", nerveId);
        this.channel?.consume(
          queue.queue,
          (payload) => {
            if (payload) {
              this.handleIncomingDirect(nerveId, payload);
            }
          },
          {
            noAck: true,
          }
        );
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  serializePayload(payload: any) {
    return JSON.stringify(payload);
  }

  unerializePayload(payload: string) {
    return JSON.parse(payload);
  }

  /**
   * This method should fire the event into the chosen backend.
   * Here it will simply emit it back out to another attached listener
   * @param String event
   * @param Any payload
   */
  emitEvent(eventName: string, payload: any) {
    this.assertExchange(eventName, () => {
      const d = this.channel?.publish(
        eventName,
        "#",
        Buffer.from(this.serializePayload(payload))
      );
    });
  }

  emitEventToNerve(nerveId: string, payload: any) {
    try {
      this.channel?.publish(
        "nerve-direct",
        nerveId,
        Buffer.from(this.serializePayload(payload))
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  handleIncoming(eventName: string, payload: amqp.ConsumeMessage) {
    if (Array.isArray(this.eventCallbacks[eventName])) {
      const content = payload.content.toString();
      this.eventCallbacks[eventName].forEach((callback) => {
        callback[1](eventName, this.unerializePayload(content), () => {
          !this.config.noAck && this.channel?.ack(payload);
        });
      });
    }
  }

  handleIncomingDirect(nerveId: string, payload: amqp.ConsumeMessage) {
    if (this.nerveCallbacks[nerveId]) {
      const content = payload.content.toString();
      this.nerveCallbacks[nerveId](this.unerializePayload(content));
      !this.config.noAck && this.channel?.ack(payload);
    }
  }

  detatch(nerveId: string, eventName: string) {
    this.eventCallbacks[eventName] = this.eventCallbacks[eventName].filter(
      (callback) => {
        return callback[0] != nerveId;
      }
    );
    delete this.nerveCallbacks[nerveId];
  }

  close() {
    this.connection?.close();
  }
}
