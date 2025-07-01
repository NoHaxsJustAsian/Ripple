# Feedback Action Logging Implementation

## Overview
Added comprehensive Supabase logging for feedback analysis actions to track user interactions with the AI feedback system.

## What's Logged

### 1. Feedback Request Events
- **Event Type**: `FEEDBACK_REQUEST`
- **Triggered**: When user clicks "Check everything" or "Check custom selection"
- **Data Logged**:
  ```typescript
  {
    analysis_type: 'all' | 'custom',
    request_time: string (ISO timestamp),
    user_id: string,
    file_id?: string
  }
  ```

### 2. Analysis Start Events
- **Event Type**: `FEEDBACK_ANALYSIS_START`
- **Triggered**: When analysis begins processing
- **Data Logged**:
  ```typescript
  {
    analysis_type: 'all' | 'custom',
    start_time: string (ISO timestamp),
    user_id: string,
    file_id?: string
  }
  ```

### 3. Analysis Completion Events
- **Event Type**: `FEEDBACK_ANALYSIS_COMPLETE`
- **Triggered**: When analysis completes (success or failure)
- **Data Logged**:
  ```typescript
  {
    analysis_type: 'all' | 'custom',
    completion_time: string (ISO timestamp),
    comments_generated: number,
    flow_highlights_generated: number,
    success: boolean,
    error?: string, // Only included if success is false
    user_id: string,
    file_id?: string
  }
  ```

### 4. Flow Sentence Hover Events
- **Event Type**: `FLOW_SENTENCE_HOVER`
- **Triggered**: When user hovers over a highlighted sentence in flow mode
- **Data Logged**:
  ```typescript
  {
    sentence_text: string, // Complete sentence text
    sentence_id: string, // Unique sentence identifier
    connection_strength: number, // AI-determined connection strength (0-1)
    hover_time: string (ISO timestamp),
    sentence_length: number, // Character count
    sentence_preview: string, // First 100 characters for quick review
    user_id: string,
    file_id?: string
  }
  ```

### 5. Flow Sentence Click Events
- **Event Type**: `FLOW_SENTENCE_CLICK`
- **Triggered**: When user clicks on a highlighted sentence in flow mode
- **Data Logged**:
  ```typescript
  {
    sentence_text: string, // Complete sentence text
    sentence_id: string, // Unique sentence identifier
    connection_strength: number, // AI-determined connection strength (0-1)
    click_time: string (ISO timestamp),
    sentence_length: number, // Character count
    sentence_preview: string, // First 100 characters for quick review
    action: string, // What the click action does ('enter_flow_sentence_mode')
    user_id: string,
    file_id?: string
  }
  ```

## Database Storage

Events are stored in the existing `user_events` table:

```sql
CREATE TABLE user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## SQL Queries for Analysis

### Basic Usage Analytics
```sql
-- Count feedback requests by type
SELECT 
  event_data->>'analysis_type' as analysis_type,
  COUNT(*) as request_count
FROM user_events 
WHERE event_type = 'feedback_request'
GROUP BY event_data->>'analysis_type';

-- Average time to completion
SELECT 
  event_data->>'analysis_type' as analysis_type,
  AVG(
    EXTRACT(EPOCH FROM 
      (complete.event_data->>'completion_time')::timestamp - 
      (start.event_data->>'start_time')::timestamp
    )
  ) as avg_duration_seconds
FROM user_events start
JOIN user_events complete ON 
  start.user_id = complete.user_id 
  AND start.file_id = complete.file_id
  AND start.event_data->>'analysis_type' = complete.event_data->>'analysis_type'
WHERE start.event_type = 'feedback_analysis_start'
  AND complete.event_type = 'feedback_analysis_complete'
  AND (complete.event_data->>'success')::boolean = true
GROUP BY event_data->>'analysis_type';
```

### User Behavior Analysis
```sql
-- Most active users
SELECT 
  u.prolific_id,
  COUNT(CASE WHEN e.event_type = 'feedback_request' THEN 1 END) as total_requests,
  COUNT(CASE WHEN e.event_type = 'feedback_request' AND e.event_data->>'analysis_type' = 'all' THEN 1 END) as full_doc_requests,
  COUNT(CASE WHEN e.event_type = 'feedback_request' AND e.event_data->>'analysis_type' = 'custom' THEN 1 END) as custom_requests
FROM users u
LEFT JOIN user_events e ON u.id = e.user_id
WHERE e.event_type = 'feedback_request'
GROUP BY u.prolific_id
ORDER BY total_requests DESC;

