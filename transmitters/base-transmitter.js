/**
 * Defines basic functions and provides testing functionality
 */

class BaseTransmitter {
  constructor() {}

  onReady(callback) {}

  onError(callback) {}

  attacheEventListener(nerveId, eventName, callback) {}

  attacheDirectEventListener(nerveId, callback) {}

  detatch(serviceId, eventName) {}

  /**
   * This method should fire the event into the chosen backend.
   * Here it will simply emit it back out to another attached listener
   * @param String event
   * @param Any payload
   */
  emitEvent(eventName, payload) {}

  emitEventToNerve(nerveId, message) {}

  close() {}
}

module.exports = BaseTransmitter;
