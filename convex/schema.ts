import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  raw_messages: defineTable({
    line: v.string(),
    nano: v.number(),
  }).index('by_line', ['line']),
});
