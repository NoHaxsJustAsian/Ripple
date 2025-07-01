# Event Logging Testing Guide

## Quick Testing Methods

### Method 1: Browser Console Monitoring

1. **Open your app** in the browser
2. **Open Developer Tools** (F12 or right-click → Inspect)
3. **Go to Console tab**
4. Look for logging messages when interacting with the app:
   - `📊 Logging event:` - Shows when events are being sent
   - `✅ Event logged successfully:` - Confirms successful logging
   - `❌ Error logging event:` - Shows any errors

### Method 2: Manual Testing via Console

#### Test Event Logging:
```javascript
// Test with current user (if logged in)
window.testEventLogging();

// Test with specific user/file IDs
window.testEventLogging('your-user-id', 'your-file-id');
```

#### Check Recent Events:
```javascript
// View last 10 events in a nice table
window.checkRecentEvents();

// View last 20 events
window.checkRecentEvents(20);
```

#### Manual Event Creation:
```javascript
// Log a custom hover event
window.logEvent('user-id', window.EventType.FLOW_SENTENCE_HOVER, {
  sentence_text: 'Custom test sentence',
  connection_strength: 0.8,
  hover_time: new Date().toISOString()
});
```

### Method 3: Real User Interaction Testing

#### Flow Mode Hover Testing:
1. **Enable Flow Mode** in the editor
2. **Generate flow highlights** by clicking "Check everything"
3. **Hover over highlighted sentences**
4. **Check console** for `📊 Logging event: flow_sentence_hover` messages

#### Flow Mode Click Testing:
1. **Hover over a flow-highlighted sentence** (to see it works)
2. **Click on the highlighted sentence**
3. **Check console** for `📊 Logging event: flow_sentence_click` messages
4. **Verify** the sentence flow analysis panel appears

#### Feedback Analysis Testing:
1. **Click "Check everything"** or "Check custom selection"
2. **Check console** for these events in sequence:
   - `📊 Logging event: feedback_request`
   - `📊 Logging event: feedback_analysis_start`
   - `📊 Logging event: feedback_analysis_complete`

## Supabase Database Verification

### Method 1: Supabase Dashboard
1. **Go to your Supabase dashboard**
2. **Navigate to Table Editor → user_events**
3. **Look for recent entries** with event_type:
   - `flow_sentence_hover`
   - `flow_sentence_click`
   - `feedback_request`
   - `feedback_analysis_start`
   - `feedback_analysis_complete`

### Method 2: SQL Query in Supabase
```sql
-- Check recent events (last 10)
SELECT 
  event_type,
  event_data->>'sentence_preview' as sentence_preview,
  event_data->>'analysis_type' as analysis_type,
  created_at
FROM user_events 
ORDER BY created_at DESC 
LIMIT 10;

-- Check flow mode events specifically
SELECT 
  event_type,
  event_data->>'sentence_preview' as sentence,
  event_data->>'connection_strength' as strength,
  created_at
FROM user_events 
WHERE event_type IN ('flow_sentence_hover', 'flow_sentence_click')
ORDER BY created_at DESC 
LIMIT 20;

-- Check if events are being logged for your user
SELECT 
  u.prolific_id,
  e.event_type,
  e.created_at
FROM user_events e
JOIN users u ON e.user_id = u.id
WHERE u.prolific_id = 'YOUR_PROLIFIC_ID'
ORDER BY e.created_at DESC
LIMIT 10;
```

## Troubleshooting Common Issues

### Issue 1: No Console Messages
**Problem**: Not seeing any `📊 Logging event:` messages

**Solutions**:
- Check if user is logged in: `console.log(window.user)`
- Verify console filter isn't hiding messages
- Make sure you're in the right tab (not iframe)

### Issue 2: Events Logged but Not in Database
**Problem**: Seeing `📊 Logging event:` but `❌ Error logging event:`

**Solutions**:
- Check Supabase connection
- Verify user_events table exists
- Check RLS (Row Level Security) policies
- Look at specific error message in console

### Issue 3: Flow Mode Events Not Triggering
**Problem**: Hovering/clicking sentences but no events logged

**Solutions**:
- Ensure you're in Flow Mode (toggle should be ON)
- Make sure flow highlights exist (run "Check everything" first)
- Verify highlighting-manager has user context
- Check if sentences have `flow-mode-highlight` class

### Issue 4: User ID Missing
**Problem**: `Attempted to log event without user ID` warning

**Solutions**:
- Verify user is logged in
- Check EditorContainer passes user ID to HighlightingManager
- Ensure HighlightingManager.updateUserContext() is called

## Expected Event Flow

### Complete User Journey:
1. **User logs in** → `login` event
2. **User opens/creates file** → `file_open` or `file_save` event
3. **User requests feedback** → `feedback_request` event
4. **Analysis starts** → `feedback_analysis_start` event
5. **Analysis completes** → `feedback_analysis_complete` event
6. **User hovers sentence** → `flow_sentence_hover` event
7. **User clicks sentence** → `flow_sentence_click` event

### Typical Console Output:
```
📊 Logging event: { eventType: "feedback_request", userId: "abc12345...", ... }
✅ Event logged successfully: feedback_request
📊 Logging event: { eventType: "feedback_analysis_start", userId: "abc12345...", ... }
✅ Event logged successfully: feedback_analysis_start
📊 Logging event: { eventType: "flow_sentence_hover", userId: "abc12345...", ... }
✅ Event logged successfully: flow_sentence_hover
📊 Logging event: { eventType: "flow_sentence_click", userId: "abc12345...", ... }
✅ Event logged successfully: flow_sentence_click
```

## Performance Monitoring

### Check Event Volume:
```sql
-- Events per day
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_events,
  COUNT(DISTINCT user_id) as unique_users
FROM user_events 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Check Event Types Distribution:
```sql
-- Event type frequency
SELECT 
  event_type,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM user_events), 2) as percentage
FROM user_events 
GROUP BY event_type
ORDER BY count DESC;
```

## Success Indicators

✅ **Console shows logging messages** for each interaction  
✅ **No error messages** in console  
✅ **Events appear in Supabase** user_events table  
✅ **Event data includes** complete sentence text and metadata  
✅ **User and file IDs** are properly associated  
✅ **Timestamps** are accurate  
✅ **Event types** match expected actions  

When all these indicators are green, your event logging is working correctly! 