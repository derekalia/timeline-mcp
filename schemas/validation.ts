import { z } from 'zod';

// Common schemas
export const platformSchema = z.enum(['x', 'linkedin', 'instagram', 'threads', 'bluesky']);
export const agentSchema = z.string().default('anthropic/claude-3-opus');
export const trackTypeSchema = z.enum(['planned']);
export const eventTypeSchema = z.enum(['scheduled']);

// ISO datetime validation
export const isoDateTimeSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid ISO 8601 datetime format' }
);

// Content schema
export const contentSchema = z.object({
  content: z.string(),
  mentions: z.array(z.string()).default([]),
  attachments: z.array(z.string()).default([])
});


// Track schema
export const trackSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Track name is required'),
  type: trackTypeSchema,
  order: z.number().int().min(0),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

// Event schema
export const eventSchema = z.object({
  id: z.string().uuid(),
  trackId: z.string().uuid(),
  name: z.string().min(1, 'Event name is required'),
  platform: platformSchema,
  scheduledTime: z.date(),
  generationTime: z.date().optional(),
  postTime: z.date().optional(),
  content: contentSchema,
  agent: agentSchema,
  contentGenerated: z.boolean().default(false),
  approved: z.boolean().default(false),
  posted: z.boolean().default(false),
  approvalVia: z.string().default('discord'),
  mcpTools: z.array(z.string()).default(['timeline']),
  metadata: z.record(z.any()).optional(),
  eventType: eventTypeSchema,
  stateFolder: z.string().optional(),
  mediaPath: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});


// Response schemas for API responses
export const trackResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['schedule']),
  order: z.number(),
  createdAt: z.string().optional()
});

export const eventResponseSchema = z.object({
  id: z.string(),
  trackId: z.string(),
  trackName: z.string().optional(),
  name: z.string(),
  prompt: z.string(),
  platform: z.string(),
  scheduledTime: z.string(),
  generationTime: z.string().optional(),
  status: z.enum(['pending', 'generated', 'posted']),
  mediaPath: z.string().optional(),
  metadata: z.record(z.any()).optional()
});


// Type exports
export type Platform = z.infer<typeof platformSchema>;
export type TrackType = z.infer<typeof trackTypeSchema>;
export type EventType = z.infer<typeof eventTypeSchema>;
export type Content = z.infer<typeof contentSchema>;
export type Track = z.infer<typeof trackSchema>;
export type Event = z.infer<typeof eventSchema>;
export type TrackResponse = z.infer<typeof trackResponseSchema>;
export type EventResponse = z.infer<typeof eventResponseSchema>;