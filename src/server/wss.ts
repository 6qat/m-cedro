import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";

class Note {
  constructor(public data: string[] = ["Moonhalo"]) {}
}

const app = new Elysia()
  .use(swagger())
  .decorate("note", new Note())
  .get("/note", ({ note }) => note.data)
  .get(
    "/note/:index",
    ({ note, params: { index } }) => {
      return note.data[index];
    },
    {
      params: t.Object({
        index: t.Number(),
      }),
    }
  )
  // .onError(({ code, error }) => {
  //   if (code === "NOT_FOUND") {
  //     return {
  //       success: false,
  //       status: 404,
  //       message: "Route not found. Available routes: /note, /note/:index",
  //       error: error.message,
  //     };
  //   }
  // })
  // .all("/*", () => {
  //   throw new Error("Route not found");
  // })
  .listen(3000);

export default app;
