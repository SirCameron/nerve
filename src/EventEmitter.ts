import { EmitConfigInternal } from "./types";

type Listener<T> = (...args: T[]) => void;

interface IEvents<EmitConfig> {
  [event: string]: Listener<EmitConfig[keyof EmitConfig]>[];
}

export class EventEmitter<EmitConfig extends EmitConfigInternal> {
  private readonly events: IEvents<EmitConfig> = {};

  public on(
    event: keyof EmitConfig,
    listener: Listener<EmitConfig[keyof EmitConfig]>
  ): () => void {
    if (typeof this.events[event as string] !== "object") {
      this.events[event as string] = [];
    }

    this.events[event as string].push(listener);
    return () => this.removeListener(event, listener);
  }

  public removeListener(
    event: keyof EmitConfig,
    listener: Listener<EmitConfig[keyof EmitConfig]>
  ): void {
    if (typeof this.events[event as string] !== "object") {
      return;
    }

    const idx: number = this.events[event as string].indexOf(listener);
    if (idx > -1) {
      this.events[event as string].splice(idx, 1);
    }
  }

  public removeAllListeners(): void {
    Object.keys(this.events).forEach((event: string) =>
      this.events[event].splice(0, this.events[event].length)
    );
  }

  public emit(event: keyof EmitConfig, ...args: any[]): void {
    if (typeof this.events[event as string] !== "object") {
      return;
    }

    [...this.events[event as string]].forEach((listener) =>
      listener.apply(this, args)
    );
  }

  public once(
    event: string,
    listener: Listener<EmitConfig[keyof EmitConfig]>
  ): () => void {
    const remove: () => void = this.on(event, (...args: any[]) => {
      remove();
      listener.apply(this, args);
    });

    return remove;
  }
}
