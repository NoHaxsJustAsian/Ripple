import { useState, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { Loader2, Clock, Highlighter, File } from 'lucide-react';
import { toast } from "sonner";
import { ActionSelect, ActionItemType } from '../ui/multi-select';
import { analyzeTextWithContext } from '@/lib/api';
import { CommentType, AnalysisResult } from './types';
import { HighlightingManager } from '@/lib/highlighting-manager';

interface AnalysisToolsProps {
  editor: Editor | null;
  setComments: React.Dispatch<React.SetStateAction<CommentType[]>>;
  setIsInsightsOpen: (open: boolean) => void;
  highlightingManager?: HighlightingManager;
}

export function AnalysisTools({
  editor,
  setComments,
  setIsInsightsOpen,
  highlightingManager
}: AnalysisToolsProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null);
  const [flowPrompt, setFlowPrompt] = useState<string>('Highlight important arguments with high emphasis, supporting details with medium emphasis, and transitions with low emphasis');

  const formatAnalysisTime = (date: Date | null) => {
    if (!date) return '';

    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Function to run contextual analysis
  const runContextualAnalysis = useCallback(async (analysisType: 'all' | 'paragraph' | 'custom') => {
    if (!editor) return;

    setIsAnalyzing(true);

    try {
      let selectedContent = '';
      let targetType: 'flow' | 'clarity' | 'focus' | 'all' = 'all';

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

      console.log('🚀 Running analysis with flow highlighting for:', analysisType);

      // Call API with context AND flow prompt - always include flow highlighting
      const response = await analyzeTextWithContext({
        content: selectedContent,
        fullContext: fullContent,
        targetType: targetType,
        flowPrompt: flowPrompt // Always include flow prompt for integrated analysis
      });

      // Process the response
      setAnalysisResult(response.data);
      // Set the last analysis time
      setLastAnalysisTime(new Date());

      console.log('📦 Analysis response received:', {
        hasComments: !!response.data?.comments?.length,
        commentsCount: response.data?.comments?.length || 0,
        hasFlowHighlights: !!response.data?.flowHighlights?.length,
        flowHighlightsCount: response.data?.flowHighlights?.length || 0
      });

      // Process flow highlights if they exist
      if (response.data.flowHighlights && response.data.flowHighlights.length > 0 && highlightingManager) {
        console.log('🟢 Processing flow highlights as part of regular analysis:', response.data.flowHighlights.length, 'highlights');

        // Set document context for hover explanations
        highlightingManager.setDocumentContext(fullContent);

        const flowHighlightsWithPositions: Array<{
          id: string;
          connectionStrength: number;
          connectedSentences: string[];
          position: { from: number; to: number };
        }> = [];

        response.data.flowHighlights.forEach((highlight, index) => {
          const textToFind = highlight.text;
          let flowPosition = null;

          // Use the same approach as comments - traverse document nodes
          editor.state.doc.descendants((node, pos) => {
            const nodeText = node.textContent;
            if (nodeText.includes(textToFind)) {
              const startPos = pos + nodeText.indexOf(textToFind);
              const endPos = startPos + textToFind.length;
              flowPosition = { from: startPos, to: endPos };
              return false; // Stop traversal
            }
          });

          if (flowPosition) {
            const highlightData = {
              id: `flow-${Date.now()}-${index}`,
              connectionStrength: highlight.connectionStrength,
              connectedSentences: [] as string[],
              position: flowPosition
            };

            flowHighlightsWithPositions.push(highlightData);
            console.log(`🎯 Flow highlight ${index + 1}: "${textToFind.substring(0, 50)}..." with strength ${highlight.connectionStrength}`);
          } else {
            console.warn('❌ Could not find position for flow highlight text:', textToFind.substring(0, 100));
          }
        });

        // Add flow highlights to the highlighting manager
        if (flowHighlightsWithPositions.length > 0) {
          highlightingManager.addFlowHighlights(flowHighlightsWithPositions);
          console.log('✅ Flow highlights added to HighlightingManager - they will be visible when flow mode is ON');
          console.log('🔍 Flow highlights details:', flowHighlightsWithPositions.map(h => ({
            text: h.position ? editor.state.doc.textBetween(h.position.from, h.position.to) : 'no position',
            strength: h.connectionStrength,
            position: h.position
          })));
        }
      } else {
        console.log('ℹ️ No flow highlights returned or HighlightingManager not available');
      }

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
              issueType: comment.issueType || 'general',
              ...(comment.suggestedEdit ? {
                suggestedEdit: {
                  original: comment.suggestedEdit.original,
                  suggested: comment.suggestedEdit.suggested,
                  explanation: comment.suggestedEdit.explanation,
                  references: comment.suggestedEdit.references || []
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
  }, [editor, setComments, setIsInsightsOpen, flowPrompt, highlightingManager]);

  // Update the feedback items with appropriate structure for ActionSelect
  const feedback_items: ActionItemType[] = [
    {
      value: 'all',
      label: 'Check everything',
      icon: <File className="h-3.5 w-3.5 text-blue-500" />,
      className: "flex items-center cursor-pointer border-b border-gray-200 border-solid pt-2 pb-2",
      description: 'Get comprehensive feedback for the entire document',
      action: () => runContextualAnalysis('all')
    },
    {
      value: 'custom',
      label: 'Check custom selection',
      description: 'Get feedback for the selected text',
      icon: <Highlighter className="h-3.5 w-3.5 text-purple-500" />,
      action: () => runContextualAnalysis('custom')
    }
  ];

  return (
    <div className="flex items-center space-x-3">
      {lastAnalysisTime && (
        <>
          <div className="text-xs text-muted-foreground flex items-center">
            <Clock className="h-3 w-3 mr-1.5" />
            <span>Feedback last updated at {formatAnalysisTime(lastAnalysisTime)}</span>
          </div>
          <div className="w-[1px] h-5 bg-border/40 dark:bg-zinc-800 rounded-full" />
        </>
      )}
      <div className="flex space-x-1 text-sm">
        {isAnalyzing ? (
          <div className="flex items-center space-x-1 text-gray-600 ">
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
    </div>
  );
}