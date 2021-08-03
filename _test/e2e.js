const RabbitMQ = require("../transmitters/rabbitmq-transmitter");
const Nerve = require("../nerve");

const rabbitMQ = new RabbitMQ("localhost");
rabbitMQ.onError((error)=>{
  console.log('error', error)
})
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

  const event1 = nerve1.event({ data: "first-event" });
  event1.emit("first");

  const event2 = nerve1.event({ data: "second-event" });
  event2
    .emitForResponse("second", 1)
    .then((response) => {
      console.log("response", response.getData());
    })
    .catch((err) => {
      console.log("message timed out:", err);
    });

  const eventNoListener = nerve1.event({ data: "second-event2" });
  eventNoListener.emitForResponse("no-listener", 2).catch(() => {
    console.log("no-listener to respond");
  });
});
rabbitMQ.connect()

const rabbitMQ2 = new RabbitMQ("localhost");
rabbitMQ2.onReady(() => {
  const nerve1 = new Nerve("login-endpoint", rabbitMQ2);
});
rabbitMQ2.connect()
