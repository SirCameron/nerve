const { v4: uuidv4 } = require("uuid");

class Event {
  constructor(nerve, payload = null, id = null) {
    if (!nerve || typeof nerve == "undefined") {
      throw new Error("Nerve is undefined");
    }
    this.nerve = nerve;
    this.payload = payload;
    this.id = id || uuidv4();
  }

  create(data) {
    if (this.payload == null) {
      this.payload = {
        id: this.id,
        timestamp: Date.now(),
        origin: this.nerve.id,
      };
    }
    this.payload.chain = [
      {
        id: uuidv4(),
        processed: null,
        data: data,
      },
    ];
    return this;
    // {
    //     chain: [
    //         {
    //             event: 'eventOne',
    //             processed: null|timestamp,
    //             data: {}
    //         },
    //         {
    //             event: 'eventTwo',
    //             processed: null|timestamp,
    //             data: {},
    //             return: {
    //                 to: 'serviceId',
    //                 timeout: 0
    //             }
    //         }
    //     ]
    // }
  }

  getData() {
    return this.getLastBlock().data;
  }

  getDataChain() {
    // return whole data chain.
  }

  getLastBlock() {
    return this.payload.chain[this.payload.chain.length - 1];
  }

  getBlock(i) {
    return this.payload.chain[i];
  }

  setBlock(i, block) {
    this.payload.chain[i] = block;
  }

  addToCurrent(options) {
    let block = this.getLastBlock();
    Object.keys(options).map((key) => {
      block[key] = options[key];
    });
    this.payload.chain[this.payload.chain.length - 1] = block;
  }

  addReplyBlock(referenceBlock, data) {
    this.payload.chain.push({
      id: uuidv4(),
      referenceBlock: referenceBlock.id,
      data: data,
    });
  }

  via() {}

  static unserialize(nerve, data) {
    const unserialized = JSON.parse(data);
    return new Event(nerve, unserialized, unserialized.id);
  }

  serialize() {
    return JSON.stringify(this.payload);
  }

  via(event, payload) {
    //for now this is just returning the messge... later it will add a preprocess to the chain allowing a message to first passthrough a service before hitting it's destination service
    return this;
  }

  emit(event) {
    this.addToCurrent({
      event: event,
    });
    this.nerve.send(event, this.serialize());
  }

  emitForResponse(eventName, timeout = null) {
    this.addToCurrent({
      event: eventName,
      returnTo: {
        serviceId: this.nerve.id,
        timeout: timeout,
      },
    });

    const replyPromise = this.nerve.replyPromise(this.id, timeout);
    this.nerve.send(eventName, this.serialize());
    return replyPromise;
  }

  reply(blocki) {
    let block = this.getBlock(blocki);
    block.returnedAt = Date.now();
    this.setBlock(blocki, block);
    this.nerve.sendReply(block.returnTo.serviceId, this.serialize());
  }

  /**
   * Called when a message has been dealt with.
   * This either pushes a reply, moves the message onto the service/event or stops it.
   */
  next(data = null) {
    //get undealt with returns... latest to first..
    let latest = this.payload.chain.length - 1;
    for (let i = latest; i >= 0; i--) {
      let block = this.getBlock(i);
      if ("returnTo" in block) {
        if (!("returnedAt" in block.returnTo)) {
          this.addReplyBlock(block, data || {});
          return this.reply(i);
        }
      }
    }
    return true;
  }

  inputError(error) {
    let message = "";
    if (error instanceof Error) {
      message = error.message;
    } else {
      message = error;
    }
    return this.next({ error: { message: message, type: "input" } });
  }

  internalError(error) {
    let message = "";
    if (error instanceof Error) {
      message = error.message;
    } else {
      message = error;
    }
    return this.next({ error: { message: message, type: "internal" } });
  }

  deniedError(error) {
    let message = "";
    if (error instanceof Error) {
      message = error.message;
    } else {
      message = error;
    }
    return this.next({ error: { message: message, type: "denied" } });
  }
}

module.exports = Event;
