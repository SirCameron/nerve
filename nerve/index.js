const { EventEmitter } = require("events");
const uuidv4 = require("uuid/v4");

const BaseTransmitter = require("../transmitters/base-transmitter");
const NerveTransmitter = require("../transmitters/nerve-transmitter");
const Event = require("../event");

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

class Nerve extends EventEmitter {
  constructor(name, transmitter, eventConfig) {
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
      this.transmitter = new NerveTransmitter();
    }
    this.eventConfig = eventConfig;

    this.getExternalEventNames().forEach((eventName) => {
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

  getExternalEventNames() {
    if (this.externalEventNames) {
      return this.externalEventNames;
    }
    if (!this.eventConfig) {
      return (this.externalEventNames = []);
    }
    return (this.externalEventNames = Object.keys(this.eventConfig).map(
      (eventName) => eventName
    ));
  }

  getInternalEventNamesForEvent(eventName) {
    if (this.internalEventNames[eventName]) {
      return this.internalEventNames[eventName];
    }
    this.getExternalEventNames().forEach((externalEventName) => {
      this.internalEventNames[externalEventName] = [];
      Object.keys(this.eventConfig[externalEventName]).forEach(
        (internalEventName) => {
          this.internalEventNames[externalEventName].push(internalEventName);
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
      this.replyQueue[messageId].on("reply", (event) => {
        delete this.replyQueue[event.id];
        if ("error" in event.getData()) {
          return rej(new EventError(event.getData().error));
        }
        return res(event);
      });
      if (timeout) {
        setTimeout(() => {
          if (messageId in this.replyQueue) {
            delete this.replyQueue[messageId];
            return rej(new EventError({ message: "timeout", type: "timeout" }));
          }
        }, timeout * 1000);
      }
    });
  }

  handleIncoming(eventName, event) {
    this.getInternalEventNamesForEvent(eventName).forEach(
      (internalEventName) => {
        this.emit(internalEventName, Event.unserialize(this, event));
      }
    );
  }

  handleIncomingDirect(payload) {
    const event = Event.unserialize(this, payload);
    if (this.replyQueue[event.id]) {
      this.replyQueue[event.id].emitReply(event);
    }
  }
}

module.exports = Nerve;
