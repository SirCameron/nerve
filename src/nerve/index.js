const BaseTransmitter = require("../transmitters/BaseTransmitter");
const NrvTransmitter = require("../transmitters/nrv");
const io = require("socket.io-client");
const util = require("util");
const { EventEmitter } = require("events");
const uuidv4 = require("uuid/v4");
const Event = require("../event");

// config
// {
//  respondsTo: [
//      eventName: {
//          concurrentCount: 1
//      },
//      anotherEventName:{
//          concurrentCount: 2
//      }
//  ]
// }

class ReplyEmitter extends EventEmitter {
  emitReply(message) {
    this.emit("reply", message);
  }
}

class EventError extends Error {
  constructor(data) {
    super(data.message);
    this.data = data;
  }

  isInternal() {
    return this.data.type == "internal";
  }

  isInput() {
    return this.data.type == "input";
  }

  isTimeout() {
    return this.data.type == "timeout";
  }
}

/**
 * should have a build in queue to handle receiving and acking new events
 */
class Service2 extends EventEmitter {
  constructor(config) {
    super();
    this.id = uuidv4();
    this.connectionSocket = null;
    this.replyQueue = {};
    this.config = {};
    if (!("host" in config)) {
      this.config.host = "http://localhost:24038";
    } else {
      this.config.host = config.host;
    }
    if (!("service" in config)) {
      this.config.service = {
        name: "nobody",
      };
    } else {
      this.config.service = config.service;
    }
    if ("defaultTimeout" in config.service) {
      this.config.service.defaultTimeout = config.service.defaultTimeout;
    } else {
      this.config.service.defaultTimeout = 30;
    }
    if (!("eventMap" in config.service)) {
      this.config.service.eventMap = {};
    }
    this.config.service.id = this.id;
    this.connect();
  }

  connect() {
    console.log("Attempting to connect", this.config.host);
    this.connectionSocket = io(this.config.host);
    this.connectionSocket.on("connect", () => {
      console.log("connected to NodeHub as", this.id);
      this.connectionSocket.emit("activate", this.config.service);
      this.emit("connect");
    });
    this.connectionSocket.on("disconnect", () => {
      console.log("oh shit, we lost our node...");
      this.emit("disconnect");
    });
    this.connectionSocket.on("node-disconnect", () => {
      console.log("oh shit, we lost our node... node-disconnect");
      this.emit("node-disconnect");
    });
    this.connectionSocket.on("reject", (message) => {
      console.log("rejected. message:", message);
      this.emit("reject");
      this.connectionSocket.close();
    });

    this.connectionSocket.on("reconnecting", (attemptNumber) => {
      console.log("reconnecting...", attemptNumber);
    });

    this.connectionSocket.on("message", this.handleIncoming.bind(this));

    this.connectionSocket.on("reply", this.handleReply.bind(this));
  }

  disconnect() {
    // this.connectionSocket.emit('deactivate', this.config.eventConfig)
    this.connectionSocket.close();
  }

  handleIncoming(message) {
    console.log("message received at", this.config.service.name);
    if (message.event in this.config.service.eventMap) {
      this.config.service.eventMap[message.event].map((map) => {
        Object.keys(map).map((internalEventName) => {
          this.emit(internalEventName, new Message(message.message, this));
        });
      });
    }
  }

  handleReply(message) {
    console.log("reply received at", this.config.service.name);
    if (message.message.id in this.replyQueue) {
      this.replyQueue[message.message.id].emitReply(message.message);
    }
  }

  send(event, message) {
    console.log("message sent from", this.config.service.name);
    this.connectionSocket.emit("message", {
      event: event,
      message: message,
    });
  }

  sendReply(to, message) {
    console.log("reply sent from", this.config.service.name);
    this.connectionSocket.emit("message", {
      to: to,
      message: message,
    });
  }

  message(data) {
    let message = new Message(null, this);
    return message.new(data);
  }

