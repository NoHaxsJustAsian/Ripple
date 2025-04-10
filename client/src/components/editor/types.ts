// Editor component related types

export interface EditorProps {
  className?: string;
  placeholder?: string;
  onEditorChange?: (content: string) => void;
}

export interface AIInsight {
  id: number;
  content: string;
  type: 'comment' | 'improvement';
  highlightedText?: string;
  highlightStyle?: string;
  isHighlighted?: boolean;
  feedbackType?: 'sentence' | 'paragraph' | 'general';
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
  content: string;
  createdAt: Date;
  createdAtTime: Date;
  quotedText: string;
  suggestedEdit?: SuggestedEdit;
  isAIFeedback?: boolean;
  feedbackType?: 'sentence' | 'paragraph' | 'general';
  title?: string;
  issueType?: 'grammar' | 'clarity' | 'coherence' | 'cohesion' | 'style' | 'structure' | string;
}

export interface AnalysisResult {
  comments?: Array<{
    text: string;
    highlightedText: string;
    suggestedEdit?: SuggestedEdit;
  }>;
  // Add other analysis result fields as needed
} 