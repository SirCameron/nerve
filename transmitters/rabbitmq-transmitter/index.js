var amqp = require("amqplib/callback_api");
const BaseTransmitter = require("../base-transmitter");

const DEFAULT_PORT = 5672;

class RabbitMQ extends BaseTransmitter {
  constructor(host, username, password, vhost = "", port = DEFAULT_PORT) {
    super();
    const credentials = username && password ? `${username}:${password}@` : "";
    const path = vhost ? `/${vhost}` : "";
    this.connectionString = `amqp://${credentials}${host}:${port}${path}`;
    this.eventCallbacks = {};
    this.nerveCallbacks = {};
    this.assertedExchanges = [];
    this.connectionAttempts = 0;
    this.connect();
  }

  connect() {
    amqp.connect(this.connectionString, (error, connection) => {
      if (error) {
        this.handleError(error);
      }
      this.connection = connection;
      this.connection.on("error", this.handleError);
      this.createChannel();
    });
  }

  handleError(error) {
    if (this.connectionAttempts < 3) {
      console.log("erer");
      this.connect();
      this.connectionAttempts++;
      return;
    }

    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    } else {
      throw error;
    }
  }

  onReady(callback) {
    this.onReadyCallback = callback;
  }

  onError(callback) {
    this.onErrorCallback = callback;
  }

  createChannel() {
    this.connection.createChannel((error, channel) => {
      if (error) {
        this.handleError(error);
      }

      channel.on("error", this.handleError);
      this.channel = channel;
      this.onReadyCallback();
    });
  }

  assertExchange(exchangeName, callback) {
    if (exchangeName in this.assertedExchanges) {
      return;
    }
    this.channel.assertExchange(
      exchangeName,
      "topic",
      {
        durable: true,
        autoDelete: false,
      },
      callback
    );
    this.assertedExchanges.push(exchangeName);
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
          this.handleError(error);
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
        exclusive: false,
        durable: false,
      },
      (error, queue) => {
        if (error) {
          this.handleError(error);
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
    this.assertExchange(eventName, () => {
      this.channel.publish(eventName, "#", Buffer.from(payload));
    });
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
