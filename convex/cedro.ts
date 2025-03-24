import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const sendRawMessage = mutation({
  args: {
    line: v.string(),
    nano: v.number(),
  },
  handler: async (ctx, args) => {
    // console.log("This TypeScript function is running on the server.");
    await ctx.db.insert("raw_messages", {
      line: args.line,
      nano: args.nano,
    });
  },
});

export const getRawMessages = query({
  args: {},
  handler: async (ctx) => {
    // Get most recent messages first
    const messages = await ctx.db.query("raw_messages").order("desc").take(50);
    // Reverse the list so that it's in a chronological order.
    return messages.reverse();
  },
});
