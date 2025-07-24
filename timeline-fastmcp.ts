#!/usr/bin/env node
import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { eq, and, asc, desc } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { tracks, events } from './schema.ts';
import {
  platformSchema,
  agentSchema,
  isoDateTimeSchema,
  contentSchema,
  trackResponseSchema,
  eventResponseSchema,
  type Platform,
  type Content
} from './schemas/validation.ts';

// Get workspace configuration
async function getWorkspaceConfig() {
  const workspacePath = process.env.POSTY_WORKSPACE || '/Users/derekalia/Documents/Posty Workspace';
  const configPath = path.join(workspacePath, '.posty', 'config.json');
  
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error('Failed to load workspace config: ' + error);
  }
}

// Database connection singleton
let dbInstance: ReturnType<typeof drizzle> | null = null;
let pgClient: Client | null = null;

async function getDb() {
  if (!dbInstance) {
    const config = await getWorkspaceConfig();
    
    pgClient = new Client({
      host: 'localhost',
      port: config.dbPort,
      user: 'posty',
      password: config.dbPassword,
      database: 'posty'
    });
    
    await pgClient.connect();
    dbInstance = drizzle(pgClient);
  }
  
  return dbInstance;
}

// Initialize FastMCP server
const mcp = new FastMCP({
  name: 'timeline-mcp',
  version: '2.1.0'
});

// Helper functions
function calculateGenerationTime(scheduledTime: Date): Date {
  return new Date(scheduledTime.getTime() - 30 * 60 * 1000); // 30 minutes before
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 100);
}

async function createMediaPath(trackName: string, eventName: string): Promise<string> {
  const trackFolderName = sanitizeFileName(trackName);
  const dateStr = new Date().toISOString().split('T')[0];
  const eventBaseName = sanitizeFileName(eventName).toLowerCase().replace(/_/g, '-');
  const eventFolderName = `${eventBaseName}-${dateStr}`;
  
  return path.join('tracks', trackFolderName, eventFolderName);
}

// Enhanced parameter schemas with better validation
const addScheduledEventParams = z.object({
  trackName: z.string().min(1, 'Track name cannot be empty').max(100, 'Track name too long'),
  eventName: z.string().min(1, 'Event name cannot be empty').max(200, 'Event name too long'),
  prompt: z.string().min(1, 'Prompt cannot be empty').max(5000, 'Prompt too long'),
  scheduledTime: isoDateTimeSchema.refine(
    (val) => new Date(val) > new Date(),
    { message: 'Scheduled time must be in the future' }
  ),
  platform: platformSchema.default('x'),
  agent: agentSchema
});


// Tool: Add scheduled event
mcp.addTool({
  name: 'timeline_add_scheduled_event',
  description: 'Add a scheduled event to a track. IMPORTANT: 1) Use the terminal MCP tool to get the current date/time (execute_command("date")) before scheduling events to ensure correct dates. 2) Use timeline_list_tracks first to check if a track with the same name already exists before creating events.',
  parameters: addScheduledEventParams,
  execute: async (params) => {
    const db = await getDb();
    
    try {
      // Validate params
      const validatedParams = addScheduledEventParams.parse(params);
      
      // Find or create track
      let track = await db.select().from(tracks)
        .where(and(eq(tracks.name, validatedParams.trackName), eq(tracks.type, 'planned')))
        .limit(1);
      
      if (track.length === 0) {
        const maxOrder = await db.select({ maxOrder: tracks.order })
          .from(tracks)
          .orderBy(desc(tracks.order))
          .limit(1);
        
        const newOrder = (maxOrder[0]?.maxOrder || 0) + 1;
        
        const [newTrack] = await db.insert(tracks).values({
          name: validatedParams.trackName,
          type: 'planned',
          order: newOrder
        }).returning();
        
        track = [newTrack];
      }
      
      // Create media folder path
      const mediaPath = await createMediaPath(validatedParams.trackName, validatedParams.eventName);
      
      // Create event
      const scheduledTime = new Date(validatedParams.scheduledTime);
      const generationTime = calculateGenerationTime(scheduledTime);
      
      const content: Content = {
        content: validatedParams.prompt,
        mentions: [],
        attachments: []
      };
      
      const [newEvent] = await db.insert(events).values({
        trackId: track[0].id,
        name: validatedParams.eventName,
        platform: validatedParams.platform,
        scheduledTime: scheduledTime,
        generationTime: generationTime,
        content: content,
        agent: validatedParams.agent,
        eventType: 'scheduled',
        mediaPath: mediaPath,
        contentGenerated: false,
        approved: false,
        posted: false
      }).returning();
      
      const response = {
        success: true,
        event: {
          id: newEvent.id,
          trackId: newEvent.trackId,
          name: newEvent.name,
          scheduledTime: newEvent.scheduledTime.toISOString(),
          generationTime: newEvent.generationTime?.toISOString(),
          mediaPath: newEvent.mediaPath,
          platform: newEvent.platform
        }
      };
      
      // Trigger a manual notification since we're using a separate connection
      // The PostgreSQL trigger will fire, but we need to ensure the app knows about it
      console.log('[MCP Timeline] Event created:', newEvent.id, newEvent.name);
      
      // Small delay to ensure notifications propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return JSON.stringify(response, null, 2);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return JSON.stringify({
          success: false,
          error: 'Validation error',
          details: error.errors
        }, null, 2);
      }
      throw error;
    }
  }
});