-- Success rates
SELECT 
  event_data->>'analysis_type' as analysis_type,
  COUNT(*) as total_attempts,
  COUNT(CASE WHEN (event_data->>'success')::boolean = true THEN 1 END) as successful,
  ROUND(
    COUNT(CASE WHEN (event_data->>'success')::boolean = true THEN 1 END) * 100.0 / COUNT(*), 
    2
  ) as success_rate_percent
FROM user_events 
WHERE event_type = 'feedback_analysis_complete'
GROUP BY event_data->>'analysis_type';
```

### Content Generation Analytics
```sql
-- Average comments generated per analysis
SELECT 
  event_data->>'analysis_type' as analysis_type,
  AVG((event_data->>'comments_generated')::int) as avg_comments,
  AVG((event_data->>'flow_highlights_generated')::int) as avg_flow_highlights
FROM user_events 
WHERE event_type = 'feedback_analysis_complete'
  AND (event_data->>'success')::boolean = true
GROUP BY event_data->>'analysis_type';

-- Peak usage times
SELECT 
  EXTRACT(HOUR FROM created_at) as hour_of_day,
  COUNT(*) as request_count
FROM user_events 
WHERE event_type = 'feedback_request'
GROUP BY EXTRACT(HOUR FROM created_at)
ORDER BY hour_of_day;
```

### Flow Mode Engagement Analytics
```sql
-- Most engaged sentences (combined hover + click activity)
SELECT 
  event_data->>'sentence_preview' as sentence_preview,
  ROUND(AVG((event_data->>'connection_strength')::numeric), 3) as avg_connection_strength,
  COUNT(CASE WHEN event_type = 'flow_sentence_hover' THEN 1 END) as hover_count,
  COUNT(CASE WHEN event_type = 'flow_sentence_click' THEN 1 END) as click_count,
  COUNT(*) as total_interactions,
  AVG((event_data->>'sentence_length')::int) as avg_length,
  ROUND(
    COUNT(CASE WHEN event_type = 'flow_sentence_click' THEN 1 END)::numeric / 
    NULLIF(COUNT(CASE WHEN event_type = 'flow_sentence_hover' THEN 1 END), 0) * 100, 
    2
  ) as click_through_rate_percent
FROM user_events 
WHERE event_type IN ('flow_sentence_hover', 'flow_sentence_click')
GROUP BY event_data->>'sentence_preview'
HAVING COUNT(*) > 1
ORDER BY total_interactions DESC, click_count DESC, avg_connection_strength DESC
LIMIT 20;

-- User engagement patterns in flow mode
SELECT 
  u.prolific_id,
  COUNT(CASE WHEN e.event_type = 'flow_sentence_hover' THEN 1 END) as total_hovers,
  COUNT(CASE WHEN e.event_type = 'flow_sentence_click' THEN 1 END) as total_clicks,
  COUNT(*) as total_flow_interactions,
  COUNT(DISTINCT e.file_id) as files_with_flow_activity,
  AVG((e.event_data->>'connection_strength')::numeric) as avg_connection_strength,
  ROUND(
    COUNT(CASE WHEN e.event_type = 'flow_sentence_click' THEN 1 END)::numeric / 
    NULLIF(COUNT(CASE WHEN e.event_type = 'flow_sentence_hover' THEN 1 END), 0) * 100, 
    2
  ) as personal_click_through_rate_percent,
  MIN(e.created_at) as first_flow_interaction,
  MAX(e.created_at) as last_flow_interaction
FROM users u
JOIN user_events e ON u.id = e.user_id
WHERE e.event_type IN ('flow_sentence_hover', 'flow_sentence_click')
GROUP BY u.prolific_id
ORDER BY total_flow_interactions DESC;

-- Connection strength distribution analysis (hover vs click behavior)
SELECT 
  CASE 
    WHEN (event_data->>'connection_strength')::numeric >= 0.8 THEN 'High (0.8-1.0)'
    WHEN (event_data->>'connection_strength')::numeric >= 0.6 THEN 'Medium-High (0.6-0.8)'
    WHEN (event_data->>'connection_strength')::numeric >= 0.4 THEN 'Medium (0.4-0.6)'
    WHEN (event_data->>'connection_strength')::numeric >= 0.2 THEN 'Low-Medium (0.2-0.4)'
    ELSE 'Low (0.0-0.2)'
  END as connection_strength_range,
  COUNT(CASE WHEN event_type = 'flow_sentence_hover' THEN 1 END) as hover_count,
  COUNT(CASE WHEN event_type = 'flow_sentence_click' THEN 1 END) as click_count,
  ROUND(AVG((event_data->>'sentence_length')::int), 1) as avg_sentence_length,
  ROUND(
    COUNT(CASE WHEN event_type = 'flow_sentence_click' THEN 1 END)::numeric / 
    NULLIF(COUNT(CASE WHEN event_type = 'flow_sentence_hover' THEN 1 END), 0) * 100, 
    2
  ) as click_through_rate_percent
