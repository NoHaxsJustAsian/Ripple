import { EventBatcher } from "@/lib/event-logger";

// Editor component related types

export interface EditorProps {
  className?: string;
  placeholder?: string;
  onEditorChange?: (content: string) => void;
  eventBatcher?: EventBatcher;
}

export interface AIInsight {
  id: number;
  content: string;
  type: 'comment' | 'improvement';
  highlightedText?: string;
  highlightStyle?: string;
  isHighlighted?: boolean;
  feedbackType?: 'general';
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

// Update to types.ts
export interface CommentType {
  id: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  content?: string;
  from?: number;
  to?: number;
  quotedText?: string;
  text?: string;
  issueType?: string;
  isAIFeedback?: boolean;
  suggestedEdit?: {
    original: string;
    suggested: string;
    explanation: string;
  };
  isPinned?: boolean;
  completionInfo?: Array<{
    action: 'active' | 'dismissed' | 'replaced';
    timestamp: string;
  }>;
  feedbackHistory?: Array<{
    timestamp: string;
    original: string;
    currentText: string;
    suggested: string;
    explanation: string;
    issueType?: string;
  }>;
  resolved?: boolean;
}

export interface AnalysisResult {
  comments?: Array<{
    text: string;
    highlightedText: string;
    suggestedEdit?: SuggestedEdit;
  }>;
  // Add other analysis result fields as needed
} 