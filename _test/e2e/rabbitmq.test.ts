import { RabbitMQTransmitter } from "../../src/transmitters/RabbitMQTransmitter";
import { Nerve } from "../../src/Nerve";
import { describe, expect, it } from "vitest";

enum EventName {
  First = "first",
}

type EmitConfig = {
  [EventName.First]: {
    value: number;
  };
};

describe("RabbitMQ", () => {
  it("Sends and receives a message on the other end", async () => {
    return new Promise((res, rej) => {
      const rabbitMQ1 = new RabbitMQTransmitter(
        "amqp://admin:admin@localhost:5672/",
        {
          durable: false,
          noAck: false,
        }
      );

      rabbitMQ1.onError((error) => {
        console.log("error", error);
        rej(error);
      });

      rabbitMQ1.onReady(() => {
        const nerve1 = new Nerve<EmitConfig>("nerve1", [], rabbitMQ1);
        const nerve2 = new Nerve<EmitConfig>(
          "nerve2",
          [EventName.First],
          rabbitMQ1
        );

        const initialEvent = nerve1.event(EventName.First, {
          value: 1001,
        });

        nerve2.on(EventName.First, (event) => {
          expect(event.getData()).toEqual(initialEvent.getData());
          event.next();
          res(true);
        });

        initialEvent.emit();
      });
      rabbitMQ1.connect();
    });
  });

  it("Sends and receives a reply", () => {
    return new Promise((res, rej) => {
      const rabbitMQ1 = new RabbitMQTransmitter(
        "amqp://admin:admin@localhost:5672/",
        {
          durable: false,
          noAck: false,
        }
      );

      rabbitMQ1.onError((error) => {
        console.log("error", error);
        rej(error);
      });

      const response = { value: 2001 };

      rabbitMQ1.onReady(() => {
        const nerve1 = new Nerve<EmitConfig>(
          "nerve1",
          [EventName.First],
          rabbitMQ1
        );
        const nerve2 = new Nerve<EmitConfig>(
          "nerve2",
          [EventName.First],
          rabbitMQ1
        );

        const initialEvent = nerve1.event(EventName.First, {
          value: 1001,
        });

        nerve2.on(EventName.First, (event) => {
          expect(event.getData()).toEqual(initialEvent.getData());
          event.next(response);
        });

        initialEvent.emitForResponse().then((reply) => {
          expect(reply).toEqual(response);
          res("sd");
        });
      });

      rabbitMQ1.onError(() => {
        console.log("ERROR");
      });
      rabbitMQ1.connect();
    });
  });
});
