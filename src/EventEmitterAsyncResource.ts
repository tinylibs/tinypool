import { EventEmitter } from 'events';
import { AsyncResource } from 'async_hooks';

const kEventEmitter = Symbol('kEventEmitter');
const kAsyncResource = Symbol('kAsyncResource');

type EventEmitterOptions = typeof EventEmitter extends {
  new (options?: infer T) : EventEmitter;
} ? T : never;

type AsyncResourceOptions = typeof AsyncResource extends {
  new (name : string, options?: infer T) : AsyncResource;
} ? T : never;

type Options = EventEmitterOptions & AsyncResourceOptions & {
  name?: string;
};

class EventEmitterReferencingAsyncResource extends AsyncResource {
  [kEventEmitter] : EventEmitter;

  constructor (ee: EventEmitter, type: string, options?: AsyncResourceOptions) {
    super(type, options);
    this[kEventEmitter] = ee;
  }

  get eventEmitter () : EventEmitter {
    return this[kEventEmitter];
  }
}

class EventEmitterAsyncResource extends EventEmitter {
  [kAsyncResource] : EventEmitterReferencingAsyncResource;

  constructor (options?: Options | string) {
    let name;
    if (typeof options === 'string') {
      name = options;
      options = undefined;
    } else {
      name = options?.name || new.target.name;
    }
    super(options);

    this[kAsyncResource] =
      new EventEmitterReferencingAsyncResource(this, name, options);
  }

  emit (event: string | symbol, ...args: any[]) : boolean {
    return this.asyncResource.runInAsyncScope(
      super.emit, this, event, ...args);
  }

  emitDestroy () : void {
    this.asyncResource.emitDestroy();
  }

  asyncId () : number {
    return this.asyncResource.asyncId();
  }

  triggerAsyncId () : number {
    return this.asyncResource.triggerAsyncId();
  }

  get asyncResource () : EventEmitterReferencingAsyncResource {
    return this[kAsyncResource];
  }

  static get EventEmitterAsyncResource () { return EventEmitterAsyncResource; }
}

export default EventEmitterAsyncResource
