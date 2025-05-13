# Fixing Comments Saving and Loading

This guide explains the changes we've made to enable proper saving and loading of comments in the Coherence application.

## Database Schema Update

The first step is to update your Supabase database schema to support storing comments. Run the following SQL in the Supabase SQL Editor:

```sql
-- Add a comments column to the files table if it doesn't exist
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]'::jsonb;
```

## How Comments Are Now Saved

1. When a document is saved, the comments are converted to a standardized format:
   - Each comment has an `id`, `text`, `from`, `to`, `createdAt`, and `resolved` properties
   - The comments are saved as a JSONB array in the database

2. When a document is loaded, the comments are:
   - Loaded from the database
   - Converted back to the application's internal format
   - Applied to the editor so that they appear in the correct positions

## Troubleshooting

If comments are still not saving or loading correctly:

1. **Check the browser console** for any errors during save or load operations

2. **Verify your database schema**:
   - Go to Supabase dashboard > Table Editor > files
   - Confirm there is a `comments` column of type JSONB

3. **Check the format of saved comments**:
   - View a file record in Supabase
   - The `comments` field should be an array of objects

4. **Clear your browser data** if you're seeing inconsistent behavior:
   - Clear localStorage
   - Try with a new document

5. **Try these specific steps**:
   1. Create a new document
   2. Add some text
   3. Add a comment by selecting text and using the comment button
   4. Save the document
   5. Open the document from the file picker
   6. Verify the comment appears in the correct position

## Technical Implementation Details

We've updated several components to support comment saving and loading:

1. **FileService:** Updated to include comments when saving files
2. **EditorHeader:** Modified to convert comments to the correct format before saving
3. **EditorContainer:** Enhanced to apply comments to the editor when loading a file

The comments are stored in a standardized format to ensure compatibility across different versions of the application. 