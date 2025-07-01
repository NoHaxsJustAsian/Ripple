import { supabase, FileData, CommentType } from './supabase';
import { logEvent, EventType } from './event-logger';
import { CommentType as UICommentType, uiCommentToDbComment } from '../components/editor/types';

/**
 * Service for managing file operations
 */
export class FileService {
  private userId: string;

  /**
   * Creates a new FileService
   * @param userId - The user's ID
   */
  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Updates the user ID for the service
   * @param userId - The new user ID
   */
  public updateUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Saves a file to the database
   * @param title - The file title
   * @param content - The file content
   * @param fileId - Optional file ID for updating an existing file
   * @returns The saved file data
   */
  public async saveFile(
    title: string, 
    content: string,
    fileId?: string
  ): Promise<FileData | null> {
    try {
      const now = new Date().toISOString();
      
      if (fileId) {
        // Update existing file
        const { data, error } = await supabase
          .from('files')
          .update({
            title,
            content,
            updated_at: now
          })
          .eq('id', fileId)
          .eq('user_id', this.userId)
          .select()
          .single();
          
        if (error) {
          console.error('Error updating file:', error);
          return null;
        }
        
        await logEvent(this.userId, EventType.FILE_SAVE, {
          file_id: fileId,
          title,
          action: 'update'
        });
        
        return data;
      } else {
        // Create new file
        const { data, error } = await supabase
          .from('files')
          .insert([{
            user_id: this.userId,
            title,
            content,
            created_at: now,
            updated_at: now
          }])
          .select()
          .single();
          
        if (error) {
          console.error('Error creating file:', error);
          return null;
        }
        
        await logEvent(this.userId, EventType.FILE_SAVE, {
          file_id: data.id,
          title,
          action: 'create'
        });
        
        return data;
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      return null;
    }
  }

  /**
   * Gets a file from the database
   * @param fileId - The file ID
   * @returns The file data
   */
  public async getFile(fileId: string): Promise<FileData | null> {
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('user_id', this.userId)
        .single();
        
      if (error) {
        console.error('Error getting file:', error);
        return null;
      }
      
      await logEvent(this.userId, EventType.FILE_OPEN, {
        file_id: fileId,
        title: data.title
      });
      
      return data;
    } catch (error) {
      console.error('Failed to get file:', error);
      return null;
    }
  }

  /**
   * Gets all files for the current user
   * @returns Array of files
   */
  public async getAllFiles(): Promise<FileData[]> {
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', this.userId)
        .order('updated_at', { ascending: false });
        
      if (error) {
        console.error('Error getting files:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Failed to get files:', error);
      return [];
    }
  }

