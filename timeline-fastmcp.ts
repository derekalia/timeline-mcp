#!/usr/bin/env node
import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { eq, and, asc, desc } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { tracks, events, postyAccounts } from './schema-sqlite.ts';
import {
  platformSchema,
  agentSchema,
  isoDateTimeSchema,
  trackResponseSchema,
  eventResponseSchema,
  type Platform
} from './schemas/validation.ts';
import { toSQLiteDate, fromSQLiteDate, prepareEventForDb, parseEventFromDb } from './date-helpers.ts';

// Get workspace path
function getWorkspacePath() {
  return process.env.POSTY_WORKSPACE;
}

// Get SQLite database path
function getDbPath() {
  const workspacePath = getWorkspacePath();
  return path.join(workspacePath, '.posty', 'workspace.db');
}

// Database connection singleton
let dbInstance: ReturnType<typeof drizzle> | null = null;
let sqliteDb: Database.Database | null = null;

async function getDb() {
  if (!dbInstance) {
    const dbPath = getDbPath();
    console.error('[Timeline MCP] Database path:', dbPath);
    
    // Ensure the directory exists
    const dbDir = path.dirname(dbPath);
    try {
      await fs.access(dbDir);
    } catch {
      console.error('[Timeline MCP] Creating database directory:', dbDir);
      await fs.mkdir(dbDir, { recursive: true });
    }
    
    // Check if database file exists
    try {
      await fs.access(dbPath);
    } catch {
      console.error('[Timeline MCP] Database file does not exist at:', dbPath);
    }
    
    try {
      sqliteDb = new Database(dbPath);
      dbInstance = drizzle(sqliteDb);
      console.error('[Timeline MCP] Database connection established');
    } catch (error) {
      console.error('[Timeline MCP] Failed to connect to database:', error);
      throw error;
    }
  }
  
  return dbInstance;
}

// Get default posty account ID
async function getDefaultPostyAccountId(): Promise<string> {
  const db = await getDb();

  // Note: Since postyAccounts only has id field in our schema stub,
  // we'll just get the first account or create one with a known ID
  const anyAccount = await db.select().from(postyAccounts).limit(1);

  if (anyAccount && anyAccount.length > 0) {
    return anyAccount[0].id;
  }

  // If no account exists, use a stable default ID
  // The actual account will be created by the main posty application
  return 'default-workspace-account';
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
  scheduledTime: isoDateTimeSchema,
  platform: platformSchema.default('x'),
  agent: agentSchema.optional().default('claude-sonnet-4-20250514'),
  approvalVia: z.string().optional().default('manual'),
  mcpTools: z.array(z.string()).optional().default(['timeline', 'fal', 'sqlite', 'playwright'])
});


