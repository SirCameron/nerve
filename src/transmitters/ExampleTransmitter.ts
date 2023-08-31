import { EventAckCallback } from "@/types";
import { BaseTransmitter } from "./BaseTransmitter";

export class ExampleTransmitter extends BaseTransmitter {
  private eventCallbacks: Record<string, [string, EventAckCallback][]> = {};
  private nerveCallbacks: Record<string, (event: any) => void> = {};

  constructor() {
    super();
  }

  onReady(callback) {
    callback();
  }

  onError(callback: (error?: Error) => void) {}

  attacheEventListener(nerveId, eventName, callback) {
    this.attachEventCallback(nerveId, eventName, callback);
  }

  attacheDirectEventListener(nerveId, callback) {
    this.attachNerveCallback(nerveId, callback);
  }

  attachEventCallback(serviceId: string, eventName: string, callback) {
    if (!this.eventCallbacks[eventName]) {
      this.eventCallbacks[eventName] = [];
    }
    this.eventCallbacks[eventName].push([serviceId, callback]);
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
