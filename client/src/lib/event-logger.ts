import { supabase } from './supabase';

export enum EventType {
  LOGIN = 'login',
  LOGOUT = 'logout',
  FILE_SAVE = 'file_save',
  FILE_OPEN = 'file_open',
  FLOW_MODE_ENTER = 'flow_mode_enter',
  FLOW_MODE_EXIT = 'flow_mode_exit',
  WRITE_MODE_ENTER = 'write_mode_enter',
  WRITE_MODE_EXIT = 'write_mode_exit',
  FEEDBACK_MODE_ENTER = 'feedback_mode_enter',
  FEEDBACK_MODE_EXIT = 'feedback_mode_exit',
  EDITOR_CHANGE = 'editor_change',
  TEXT_SELECTION = 'text_selection',
  TOOLBAR_ACTION = 'toolbar_action',
  COMMENT_ADD = 'comment_add',
  COMMENT_EDIT = 'comment_edit',
  COMMENT_DELETE = 'comment_delete',
  INSIGHT_VIEW = 'insight_view',
  AI_INTERACTION = 'ai_interaction',
  FEEDBACK_REQUEST = 'feedback_request',
  FEEDBACK_ANALYSIS_START = 'feedback_analysis_start',
  FEEDBACK_ANALYSIS_COMPLETE = 'feedback_analysis_complete',
  CUSTOM_ANALYSIS_START = 'custom_analysis_start',
  CUSTOM_ANALYSIS_COMPLETE = 'custom_analysis_complete',
  FLOW_SENTENCE_HOVER = 'flow_sentence_hover',
  FLOW_SENTENCE_CLICK = 'flow_sentence_click',
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

  // Add console logging for monitoring
  console.log('📊 Logging event:', {
    eventType,
    userId: userId.substring(0, 8) + '...',
    fileId: fileId ? fileId.substring(0, 8) + '...' : 'none',
    eventData: {
      ...eventData,
      // Truncate long text fields for console readability
      sentence_text: eventData.sentence_text ?
        eventData.sentence_text.toString().substring(0, 50) + '...' : undefined,
      sentence_preview: eventData.sentence_preview ?
        eventData.sentence_preview.toString().substring(0, 30) + '...' : undefined
    }
  });

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
      console.error('❌ Error logging event:', error);
      console.error('Event details:', { eventType, userId, fileId, eventData });
    } else {
      console.log('✅ Event logged successfully:', eventType);
    }
  } catch (err) {
    console.error('❌ Failed to log event:', err);
    console.error('Event details:', { eventType, userId, fileId, eventData });
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

/**
 * Debug function to test event logging from browser console
 * Usage: window.testEventLogging()
 */
export function testEventLogging(userId = 'test-user-id', fileId = 'test-file-id') {
  console.log('🧪 Testing event logging...');

  logEvent(userId, EventType.FLOW_SENTENCE_HOVER, {
    sentence_text: 'This is a test sentence for hover logging.',
    sentence_id: 'test-sentence-123',
    connection_strength: 0.75,
    hover_time: new Date().toISOString(),
    sentence_length: 42,
    sentence_preview: 'This is a test sentence for hover...'
  }, fileId);

  setTimeout(() => {
    logEvent(userId, EventType.FLOW_SENTENCE_CLICK, {
      sentence_text: 'This is a test sentence for click logging.',
      sentence_id: 'test-sentence-456',
      connection_strength: 0.85,
      click_time: new Date().toISOString(),
      sentence_length: 43,
      sentence_preview: 'This is a test sentence for click...',
      action: 'enter_flow_sentence_mode'
    }, fileId);
  }, 1000);

  console.log('🧪 Test events sent! Check console and database.');
}

/**
 * Debug function to check recent events from browser console
 * Usage: window.checkRecentEvents()
 */
export async function checkRecentEvents(limit = 10) {
  console.log('🔍 Checking recent events...');

  try {
    const { data, error } = await supabase
      .from('user_events')
      .select(`
        id,
        event_type,
        event_data,
        created_at,
        users!inner(prolific_id)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error fetching events:', error);
      return;
    }

    console.table(data?.map(event => ({
      time: new Date(event.created_at).toLocaleTimeString(),
      type: event.event_type,
      user: (event.users as any)?.prolific_id || 'unknown',
      data_preview: event.event_data?.sentence_preview ||
        event.event_data?.analysis_type ||
        JSON.stringify(event.event_data).substring(0, 50) + '...'
    })));

    console.log('📊 Full event data:', data);
    return data;
  } catch (err) {
    console.error('❌ Failed to fetch events:', err);
  }
}

// Expose debug functions to window for console access
if (typeof window !== 'undefined') {
  (window as any).testEventLogging = testEventLogging;
  (window as any).checkRecentEvents = checkRecentEvents;
  (window as any).logEvent = logEvent;
  (window as any).EventType = EventType;
} 