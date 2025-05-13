import { supabase } from './supabase';

export enum EventType {
  LOGIN = 'login',
  LOGOUT = 'logout',
  FILE_SAVE = 'file_save',
  FILE_OPEN = 'file_open',
  EDITOR_CHANGE = 'editor_change',
  TEXT_SELECTION = 'text_selection',
  TOOLBAR_ACTION = 'toolbar_action',
  COMMENT_ADD = 'comment_add',
  COMMENT_EDIT = 'comment_edit',
  COMMENT_DELETE = 'comment_delete',
  INSIGHT_VIEW = 'insight_view',
  AI_INTERACTION = 'ai_interaction',
  ERROR = 'error'
}

export interface EventData {
  [key: string]: any;
}

/**
 * Logs a user event to Supabase
 * @param userId - The user's ID
 * @param eventType - The type of event
 * @param eventData - Additional data about the event
 * @param fileId - Optional file ID associated with the event
 * @returns Promise that resolves when the event is logged
 */
export async function logEvent(
  userId: string,
  eventType: EventType | string,
  eventData: EventData = {},
  fileId?: string
): Promise<void> {
  if (!userId) {
    console.warn('Attempted to log event without user ID');
    return;
  }

  // If fileId is not explicitly provided, try to get it from eventData
  if (!fileId && eventData.file_id) {
    fileId = eventData.file_id;
  }

  try {
    const { error } = await supabase
      .from('user_events')
      .insert([
        {
          user_id: userId,
          file_id: fileId,
          event_type: eventType,
          event_data: eventData
        }
      ]);

    if (error) {
      console.error('Error logging event:', error);
    }
  } catch (err) {
    console.error('Failed to log event:', err);
  }
}

/**
 * Batches events for more efficient logging
 */
export class EventBatcher {
  private userId: string;
  private batchedEvents: Array<{ 
    event_type: string; 
    event_data: EventData; 
    file_id?: string;
    timestamp: number 
  }> = [];
  private batchSize: number;
  private flushInterval: number;
  private timer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Creates a new EventBatcher
   * @param userId - The user's ID
   * @param batchSize - Maximum number of events to batch before flushing
   * @param flushIntervalMs - Maximum time to wait before flushing events in ms
   */
  constructor(userId: string, batchSize = 10, flushIntervalMs = 5000) {
    this.userId = userId;
    this.batchSize = batchSize;
    this.flushInterval = flushIntervalMs;
    this.startTimer();
  }

  /**
   * Adds an event to the batch
   * @param eventType - The type of event
   * @param eventData - Additional data about the event
   * @param fileId - Optional file ID associated with the event
   */
  public addEvent(
    eventType: EventType | string, 
    eventData: EventData = {},
    fileId?: string
  ): void {
    // If fileId is not explicitly provided, try to get it from eventData
    if (!fileId && eventData.file_id) {
      fileId = eventData.file_id;
    }
    
    this.batchedEvents.push({
      event_type: eventType,
      event_data: eventData,
      file_id: fileId,
      timestamp: Date.now()
    });

    if (this.batchedEvents.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Flushes all batched events to the database
   */
  public async flush(): Promise<void> {
    if (this.batchedEvents.length === 0) return;

    const eventsToSend = [...this.batchedEvents];
    this.batchedEvents = [];

    try {
      const { error } = await supabase
        .from('user_events')
        .insert(
          eventsToSend.map(event => ({
            user_id: this.userId,
            file_id: event.file_id,
            event_type: event.event_type,
            event_data: { ...event.event_data, timestamp: event.timestamp }
          }))
        );

      if (error) {
        console.error('Error logging batch of events:', error);
        // Put events back in the batch
        this.batchedEvents = [...eventsToSend, ...this.batchedEvents];
      }
    } catch (err) {
      console.error('Failed to log batch of events:', err);
      // Put events back in the batch
      this.batchedEvents = [...eventsToSend, ...this.batchedEvents];
    }
  }

  /**
   * Updates the user ID for the batcher
   * @param userId - The new user ID
   */
  public updateUserId(userId: string): void {
    // Flush any existing events first
    this.flush();
    this.userId = userId;
  }

  /**
   * Starts the timer to automatically flush events
   */
  private startTimer(): void {
    this.timer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Stops the timer and flushes any remaining events
   */
  public dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.flush();
  }
} 