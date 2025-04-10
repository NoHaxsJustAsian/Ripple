import { useCallback, useState } from 'react';
import { Editor } from '@tiptap/react';
import { Zap, Loader2 } from 'lucide-react';
import { toast } from "sonner";
import { ActionSelect, ActionItemType } from '../ui/multi-select';
import { analyzeTextWithContext } from '@/lib/api';
import { CommentType, AnalysisResult } from './types';

interface AnalysisToolsProps {
  editor: Editor | null;
  setComments: React.Dispatch<React.SetStateAction<CommentType[]>>;
  setIsInsightsOpen: (open: boolean) => void;
}

export function AnalysisTools({
  editor,
  setComments,
  setIsInsightsOpen
}: AnalysisToolsProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  
  // Function to run contextual analysis
  const runContextualAnalysis = useCallback(async (analysisType: 'all' | 'paragraph' | 'custom') => {
    if (!editor) return;
    
    setIsAnalyzing(true);
    
    try {
      let selectedContent = '';
      let targetType: 'coherence' | 'cohesion' | 'focus' | 'all' = 'all';
      
      // Handle each analysis type differently
      switch (analysisType) {
        case 'all':
          // Select entire document content
          editor.chain().focus().selectAll().run();
          selectedContent = editor.state.doc.textContent;
          break;
          
        case 'custom':
          // Use existing selection
          selectedContent = editor.state.doc.textBetween(
            editor.state.selection.from,
            editor.state.selection.to
          );
          if (!selectedContent) {
            toast.warning("Please make a Custom Selection first.");
            return;
          }
          break;
          
        case 'paragraph': {
          toast.warning("Paragraph analysis is not yet supported.");
          return;
        }
      }
      
      if (!selectedContent) {
        console.error('No content selected for analysis');
        return;
      }
      
      // Get full document content for context
      const fullContent = editor.state.doc.textContent;
      
      // Map client analysis type to server expected type
      let serverAnalysisType: string;
      switch(analysisType) {
        case 'paragraph':
          serverAnalysisType = 'paragraph';
          break;
        case 'custom':
          serverAnalysisType = 'section';
          break;
        case 'all':
        default:
          serverAnalysisType = 'document';
          break;
      }
      
      // Call API with context
      const response = await analyzeTextWithContext({
        content: selectedContent,
        fullContext: fullContent,
        type: serverAnalysisType as 'paragraph' | 'section' | 'document' | 'theme',
        targetType: targetType
      });
      
      // Process the response
      setAnalysisResult(response.data);
      
      if (response.data.comments?.length > 0) {
        const newComments: CommentType[] = [];
        
        response.data.comments.forEach(comment => {
          const textToFind = comment.highlightedText;
          let commentPosition = null;
          
          // Find the position of the text in the document
          editor.state.doc.descendants((node, pos) => {
            const nodeText = node.textContent;
            if (nodeText.includes(textToFind)) {
              const startPos = pos + nodeText.indexOf(textToFind);
              const endPos = startPos + textToFind.length;
              commentPosition = { from: startPos, to: endPos };
              return false; // Stop traversal
            }
          });
          
          if (commentPosition) {
            const commentId = `comment-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            
            const newComment: CommentType = {
              id: commentId,
              content: comment.text,
              createdAt: new Date(),
              createdAtTime: new Date(),
              quotedText: comment.highlightedText,
              isAIFeedback: true,
              feedbackType: 'general', // Default to general feedback
              ...(comment.suggestedEdit ? {
                suggestedEdit: {
                  original: comment.suggestedEdit.original,
                  suggested: comment.suggestedEdit.suggested,
                  explanation: comment.suggestedEdit.explanation
                }
              } : {})
            };
            
            editor.chain()
              .setTextSelection(commentPosition)
              .setComment(commentId)
              .run();
            
            newComments.push(newComment);
          }
        });
        
        setComments(prev => [...prev, ...newComments]);
        setIsInsightsOpen(true);
      }
      
    } catch (error) {
      console.error('Error running contextual analysis:', error);
      toast.error("Analysis failed. Please try again.");
      setAnalysisResult(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [editor, setComments, setIsInsightsOpen]);

  // Update the feedback items with appropriate structure for ActionSelect
  const feedback_items: ActionItemType[] = [
    {
      value: 'all',
      label: 'Analyze Everything',
      icon: <Zap className="h-3.5 w-3.5" />,
      className: "flex items-center cursor-pointer border-b border-gray-200 border-solid pt-2 pb-2", 
      action: () => runContextualAnalysis('all')
    },
    {
      value: 'paragraph',
      label: 'Analyze by Paragraph',
      icon: <Zap className="h-3.5 w-3.5 text-yellow-500" />,
      action: () => runContextualAnalysis('paragraph')
    },
    {
      value: 'custom',
      label: 'Analyze Custom Selection',
      icon: <Zap className="h-3.5 w-3.5 text-purple-500" />,
      action: () => runContextualAnalysis('custom')
    }
  ];

  return (
    <div className="flex space-x-1 text-sm">
      {isAnalyzing ? (
        <div className="flex items-center space-x-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Checking...</span>
        </div>
      ) : (
        <ActionSelect
          label="Check for Feedback"
          items={feedback_items}
        />
      )}
    </div>
  );
} 