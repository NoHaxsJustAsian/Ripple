import { supabase, FileData, CommentType } from './supabase';
import { logEvent, EventType } from './event-logger';

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
   * @param comments - The file comments
   * @param fileId - Optional file ID for updating an existing file
   * @returns The saved file data
   */
  public async saveFile(
    title: string, 
    content: string,
    comments: CommentType[] = [],
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
            comments, // Save comments as JSONB
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
          comment_count: comments.length,
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
            comments, // Save comments as JSONB
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
          comment_count: comments.length,
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
        title: data.title,
        comment_count: data.comments?.length || 0
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
} 