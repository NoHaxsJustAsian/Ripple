# Completion Info Implementation Guide

## Overview
The `completion_info` field tracks the lifecycle of comments/suggestions through various states like active, dismissed, replaced, accepted, or ignored.

## Database Schema
```sql
-- JSONB column storing array of completion events
completion_info JSONB DEFAULT '[]'::jsonb

-- Computed column for quick status queries  
completion_status TEXT -- 'active' | 'dismissed' | 'replaced' | 'accepted' | 'ignored'
```

## TypeScript Interface
```typescript
completionInfo?: Array<{
  action: 'active' | 'dismissed' | 'replaced' | 'accepted' | 'ignored';
  timestamp: string;
  reason?: string;
}>;
```

## Usage Examples

### 1. Creating a new comment (starts as active)
```typescript
const newComment: CommentType = {
  id: crypto.randomUUID(),
  content: "Consider revising this sentence",
  quotedText: "The quick brown fox",
  // completionInfo defaults to empty array (active state)
};
```

### 2. Dismissing a suggestion
```typescript
const updatedComment = {
  ...comment,
  completionInfo: [
    ...(comment.completionInfo || []),
    {
      action: 'dismissed' as const,
      timestamp: new Date().toISOString(),
      reason: 'User disagreed with suggestion'
    }
  ]
};
```

### 3. Accepting a suggestion
```typescript
const acceptedComment = {
  ...comment,
  completionInfo: [
    ...(comment.completionInfo || []),
    {
      action: 'accepted' as const,
      timestamp: new Date().toISOString(),
      reason: 'User applied the suggested edit'
    }
  ]
};
```

### 4. Querying by status (SQL)
```sql
-- Get all active comments
SELECT * FROM comments WHERE completion_status = 'active';

-- Get all dismissed suggestions in the last week
SELECT * FROM comments 
WHERE completion_status = 'dismissed'
  AND completion_info->-1->>'timestamp' > (NOW() - INTERVAL '7 days');

-- Count comments by status
SELECT 
  completion_status,
  COUNT(*) as count
FROM comments 
GROUP BY completion_status;
```

### 5. Filtering in TypeScript
```typescript
// Get active comments
const activeComments = comments.filter(comment => 
  !comment.completionInfo || 
  comment.completionInfo.length === 0 ||
  comment.completionInfo[comment.completionInfo.length - 1].action === 'active'
);

// Get dismissed comments
const dismissedComments = comments.filter(comment => 
  comment.completionInfo && 
  comment.completionInfo.length > 0 &&
  comment.completionInfo[comment.completionInfo.length - 1].action === 'dismissed'
);
```

## Migration Instructions

### For New Installations
Use the updated `supabase_schema.sql` file which includes the `completion_info` column.

### For Existing Databases
Run the migration script:
```bash
# Execute the migration SQL file in your Supabase dashboard or via CLI
psql -d your_database < supabase_migration_completion_info.sql
```

## Benefits

1. **Full History**: Track complete lifecycle of each comment/suggestion
2. **Flexible Queries**: Use JSONB operators for complex filtering
3. **Performance**: GIN index enables fast JSONB queries
4. **Computed Status**: Quick status checks without parsing JSONB
5. **Backward Compatible**: Existing comments remain active by default 