FROM user_events 
WHERE event_type IN ('flow_sentence_hover', 'flow_sentence_click')
GROUP BY 
  CASE 
    WHEN (event_data->>'connection_strength')::numeric >= 0.8 THEN 'High (0.8-1.0)'
    WHEN (event_data->>'connection_strength')::numeric >= 0.6 THEN 'Medium-High (0.6-0.8)'
    WHEN (event_data->>'connection_strength')::numeric >= 0.4 THEN 'Medium (0.4-0.6)'
    WHEN (event_data->>'connection_strength')::numeric >= 0.2 THEN 'Low-Medium (0.2-0.4)'
    ELSE 'Low (0.0-0.2)'
  END
ORDER BY 
  CASE connection_strength_range
    WHEN 'High (0.8-1.0)' THEN 1
    WHEN 'Medium-High (0.6-0.8)' THEN 2
    WHEN 'Medium (0.4-0.6)' THEN 3
    WHEN 'Low-Medium (0.2-0.4)' THEN 4
    ELSE 5
  END;

-- Daily click-through funnel analysis
SELECT 
  DATE(created_at) as activity_date,
  COUNT(CASE WHEN event_type = 'flow_sentence_hover' THEN 1 END) as daily_hovers,
  COUNT(CASE WHEN event_type = 'flow_sentence_click' THEN 1 END) as daily_clicks,
  ROUND(
    COUNT(CASE WHEN event_type = 'flow_sentence_click' THEN 1 END)::numeric / 
    NULLIF(COUNT(CASE WHEN event_type = 'flow_sentence_hover' THEN 1 END), 0) * 100, 
    2
  ) as daily_click_through_rate_percent
FROM user_events 
WHERE event_type IN ('flow_sentence_hover', 'flow_sentence_click')
GROUP BY DATE(created_at)
ORDER BY activity_date DESC
LIMIT 30;
```

## Implementation Details

### Files Modified
1. **`/lib/event-logger.ts`** - Added new event types
2. **`/components/editor/AnalysisTools.tsx`** - Added logging calls
3. **`/components/editor/EditorHeader.tsx`** - Added userId prop
4. **`/components/editor/EditorContainer.tsx`** - Pass userId to header
5. **`/lib/highlighting-manager.ts`** - Added hover logging in flow mode

### Key Features
- **Automatic Logging**: No manual intervention required
- **Performance Tracking**: Measures analysis duration
- **Error Tracking**: Logs failures with error messages
- **User Context**: Associates all events with user and file
- **Non-blocking**: Logging happens asynchronously

### Usage Examples

The logging happens automatically when users interact with the feedback system:

1. User clicks "Check everything" → `FEEDBACK_REQUEST` logged
2. Analysis starts → `FEEDBACK_ANALYSIS_START` logged  
3. Analysis completes → `FEEDBACK_ANALYSIS_COMPLETE` logged with results
4. User hovers over flow mode sentence → `FLOW_SENTENCE_HOVER` logged with sentence details
5. User clicks on flow mode sentence → `FLOW_SENTENCE_CLICK` logged with sentence details and action

All events include user ID and file ID for comprehensive tracking and analytics.

## Benefits

1. **Usage Analytics**: Track which features are most popular
2. **Performance Monitoring**: Identify slow analysis operations
3. **Error Tracking**: Monitor and debug analysis failures
4. **User Behavior**: Understand how users interact with AI feedback
5. **Content Metrics**: Track how much feedback is generated per session
6. **Flow Mode Engagement**: Monitor which sentences users find most interesting
7. **Connection Strength Analysis**: Understand user preferences for AI-identified connections
8. **Reading Patterns**: Track how users explore document flow and relationships
9. **Click-Through Analysis**: Measure conversion from hover to click for engagement depth
10. **User Journey Mapping**: Understand the progression from passive viewing to active analysis 