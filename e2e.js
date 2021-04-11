const RabbitMQ = require("./src/transmitters/rabbitmq");
const { encode, decode } = require("@msgpack/msgpack");
const Nerve = require("./src/nerve");

const rabbitMQ = new RabbitMQ("localhost");
rabbitMQ.onReady(() => {
  const nerve1 = new Nerve("login-endpoint", rabbitMQ);
  const nerve2 = new Nerve("auth-check", rabbitMQ, {
    userAuthed: { userAuthed: {}, fuck: {} },
  });
  nerve2.on("userAuthed", (event) => {
    console.log(event.getData());
  });
  // nerve2.on("fuck", (event) => {
  //   console.log(event.getData());
  // });
  const event = nerve1.event({ data: "adasd" });
  event.emit("userAuthed");
});
