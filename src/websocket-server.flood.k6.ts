import ws from "k6/ws";
import { sleep } from "k6";

// https://grafana.com/docs/k6/latest/set-up/install-k6/
// bun add -d @types/k6
// k6 run src/websocket-server.flood.k6.ts

export const options = {
  vus: 5000,
  duration: "20s",
};

export default function () {
  const url = "ws://127.0.0.1:3030/";
  ws.connect(url, {}, (socket) => {
    socket.on("open", () => socket.send("ping"));
    socket.on("message", (m) => {});
    socket.setInterval(() => socket.send("ping"), 1000);
    // Close after 1s so this iteration completes
    socket.setTimeout(() => socket.close(), 2000);
  });
  sleep(1);
}