  /**
   * Deletes a file from the database
   * @param fileId - The file ID
   * @returns True if successful, false otherwise
   */
  public async deleteFile(fileId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('files')
        .delete()
        .eq('id', fileId)
        .eq('user_id', this.userId);
        
      if (error) {
        console.error('Error deleting file:', error);
        return false;
      }
      
      await logEvent(this.userId, EventType.FILE_SAVE, {
        file_id: fileId,
        action: 'delete'
      });
      
      return true;
    } catch (error) {
      console.error('Failed to delete file:', error);
      return false;
    }
  }

  /**
   * Get comments for a file
   * @param fileId - The file ID
   * @returns Array of comments for the file
   */
  public async getComments(fileId: string): Promise<CommentType[]> {
    try {
      console.log(`Getting comments for file ${fileId} with userId ${this.userId}`);
      
      // Validate the fileId to ensure it's a proper UUID
      if (!fileId || typeof fileId !== 'string') {
        console.error('Invalid fileId for getting comments:', fileId);
        return [];
      }
      
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('file_id', fileId)
        .order('created_at', { ascending: true });
        
      if (error) {
        console.error('Error getting comments:', error);
        return [];
      }
      
      console.log(`Retrieved ${data?.length || 0} comments for file ${fileId}:`, data);
      return data || [];
    } catch (error) {
      console.error('Failed to get comments:', error);
      return [];
    }
  }

  /**
   * Add a comment to a file
   * @param fileId - The file ID
   * @param content - The comment content
   * @param positionStart - The starting position in the file
   * @param positionEnd - The ending position in the file
   * @returns The created comment
   */
  public async addComment(
    fileId: string,
    content: string,
    positionStart: number,
    positionEnd: number
  ): Promise<CommentType | null> {
    try {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('comments')
        .insert([{
          file_id: fileId,
          user_id: this.userId,
          content,
          position_start: positionStart,
          position_end: positionEnd,
          created_at: now,
          updated_at: now,
          completion_info: [] // Initialize as active (empty array)
        }])
        .select()
        .single();
        
      if (error) {
        console.error('Error adding comment:', error);
        return null;
      }
      
      await logEvent(this.userId, EventType.COMMENT_ADD, {
        file_id: fileId,
        comment_id: data.id
      });
      
      return data;
    } catch (error) {
      console.error('Failed to add comment:', error);
      return null;
    }
  }

  /**
   * Update a comment
   * @param commentId - The comment ID
   * @param content - The updated content
   * @param resolved - Whether the comment is resolved
   * @returns The updated comment
   */
  public async updateComment(
    commentId: string,
    content?: string,
    resolved?: boolean
  ): Promise<CommentType | null> {
    try {
      const now = new Date().toISOString();
      const updates: any = { updated_at: now };
      
      if (content !== undefined) updates.content = content;
      if (resolved !== undefined) updates.resolved = resolved;
      
      const { data, error } = await supabase
        .from('comments')
        .update(updates)
        .eq('id', commentId)
        .eq('user_id', this.userId)
        .select()
        .single();
        
      if (error) {
        console.error('Error updating comment:', error);
        return null;
      }
      
      await logEvent(this.userId, EventType.COMMENT_EDIT, {
        comment_id: commentId,
        file_id: data.file_id
      });
      
      return data;
    } catch (error) {
      console.error('Failed to update comment:', error);
      return null;
    }
  }

  /**
   * Delete a comment
   * @param commentId - The comment ID
   * @returns True if successful, false otherwise
   */
  public async deleteComment(commentId: string): Promise<boolean> {
    try {
      // First get the file_id for logging
      const { data: comment, error: fetchError } = await supabase
        .from('comments')
        .select('file_id')
        .eq('id', commentId)
        .eq('user_id', this.userId)
        .single();
        
      if (fetchError) {
        console.error('Error fetching comment:', fetchError);
        return false;
      }
      
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', this.userId);
        
      if (error) {
        console.error('Error deleting comment:', error);
        return false;
      }
      
      await logEvent(this.userId, EventType.COMMENT_DELETE, {
        comment_id: commentId,
        file_id: comment.file_id
      });
      
      return true;
    } catch (error) {
      console.error('Failed to delete comment:', error);
      return false;
    }
  }

  /**
   * Saves UI comments to the database for a file
   * @param fileId - The file ID
   * @param comments - Array of UI comment objects
   * @returns True if successful
   */
  public async saveComments(fileId: string, comments: UICommentType[]): Promise<boolean> {
    try {
      console.log(`Saving ${comments.length} comments for file ${fileId}`);
      console.log("User ID for comment saving:", this.userId);
      
      // Validate fileId is a proper UUID
      if (!fileId || typeof fileId !== 'string' || fileId.length !== 36) {
        console.error('Invalid fileId for saving comments:', fileId);
        return false;
      }
      
      // First delete existing comments for this file
      const { error: deleteError } = await supabase
        .from('comments')
        .delete()
        .eq('file_id', fileId);
        
      if (deleteError) {
        console.error('Error deleting existing comments:', deleteError);
        return false;
      }
      
      // Then insert the new comments
      if (comments.length > 0) {
        try {
          // Convert each comment individually, so one bad comment doesn't fail the whole batch
          const dbComments = [];
          
          for (const comment of comments) {
            try {
              // Skip invalid comments
              if (!comment || !comment.id) {
                console.warn('Skipping invalid comment (missing ID):', comment);
                continue;
              }
              
              const dbComment = uiCommentToDbComment(comment, fileId, this.userId);
              
              // Additional validation to ensure no null content
              if (!dbComment.content) {
                console.warn('Comment has null content, setting to empty string:', comment);
                dbComment.content = '';
              }
              
              dbComments.push(dbComment);
            } catch (conversionError) {
              console.error('Error converting comment - skipping:', conversionError, comment);
              // Continue with other comments instead of failing completely
            }
          }
          
          console.log(`Inserting ${dbComments.length} DB comments`);
          
          if (dbComments.length === 0) {
            console.warn('No valid comments to save after conversion');
            return true; // No comments to save is not an error
          }
          
          // Insert in batches to handle large numbers of comments
          const BATCH_SIZE = 20;
          for (let i = 0; i < dbComments.length; i += BATCH_SIZE) {
            const batch = dbComments.slice(i, i + BATCH_SIZE);
            console.log(`Inserting batch ${i/BATCH_SIZE + 1} of ${Math.ceil(dbComments.length/BATCH_SIZE)}`);
            
            const { error } = await supabase
              .from('comments')
              .insert(batch);
              
            if (error) {
              console.error('Error saving comments batch:', error);
              // Try inserting comments one by one to save as many as possible
              for (const comment of batch) {
                try {
                  await supabase.from('comments').insert([comment]);
                } catch (singleInsertError) {
                  console.error('Failed to insert single comment:', comment, singleInsertError);
                }
              }
            }
          }
        } catch (insertError) {
          console.error('Error in comment insert process:', insertError);
          return false;
        }
      }
      
      await logEvent(this.userId, EventType.FILE_SAVE, {
        file_id: fileId,
        comment_count: comments.length,
        action: 'save_comments'
      });
      
      console.log(`Successfully saved ${comments.length} comments`);
      return true;
    } catch (error) {
      console.error('Failed to save comments:', error);
      return false;
    }
  }
} 