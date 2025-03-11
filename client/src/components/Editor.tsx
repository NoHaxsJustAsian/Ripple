import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import { useEffect, useState, useCallback, useRef, createContext, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { cn } from "@/lib/utils";
import { MessageSquare, LightbulbIcon, Save, FileDown, X, Pencil, Trash2, Check, Zap, Loader2 } from 'lucide-react';
import { AISidePanel } from './AISidePanel';
import { AIContextMenu } from './AIContextMenu';
import { EditorToolbar } from './EditorToolbar';
import { toast } from "sonner";
import { ActionSelect, ActionItemType } from './ui/multi-select';
import { EditorView } from 'prosemirror-view';
import { CommentExtension } from '../extensions/Comment';
import { SuggestEditExtension } from '../extensions/SuggestEdit';
import '@/styles/comment.css';
import { analyzeText, analyzeTextWithContext } from '@/lib/api';

interface EditorProps {
  className?: string;
  placeholder?: string;
  onEditorChange?: (content: string) => void;
}

interface AIInsight {
  id: number;
  content: string;
  type: 'comment' | 'improvement';
  highlightedText?: string;
  highlightStyle?: string;
  isHighlighted?: boolean;
}

interface PendingComment {
  text: string;
  highlightStyle: string;
  editingId?: number;
}

interface SuggestedEdit {
  original: string;
  suggested: string;
}

interface CommentType {
  id: string;
  content: string;
  createdAt: Date;
  quotedText: string;
  suggestedEdit?: SuggestedEdit;
}

// Create a context for insights
export const InsightsContext = createContext<[AIInsight[], React.Dispatch<React.SetStateAction<AIInsight[]>>]>([[], () => {}]);

export default function Editor({ 
  className = '', 
  placeholder = 'Type @ to insert...',
  onEditorChange 
}: EditorProps): JSX.Element {
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(true);
  const [documentTitle, setDocumentTitle] = useState('Untitled document');
  const [isSaving, setIsSaving] = useState(false);
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<number | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [essayTopicHighlight, setEssayTopicHighlight] = useState<{from: number, to: number} | null>(null);
  const [paragraphTopicHighlights, setParagraphTopicHighlights] = useState<{[paragraphId: string]: {from: number, to: number}}>({});
  const commentsSectionRef = useRef<HTMLDivElement | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  // Track individual toggle states
  const [showParagraphTopics, setShowParagraphTopics] = useState(false);
  const [showEssayTopics, setShowEssayTopics] = useState(false);
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({
        multicolor: true,
      }),
      TextStyle,
      Color,
      Underline,
      CommentExtension.configure({
        HTMLAttributes: {
          class: 'tiptap-comment',
        },
        onCommentActivated: (commentId: string | null) => {
          setActiveCommentId(commentId);
          if (commentId) setTimeout(() => focusCommentWithActiveId(commentId));
        },
      }),
      // Use a unique key to ensure only one instance is created
      SuggestEditExtension.configure({
        HTMLAttributes: {
          class: 'tiptap-suggest-edit',
        },
        onSuggestEdit: (original: string, suggested: string) => {
          console.log('Suggested edit:', { original, suggested });
        },
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: cn(
          "outline-none min-h-[1028px] text-[11pt]",
          "px-[64px] py-[84px]",
          "text-stone-800 dark:text-zinc-50",
          "caret-blue-500",
          "[&>div]:min-h-[24px]",
          "[&>div]:break-words",
          "[&>div]:max-w-[666px]"
        ),
      },
      handleKeyDown: (view: EditorView, event: KeyboardEvent) => {
        // Check if it's a content-modifying key (letter, number, space, delete, etc.)
        const isContentModifying = (
          // Single letters, numbers or special chars
          (event.key.length === 1 && !event.ctrlKey && !event.metaKey) ||
          // Space, backspace, delete
          event.key === ' ' || 
          event.key === 'Backspace' || 
          event.key === 'Delete'
        );
        
        if (isContentModifying) {
          // Preemptively remove highlight at the cursor position
          // This happens before the character is inserted
          editor?.chain().unsetHighlight().run();
        }
        
        return false; // Let the default handler run
      },
      handlePaste: (view: EditorView, event: ClipboardEvent) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;
        
        const text = clipboardData.getData('text');
        try {
          JSON.parse(text);
          event.preventDefault();
          return true;
        } catch (e) {
          return false;
        }
      },
    },
    onUpdate: ({ editor, transaction }) => {
      const html = editor.getHTML();
      onEditorChange?.(html);
      // Clear the selected insight when user types
      setSelectedInsight(null);
      
      // If this update was triggered by the user typing (not by a programmatic change),
      // we should remove any highlighting at the current cursor position
      if (transaction.docChanged && transaction.steps.some(step => step.toJSON().stepType === 'replace')) {
        // Get the current selection position
        const { from } = editor.state.selection;
        
        // Remove highlight at the cursor position
        // This approach removes highlighting from the current node where typing is happening
        editor.chain().unsetHighlight().run();
      }
    },
  });

  const handleToolbarComment = useCallback(() => {
    if (!editor) return;
    
    const { from, to } = editor.state.selection;
    if (from === to) return; // No selection
    
    const text = editor.state.doc.textBetween(from, to);
    
    editor.chain()
      .setHighlight({ color: '#fef9c3' })
      .setTextSelection(to)
      .run();

    setPendingComment({ text, highlightStyle: "#fef9c3" });
    setShowCommentInput(true);
    setIsInsightsOpen(true);
  }, [editor]);

  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const [isEditingComment, setIsEditingComment] = useState(false);

  useEffect(() => {
    if (showCommentInput && commentInputRef.current) {
      // Small delay to ensure the panel is visible
      setTimeout(() => {
        commentInputRef.current?.focus();
      }, 100);
    }
  }, [showCommentInput, pendingComment]);

  const handleSave = useCallback(async () => {
    if (!editor) return;

    setIsSaving(true);
    try {
      localStorage.setItem('ripple-doc', JSON.stringify({
        title: documentTitle,
        content: editor.getHTML(),
        comments,
        lastSaved: new Date().toISOString()
      }));

      toast.success("Document saved successfully");
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error("Failed to save document");
    } finally {
      setIsSaving(false);
    }
  }, [editor, documentTitle, comments]);

  const handleSaveAs = useCallback(async () => {
    if (!editor) return;

    setIsSaving(true);
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const newTitle = `${documentTitle} - ${timestamp}`;
      
      const docKey = `ripple-doc-${Date.now()}`;
      localStorage.setItem(docKey, JSON.stringify({
        title: newTitle,
        content: editor.getHTML(),
        comments,
        lastSaved: new Date().toISOString()
      }));

      setDocumentTitle(newTitle);
      toast.success("Document saved as new copy");
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error("Failed to save document");
    } finally {
      setIsSaving(false);
    }
  }, [editor, documentTitle, comments]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Load saved content on mount
  useEffect(() => {
    const saved = localStorage.getItem('ripple-doc');
    if (saved && editor) {
      const { title, content, comments: savedComments = [] } = JSON.parse(saved);
      setDocumentTitle(title);
      setComments(savedComments);
      editor.commands.setContent(content);
    }
  }, [editor]);

  const getSelectedText = useCallback(() => {
    if (!editor) return '';
    
    const { from, to } = editor.state.selection;
    if (from === to) return ''; // No selection
    
    return editor.state.doc.textBetween(from, to);
  }, [editor]);

  const toggleAIPanel = useCallback(() => {
    if (!isAIPanelOpen) {
      const text = getSelectedText();
      setSelectedText(text);
    }
    setIsAIPanelOpen(!isAIPanelOpen);
  }, [isAIPanelOpen, getSelectedText]);

  // Memoize toggleTopicSentencesVisibility to prevent recreation on every render
  const toggleTopicSentencesVisibility = useCallback((topicType: string) => {
    if (!editor) return;
    
    // Save current selection before modifying anything
    const { from: currentFrom, to: currentTo } = editor.state.selection;
    const hadSelection = currentFrom !== currentTo;
    
    // For interactions between paragraph and essay topics
    // When showing one type, we want to make sure the other type remains visible if toggled on
    
    if (topicType === 'paragraph') {
      // Show paragraph topics
      Object.entries(paragraphTopicHighlights).forEach(([, { from, to }]) => {
        editor.commands.setTextSelection({ from, to });
        editor.commands.setHighlight({ color: '#93c5fd' });
      });
    } 
    else if (topicType === 'paragraph_hide') {
      // Hide paragraph topics
      Object.entries(paragraphTopicHighlights).forEach(([, { from, to }]) => {
        editor.commands.setTextSelection({ from, to });
        editor.commands.unsetHighlight();
      });
      
      // If essay topics are still visible, we need to re-highlight them in case of overlap
      if (showEssayTopics && essayTopicHighlight) {
        editor.commands.setTextSelection({ 
          from: essayTopicHighlight.from, 
          to: essayTopicHighlight.to 
        });
        editor.commands.setHighlight({ color: '#c4b5fd' });
      }
    }
    else if (topicType === 'document') {
      // Show essay topic
      if (essayTopicHighlight) {
        editor.commands.setTextSelection({ 
          from: essayTopicHighlight.from, 
          to: essayTopicHighlight.to 
        });
        editor.commands.setHighlight({ color: '#c4b5fd' });
      }
    }
    else if (topicType === 'document_hide') {
      // Hide essay topic
      if (essayTopicHighlight) {
        editor.commands.setTextSelection({ 
          from: essayTopicHighlight.from, 
          to: essayTopicHighlight.to 
        });
        editor.commands.unsetHighlight();
      }
      
      // If paragraph topics are still visible, we need to re-highlight them in case of overlap
      if (showParagraphTopics) {
        Object.entries(paragraphTopicHighlights).forEach(([, { from, to }]) => {
          editor.commands.setTextSelection({ from, to });
          editor.commands.setHighlight({ color: '#93c5fd' });
        });
      }
    }
    
    // Restore the user's original selection
    if (hadSelection) {
      editor.commands.setTextSelection({ from: currentFrom, to: currentTo });
    } else {
      // If there was no selection, just position the cursor where it was
      editor.commands.setTextSelection(currentFrom);
    }
    
    // Focus the editor to ensure the cursor/selection is visible
    editor.commands.focus();
  }, [editor, paragraphTopicHighlights, essayTopicHighlight, showParagraphTopics, showEssayTopics]);

  // Improved toggle handlers with better user guidance
  const toggleParagraphTopics = useCallback(() => {
    const newState = !showParagraphTopics;
    setShowParagraphTopics(newState);
    
    // Show notification based on the toggle state and available topics
    if (newState) {
      const topicCount = Object.keys(paragraphTopicHighlights).length;
      if (topicCount > 0) {
        toggleTopicSentencesVisibility('paragraph');
        toast.success(`Showing ${topicCount} paragraph topic${topicCount === 1 ? '' : 's'}`);
      } else {
        toast.info("No paragraph topics marked yet. Right-click on text and select 'Select as Paragraph Topic'", {
          duration: 5000,
          action: {
            label: "How to use",
            onClick: () => {
              toast.info("Select important sentences in each paragraph, then right-click and choose 'Select as Paragraph Topic'", { duration: 7000 });
            }
          }
        });
      }
    } else {
      toggleTopicSentencesVisibility('paragraph_hide');
      toast.success("Paragraph topics hidden");
    }
  }, [showParagraphTopics, paragraphTopicHighlights, toggleTopicSentencesVisibility]);

  const toggleEssayTopics = useCallback(() => {
    const newState = !showEssayTopics;
    setShowEssayTopics(newState);
    
    // Show notification based on the toggle state and available topics
    if (newState) {
      if (essayTopicHighlight) {
        toggleTopicSentencesVisibility('document');
        toast.success("Showing essay topic");
      } else {
        toast.info("No essay topic marked yet. Right-click on text and select 'Select as Essay Topic'", {
          duration: 5000,
          action: {
            label: "How to use",
            onClick: () => {
              toast.info("Select your main thesis or focus statement, then right-click and choose 'Select as Essay Topic'", { duration: 7000 });
            }
          }
        });
      }
    } else {
      toggleTopicSentencesVisibility('document_hide');
      toast.success("Essay topic hidden");
    }
  }, [showEssayTopics, essayTopicHighlight, toggleTopicSentencesVisibility]);

  // Add useEffect to synchronize highlight visibility only when editor or toggle states change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (editor && showParagraphTopics) {
      toggleTopicSentencesVisibility('paragraph');
    }
  }, [editor, showParagraphTopics]);  // Remove toggleTopicSentencesVisibility from deps array to prevent infinite loops

  // Add useEffect to synchronize essay highlight visibility only when editor or toggle states change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (editor && showEssayTopics) {
      toggleTopicSentencesVisibility('document');
    }
  }, [editor, showEssayTopics]);  // Remove toggleTopicSentencesVisibility from deps array to prevent infinite loops

  // Now add the selection handlers after the toggle state variables
  const handleSelectAsParagraphTopic = useCallback(() => {
    if (!editor) return;
    
    const { from, to } = editor.state.selection;
    if (from === to) return; // No selection
    
    const text = editor.state.doc.textBetween(from, to);
    
    // Get the paragraph node that contains the selection
    const resolvedPos = editor.state.doc.resolve(from);
    const paragraph = resolvedPos.node(1); // Assuming paragraphs are at depth 1
    
    if (paragraph) {
      const paragraphId = paragraph.attrs.id || resolvedPos.before(1).toString();
      
      // Remove any existing paragraph topic highlight in this paragraph
      if (paragraphTopicHighlights[paragraphId]) {
        const existingHighlight = paragraphTopicHighlights[paragraphId];
        
        // Try to remove the existing highlight
        editor.chain()
          .setTextSelection({ from: existingHighlight.from, to: existingHighlight.to })
          .unsetHighlight()
          .setTextSelection({ from, to }) // Restore original selection
          .run();
      }
      
      // Apply the new highlight if topics are shown
      if (showParagraphTopics) {
        editor.chain()
          .setHighlight({ color: '#93c5fd' })
          .setTextSelection(to)
          .run();
      }
      
      // Update the state with the new paragraph topic position
      setParagraphTopicHighlights(prev => ({ 
        ...prev, 
        [paragraphId]: { from, to } 
      }));
      
      toast.success("Paragraph topic set");
    }
  }, [editor, paragraphTopicHighlights, showParagraphTopics]);

  const handleSelectAsEssayTopic = useCallback(() => {
    if (!editor) return;
    
    const { from, to } = editor.state.selection;
    if (from === to) return; // No selection
    
    const text = editor.state.doc.textBetween(from, to);
    
    // Remove any existing essay topic highlight
    if (essayTopicHighlight) {
      // Try to remove the existing highlight
      editor.chain()
        .setTextSelection({ from: essayTopicHighlight.from, to: essayTopicHighlight.to })
        .unsetHighlight()
        .setTextSelection({ from, to }) // Restore original selection
        .run();
    }
    
    // Apply the new highlight if topics are shown
    if (showEssayTopics) {
      editor.chain()
        .setHighlight({ color: '#c4b5fd' })
        .setTextSelection(to)
        .run();
    }
    
    // Update the state with the new essay topic position
    setEssayTopicHighlight({ from, to });
    
    toast.success("Essay topic set");
  }, [editor, essayTopicHighlight, showEssayTopics]);

  // Run analysis on the selected text
  const runAnalysis = useCallback(async () => {
    const text = getSelectedText();
    if (!text) {
      setAnalysisResult(null);
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await analyzeText({
        content: text,
        type: 'paragraph'
      });
      setAnalysisResult(response.data);
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisResult(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [getSelectedText]);

  // Auto-run analysis when text is selected
  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      const text = getSelectedText();
      if (text && text.length > 10) {  // Only analyze if meaningful selection
        runAnalysis();
      } else {
        setAnalysisResult(null);
      }
    };

    // Throttle selection events to prevent too many API calls
    let timeoutId: NodeJS.Timeout;
    const throttledSelectionHandler = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleSelectionUpdate, 1000); // 1 second delay
    };

    editor.on('selectionUpdate', throttledSelectionHandler);

    return () => {
      editor.off('selectionUpdate', throttledSelectionHandler);
      clearTimeout(timeoutId);
    };
  }, [editor, getSelectedText, runAnalysis]);

  // Helper to format coherence score
  const formatScore = (score: number) => {
    return `${Math.round(score * 100)}%`;
  };

  // Get the entire document content
  const getDocumentContent = useCallback(() => {
    if (!editor) return '';
    return editor.getHTML();
  }, [editor]);

  // Function to run contextual analysis
  const runContextualAnalysis = useCallback(async (targetType: 'coherence' | 'cohesion' | 'focus' | 'all') => {
    if (!editor) return;
    
    try {
      // Get the current selection or current paragraph
      let selectedContent = getSelectedText();
      let analysisType: 'paragraph' | 'section' = 'paragraph';
      
      // If no text is selected, try to get the current paragraph
      if (!selectedContent) {
        const { from } = editor.state.selection;
        const resolvedPos = editor.state.doc.resolve(from);
        const paragraph = resolvedPos.parent;
        
        if (paragraph) {
          selectedContent = paragraph.textContent;
          // Find the start and end positions of the paragraph
          const paragraphStart = resolvedPos.start();
          const paragraphEnd = paragraphStart + paragraph.nodeSize - 2;
          
          // Set the selection to the paragraph
          editor.chain().setTextSelection({
            from: paragraphStart,
            to: paragraphEnd
          }).run();
        }
      }
      
      if (!selectedContent) {
        console.error('No content selected or paragraph found');
        return;
      }
      
      // Depending on the selection size, determine if it's a paragraph or section
      if (selectedContent.length > 500) {
        analysisType = 'section';
      }
      
      // Get full document content for context
      const fullContent = getDocumentContent();
      
      // Call API with context
      const response = await analyzeTextWithContext({
        content: selectedContent,
        fullContext: fullContent,
        type: analysisType,
        targetType: targetType
      });
      
      // Process the comments from the response
      if (response.data.comments && response.data.comments.length > 0) {
        // Add each comment to the editor
        response.data.comments.forEach(comment => {
          // Find the text to highlight
          const textToFind = comment.highlightedText;
          let commentPosition = null;
          
          // Find the position of the text in the document
          editor.state.doc.descendants((node, pos) => {
            const nodeText = node.textContent;
            if (nodeText.includes(textToFind)) {
              const startPos = pos + nodeText.indexOf(textToFind);
              const endPos = startPos + textToFind.length;
              commentPosition = { from: startPos, to: endPos };
              return false; // Stop the traversal
            }
          });
          
          if (commentPosition) {
            // Add the comment at the found position
            const commentId = `comment-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            
            // Create the comment with or without a suggested edit
            const newComment: CommentType = {
              id: commentId,
              content: comment.text,
              createdAt: new Date(),
              quotedText: comment.highlightedText,
              ...(comment.suggestedEdit ? {
                suggestedEdit: {
                  original: comment.suggestedEdit.original,
                  suggested: comment.suggestedEdit.suggested
                }
              } : {})
            };
            
            // Add the comment to the editor
            editor.chain()
              .setTextSelection(commentPosition)
              .setComment(commentId)
              .run();
            
            // Then add the comment to our state separately
            setComments(prev => [...prev, newComment]);
          }
        });
      }
      
    } catch (error) {
      console.error('Error running contextual analysis:', error);
    }
  }, [editor, getSelectedText, getDocumentContent]);

  // Update the feedback items with appropriate structure for ActionSelect
  const feedback_items = useMemo<ActionItemType[]>(() => [
    {
      value: 'coherence',
      label: 'Check Coherence',
      icon: <Zap className="h-3.5 w-3.5 text-yellow-500" />,
      action: () => runContextualAnalysis('coherence')
    },
    {
      value: 'cohesion',
      label: 'Check Cohesion',
      icon: <Zap className="h-3.5 w-3.5 text-blue-500" />,
      action: () => runContextualAnalysis('cohesion')
    },
    {
      value: 'focus',
      label: 'Check Focus',
      icon: <Zap className="h-3.5 w-3.5 text-purple-500" />,
      action: () => runContextualAnalysis('focus')
    },
    {
      value: 'all',
      label: 'Analyze Everything',
      icon: <Zap className="h-3.5 w-3.5" />,
      action: () => runContextualAnalysis('all')
    }
  ], [runContextualAnalysis]);

  const handleAddInsight = useCallback((content: string, highlightedText: string, highlightStyle?: string) => {
    console.log('Adding insight:', { content, highlightedText, highlightStyle });
    const newId = Date.now();
    const newInsight: AIInsight = {
      id: newId,
      content,
      type: 'comment',
      highlightedText,
      highlightStyle,
      isHighlighted: true
    };
    setInsights(prev => {
      const newInsights = [...prev, newInsight];
      console.log('New insights state:', newInsights);
      return newInsights;
    });
    setSelectedInsight(newId);
    setShowCommentInput(false);
    setPendingComment(null);
    setIsInsightsOpen(true);
  }, []);

  // Log insights whenever they change
  useEffect(() => {
    console.log('Current insights:', insights);
  }, [insights]);

  const handleStartComment = useCallback((text: string, highlightStyle: string) => {
    setPendingComment({ text, highlightStyle });
    setShowCommentInput(true);
    setIsInsightsOpen(true);
  }, []);

  const handleStartEdit = useCallback((insight: AIInsight) => {
    setPendingComment({ 
      text: insight.highlightedText || '', 
      highlightStyle: insight.highlightStyle || '',
      editingId: insight.id 
    });
    setShowCommentInput(true);
    setIsEditingComment(true);
    setSelectedInsight(insight.id);
  }, []);

  const handleFinishEdit = useCallback(() => {
    setShowCommentInput(false);
    setPendingComment(null);
    setIsEditingComment(false);
    setSelectedInsight(null);
  }, []);

  // Update highlights when selection changes
  useEffect(() => {
    if (selectedInsight === null) {
      setInsights(prev => prev.map(insight => ({ ...insight, isHighlighted: false })));
    } else {
      setInsights(prev => prev.map(insight => ({
        ...insight,
        isHighlighted: insight.id === selectedInsight
      })));
    }
  }, [selectedInsight]);

  const handleEditComment = useCallback((insightId: number, newContent: string) => {
    setInsights(prev => prev.map(insight => 
      insight.id === insightId 
        ? { ...insight, content: newContent }
        : insight
    ));
  }, []);

  const handleDeleteInsight = useCallback((insightId: number) => {
    setInsights(prev => prev.filter(insight => insight.id !== insightId));
    setSelectedInsight(null);
  }, []);

  const focusCommentWithActiveId = (id: string) => {
    if (!commentsSectionRef.current) return;

    const commentInput = commentsSectionRef.current.querySelector<HTMLTextAreaElement>(`textarea#${id}`);
    if (!commentInput) return;

    commentInput.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    });
    commentInput.focus();
  };

  useEffect(() => {
    if (!activeCommentId) return;
    focusCommentWithActiveId(activeCommentId);
  }, [activeCommentId]);

  const handleAddComment = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;

    const quotedText = editor.state.doc.textBetween(from, to);
    const commentId = `c${Date.now()}`;
    const newComment: CommentType = {
      id: commentId,
      content: '',
      createdAt: new Date(),
      quotedText
    };

    setComments(prev => [...prev, newComment]);
    editor.chain().setComment(commentId).run();
    setActiveCommentId(commentId);
    setIsInsightsOpen(true);
    
    // Small delay to ensure the DOM is updated
    setTimeout(() => {
      const textarea = document.getElementById(commentId) as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
      }
    }, 50);
  }, [editor]);

  const handleSuggestEdit = useCallback(() => {
    if (!editor) return;
    
    const { from, to } = editor.state.selection;
    if (from === to) return; // No selection
    
    const quotedText = editor.state.doc.textBetween(from, to);
    
    // Show a prompt for the suggested edit
    const suggestedText = window.prompt('Suggest an edit:', quotedText);
    if (!suggestedText) return;

    // Add the edit to the comment system - but don't apply mark if we changed the name
    const commentId = `c${Date.now()}`;
    const newComment: CommentType = {
      id: commentId,
      content: 'Suggested Edit',
      createdAt: new Date(),
      quotedText,
      suggestedEdit: {
        original: quotedText,
        suggested: suggestedText
      }
    };

    setComments(prev => [...prev, newComment]);
    setActiveCommentId(commentId);
    setIsInsightsOpen(true);
  }, [editor]);

  return (
    <div className={cn("w-full h-full relative", className)}>
      <InsightsContext.Provider value={[insights, setInsights]}>
        <div className="h-full flex flex-col">
          <div className="sticky top-4 z-30">
            <div className="mx-4 rounded-lg overflow-hidden border border-border/40">
              <div className="px-4 py-2 border-b border-border/40 bg-blue-100/60 dark:bg-blue-900/10 backdrop-blur supports-[backdrop-filter]:bg-blue-100/40 dark:supports-[backdrop-filter]:bg-blue-900/5">
                <div className="flex items-center justify-between space-x-4">
                  {/* Left section */}
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-stone-200 dark:bg-zinc-700" />
                      <span className="text-sm font-semibold">Ripple</span>
                    </div>
                    <div className="w-[1px] h-7 bg-border/40 dark:bg-zinc-800 rounded-full" />
                    <input 
                      type="text" 
                      value={documentTitle}
                      onChange={(e) => setDocumentTitle(e.target.value)}
                      placeholder="Untitled document"
                      className="bg-transparent border-none text-sm focus:outline-none focus:ring-0 p-0 h-6 text-stone-800 dark:text-zinc-100"
                    />
                    <div className="w-[1px] h-7 bg-border/40 dark:bg-zinc-800 rounded-full" />
                    <ModeToggle />
                    <div className="w-[1px] h-7 bg-border/40 dark:bg-zinc-800 rounded-full" />
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="h-7 px-3 text-xs flex items-center space-x-2"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>Save</span>
                        <span className="text-xs text-muted-foreground ml-1">{isMac ? '⌘S' : 'Ctrl+S'}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSaveAs}
                        disabled={isSaving}
                        className="h-7 px-3 text-xs flex items-center space-x-2"
                      >
                        <FileDown className="h-3.5 w-3.5" />
                        <span>Save As</span>
                      </Button>
                    </div>
                  </div>

                  {/* Right section */}
                  <div className="flex items-center space-x-4">
                    <div className="flex space-x-1 text-sm">
                      <ActionSelect
                        label="Check for Feedback"
                        items={feedback_items}
                      />
                    </div>
                    <div className="w-[1px] h-7 bg-border/40 dark:bg-zinc-800 rounded-full" />
                    <Button
                      variant={isInsightsOpen ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setIsInsightsOpen(!isInsightsOpen)}
                      className="h-7 px-3 text-xs flex items-center space-x-1"
                    >
                      <LightbulbIcon className="h-3.5 w-3.5" />
                      <span>Insights</span>
                    </Button>
                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-3 text-xs flex items-center space-x-1"
                          disabled={isAnalyzing}
                          onClick={runAnalysis}
                        >
                          {isAnalyzing ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Analyzing...</span>
                            </>
                          ) : (
                            <>
                              <Zap className="h-3.5 w-3.5" />
                              <span>Analyze</span>
                              {analysisResult && (
                                <span className="ml-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-[10px]">
                                  {formatScore(analysisResult.coherence.score)}
                                </span>
                              )}
                            </>
                          )}
                        </Button>
                        
                        {/* Analysis Results Dropdown */}
                        {analysisResult && (
                          <div className="absolute right-0 mt-2 w-80 rounded-md shadow-lg bg-background border border-border/40 z-50 overflow-hidden">
                            <div className="p-3 space-y-3">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium">Analysis Results</h3>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0"
                                  onClick={() => setAnalysisResult(null)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              
                              <div className="space-y-3">
                                {/* Coherence */}
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-medium">Coherence</h4>
                                    <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full">
                                      {formatScore(analysisResult.coherence.score)}
                                    </span>
                                  </div>
                                  {analysisResult.coherence.issues.length > 0 ? (
                                    <ul className="text-xs space-y-1 pl-4 list-disc">
                                      {analysisResult.coherence.issues.map((issue: any, i: number) => (
                                        <li key={i}>{issue.issue}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">No coherence issues found!</p>
                                  )}
                                </div>
                                
                                {/* Cohesion */}
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-medium">Cohesion</h4>
                                    <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full">
                                      {formatScore(analysisResult.cohesion.score)}
                                    </span>
                                  </div>
                                  {analysisResult.cohesion.transitions.missing_between.length > 0 ? (
                                    <ul className="text-xs space-y-1 pl-4 list-disc">
                                      {analysisResult.cohesion.transitions.missing_between.map((issue: any, i: number) => (
                                        <li key={i}>Missing transition between sentences</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">No cohesion issues found!</p>
                                  )}
                                </div>
                                
                                {/* Focus */}
                                <div className="space-y-1">
                                  <h4 className="text-xs font-medium">Focus</h4>
                                  <p className="text-xs">Main idea: {analysisResult.focus.mainIdea}</p>
                                  {analysisResult.focus.unfocused_elements.length > 0 ? (
                                    <ul className="text-xs space-y-1 pl-4 list-disc">
                                      {analysisResult.focus.unfocused_elements.map((element: any, i: number) => (
                                        <li key={i}>{element.issue}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">Text is well-focused!</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleAIPanel}
                        className="h-7 px-3 text-xs flex items-center space-x-1"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Chat</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <EditorToolbar 
                editor={editor} 
                hasSelection={!!editor?.state.selection.content()}
                onAddComment={handleAddComment}
                onSuggestEdit={handleSuggestEdit}
                showParagraphTopics={showParagraphTopics}
                showEssayTopics={showEssayTopics}
                onToggleParagraphTopics={toggleParagraphTopics}
                onToggleEssayTopics={toggleEssayTopics}
              />
              <div className="flex-1 overflow-auto bg-[#FAF9F6] dark:bg-background/10">
                <div className="mx-auto relative" style={{ width: '794px' }}>
                  <div className="py-12">
                    <div className="relative bg-[#FFFDF7] dark:bg-card shadow-sm">
                      <AIContextMenu 
                        editor={editor}
                        onSelectAsParagraphTopic={handleSelectAsParagraphTopic}
                        onSelectAsEssayTopic={handleSelectAsEssayTopic}
                        comments={comments}
                        setComments={setComments}
                        activeCommentId={activeCommentId}
                        setActiveCommentId={setActiveCommentId}
                        onAddComment={handleAddComment}
                      >
                        <EditorContent editor={editor} />
                      </AIContextMenu>
                    </div>
                  </div>

                  {/* Comments Section */}
                  <div 
                    ref={commentsSectionRef} 
                    className={cn(
                      "absolute top-0 right-0 w-[300px] space-y-2 py-12",
                      "transition-all duration-150 ease-in-out",
                      isInsightsOpen 
                        ? "opacity-100 pointer-events-auto translate-x-0" 
                        : "opacity-0 pointer-events-none translate-x-8"
                    )}
                    style={{
                      right: "-332px"
                    }}
                  >
                    {comments.length === 0 ? (
                      <div className="text-center text-muted-foreground pt-8">
                        No comments yet
                      </div>
                    ) : (
                      comments.map((comment) => (
                        <Card 
                          key={comment.id}
                          className={cn(
                            "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
                            "border border-border/40 shadow-sm transition-all duration-200",
                            activeCommentId === comment.id && "ring-2 ring-blue-500"
                          )}
                        >
                          <CardContent className="p-3">
                            <div className="flex flex-col space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">
                                    {comment.suggestedEdit ? 'Suggested Edit' : 'Comment'}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(comment.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {comment.suggestedEdit && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => {
                                          if (!editor) return;
                                          
                                          // Find the comment mark
                                          let foundPos: { from: number; to: number } | null = null;
                                          editor.state.doc.descendants((node, pos) => {
                                            const mark = node.marks.find(m => 
                                              m.type.name === 'comment' && 
                                              m.attrs.commentId === comment.id
                                            );
                                            if (mark) {
                                              foundPos = { from: pos, to: pos + node.nodeSize };
                                              return false;
                                            }
                                          });

                                          if (foundPos && comment.suggestedEdit) {
                                            // Apply the suggested edit
                                            editor
                                              .chain()
                                              .focus()
                                              .setTextSelection(foundPos)
                                              .insertContent(comment.suggestedEdit.suggested)
                                              .unsetComment(comment.id)
                                              .run();
                                            
                                            setComments(prev => prev.filter(c => c.id !== comment.id));
                                          }
                                        }}
                                      >
                                        <Check className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => {
                                          editor?.chain().focus().unsetComment(comment.id).run();
                                          setComments(comments.filter(c => c.id !== comment.id));
                                        }}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </>
                                  )}
                                  {!comment.suggestedEdit && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => setActiveCommentId(comment.id)}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => {
                                          editor?.chain().focus().unsetComment(comment.id).run();
                                          setComments(comments.filter(c => c.id !== comment.id));
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                              {comment.quotedText && (
                                <div 
                                  className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md cursor-pointer hover:bg-muted/70"
                                  onClick={() => {
                                    if (!editor) return;
                                    
                                    // Find the comment mark
                                    let foundPos: { from: number; to: number } | null = null;
                                    editor.state.doc.descendants((node, pos) => {
                                      const mark = node.marks.find(m => 
                                        m.type.name === 'comment' && 
                                        m.attrs.commentId === comment.id
                                      );
                                      if (mark) {
                                        foundPos = { from: pos, to: pos + node.nodeSize };
                                        return false;
                                      }
                                    });

                                    if (foundPos) {
                                      editor
                                        .chain()
                                        .focus()
                                        .setTextSelection(foundPos)
                                        .run();

                                      const selection = window.getSelection();
                                      if (selection && selection.rangeCount > 0) {
                                        const range = selection.getRangeAt(0);
                                        const rect = range.getBoundingClientRect();
                                        if (rect.top < 0 || rect.bottom > window.innerHeight) {
                                          editor.commands.scrollIntoView();
                                        }
                                      }
                                    }
                                  }}
                                >
                                  {comment.suggestedEdit ? (
                                    <div className="suggest-edit-container">
                                      <div>
                                        <div className="suggest-edit-label">Current Text</div>
                                        <div className="suggest-edit-deletion">{comment.suggestedEdit?.original || ''}</div>
                                      </div>
                                      <div>
                                        <div className="suggest-edit-label">New Text</div>
                                        <div className="suggest-edit-addition">{comment.suggestedEdit?.suggested || ''}</div>
                                      </div>
                                    </div>
                                  ) : (
                                    `"${comment.quotedText}"`
                                  )}
                                </div>
                              )}
                              <div className={cn(
                                "text-sm",
                                activeCommentId === comment.id && "bg-muted rounded-md p-2"
                              )}>
                                {activeCommentId === comment.id ? (
                                  <div className="space-y-2">
                                    <div className="relative">
                                      {comment.suggestedEdit ? (
                                        <textarea
                                          id={comment.id}
                                          value={comment.suggestedEdit.suggested}
                                          onChange={(e) => {
                                            setComments(prev => prev.map(c => 
                                              c.id === comment.id 
                                                ? { 
                                                    ...c, 
                                                    suggestedEdit: {
                                                      ...c.suggestedEdit!,
                                                      suggested: e.target.value
                                                    }
                                                  }
                                                : c
                                            ));
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                              e.preventDefault();
                                              setActiveCommentId(null);
                                            }
                                          }}
                                          placeholder="Edit suggestion..."
                                          className="w-full min-h-[60px] bg-transparent border-none p-0 resize-none focus:outline-none focus:ring-0"
                                          autoFocus
                                        />
                                      ) : (
                                        <textarea
                                          id={comment.id}
                                          value={comment.content}
                                          onChange={(e) => {
                                            setComments(prev => prev.map(c => 
                                              c.id === comment.id 
                                                ? { ...c, content: e.target.value }
                                                : c
                                            ));
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                              e.preventDefault();
                                              setActiveCommentId(null);
                                            }
                                          }}
                                          placeholder="Add a comment..."
                                          className="w-full min-h-[60px] bg-transparent border-none p-0 resize-none focus:outline-none focus:ring-0"
                                          autoFocus
                                        />
                                      )}
                                    </div>
                                    <div className="flex justify-end">
                                      <Button
                                        size="sm"
                                        className="h-7 text-xs flex items-center gap-1.5"
                                        onClick={() => setActiveCommentId(null)}
                                      >
                                        Save <span className="opacity-60">⏎</span>
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  comment.suggestedEdit ? null : comment.content || "No content"
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <AISidePanel 
          isOpen={isAIPanelOpen} 
          onClose={toggleAIPanel} 
          selectedText={selectedText}
        />
      </InsightsContext.Provider>
    </div>
  );
} 