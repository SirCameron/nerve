const BaseTransmitter = require("../base-transmitter");

class NerveTransmitter extends BaseTransmitter {
  constructor() {
    super();
    this.eventCallbacks = {};
  }

  /**
   *
   * @param Array eventArray - list of events to listen for
   */
  connect(serviceId, eventArray) {
    // add events in eventArray to internal array and connect to those socket events.
  }

  on(serviceId, eventName, callback) {
    // attach eventName to backend (rabbit, etc) and add callback to array
    // has it's own event callback to receive events from backend
    this.attachEventCallback(serviceId, eventName, callback);
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

  emitEvent(event, serializedPayload) {
    //shoots event into backend.
  }

  handleIncoming(eventName, eventPayload) {
    if (this.eventCallbacks[eventName]) {
      Object.keys(this.eventCallbacks[eventName]).forEach((serviceId) => {
        this.eventCallbacks[eventName][serviceId](eventName, eventPayload);
      });
    }
  }
}

module.exports = NerveTransmitter;