// Tool: Add scheduled event
mcp.addTool({
  name: 'timeline_add_scheduled_event',
  description: 'Add a scheduled event to a track. IMPORTANT: 1) Use the terminal MCP tool to get the current date/time (execute_command("date")) before scheduling events to ensure correct dates. 2) ALWAYS use timeline_list_tracks first to check existing tracks - if a track with a similar name or purpose already exists, use that instead of creating a new one. If unsure whether an existing track matches your needs, ask the user for clarification before proceeding.',
  parameters: addScheduledEventParams,
  execute: async (params) => {
    console.error('[Timeline MCP] Add scheduled event called with params:', JSON.stringify(params, null, 2));
    
    const db = await getDb();
    
    try {
      // Validate params
      const validatedParams = addScheduledEventParams.parse(params);
      console.error('[Timeline MCP] Validated params:', JSON.stringify(validatedParams, null, 2));
      
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
        
        const trackId = uuidv4();
        const postyAccountId = await getDefaultPostyAccountId();
        await db.insert(tracks).values({
          id: trackId,
          postyAccountId,
          name: validatedParams.trackName,
          type: 'planned',
          order: newOrder
        });
        
        const [newTrack] = await db.select().from(tracks).where(eq(tracks.id, trackId));
        
        track = [newTrack];
      }
      
      // Generate event ID first
      const eventId = uuidv4();
      
      // Create media folder path
      const mediaPath = await createMediaPath(validatedParams.trackName, validatedParams.eventName);
      
      // Create the actual folder on disk
      const workspacePath = getWorkspacePath();
      const fullMediaPath = path.join(workspacePath, mediaPath);
      console.error('[Timeline MCP] Creating media folder:', fullMediaPath);
      
      try {
        await fs.mkdir(fullMediaPath, { recursive: true });
        
        // Create an info.json file with event metadata
        const infoFile = path.join(fullMediaPath, 'info.json');
        const info = {
          eventId: eventId,
          eventName: validatedParams.eventName,
          trackId: track[0].id,
          createdAt: new Date().toISOString()
        };
        await fs.writeFile(infoFile, JSON.stringify(info, null, 2));
        
        console.error('[Timeline MCP] Media folder created successfully with info.json');
      } catch (error) {
        console.error('[Timeline MCP] Error creating media folder:', error);
        // Continue even if folder creation fails
      }
      
      // Create event
      const scheduledTime = new Date(validatedParams.scheduledTime);
      const generationTime = calculateGenerationTime(scheduledTime);
      const postyAccountId = await getDefaultPostyAccountId();

      const eventData = prepareEventForDb({
        id: eventId,
        postyAccountId,
        trackId: track[0].id,
        name: validatedParams.eventName,
        platform: validatedParams.platform,
        scheduledTime: scheduledTime,
        generationTime: generationTime,
        prompt: validatedParams.prompt, // Store prompt string directly
        agent: validatedParams.agent,
        eventType: 'scheduled',
        mediaPath: mediaPath,
        mcpTools: JSON.stringify(validatedParams.mcpTools),
        approvalVia: validatedParams.approvalVia,
        contentGenerated: false,
        approved: false,
        posted: false
      });
      
      await db.insert(events).values(eventData);
      
      const [newEvent] = await db.select().from(events).where(eq(events.id, eventId));
      
      const response = {
        success: true,
        event: {
          id: newEvent.id,
          trackId: newEvent.trackId,
          name: newEvent.name,
          scheduledTime: newEvent.scheduledTime,
          generationTime: newEvent.generationTime,
          mediaPath: newEvent.mediaPath,
          platform: newEvent.platform
        }
      };
      
      // Log event creation
      console.log('[MCP Timeline] Event created:', newEvent.id, newEvent.name);
      
      return JSON.stringify(response, null, 2);
    } catch (error) {
      console.error('[Timeline MCP] Error in add_scheduled_event:', error);
      
      if (error instanceof z.ZodError) {
        return JSON.stringify({
          success: false,
          error: 'Validation error',
          details: error.errors
        }, null, 2);
      }
      
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        stack: error instanceof Error ? error.stack : undefined
      }, null, 2);
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
    console.error('[Timeline MCP] List tracks called');
    
    try {
      const db = await getDb();
      
      const results = await db.select().from(tracks)
        .where(eq(tracks.type, 'planned'))
        .orderBy(asc(tracks.order))
        .limit(params.limit)
        .offset(params.offset);
      
      console.error('[Timeline MCP] Found tracks:', results.length);
      
      const response = {
        tracks: results.map(track => trackResponseSchema.parse({
          id: track.id,
          name: track.name,
          type: 'schedule',
          order: track.order,
          createdAt: track.createdAt
        })),
        pagination: {
          limit: params.limit,
          offset: params.offset,
          total: results.length
        }
      };
      
      return JSON.stringify(response, null, 2);
    } catch (error) {
      console.error('[Timeline MCP] Error in list_tracks:', error);
      
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        stack: error instanceof Error ? error.stack : undefined
      }, null, 2);
    }
  }
});