// Tool: List tracks with enhanced filtering
mcp.addTool({
  name: 'timeline_list_tracks',
  description: 'List all tracks',
  parameters: z.object({
    limit: z.number().int().positive().max(100).optional().default(50),
    offset: z.number().int().nonnegative().optional().default(0)
  }),
  execute: async (params) => {
    const db = await getDb();
    
    const results = await db.select().from(tracks)
      .where(eq(tracks.type, 'planned'))
      .orderBy(asc(tracks.order))
      .limit(params.limit)
      .offset(params.offset);
    
    const response = {
      tracks: results.map(track => trackResponseSchema.parse({
        id: track.id,
        name: track.name,
        type: 'schedule',
        order: track.order,
        createdAt: track.createdAt?.toISOString()
      })),
      pagination: {
        limit: params.limit,
        offset: params.offset,
        total: results.length
      }
    };
    
    return JSON.stringify(response, null, 2);
  }
});

// Tool: List scheduled events with enhanced filtering
mcp.addTool({
  name: 'timeline_list_scheduled_events',
  description: 'List scheduled events with optional filtering',
  parameters: z.object({
    trackId: z.string().uuid().optional(),
    status: z.enum(['all', 'pending', 'generated', 'posted']).optional().default('all'),
    platform: platformSchema.optional(),
    startDate: isoDateTimeSchema.optional(),
    endDate: isoDateTimeSchema.optional(),
    limit: z.number().int().positive().max(100).optional().default(50),
    offset: z.number().int().nonnegative().optional().default(0)
  }),
  execute: async (params) => {
    const db = await getDb();
    
    let whereConditions = [eq(events.eventType, 'scheduled')];
    
    if (params.trackId) {
      whereConditions.push(eq(events.trackId, params.trackId));
    }
    
    if (params.platform) {
      whereConditions.push(eq(events.platform, params.platform));
    }
    
    const results = await db.select({
      event: events,
      track: tracks
    })
    .from(events)
    .innerJoin(tracks, eq(events.trackId, tracks.id))
    .where(and(...whereConditions))
    .orderBy(asc(events.scheduledTime))
    .limit(params.limit)
    .offset(params.offset);
    
    // Apply additional filters
    const filtered = results.filter(({ event }) => {
      // Status filter
      if (params.status !== 'all') {
        if (params.status === 'posted' && !event.posted) return false;
        if (params.status === 'generated' && (!event.contentGenerated || event.posted)) return false;
        if (params.status === 'pending' && event.contentGenerated) return false;
      }
      
      // Date filters
      if (params.startDate && event.scheduledTime < new Date(params.startDate)) return false;
      if (params.endDate && event.scheduledTime > new Date(params.endDate)) return false;
      
      return true;
    });
    
    const response = {
      events: filtered.map(({ event, track }) => eventResponseSchema.parse({
        id: event.id,
        trackId: event.trackId,
        trackName: track.name,
        name: event.name,
        prompt: (event.content as Content).content,
        platform: event.platform,
        scheduledTime: event.scheduledTime.toISOString(),
        generationTime: event.generationTime?.toISOString(),
        status: event.posted ? 'posted' : (event.contentGenerated ? 'generated' : 'pending'),
        mediaPath: event.mediaPath,
        metadata: event.metadata
      })),
      pagination: {
        limit: params.limit,
        offset: params.offset,
        total: filtered.length
      }
    };
    
    return JSON.stringify(response, null, 2);
  }
});

