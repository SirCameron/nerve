const BaseTransmitter = require("./base-transmitter");

class ExampleTransmitter extends BaseTransmitter {
  constructor() {
    super();
    this.eventCallbacks = {};
    this.nerveCallbacks = {};
  }

  onReady(callback) {
    callback();
  }

  attacheEventListener(nerveId, eventName, callback) {
    this.attachEventCallback(nerveId, eventName, callback);
  }

  attacheDirectEventListener(nerveId, callback) {
    this.attachNerveCallback(nerveId, callback);
  }

  // detatch(serviceId, eventName){
  //   const key = `${serviceId}-${eventName}`
  //   delete(this.eventCallbacks[key])
  // }

  attachEventCallback(serviceId, eventName, callback) {
    if (!this.eventCallbacks[eventName]) {
      this.eventCallbacks[eventName] = {};
    }
    this.eventCallbacks[eventName][serviceId] = callback;
  }

  attachNerveCallback(nerveId, callback) {
    this.nerveCallbacks[nerveId] = callback;
  }

  /**
   * This method should fire the event into the chosen backend.
   * Here it will simply emit it back out to another attached listener
   * @param String event
   * @param Any payload
   */
  emitEvent(eventName, payload) {
    this.handleIncoming(eventName, payload);
  }

  emitEventToNerve(nerveId, message) {
    if (this.nerveCallbacks[nerveId]) {
      this.nerveCallbacks[nerveId](message);
    }
  }

  handleIncoming(eventName, payload) {
    if (this.eventCallbacks[eventName]) {
      Object.keys(this.eventCallbacks[eventName]).forEach((nerveId) => {
        this.eventCallbacks[eventName][nerveId](eventName, payload);
      });
    }
  }

  close() {
    // delete attached listeners
  }
}

module.exports = ExampleTransmitter;
