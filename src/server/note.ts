import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";

class Note {
  constructor(public data: string[] = ["Moonhalo"]) {}
  add(note: string) {
    this.data.push(note);
    return this.data;
  }

  remove(index: number) {
    return this.data.splice(index, 1);
  }

  update(index: number, note: string) {
    return this.data[index] === note;
  }
}

export const note = new Elysia({
  prefix: "/note",
})
  .use(swagger())
  .decorate("note", new Note())
  .get("/", ({ note }) => note.data)
  .put("/", ({ note, body: { data } }) => note.add(data), {
    body: t.Object({
      data: t.String(),
    }),
  })
  .get(
    "/:index",
    ({ note, params: { index }, error }) => {
      return note.data[index] ?? error(404, "Note not found");
    },
    {
      params: t.Object({
        index: t.Number(),
      }),
    }
  )
  .delete(
    "/:index",
    ({ note, params: { index }, error }) => {
      if (index in note.data) return note.remove(index);

      return error(422);
    },
    {
      params: t.Object({
        index: t.Number(),
      }),
    }
  )
  .patch(
    "/:index",
    ({ note, params: { index }, body: { data }, error }) => {
      if (index in note.data) return note.update(index, data);

      return error(422);
    },
    {
      params: t.Object({
        index: t.Number(),
      }),
      body: t.Object({
        data: t.String(),
      }),
    }
  );
