const RabbitMQ = require("../src/transmitters/rabbitmq");
const Nerve = require("../src/nerve");

const rabbitMQ = new RabbitMQ("localhost");
rabbitMQ.onReady(() => {
  const nerve1 = new Nerve("login-endpoint", rabbitMQ);
  const nerve2 = new Nerve("auth-check", rabbitMQ, {
    first: { first: {} },
    second: { second: {} },
  });

  nerve2.on("first", (event) => {
    console.log("first", event.getData());
    event.next();
  });

  nerve2.on("second", (event) => {
    console.log("second", event.getData());
    event.next({ response: "blabla" });
  });

  setTimeout(() => {
    const event1 = nerve1.event({ data: "first-event" });
    event1.emit("first");

    const event2 = nerve1.event({ data: "second-event" });
    event2.emitForResponse("second").then((response) => {
      console.log("response", response.getData());
    });
  }, 1000);
});
