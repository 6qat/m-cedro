import { createClient } from 'redis';

// Create publisher and subscriber clients
const publisher = createClient();
const subscriber = createClient();

// Handle connection errors
publisher.on('error', (err) =>
  console.log('Publisher Redis Client Error', err),
);
subscriber.on('error', (err) =>
  console.log('Subscriber Redis Client Error', err),
);

async function runExample() {
  await publisher.connect();
  await subscriber.connect();

  // Subscribe to a channel
  await subscriber.subscribe('news', (message) => {
    console.log('Received news:', message);
  });

  // Publish to the channel
  await publisher.publish('news', 'Breaking news: Redis is awesome!');
  await publisher.publish('news', 'Update: TypeScript works great with Redis');

  // Wait a bit to receive messages
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Clean up
  await subscriber.unsubscribe('news');
  await publisher.quit();
  await subscriber.quit();
}

runExample().catch(console.error);
