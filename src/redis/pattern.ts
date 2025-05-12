import { createClient } from 'redis';

const subscriber = createClient();

subscriber.on('error', (err) => console.log('Redis Client Error', err));

async function patternMatchingExample() {
  await subscriber.connect();

  // Subscribe to all channels starting with 'sensor:'
  await subscriber.pSubscribe('news*', (message, channel) => {
    console.log(`Data from ${channel}: ${message}`);
  });

  // In another part of your application, you could publish to:
  // await publisher.publish('sensor:temperature', '22.5°C');
  // await publisher.publish('sensor:humidity', '45%');
}

patternMatchingExample().catch(console.error);
