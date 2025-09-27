/**
 * Helper functions for date handling in timeline-mcp
 * SQLite stores dates as strings, but we use Date types in our schemas
 */

/**
 * Convert a value to ISO string for SQLite storage
 * Handles Date objects, strings, null, and undefined
 */
export function toSQLiteDate(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  // If it's already a string, validate it's a valid date
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return null;
}

/**
 * Parse a date string from SQLite to a Date object
 */
export function fromSQLiteDate(value: string | null | undefined): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Prepare event data for SQLite storage
 * Converts all Date fields to ISO strings
 */
export function prepareEventForDb(event: any): any {
  const prepared = { ...event };
  
  // Convert date fields to ISO strings
  if (prepared.scheduledTime) prepared.scheduledTime = toSQLiteDate(prepared.scheduledTime);
  if (prepared.generationTime) prepared.generationTime = toSQLiteDate(prepared.generationTime);
  if (prepared.postTime) prepared.postTime = toSQLiteDate(prepared.postTime);
  if (prepared.generationStartedAt) prepared.generationStartedAt = toSQLiteDate(prepared.generationStartedAt);
  if (prepared.approvalRequestedAt) prepared.approvalRequestedAt = toSQLiteDate(prepared.approvalRequestedAt);
  if (prepared.createdAt) prepared.createdAt = toSQLiteDate(prepared.createdAt);
  if (prepared.updatedAt) prepared.updatedAt = toSQLiteDate(prepared.updatedAt);
  
  // Convert boolean fields to 0/1 for SQLite
  if (typeof prepared.contentGenerated === 'boolean') {
    prepared.contentGenerated = prepared.contentGenerated ? 1 : 0;
  }
  if (typeof prepared.approved === 'boolean') {
    prepared.approved = prepared.approved ? 1 : 0;
  }
  if (typeof prepared.posted === 'boolean') {
    prepared.posted = prepared.posted ? 1 : 0;
  }
  if (typeof prepared.generationStarted === 'boolean') {
    prepared.generationStarted = prepared.generationStarted ? 1 : 0;
  }
  
  return prepared;
}

/**
 * Parse event data from SQLite
 * Converts date strings to Date objects and integers to booleans
 */
export function parseEventFromDb(event: any): any {
  if (!event) return null;
  
  const parsed = { ...event };
  
  // Convert date strings to Date objects
  parsed.scheduledTime = fromSQLiteDate(event.scheduledTime);
  parsed.generationTime = fromSQLiteDate(event.generationTime);
  parsed.postTime = fromSQLiteDate(event.postTime);
  parsed.generationStartedAt = fromSQLiteDate(event.generationStartedAt);
  parsed.approvalRequestedAt = fromSQLiteDate(event.approvalRequestedAt);
  parsed.createdAt = fromSQLiteDate(event.createdAt);
  parsed.updatedAt = fromSQLiteDate(event.updatedAt);
  
  // Convert SQLite integers to booleans
  parsed.contentGenerated = event.contentGenerated === 1;
  parsed.approved = event.approved === 1;
  parsed.posted = event.posted === 1;
  parsed.generationStarted = event.generationStarted === 1;
  
  return parsed;
}