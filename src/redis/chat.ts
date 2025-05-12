import { createClient } from 'redis';

class ChatService {
  private publisher = createClient();
  private subscriber = createClient();

  constructor() {
    this.publisher.on('error', console.error);
    this.subscriber.on('error', console.error);
  }

  async connect() {
    await this.publisher.connect();
    await this.subscriber.connect();
  }

  async joinRoom(
    userId: string,
    roomId: string,
    messageHandler: (message: string) => void,
  ) {
    const channel = `chat:${roomId}`;
    await this.subscriber.subscribe(channel, messageHandler);
    await this.publish(roomId, `User ${userId} joined the chat`);
  }

  async leaveRoom(userId: string, roomId: string) {
    const channel = `chat:${roomId}`;
    await this.publish(roomId, `User ${userId} left the chat`);
    await this.subscriber.unsubscribe(channel);
  }

  async publish(roomId: string, message: string) {
    await this.publisher.publish(`chat:${roomId}`, message);
  }

  async disconnect() {
    await this.publisher.quit();
    await this.subscriber.quit();
  }
}

// Usage example
async function chatExample() {
  const chat = new ChatService();
  await chat.connect();

  const roomId = 'general';
  const userId = 'user1';

  await chat.joinRoom(userId, roomId, (msg) => {
    console.log(`[Chat Message]: ${msg}`);
  });

  await chat.publish(roomId, 'Hello everyone!');

  // Later...
  await chat.leaveRoom(userId, roomId);
  await chat.disconnect();
}

chatExample().catch(console.error);