  replyPromise(messageId, timeout = null) {
    if (!timeout) {
      timeout = this.config.service.defaultTimeout;
    }
    this.replyQueue[messageId] = new ReplyEmitter();
    return new Promise((res, rej) => {
      this.replyQueue[messageId].on("reply", (message) => {
        delete this.replyQueue[messageId];
        message = new Message(message, this);
        if ("error" in message.getData()) {
          return rej(new MessageError(message.getData().error));
        }
        return res(message);
      });
      if (timeout) {
        setTimeout(() => {
          if (messageId in this.replyQueue) {
            return rej(
              new MessageError({ message: "timeout", type: "timeout" })
            );
          }
          delete this.replyQueue[messageId];
        }, timeout * 1000);
      }
    });
  }

  interface() {
    //create a means to retrieve service interfaces... objects with specific functions defeind that chain onto the message making process..
    //like interface('mail').type('welcome').data(data).emit()
    //
    //this way, whenever an interface changes, erros will occur in mis-aligned services that use it.
  }
}

// util.inherits(ReplyEmitter, EventEmitter);

class Nerve extends EventEmitter {
  constructor(name, eventConfig, transmitter) {
    super();
    this.id = uuidv4();
    this.name = name;
    this.internalEventNames = {};
    this.replyQueue = {};
    // if ("defaultTimeout" in config.service) {
    //   this.config.service.defaultTimeout = config.service.defaultTimeout;
    // } else {
    //   this.config.service.defaultTimeout = 30;
    // }

    if (transmitter instanceof BaseTransmitter) {
      this.transmitter = transmitter;
    } else {
      this.transmitter = new NrvTransmitter();
    }
    this.eventConfig = eventConfig;

    this.getExternalEventNames().forEach((eventName) => {
      this.transmitter.on(this.id, eventName, this.handleIncoming.bind(this));
    });
    this.transmitter.onDirect(this.id, this.handleIncomingDirect.bind(this));
  }

  getExternalEventNames() {
    if (this.externalEventNames) {
      return this.externalEventNames;
    }
    return (this.externalEventNames = Object.keys(this.eventConfig).map(
      (eventName) => eventName
    ));
  }

  getInternalEventNamesForEvent(eventName) {
    if (this.internalEventNames[eventName]) {
      return this.internalEventNames[eventName];
    }
    this.internalEventNames[eventName] = [];
    this.getExternalEventNames().forEach((externalEventName) => {
      Object.keys(this.eventConfig[externalEventName]).forEach(
        (internalEventName) => {
          this.internalEventNames[eventName].push(internalEventName);
        }
      );
    });

    return this.internalEventNames[eventName];
  }

  event(data) {
    let message = new Event(this);
    return message.create(data);
  }

  send(event, message) {
    this.transmitter.emitEvent(event, message);
  }

  sendReply(nerveId, message) {
    this.transmitter.emitEventToNerve(nerveId, message);
  }

  replyPromise(messageId, timeout = null) {
    if (!timeout) {
      timeout = 30;
    }
    this.replyQueue[messageId] = new ReplyEmitter();
    return new Promise((res, rej) => {
      this.replyQueue[messageId].on("reply", (message) => {
        delete this.replyQueue[messageId];
        message = new Event(this, message);
        if ("error" in message.getData()) {
          return rej(new EventError(message.getData().error));
        }
        return res(message);
      });
      if (timeout) {
        setTimeout(() => {
          if (messageId in this.replyQueue) {
            return rej(new EventError({ message: "timeout", type: "timeout" }));
          }
          delete this.replyQueue[messageId];
        }, timeout * 1000);
      }
    });
  }

  handleIncoming(eventName, event) {
    this.getInternalEventNamesForEvent(eventName).forEach(
      (internalEventName) => {
        this.emit(internalEventName, new Event(this, event));
      }
    );
  }

  handleIncomingDirect(event) {
    if (this.replyQueue[event.id]) {
      this.replyQueue[event.id].emitReply(event);
    }
  }
}

module.exports = Nerve;
