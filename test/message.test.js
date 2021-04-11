const ExampleTransmitter = require("../src/transmitters/ExampleTransmitter");
const Event = require("../src/event");

class TestTransmitter extends ExampleTransmitter {
  constructor() {
    super();
  }
}

const Nerve = require("../src/nerve");

describe("Transmitter", () => {
  it("connects with correct external event names", () => {
    const testTransmitter = new TestTransmitter();
    testTransmitter.on = jest.fn(() => {});
    const service = new Nerve(
      "Service1",
      {
        externalEvent1: { internalEvent1: {} },
      },
      testTransmitter
    );
    expect(testTransmitter.on).toHaveBeenCalled();
    expect(testTransmitter.on.mock.calls[0][0]).toBe(service.id);
    expect(testTransmitter.on.mock.calls[0][1]).toBe("externalEvent1");
    expect(testTransmitter.on.mock.calls[0][2]).toBeInstanceOf(Function);
  });
});

describe("Nerve", () => {
  it("sends and receives an event", () => {
    const testTransmitter = new TestTransmitter();
    const service1 = new Nerve("Service1", testTransmitter);
    const service2 = new Nerve("Service2", testTransmitter, {
      externalEvent2: { internalEvent2: {} },
    });

    let payload = null;
    service2.on("internalEvent2", (event) => {
      payload = event.getData();
    });

    const data = { somedata: "blabla" };
    const event = service1.event(data);
    expect(event).toBeInstanceOf(Event);
    event.emit("externalEvent2");
    expect(payload).toEqual(data);
  });

  it("sends and receives a reply event", async () => {
    const testTransmitter = new TestTransmitter();
    const service1 = new Nerve("Service1", testTransmitter, {
      externalEvent1: { internalEvent1: {} },
    });
    const service2 = new Nerve("Service2", testTransmitter, {
      externalEvent2: { internalEvent2: {} },
    });

    const replyData = { bip: "boop" };
    service2.on("internalEvent2", (event) => {
      event.next(replyData);
    });

    const data = { somedata: "blabla" };
    const event = service1.event(data);
    expect(event).toBeInstanceOf(Event);
    let replyMessage = null;
    await event.emitForResponse("externalEvent2").then((message) => {
      replyMessage = message;
    });
    expect(replyMessage.getData()).toEqual(replyData);
  });

  // const node = spawn("node", ["node.js", "--port=9000"]);
  // node.stdout.on("data", (data) => {
  //   // console.log(data.toString());
  // });
  // node.on("close", (code) => {
  //   // console.log(`child process exited with code ${code}`);
  // });

  // node.kill();
});
