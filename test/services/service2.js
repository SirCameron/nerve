var Connector = require("../../src/Service");
var connector = new Connector({
  host: "http://localhost:9999",
  service: {
    name: "api",
    eventMap: {
      auth: [
        {
          auth: {
            concurrentCount: 1,
          },
        },
      ],
    },
  },
});

connector.on("auth", (message) => {
  console.log(message);
});
