# Suggestion Migration Guide

## Database Migration

To properly support AI-generated suggestions, we need to add specific fields to the `comments` table. Run the following SQL migration in your Supabase dashboard SQL editor:

```sql
-- Add suggestion-specific columns to the comments table
ALTER TABLE comments 
  ADD COLUMN IF NOT EXISTS is_ai_feedback BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS issue_type TEXT,
  ADD COLUMN IF NOT EXISTS original_text TEXT,
  ADD COLUMN IF NOT EXISTS suggested_text TEXT,
  ADD COLUMN IF NOT EXISTS explanation TEXT;
```

## Verification Steps

After applying the migration and deploying the updated code, follow these steps to verify that suggestions are being properly stored and loaded:

1. **Create a new suggestion**:
   - Open a document
   - Select some text
   - Create an AI suggestion on it
   - Save the document
   - Check the console logs for "Processing comment for DB" messages

2. **Check database**:
   - Open the Supabase dashboard
   - Go to the Table Editor
   - Select the "comments" table
   - Verify that your new suggestion has values in the fields:
     - `is_ai_feedback` should be `true`
     - `issue_type` should be set (if applicable)
     - `original_text` should contain the original text
     - `suggested_text` should contain the suggested text
     - `explanation` should contain the explanation

3. **Test loading**:
   - Refresh the page
   - Open the same document
   - Check that the suggestions appear correctly with all their metadata
   - Check the console logs for "Converting DB comment to UI format" messages
   - Verify that the UI displays the suggestion, not just a regular comment

## Troubleshooting

If suggestions are not being loaded correctly:

1. **Check console logs**:
   - Look for errors in the conversion processes
   - Verify that `dbCommentToUiComment` is receiving all necessary fields

2. **Database validation**:
   - Confirm that the suggestion data is actually saved in the database
   - Check if any constraints are preventing data from being saved

3. **UI inspection**:
   - Use browser developer tools to inspect the component props
   - Verify that `CommentItem` receives the `suggestedEdit` property
   - Check if `isAIFeedback` is properly set

## Additional Notes

- The migration adds columns without dropping existing data
- Legacy comments will work alongside the new suggestion format
- For comments stored as JSON in the content field, the system will attempt to extract suggestion data during conversion 