// Tool: Update scheduled event with validation
mcp.addTool({
  name: 'timeline_update_scheduled_event',
  description: 'Update an existing scheduled event',
  parameters: z.object({
    eventId: z.string().uuid(),
    updates: z.object({
      name: z.string().min(1).max(200).optional(),
      prompt: z.string().min(1).max(5000).optional(),
      scheduledTime: isoDateTimeSchema.optional(),
      approved: z.boolean().optional(),
      platform: platformSchema.optional()
    }).refine(data => Object.keys(data).length > 0, {
      message: 'At least one update field must be provided'
    })
  }),
  execute: async (params) => {
    const db = await getDb();
    
    try {
      const updates: any = { updatedAt: new Date() };
      
      if (params.updates.name) updates.name = params.updates.name;
      if (params.updates.prompt) {
        updates.content = { content: params.updates.prompt, mentions: [], attachments: [] };
        updates.contentGenerated = false; // Reset generation status if prompt changes
      }
      if (params.updates.scheduledTime) {
        const newScheduledTime = new Date(params.updates.scheduledTime);
        if (newScheduledTime <= new Date()) {
          throw new Error('Scheduled time must be in the future');
        }
        updates.scheduledTime = newScheduledTime;
        updates.generationTime = calculateGenerationTime(newScheduledTime);
      }
      if (params.updates.approved !== undefined) updates.approved = params.updates.approved;
      if (params.updates.platform) updates.platform = params.updates.platform;
      
      const [updated] = await db.update(events)
        .set(updates)
        .where(eq(events.id, params.eventId))
        .returning();
      
      if (!updated) {
        return JSON.stringify({
          success: false,
          error: 'Event not found'
        }, null, 2);
      }
      
      return JSON.stringify({
        success: true,
        event: {
          id: updated.id,
          name: updated.name,
          scheduledTime: updated.scheduledTime.toISOString(),
          approved: updated.approved,
          platform: updated.platform
        }
      }, null, 2);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return JSON.stringify({
          success: false,
          error: 'Validation error',
          details: error.errors
        }, null, 2);
      }
      throw error;
    }
  }
});

// Tool: Remove scheduled event
mcp.addTool({
  name: 'timeline_remove_scheduled_event',
  description: 'Remove a scheduled event',
  parameters: z.object({
    eventId: z.string().uuid()
  }),
  execute: async (params) => {
    const db = await getDb();
    
    await db.delete(events).where(eq(events.id, params.eventId));
    
    return JSON.stringify({
      success: true,
      message: `Event ${params.eventId} removed successfully`
    }, null, 2);
  }
});

// Tool: Remove track
mcp.addTool({
  name: 'timeline_remove_track',
  description: 'Remove a track and all its associated events. WARNING: This will delete all events in the track.',
  parameters: z.object({
    trackId: z.string().uuid()
  }),
  execute: async (params) => {
    const db = await getDb();
    
    // Get track details before deletion
    const [track] = await db.select()
      .from(tracks)
      .where(eq(tracks.id, params.trackId))
      .limit(1);
    
    if (!track) {
      return JSON.stringify({
        success: false,
        message: `Track ${params.trackId} not found`
      }, null, 2);
    }
    
    // Get count of events that will be deleted
    const eventsInTrack = await db.select()
      .from(events)
      .where(eq(events.trackId, params.trackId));
    
    // Delete the track (cascade will handle events)
    await db.delete(tracks).where(eq(tracks.id, params.trackId));
    
    return JSON.stringify({
      success: true,
      message: `Track "${track.name}" removed successfully`,
      deletedEvents: eventsInTrack.length,
      trackType: track.type
    }, null, 2);
  }
});

// Cleanup function
process.on('SIGINT', async () => {
  if (pgClient) {
    await pgClient.end();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (pgClient) {
    await pgClient.end();
  }
  process.exit(0);
});

// Start the server
mcp.start({ transportType: 'stdio' });