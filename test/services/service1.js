const RabbitMQ = require("../../src/backends/rabbitmq");
const rabbitMQ = new RabbitMQ({
  host: "https://localhost:1234",
});
var Connector = require("../../src/nerve");
var connector = new Connector(rabbitMQ, {
  name: "service1",
  eventMap: {
    incomingName: {},
  },
});

connector
  .message("auth", { fuckity: "fuckfuck" })
  .emitForResponse()
  .then((response) => {
    console.log(response);
  });
