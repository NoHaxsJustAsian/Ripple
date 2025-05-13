import { EventBatcher } from "@/lib/event-logger";
import { CommentType as DBCommentType } from "@/lib/supabase";

// Editor component related types

export interface EditorProps {
  className?: string;
  placeholder?: string;
  onEditorChange?: (content: string) => void;
  eventBatcher?: EventBatcher;
}

// UI version of CommentType that extends DB type with UI-specific properties
export interface CommentType {
  id: string;
  content: string;
  quotedText?: string;
  from?: number;
  to?: number;
  createdAt: Date;
  updatedAt?: string;
  createdAtTime?: Date;
  isAIFeedback?: boolean;
  resolved?: boolean;
  issueType?: string;
  authorId?: string;
  // Additional UI-specific properties
  feedbackType?: string;
  isPinned?: boolean;
  feedbackHistory?: Array<{
    timestamp: string | Date;
    original?: string;
    currentText?: string;
    suggested?: string;
    explanation: string;
    issueType?: string;
  }>;
  completionInfo?: Array<{
    action: 'active' | 'dismissed' | 'replaced';
    timestamp: string;
  }>;
  suggestedEdit?: {
    original: string;
    suggested: string;
    explanation: string;
  };
}

// Database conversion function
export function uiCommentToDbComment(comment: CommentType, fileId: string, userId: string): DBCommentType {
  // Ensure createdAt is properly converted to ISO string 
  let createdAtString: string;
  if (typeof comment.createdAt === 'object' && comment.createdAt instanceof Date) {
    createdAtString = comment.createdAt.toISOString();
  } else if (typeof comment.createdAt === 'string') {
    createdAtString = comment.createdAt;
  } else {
    createdAtString = new Date().toISOString();
  }

  // Ensure content is never null - use empty string as fallback
  // Check both comment.content and text field which might be used in AI suggestions
  let contentValue = '';
  if (comment.content !== undefined && comment.content !== null) {
    contentValue = String(comment.content);
  } else if ((comment as any).text) {
    // Some AI suggestions might store content in a 'text' field
    contentValue = String((comment as any).text);
  } else if (comment.suggestedEdit?.explanation) {
    // Use explanation as content if available
    contentValue = comment.suggestedEdit.explanation;
  } else if (comment.quotedText) {
    // Use quoted text as content if nothing else available
    contentValue = `Comment on: ${comment.quotedText}`;
  }

  // Log the comment conversion for debugging
  console.log('Processing comment for DB:', { 
    id: comment.id, 
    originalContent: comment.content,
    processedContent: contentValue,
    hasText: !!(comment as any).text,
    hasSuggestedEdit: !!comment.suggestedEdit
  });

  const dbComment: DBCommentType = {
    // Use a UUID generator for new comments or if ID doesn't match UUID format
    id: comment.id.includes('-') && comment.id.length === 36 ? comment.id : crypto.randomUUID(),
    file_id: fileId,
    user_id: userId,
    content: contentValue,
    position_start: comment.from || 0,
    position_end: comment.to || 0,
    created_at: createdAtString,
    updated_at: new Date().toISOString(),
    resolved: comment.resolved || false,
    // Add suggestion-specific fields if available
    is_ai_feedback: comment.isAIFeedback || !!comment.suggestedEdit,
    issue_type: comment.issueType
  };
  
  // Add suggestion-specific fields if they exist
  if (comment.suggestedEdit) {
    dbComment.original_text = comment.suggestedEdit.original || comment.quotedText || '';
    dbComment.suggested_text = comment.suggestedEdit.suggested || '';
    dbComment.explanation = comment.suggestedEdit.explanation || '';
  }

  return dbComment;
}

// Convert DB comment to UI comment format
export function dbCommentToUiComment(dbComment: DBCommentType): CommentType {
  try {
    console.log('Converting DB comment to UI format:', dbComment);
    
    // Build suggested edit if we have the necessary fields
    let suggestedEdit: CommentType['suggestedEdit'] | undefined = undefined;
    
    // Default to the original content
    let mainContent = dbComment.content;
    
    if (dbComment.is_ai_feedback || dbComment.original_text || dbComment.suggested_text || dbComment.explanation) {
      suggestedEdit = {
        original: dbComment.original_text || '',
        suggested: dbComment.suggested_text || '',
        explanation: dbComment.explanation || ''
      };
      
      // For AI feedback/suggestions, use a minimal title to avoid duplicating text
      if (dbComment.is_ai_feedback) {
        mainContent = 'AI Suggestion';
      }
    } else {
      // Try to extract from content if it might be JSON
      try {
        const contentObj = JSON.parse(dbComment.content);
        if (contentObj && typeof contentObj === 'object' && contentObj.suggestedEdit) {
          suggestedEdit = contentObj.suggestedEdit;
          // For extracted AI feedback, use minimal title to avoid duplication
          mainContent = 'AI Suggestion';
        }
      } catch (e) {
        // Not JSON, just use as regular content
      }
    }
    
    const uiComment: CommentType = {
      id: dbComment.id,
      content: mainContent,
      from: dbComment.position_start,
      to: dbComment.position_end,
      createdAt: new Date(dbComment.created_at),
      updatedAt: dbComment.updated_at,
      resolved: dbComment.resolved || false,
      quotedText: dbComment.original_text || '',  // Use original_text as quotedText if available
      isAIFeedback: dbComment.is_ai_feedback,
      issueType: dbComment.issue_type,
      suggestedEdit
    };
    
    console.log('DB comment converted to UI format:', uiComment);
    return uiComment;
  } catch (error) {
    console.error('Error converting DB comment to UI format:', error);
    // Return a minimal valid comment as fallback
    return {
      id: dbComment.id,
      content: dbComment.content || '(Error loading comment)',
      from: dbComment.position_start,
      to: dbComment.position_end,
      createdAt: new Date(dbComment.created_at)
    };
  }
}

export interface AIInsight {
  id: string;
  text: string;
  type: 'suggestion' | 'question' | 'insight';
  timestamp: Date;
  source: 'ai' | 'user';
}

export interface PendingComment {
  text: string;
  highlightStyle: string;
  editingId?: number;
}

export interface SuggestedEdit {
  original: string;
  suggested: string;
  explanation: string;
  references?: Reference[];
}

export interface Reference {
  text: string;
  referenceText: string;
  source?: 'quote' | 'implicit' | 'api';
  position?: { from: number, to: number };
}

export interface AnalysisResult {
  comments?: Array<{
    text: string;
    highlightedText: string;
    suggestedEdit?: SuggestedEdit;
  }>;
  // Add other analysis result fields as needed
} 