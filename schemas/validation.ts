import { z } from 'zod';

// Common schemas
export const platformSchema = z.enum(['x', 'linkedin', 'instagram', 'threads', 'bluesky', 'reddit']);
export const agentSchema = z.string().default('claude-sonnet-4-5-20250929');
export const trackTypeSchema = z.enum(['planned']);
export const eventTypeSchema = z.enum(['scheduled']);

// ISO datetime validation
export const isoDateTimeSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid ISO 8601 datetime format' }
);

// Content schema - DEPRECATED, keeping for backward compatibility
// Now we just use a string for prompt
export const contentSchema = z.object({
  content: z.string(),
  mentions: z.array(z.string()).default([]),
  attachments: z.array(z.string()).default([]),
  quoteTweetUrl: z.string().optional() // URL of tweet to quote (for X/Twitter quote tweets)
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
  prompt: z.string(), // Now using prompt string directly
  agent: agentSchema,
  contentGenerated: z.boolean().default(false),
  approved: z.boolean().default(false),
  posted: z.boolean().default(false),
  approvalVia: z.string().default('manual'),
  mcpTools: z.array(z.string()).default(['timeline', 'fal', 'sqlite', 'playwright']),
  metadata: z.record(z.any()).optional(), // Platform-specific metadata (e.g., target subreddit)
  generationSessionId: z.string().nullable().optional(),
  postingSessionId: z.string().nullable().optional(),
  generationStartedAt: z.date().nullable().optional(),
  approvalRequestedAt: z.date().nullable().optional(),
  error: z.string().nullable().optional(),
  postedUrl: z.string().nullable().optional(),
  eventType: eventTypeSchema,
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
  prompt: z.string(),  // Now using prompt field
  platform: z.string(),
  scheduledTime: z.string(),  // ISO string for API response
  generationTime: z.string().optional(),  // ISO string for API response
  status: z.enum(['pending', 'generated', 'posted']),
  mediaPath: z.string().optional(),
  metadata: z.record(z.any()).optional(), // Platform-specific metadata
  generationSessionId: z.string().nullable().optional(),
  postingSessionId: z.string().nullable().optional(),
  generationStartedAt: z.string().optional(),  // ISO string for API response
  approvalRequestedAt: z.string().optional(),  // ISO string for API response
  error: z.string().nullable().optional(),
  postedUrl: z.string().nullable().optional()
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