import { Elysia, t } from "elysia";
import { note } from "./note";

// Define a minimal interface for Elysia's WebSocket
interface ElysiaWebSocket {
  send: (data: string | Uint8Array) => void;
  close: () => void;
}

// Store connected WebSocket clients
const connectedClients = new Set<ElysiaWebSocket>();

const app = new Elysia()
  .use(note)
  // Add WebSocket endpoint for Cedro data
  .ws("/cedro", {
    open(ws) {
      console.log("WebSocket client connected");
      connectedClients.add(ws);
    },
    close(ws) {
      console.log("WebSocket client disconnected");
      connectedClients.delete(ws);
    },
    message(ws, message) {
      console.log("Received message:", message);
      // Echo back the message for testing
      ws.send(`Echo: ${message}`);
    },
  })
  // Add an HTTP endpoint to send messages to all connected WebSocket clients
  .post(
    "/broadcast",
    ({ body }) => {
      const message = body;
      broadcastToClients(message.message);
      return { success: true, clientCount: connectedClients.size };
    },
    {
      body: t.Object({
        message: t.String(),
      }),
    }
  )
  .listen(3000);

// Function to broadcast a message to all connected WebSocket clients
function broadcastToClients(message: string) {
  console.log(`Broadcasting to ${connectedClients.size} clients:`, message);
  for (const client of connectedClients) {
    client.send(message);
  }
}

// Export a function to send messages from other parts of the application
export function sendMessageToClients(message: string) {
  broadcastToClients(message);
}

console.log(` Elysia server is running at ${app.server?.hostname}:${app.server?.port}`);

export default app;
