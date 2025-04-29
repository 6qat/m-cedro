import WebSocket from "ws";

async function flood(n: number, lifeMs = 10000) {
  const conns = new Array<WebSocket>();
  await Promise.all(
    Array.from(
      { length: n },
      (_, i) =>
        new Promise<void>((res) => {
          const ws = new WebSocket("ws://localhost:3000");
          ws.on("open", () => res());
          ws.on("error", () => res());
          conns.push(ws);
        })
    )
  );
  console.log(`✅ ${n} clients open`);
  // keep them alive for lifeMs then close
  setTimeout(() => {
    for (const ws of conns) {
      ws.close();
    }
    console.log("🏁 Done");
    process.exit(0);
  }, lifeMs);
}

flood(2500, 10000).catch(console.error);
