import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Helper functions for SQLite (matching Posty's implementation)
const uuid = {
  defaultFn: () => sql`lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('8901ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))`
};

const timestamp = {
  defaultNow: () => sql`datetime('now')`
};

const json = {
  defaultObject: () => sql`json('{}')`,
  defaultArray: () => sql`json('[]')`
};

// Tracks table (formerly layers)
export const tracks = sqliteTable('timeline_tracks', {
  id: text('id').primaryKey().$defaultFn(uuid.defaultFn),
  name: text('name').notNull(),
  type: text('type', { enum: ['planned', 'automation'] }).notNull(),
  order: integer('order').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(timestamp.defaultNow),
  updatedAt: text('updated_at').notNull().$defaultFn(timestamp.defaultNow),
}, (table) => ({
  orderIdx: index('timeline_tracks_order_idx').on(table.order),
}));

// Events table - stores both scheduled events AND automation-generated events
export const events = sqliteTable('timeline_events', {
  id: text('id').primaryKey().$defaultFn(uuid.defaultFn),
  trackId: text('track_id').references(() => tracks.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  platform: text('platform'),
  
  // Timing fields
  scheduledTime: text('scheduled_time').notNull(),
  generationTime: text('generation_time'),
  postTime: text('post_time'),
  
  // Content fields - using JSON strings for SQLite
  content: text('content').$defaultFn(json.defaultObject),
  agent: text('agent'),
  contentGenerated: integer('content_generated').notNull().default(0),
  approved: integer('approved').notNull().default(0),
  posted: integer('posted').notNull().default(0),
  
  // Status tracking
  status: text('status').default('pending'),
  generationStarted: integer('generation_started').default(0),
  
  // Metadata
  approvalVia: text('approval_via'),
  mcpTools: text('mcp_tools').$defaultFn(json.defaultArray),
  metadata: text('metadata').$defaultFn(json.defaultObject),
  
  // Automation fields
  automationId: text('automation_id'),
  eventType: text('event_type').default('scheduled'),
  automationContext: text('automation_context'),
  
  // File paths
  stateFolder: text('state_folder'),
  mediaPath: text('media_path'),
  
  // Timestamps
  createdAt: text('created_at').notNull().$defaultFn(timestamp.defaultNow),
  updatedAt: text('updated_at').notNull().$defaultFn(timestamp.defaultNow),
}, (table) => ({
  trackIdIdx: index('timeline_events_track_id_idx').on(table.trackId),
  scheduledTimeIdx: index('timeline_events_scheduled_time_idx').on(table.scheduledTime),
  platformIdx: index('timeline_events_platform_idx').on(table.platform),
  postedIdx: index('timeline_events_posted_idx').on(table.posted),
  statusIdx: index('timeline_events_status_idx').on(table.status),
  generationTimeIdx: index('timeline_events_generation_time_idx').on(table.generationTime),
  mediaPathIdx: index('timeline_events_media_path_idx').on(table.mediaPath),
}));

// Automations table - stores automation configurations
export const automations = sqliteTable('timeline_automations', {
  id: text('id').primaryKey().$defaultFn(uuid.defaultFn),
  trackId: text('track_id').references(() => tracks.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  
  // Automation configuration
  trigger: text('trigger').notNull().$defaultFn(json.defaultObject),
  actions: text('actions').notNull().$defaultFn(json.defaultObject),
  enabled: integer('enabled').notNull().default(1),
  
  // Old fields from PostgreSQL schema (kept for compatibility)
  checkPrompt: text('check_prompt'),
  checkInterval: text('check_interval'),
  doPrompt: text('do_prompt'),
  agent: text('agent'),
  platform: text('platform'),
  stateFolder: text('state_folder'),
  endCondition: text('end_condition'),
  stats: text('stats').$defaultFn(json.defaultObject),
  
  // Execution tracking
  lastRun: text('last_run'),
  nextRun: text('next_run'),
  state: text('state').$defaultFn(json.defaultObject),
  lastExecutedAt: text('last_executed_at'),
  nextRunAt: text('next_run_at'),
  
  // Timestamps
  createdAt: text('created_at').notNull().$defaultFn(timestamp.defaultNow),
  updatedAt: text('updated_at').notNull().$defaultFn(timestamp.defaultNow),
}, (table) => ({
  trackIdIdx: index('timeline_automations_track_id_idx').on(table.trackId),
  enabledIdx: index('timeline_automations_enabled_idx').on(table.enabled),
}));

// Type exports for TypeScript
export type Track = typeof tracks.$inferSelect;
export type NewTrack = typeof tracks.$inferInsert;

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

export type Automation = typeof automations.$inferSelect;
export type NewAutomation = typeof automations.$inferInsert;