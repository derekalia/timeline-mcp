import { pgTable, uuid, text, timestamp, jsonb, pgSchema, boolean, integer } from 'drizzle-orm/pg-core';

// Create timeline schema
export const timelineSchema = pgSchema('timeline');

// Tracks table (formerly layers)
export const tracks = timelineSchema.table('tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'planned' or 'automation'
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Automations table - stores automation configurations
export const automations = timelineSchema.table('automations', {
  id: uuid('id').primaryKey().defaultRandom(),
  trackId: uuid('track_id').notNull().references(() => tracks.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  checkPrompt: text('check_prompt').notNull(),
  checkInterval: text('check_interval').notNull(), // "30m", "1h", or cron expression
  doPrompt: text('do_prompt').notNull(),
  agent: text('agent').default('assistant'),
  platform: text('platform').default('x'),
  enabled: boolean('enabled').default(true),
  stateFolder: text('state_folder'), // e.g. "twitter-dm-support"
  endCondition: jsonb('end_condition'), // { type: 'executions' | 'date' | 'days', value: number | string }
  stats: jsonb('stats').default({ totalExecutions: 0, successCount: 0, failureCount: 0 }),
  lastExecutedAt: timestamp('last_executed_at'),
  nextRunAt: timestamp('next_run_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Events table - stores both scheduled events AND automation-generated events
export const events = timelineSchema.table('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  trackId: uuid('track_id').notNull().references(() => tracks.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  platform: text('platform').notNull(), // 'x.com', 'linkedin', etc.
  scheduledTime: timestamp('scheduled_time').notNull(),
  generationTime: timestamp('generation_time'),
  postTime: timestamp('post_time'),
  content: jsonb('content').notNull(), // { content: string, mentions: string[], attachments: string[] }
  agent: text('agent').default('anthropic/claude-opus-4'),
  contentGenerated: boolean('content_generated').default(false),
  approved: boolean('approved').default(false),
  posted: boolean('posted').default(false),
  approvalVia: text('approval_via').default('discord'),
  mcpTools: jsonb('mcp_tools').default(['timeline']),
  metadata: jsonb('metadata'), // Additional flexible data
  
  // Fields for automation-generated events
  automationId: uuid('automation_id').references(() => automations.id, { onDelete: 'set null' }),
  eventType: text('event_type').default('scheduled'), // 'scheduled' | 'automation_generated'
  automationContext: jsonb('automation_context'), // {triggerData, queryResult, etc}
  stateFolder: text('state_folder'), // Can be used by any event for file storage
  mediaPath: text('media_path'), // Path to folder containing generated media files
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});