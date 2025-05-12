import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const sendRawMessage = mutation({
  args: {
    line: v.string(),
    nano: v.number(),
  },
  handler: async (ctx, args) => {
    // console.log("This TypeScript function is running on the server.");
    await ctx.db.insert('raw_messages', {
      line: args.line,
      nano: args.nano,
    });
  },
});

export const deleteRawMessage = mutation({
  args: {
    line: v.string(),
  },
  handler: async (ctx, args) => {
    // Query for messages with the matching line using the by_line index
    const messages = await ctx.db
      .query('raw_messages')
      .withIndex('by_line', (q) => q.eq('line', args.line))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    return { success: true, message: 'Messages deleted successfully' };
  },
});

export const getRawMessages = query({
  args: {},
  handler: async (ctx) => {
    // Get most recent messages first
    const messages = await ctx.db.query('raw_messages').order('desc').take(50);
    // Reverse the list so that it's in a chronological order.
    return messages.reverse();
  },
});
