/**
 * Defines basic functions and provides testing functionality
 */

class BaseTransmitter {
  constructor() {}

  on(nerveId, eventName, callback) {}

  onDirect(nerveId, callback) {}

  detatch(serviceId, eventName) {}

  attachEventCallback(serviceId, eventName, callback) {}

  attachNerveCallback(nerveId, callback) {}

  /**
   * This method should fire the event into the chosen backend.
   * Here it will simply emit it back out to another attached listener
   * @param String event
   * @param Any payload
   */
  emitEvent(eventName, payload) {}

  emitEventToNerve(nerveId, message) {}

  handleIncoming(eventName, payload) {}
}

module.exports = BaseTransmitter;