// Tool: Add a new track
mcp.addTool({
  name: 'timeline_add_track',
  description: 'Create a new track for organizing timeline events. Check existing tracks with timeline_list_tracks first to avoid duplicates.',
  parameters: z.object({
    name: z.string().min(1, 'Track name cannot be empty').max(100, 'Track name too long'),
    type: z.enum(['planned', 'automation']).optional().default('planned'),
    order: z.number().int().optional().describe('Optional order position. If not provided, will be added at the end.')
  }),
  execute: async (params) => {
    console.error('[Timeline MCP] Add track called with params:', params);
    
    try {
      const db = await getDb();
      
      // Check if track with same name already exists
      const existingTrack = await db.select().from(tracks)
        .where(and(
          eq(tracks.name, params.name),
          eq(tracks.type, params.type)
        ))
        .limit(1);
      
      if (existingTrack.length > 0) {
        return JSON.stringify({
          success: false,
          error: `Track "${params.name}" with type "${params.type}" already exists`,
          existingTrack: trackResponseSchema.parse({
            id: existingTrack[0].id,
            name: existingTrack[0].name,
            type: params.type === 'automation' ? 'automation' : 'schedule',
            order: existingTrack[0].order,
            createdAt: existingTrack[0].createdAt
          })
        }, null, 2);
      }
      
      // Determine order
      let order = params.order;
      if (order === undefined) {
        // Get the maximum order and add 1
        const maxOrder = await db.select({ maxOrder: tracks.order })
          .from(tracks)
          .orderBy(desc(tracks.order))
          .limit(1);
        
        order = (maxOrder[0]?.maxOrder || 0) + 1;
      }
      
      // Create new track
      const trackId = uuidv4();
      const now = new Date().toISOString();
      const postyAccountId = await getDefaultPostyAccountId();

      await db.insert(tracks).values({
        id: trackId,
        postyAccountId,
        name: params.name,
        type: params.type,
        order: order,
        createdAt: now,
        updatedAt: now
      });
      
      // Fetch the created track
      const [newTrack] = await db.select().from(tracks).where(eq(tracks.id, trackId));
      
      if (!newTrack) {
        throw new Error('Failed to create track');
      }
      
      // Create track folder on disk
      const workspacePath = getWorkspacePath();
      const trackFolderName = sanitizeFileName(params.name);
      const trackFolderPath = path.join(workspacePath, 'tracks', trackFolderName);
      
      try {
        await fs.mkdir(trackFolderPath, { recursive: true });
        console.error('[Timeline MCP] Created track folder:', trackFolderPath);
        
        // Create a track info file
        const trackInfoFile = path.join(trackFolderPath, '.track-info.json');
        const trackInfo = {
          id: trackId,
          name: params.name,
          type: params.type,
          order: order,
          createdAt: now,
          folderName: trackFolderName
        };
        await fs.writeFile(trackInfoFile, JSON.stringify(trackInfo, null, 2));
      } catch (folderError) {
        console.error('[Timeline MCP] Warning: Could not create track folder:', folderError);
        // Continue anyway - folder creation is not critical
      }
      
      const response = {
        success: true,
        track: trackResponseSchema.parse({
          id: newTrack.id,
          name: newTrack.name,
          type: params.type === 'automation' ? 'automation' : 'schedule',
          order: newTrack.order,
          createdAt: newTrack.createdAt
        }),
        message: `Track "${params.name}" created successfully`
      };
      
      console.error('[Timeline MCP] Track created successfully:', response);
      return JSON.stringify(response, null, 2);
      
    } catch (error) {
      console.error('[Timeline MCP] Error in add_track:', error);
      
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        stack: error instanceof Error ? error.stack : undefined
      }, null, 2);
    }
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
      if (params.startDate && new Date(event.scheduledTime) < new Date(params.startDate)) return false;
      if (params.endDate && new Date(event.scheduledTime) > new Date(params.endDate)) return false;
      
      return true;
    });
    
    const response = {
      events: filtered.map(({ event, track }) => {
        const parsedEvent = parseEventFromDb(event);
        return eventResponseSchema.parse({
          id: parsedEvent.id,
          trackId: parsedEvent.trackId,
          trackName: track.name,
          name: parsedEvent.name,
          prompt: parsedEvent.prompt, // Now using prompt field
          platform: parsedEvent.platform,
          scheduledTime: parsedEvent.scheduledTime?.toISOString(),
          generationTime: parsedEvent.generationTime?.toISOString(),
          status: parsedEvent.posted ? 'posted' : (parsedEvent.contentGenerated ? 'generated' : 'pending'),
          mediaPath: parsedEvent.mediaPath,
          generationSessionId: parsedEvent.generationSessionId,
          postingSessionId: parsedEvent.postingSessionId,
          generationStartedAt: parsedEvent.generationStartedAt?.toISOString(),
          approvalRequestedAt: parsedEvent.approvalRequestedAt?.toISOString(),
          error: parsedEvent.error,
          postedUrl: parsedEvent.postedUrl
        });
      }),
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
        updates.prompt = params.updates.prompt; // Store prompt string directly
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
      
      // Convert dates and booleans for SQLite
      const dbUpdates = prepareEventForDb(updates);
      
      await db.update(events)
        .set(dbUpdates)
        .where(eq(events.id, params.eventId));
        
      const [updated] = await db.select().from(events).where(eq(events.id, params.eventId));
      
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
          scheduledTime: updated.scheduledTime,
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
process.on('SIGINT', () => {
  if (sqliteDb) {
    sqliteDb.close();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (sqliteDb) {
    sqliteDb.close();
  }
  process.exit(0);
});

// Start the server
mcp.start({ transportType: 'stdio' });