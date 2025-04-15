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
  title: string;
  text: string;
  type: 'suggestion' | 'highlight' | 'analysis';
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
}

export interface CommentType {
  id: string;
  text?: string;
  content?: string;
  from?: number;
  to?: number;
  createdAt: Date | string;
  createdAtTime?: Date;
  resolved?: boolean;
  quotedText?: string;
  author?: string;
  userId?: string;
  isAIFeedback?: boolean;
  title?: string;
  feedbackType?: 'style' | 'grammar' | 'clarity' | 'idea' | 'sentence' | 'paragraph' | 'general';
  issueType?: 'error' | 'warning' | 'suggestion' | 'grammar' | 'clarity' | 'coherence' | 'cohesion' | 'style' | 'structure' | 'flow';
  suggestedEdit?: {
    original: string;
    suggested: string;
    explanation: string;
  };
}

export interface AnalysisResult {
  comments?: Array<{
    text: string;
    highlightedText: string;
    suggestedEdit?: SuggestedEdit;
  }>;
  // Add other analysis result fields as needed
} 