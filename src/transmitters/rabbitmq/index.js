var amqp = require("amqplib/callback_api");
const BaseTransmitter = require("../BaseTransmitter");

const DEFAULT_PORT = 5672;

class RabbitMQ extends BaseTransmitter {
  constructor(host, username, password, port = DEFAULT_PORT) {
    super();
    const credentials = username && password ? `${username}:${password}@` : "";
    amqp.connect(
      `amqp://${credentials}${host}:${port}`,
      (error, connection) => {
        if (error) {
          throw error;
        }
        this.connection = connection;
        this.createChannel();
      }
    );
    this.eventCallbacks = {};
    this.nerveCallbacks = {};
  }

  onReady(callback) {
    this.onReadyCallback = callback;
  }

  createChannel() {
    this.connection.createChannel((error, channel) => {
      if (error) {
        throw error;
      }
      this.channel = channel;
      this.onReadyCallback();
    });
  }

  assertExchange(exchangeName) {
    this.channel.assertExchange(exchangeName, "topic", {
      durable: true,
      autoDelete: false,
    });
  }

  assertDirectExchange(exchangeName) {
    this.channel.assertExchange(exchangeName, "direct", {
      durable: false,
      autoDelete: true,
    });
  }

  attachEventListener(nerveId, eventName, callback) {
    if (!this.eventCallbacks[eventName]) {
      this.eventCallbacks[eventName] = [];
    }
    this.eventCallbacks[eventName].push([nerveId, callback]);
    this.assertExchange(eventName);
    this.attachIncoming(eventName);
  }

  attachDirectEventListener(nerveId, callback) {
    this.nerveCallbacks[nerveId] = callback;
    this.assertDirectExchange("nerve-direct");
    this.attachIncomingDirect(nerveId);
  }

  attachIncoming(eventName) {
    this.channel.assertQueue(
      eventName,
      {
        exclusive: false,
        durable: true,
      },
      (error, queue) => {
        if (error) {
          throw error;
        }
        this.channel.bindQueue(queue.queue, eventName, "#");
        this.channel.consume(
          queue.queue,
          (payload) => {
            this.handleIncoming(eventName, payload.content.toString());
          },
          {
            noAck: true,
          }
        );
      }
    );
  }

  attachIncomingDirect(nerveId) {
    this.channel.assertQueue(
      "nerve-direct",
      {
        exclusive: true,
      },
      (error, queue) => {
        if (error) {
          throw error;
        }
        this.channel.bindQueue(queue.queue, "nerve-direct", nerveId);
        this.channel.consume(
          queue.queue,
          (payload) => {
            this.handleIncomingDirect(nerveId, payload.content.toString());
          },
          {
            noAck: true,
          }
        );
      }
    );
  }

  /**
   * This method should fire the event into the chosen backend.
   * Here it will simply emit it back out to another attached listener
   * @param String event
   * @param Any payload
   */
  emitEvent(eventName, payload) {
    try {
      this.channel.publish(eventName, "#", Buffer.from(payload));
    } catch (err) {
      console.log("asdsad", err);
    }
  }

  emitEventToNerve(nerveId, payload) {
    this.channel.publish("nerve-direct", nerveId, Buffer.from(payload));
  }

  handleIncoming(eventName, payload) {
    if (Array.isArray(this.eventCallbacks[eventName])) {
      this.eventCallbacks[eventName].forEach((callback) => {
        callback[1](eventName, payload);
      });
    }
  }

  handleIncomingDirect(nerveId, payload) {
    if (this.nerveCallbacks[nerveId]) {
      this.nerveCallbacks[nerveId](payload);
    }
  }

  detatch(nerveId, eventName) {
    this.eventCallbacks[eventName] = this.eventCallbacks[eventName].filter(
      (callback) => {
        return callback[0] != nerveId;
      }
    );
    delete this.nerveCallbacks[nerveId];
  }

  close() {
    // disconnect attaced..
    connection.close();
  }
}

module.exports = RabbitMQ;
