import amqp from 'amqplib';

const QUEUE_NAME = 'hello';
const RABBITMQ_URL = 'amqp://myuser:mypassword@localhost';

async function sendMessage() {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();

  await channel.assertQueue(QUEUE_NAME, { durable: false });

  const message = 'Hello, RabbitMQ!';
  channel.sendToQueue(QUEUE_NAME, Buffer.from(message));

  console.log(`✅ Sent: ${message}`);

  setTimeout(() => {
    connection.close();
    process.exit(0);
  }, 500);
}

sendMessage();
