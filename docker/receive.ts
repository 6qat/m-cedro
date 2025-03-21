import amqp from "amqplib";

const QUEUE_NAME = "hello";
const RABBITMQ_URL = "amqp://myuser:mypassword@localhost";

async function receiveMessage() {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();

  await channel.assertQueue(QUEUE_NAME, { durable: false });

  console.log(`🚀 Waiting for messages in "${QUEUE_NAME}"...`);

  channel.consume(
    QUEUE_NAME,
    (msg) => {
      if (msg) {
        console.log(`📩 Received: ${msg.content.toString()}`);
      }
    },
    { noAck: true }
  );
}

receiveMessage();
