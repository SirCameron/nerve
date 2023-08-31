/**
 * Defines basic functions and provides testing functionality
 */

import { EventAckCallback } from "..";

export class BaseTransmitter {
  constructor() {}

  onReady(callback: () => void) {}

  onReadyToAttach(callback: () => void) {}

  onError(callback: (error?: Error) => void) {}

  attachEventListener(
    nerveId: string,
    eventName: string,
    callback: EventAckCallback
  ) {}

  attachDirectEventListener(nerveId: string, callback: (event: any) => void) {}

  detatch(serviceId: string, eventName: string) {}

  /**
   * This method should fire the event into the chosen backend.
   * Here it will simply emit it back out to another attached listener
   * @param String event
   * @param Any payload
   */
  emitEvent(eventName: string, payload: any) {}

  emitEventToNerve(nerveId: string, message: any) {}

  close() {}
}
