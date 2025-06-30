// Key import changes needed
import { useEffect, useState, useCallback, createContext, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import { cn } from "@/lib/utils";
import { EditorView } from 'prosemirror-view';
import { HelpCircle, Loader2 } from 'lucide-react';  // Add missing Lucide icons
import { AIContextMenu } from '../AIContextMenu';
import { EditorToolbar } from '../EditorToolbar';
import { CommentExtension } from '../../extensions/Comment';
import { SuggestEditExtension } from '../../extensions/SuggestEdit';
import { CommentModeMark, FlowModeMark, SentenceConnectionModeMark } from "@/extensions/HighlightingModes";
import { HighlightingManager, HighlightingMode } from '@/lib/highlighting-manager';
import { SentenceFlowActionPanel } from '../SentenceFlowActionPanel';
import '@/styles/comment.css';
import '@/styles/highlighting-modes.css';
import { AISidePanel } from '../AISidePanel';
import { toast } from "sonner";
import { HelpSplashScreen } from '../HelpSplashScreen';
import { EditorHeader } from './EditorHeader';
import { CommentsList } from './CommentsList';
import { AIInsight, EditorProps, CommentType, dbCommentToUiComment } from './types';
import { useAuth } from '@/lib/auth-context';
import { FileService } from '@/lib/file-service';
import { EventType } from '@/lib/event-logger';
import { logEvent } from '@/lib/event-logger';
import { analyzeTextWithContext } from '@/lib/api';
import { highlightDebugger } from '@/lib/highlighting-debug';
import '@/lib/test-prosemirror-search'; // Import to make test functions globally available

// Create a context for insights
export const InsightsContext = createContext<[AIInsight[], React.Dispatch<React.SetStateAction<AIInsight[]>>]>([[], () => { }]);

export function EditorContainer({
  className = '',
  onEditorChange,
  eventBatcher
}: EditorProps): JSX.Element | null {
  const { user } = useAuth();
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [documentTitle, setDocumentTitle] = useState('Untitled document');
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [essayTopicHighlight, setEssayTopicHighlight] = useState<{ from: number, to: number } | null>(null);
  const [paragraphTopicHighlights, setParagraphTopicHighlights] = useState<{ [paragraphId: string]: { from: number, to: number } }>({});
  const [selectedText, setSelectedText] = useState('');
  const [showParagraphTopics, setShowParagraphTopics] = useState(false);
  const [showEssayTopics, setShowEssayTopics] = useState(false);

  // Add new state variables to store the actual text content
  const [paragraphTopicTexts, setParagraphTopicTexts] = useState<{ [paragraphId: string]: string }>({});
  const [essayTopicText, setEssayTopicText] = useState<string>('');

  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [fileService] = useState<FileService | null>(user ? new FileService(user.id) : null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add state for focused comment to sync between editor and sidebar
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);

  // Ref to trigger comment sorting from parent component
  const sortCommentsRef = useRef<(() => void) | null>(null);

  // Add HighlightingManager state
  const [highlightingManager, setHighlightingManager] = useState<HighlightingManager | null>(null);
  const [popoverTrigger, setPopoverTrigger] = useState(0); // State to force re-renders for popover

  // Add state for tracking analysis loading
  const [isAnalysisRunning, setIsAnalysisRunning] = useState(false);

  // Function to check if sentence flow analysis is running
  const [isSentenceFlowAnalyzing, setIsSentenceFlowAnalyzing] = useState(false);

  // Combined analysis state - true if either main analysis or sentence flow analysis is running
  const isAnyAnalysisRunning = isAnalysisRunning || isSentenceFlowAnalyzing;

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
        },
        onCommentClicked: (commentId: string) => {
          console.log('onCommentClicked triggered for:', commentId);

          // Check if we're in write mode - if so, ignore comment interactions for distraction-free writing
          if (highlightingManager && highlightingManager.getCurrentMode() === 'write') {
            console.log('Write mode is active - ignoring comment click for distraction-free writing');
            return;
          }

          // Only allow comment focus actions in comments mode
          if (highlightingManager && highlightingManager.getCurrentMode() !== 'comments') {
            console.log('Not in comments mode - ignoring comment click focus actions');
            return;
          }

          console.log('Available comments:', comments);

          // Instead of duplicating logic, trigger the sidebar comment item click
          // This ensures both editor and sidebar clicks use the same exact logic
          const commentItemElement = document.querySelector(`[data-comment-item="${commentId}"]`) as HTMLElement;

          if (commentItemElement) {
            console.log('Found sidebar comment item, triggering click:', commentItemElement);
            // Programmatically trigger the click on the sidebar comment item
            commentItemElement.click();
          } else {
            console.log('Comment item not found in sidebar for ID:', commentId);

            // Fallback to direct focus mode handling if sidebar item not found
            const isCurrentlyFocused = focusedCommentId === commentId;

            if (isCurrentlyFocused) {
              console.log('Comment already focused, exiting focus mode');
              // Exit focus mode
              const editorElement = editor?.view.dom.closest('.ProseMirror') || editor?.view.dom;
              if (editorElement) {
                editorElement.classList.remove('focus-mode-active');
                editorElement.removeAttribute('data-focused-comment');

                // Remove focused-comment classes from all elements
                const focusedElements = document.querySelectorAll('.focused-comment');
                focusedElements.forEach(el => {
                  el.classList.remove('focused-comment');
                });
              }
              setFocusedCommentId(null);
              return;
            }

            // Find the comment and trigger focus mode
            const comment = comments.find(c => c.id === commentId);
            console.log('Found comment:', comment);

            if (comment) {
              // Enter focus mode for this comment
              const editorElement = editor?.view.dom.closest('.ProseMirror') || editor?.view.dom;
              if (editorElement) {
                console.log('Entering focus mode for comment:', commentId);

                // Clear any existing focus states
                const allFocusedElements = document.querySelectorAll('.focused-comment');
                allFocusedElements.forEach(el => {
                  el.classList.remove('focused-comment');
                });

                // Enter focus mode
                editorElement.classList.add('focus-mode-active');
                editorElement.setAttribute('data-focused-comment', commentId);

                // Add focused-comment class to the clicked comment elements
                const commentElements = document.querySelectorAll(`[data-comment-id="${commentId}"]`);
                console.log('Found comment elements to focus:', commentElements);
                commentElements.forEach(el => {
                  el.classList.add('focused-comment');
                });
              }

              // Update shared state
              setFocusedCommentId(commentId);
            } else {
              console.log('Comment not found in comments array');
            }
          }
        },
      }),
      SuggestEditExtension.configure({
        HTMLAttributes: {
          class: 'tiptap-suggest-edit',
        },
        onSuggestEdit: (original: string, suggested: string) => {
          console.log('Suggested edit:', { original, suggested });
        },
      }),
      CommentModeMark,
      FlowModeMark,
      SentenceConnectionModeMark,
    ],
    content: '',
    // Disable editor when any analysis is running
    editable: !isAnyAnalysisRunning,
    editorProps: {
      attributes: {
        class: cn(
          "outline-none min-h-[1028px] text-[11pt]",
          "px-[64px] py-[84px]",
          "text-stone-800 dark:text-zinc-400",
          "caret-blue-500",
          "[&>div]:min-h-[24px]",
          "[&>div]:break-words",
          "[&>div]:max-w-[666px]",
          // Add loading styles when any analysis is running
          isAnyAnalysisRunning && "pointer-events-none cursor-wait opacity-75"
        ),
      },
      handleKeyDown: (_view: EditorView, event: KeyboardEvent) => {
        // Prevent all input when any analysis is running
        if (isAnyAnalysisRunning) {
          event.preventDefault();
          return true;
        }

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
          editor?.chain().unsetHighlight().run();
        }

        return false; // Let the default handler run
      },
      handlePaste: (_view: EditorView, event: ClipboardEvent) => {
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
      // If this update was triggered by the user typing (not by a programmatic change),
      // we should remove any highlighting at the current cursor position
      if (transaction.docChanged && transaction.steps.some(step => step.toJSON().stepType === 'replace')) {
        editor.chain().unsetHighlight().run();
      }
    },
  });

  // Now we can check if editor is null
  if (!editor) {
    return null; // Ensure a return value when the editor is not initialized
  }

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
  }, []);

  // Initialize file service when user changes
  useEffect(() => {
    if (user && fileService) {
      fileService.updateUserId(user.id);
    }
  }, [user, fileService]);

  // Load saved content on mount
  useEffect(() => {
    const loadInitialContent = async () => {
      try {
        const saved = localStorage.getItem('ripple-doc');
        if (saved && editor) {
          const {
            title,
            content,
            comments: savedComments = [],
            paragraphTopicHighlights: savedParagraphTopicHighlights = {},
            essayTopicHighlight: savedEssayTopicHighlight = null,
            paragraphTopicTexts: savedParagraphTopicTexts = {},
            essayTopicText: savedEssayTopicText = ''
          } = JSON.parse(saved);

          // First check localStorage for backward compatibility
          setDocumentTitle(title);
          setComments(savedComments);
          setParagraphTopicHighlights(savedParagraphTopicHighlights);
          setEssayTopicHighlight(savedEssayTopicHighlight);
          setParagraphTopicTexts(savedParagraphTopicTexts);
          setEssayTopicText(savedEssayTopicText);
          editor.commands.setContent(content);
        }

        // Then try to load most recent file from database if user is logged in
        if (user && fileService && editor) {
          const files = await fileService.getAllFiles();
          if (files.length > 0) {
            const mostRecent = files[0]; // Files are ordered by updated_at desc
            setDocumentTitle(mostRecent.title);
            setCurrentFileId(mostRecent.id);
            editor.commands.setContent(mostRecent.content);

            // Load comments for this file
            console.log("Loading comments for file:", mostRecent.id);
            const dbComments = await fileService.getComments(mostRecent.id);
            console.log("Retrieved database comments:", dbComments);
            
            if (dbComments && dbComments.length > 0) {
              // Convert DB comments to UI comments
              const uiComments = dbComments.map(dbComment => dbCommentToUiComment(dbComment));
              
              console.log("Setting UI comments:", uiComments);
              setComments(uiComments);
              
              // Apply comment marks to the editor content
              uiComments.forEach(comment => {
                if (comment.from !== undefined && comment.to !== undefined) {
                  editor.commands.setTextSelection({
                    from: comment.from,
                    to: comment.to
                  });
                  editor.chain().setComment(comment.id).run();
                }
              });
              
              // Reset selection after applying marks
              editor.commands.setTextSelection(0);
            } else {
              console.log("No comments found for file:", mostRecent.id);
              setComments([]);
            }

            // Log file open event
            eventBatcher?.addEvent(EventType.FILE_OPEN, {
              file_id: mostRecent.id,
              title: mostRecent.title
            });
          }
        }
      } catch (error) {
        console.error('Error loading initial content:', error);
      }
    };

    loadInitialContent();
  }, [editor, user, fileService, eventBatcher]);

  const getSelectedText = useCallback(() => {
    if (!editor) return '';

    const { from, to } = editor.state.selection;
    if (from === to) return ''; // No selection

    // Log text selection event
    if (eventBatcher && user) {
      eventBatcher.addEvent(EventType.TEXT_SELECTION, {
        length: to - from,
        selection_text: editor.state.doc.textBetween(from, to).substring(0, 100) // Limit to first 100 chars
      });
    }

    return editor.state.doc.textBetween(from, to);
  }, [editor, eventBatcher, user]);

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

  // Rest of the component code...

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

  // Add debug utilities to window for manual testing
  useEffect(() => {
    if (editor && typeof window !== 'undefined') {
      (window as any).rippleDebug = {
        debugText: (text: string) => highlightDebugger.quickDebug(editor, text),
        debugComment: (comment: any) => highlightDebugger.debugComment(editor, comment, editor.state.doc.textContent),
        editor: editor
      };
    }
  }, [editor]);

  // Now add the selection handlers after the toggle state variables
  const handleSelectAsParagraphTopic = useCallback(() => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    if (from === to) return; // No selection

    // Get the paragraph node that contains the selection
    const resolvedPos = editor.state.doc.resolve(from);
    const paragraph = resolvedPos.node(1); // Assuming paragraphs are at depth 1

    if (paragraph) {
      const paragraphId = paragraph.attrs.id || resolvedPos.before(1).toString();

      // Extract the actual text content
      const selectedText = editor.state.doc.textBetween(from, to);

      console.log("Paragraph Topic Selected:", {
        paragraphId,
        position: { from, to },
        text: selectedText
      });

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

      // Store the actual text content
      setParagraphTopicTexts(prev => ({
        ...prev,
        [paragraphId]: selectedText
      }));

      // Log the updated state values
      setTimeout(() => {
        console.log("Updated paragraph topic states:", {
          highlights: paragraphTopicHighlights,
          texts: paragraphTopicTexts
        });
      }, 0);

      toast.success("Paragraph topic set");
    }
  }, [editor, paragraphTopicHighlights, paragraphTopicTexts, showParagraphTopics]);

  const handleSelectAsEssayTopic = useCallback(() => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    if (from === to) return; // No selection

    // Extract the actual text content
    const selectedText = editor.state.doc.textBetween(from, to);

    console.log("Essay Topic Selected:", {
      position: { from, to },
      text: selectedText
    });

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

    // Store the actual text content
    setEssayTopicText(selectedText);

    // Log the updated state values
    setTimeout(() => {
      console.log("Updated essay topic states:", {
        highlight: essayTopicHighlight,
        text: essayTopicText
      });
    }, 0);

    toast.success("Essay topic set");
  }, [editor, essayTopicHighlight, essayTopicText, showEssayTopics]);

  // Get the entire document content
  const getDocumentContent = useCallback(() => {
    if (!editor) return '';
    return editor.getHTML();
  }, [editor]);

  // Function to run contextual analysis
  const runContextualAnalysis = useCallback(async (analysisType: 'all' | 'custom') => {
    if (!editor) return;

    setIsAnalysisRunning(true);

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
        flowPrompt: 'Highlight important arguments with high emphasis, supporting details with medium emphasis, and transitions with low emphasis' // Always include flow prompt for integrated analysis
      });

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
        }
      } else {
        console.log('ℹ️ No flow highlights returned or HighlightingManager not available');
      }

      if (response.data.comments?.length > 0) {
        const newComments: CommentType[] = [];

        response.data.comments.forEach((comment, index) => {
          const textToFind = comment.highlightedText;

          // Debug the first few comments to understand what's happening
          if (index < 3) {
            console.log(`\n🔍 DEBUGGING COMMENT ${index + 1}:`);
            highlightDebugger.debugComment(editor, comment, fullContent);
          }

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

        // Trigger comment sorting to include new comments
        setTimeout(() => {
          if (sortCommentsRef.current) {
            sortCommentsRef.current();
          }
        }, 50);

        // Scroll to the most recently created comment after a short delay
        if (newComments.length > 0) {
          setTimeout(() => {
            const mostRecentComment = newComments[newComments.length - 1];
            const commentElement = document.querySelector(`[data-comment-item="${mostRecentComment.id}"]`);
            if (commentElement) {
              commentElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
              });
            }
          }, 100);
        }
      }

      // Clear any text selection after analysis completes
      if (editor) {
        editor.commands.focus('end');
      }

    } catch (error) {
      console.error('Error running contextual analysis:', error);
      toast.error("Analysis failed. Please try again.");
    } finally {
      setIsAnalysisRunning(false);
    }
  }, [editor, setComments, setIsInsightsOpen, highlightingManager, setIsAnalysisRunning]);

  const handleAddComment = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;

    const quotedText = editor.state.doc.textBetween(from, to);
    const commentId = crypto.randomUUID();
    const newComment: CommentType = {
      id: commentId,
      createdAt: new Date(),
      quotedText,
      content: '',
      createdAtTime: new Date(),
      from,
      to
    };

    console.log("Adding new comment:", newComment);
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
      createdAt: new Date(),
      quotedText,
      content: ''
    };

    setComments(prev => [...prev, newComment]);
    setActiveCommentId(commentId);
    setIsInsightsOpen(true);
  }, [editor]);

  // Check if this is the user's first visit
  useEffect(() => {
    const hasVisitedBefore = localStorage.getItem('ripple-has-visited');
    if (!hasVisitedBefore) {
      // Show help panel after a short delay for first-time visitors
      setTimeout(() => {
        setIsHelpOpen(true);
        setIsFirstVisit(true);
        // Set flag for future visits
        localStorage.setItem('ripple-has-visited', 'true');
      }, 1000);
    }
  }, []);

  // Save document content
  const handleSave = useCallback(async () => {
    if (!editor || !fileService) return;

    try {
      // Log what we're saving
      console.log("Saving document with topics:", {
        paragraphTopicHighlights,
        paragraphTopicTexts,
        essayTopicHighlight,
        essayTopicText
      });

      console.log("Current comments being saved:", comments);

      // Save to localStorage for backup
      localStorage.setItem('ripple-doc', JSON.stringify({
        title: documentTitle,
        content: editor.getHTML(),
        comments,
        paragraphTopicHighlights,
        essayTopicHighlight,
        paragraphTopicTexts,
        essayTopicText,
        lastSaved: new Date().toISOString()
      }));


      try {
        const content = editor.getHTML();

        // Save the file content first
        let fileId = currentFileId;
        if (!fileId) {
          // Create a new file if we don't have one
          const fileData = await fileService.saveFile(documentTitle, content);
          if (fileData) {
            fileId = fileData.id;
            setCurrentFileId(fileId);
          } else {
            throw new Error("Failed to create file");
          }
        } else {
          // Update the existing file
          await fileService.saveFile(documentTitle, content, fileId);
        }

        // Now save the comments if we have a file ID
        if (fileId) {
          console.log(`Preparing to save ${comments.length} comments for file ID: ${fileId}`);
          
          // Check if comments array is valid
          if (!Array.isArray(comments)) {
            console.error("Comments is not an array:", comments);
            throw new Error("Comments is not a valid array");
              }

          if (comments.length > 0) {
            // Verify comment structure
            console.log("Comment samples before saving:", comments.slice(0, 2));
            
            const saveResult = await fileService.saveComments(fileId, comments);
            console.log("Comment save result:", saveResult);

            if (!saveResult) {
              console.warn("Comments may not have saved successfully");
            }
                } else {
            console.log("No comments to save");
              }
            }

        toast.success("Document saved successfully");
      } catch (e: any) {
        console.error("Error saving document", e);
        logEvent(user?.id || 'anonymous', EventType.ERROR, {
          error: e.message,
        });
        toast.error("Failed to save document");
      }
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error("Failed to save document");
    }
  }, [editor, fileService, documentTitle, comments, currentFileId, 
      paragraphTopicHighlights, paragraphTopicTexts, 
      essayTopicHighlight, essayTopicText, user]);


  // Function to update the positions of comments when the document changes
  const updateCommentPositions = useCallback(() => {
    if (!editor) return;

    // Update all comment positions
    setComments(prevComments => {
      return prevComments.map((comment: CommentType) => {
        // Find the comment mark in the document
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

        // If found, update the positions
        if (foundPos) {
          const position = foundPos as { from: number; to: number };
          return {
            ...comment,
            from: position.from,
            to: position.to,
            quotedText: editor.state.doc.textBetween(position.from, position.to)
          };
        }

        return comment;
      });
    });
  }, [editor, setComments]);

  // Add an event handler for document changes
  useEffect(() => {
    if (!editor) return;

    const handleDocChange = () => {
      // Debounce the update to avoid excessive recalculations
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(updateCommentPositions, 500);
    };

    editor.on('update', handleDocChange);

    return () => {
      editor.off('update', handleDocChange);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [editor, updateCommentPositions]);

  // Add global click handler to exit focus mode when clicking outside comments
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      if (!focusedCommentId) return;

      const target = event.target as HTMLElement;

      // Check if the click is on a comment in the editor
      const isCommentInEditor = target.closest('[data-comment-id]') || target.hasAttribute('data-comment-id');

      // Check if the click is on a comment item in the sidebar
      const isCommentItem = target.closest('[data-comment-item]') || target.closest('.cursor-pointer');

      // Check if the click is inside the comments sidebar
      const isInCommentsSidebar = target.closest('[data-comments-sidebar]');

      // Check if the click is on any interactive element that shouldn't trigger unfocus
      const isInteractiveElement = target.closest('button, input, textarea, select, [role="button"]');

      // Exit focus mode if clicking outside of comments and not on interactive elements
      if (!isCommentInEditor && !isCommentItem && !isInteractiveElement) {
        console.log('Global click detected, exiting focus mode');

        // Exit focus mode
        const editorElement = editor?.view.dom.closest('.ProseMirror') || editor?.view.dom;
        if (editorElement?.classList.contains('focus-mode-active')) {
          editorElement.classList.remove('focus-mode-active');
          editorElement.removeAttribute('data-focused-comment');

          // Remove focused-comment classes from all elements
          const focusedElements = document.querySelectorAll('.focused-comment');
          focusedElements.forEach(el => {
            el.classList.remove('focused-comment');
          });
        }

        setFocusedCommentId(null);
      }
    };

    // Add the event listener
    document.addEventListener('click', handleGlobalClick, true);

    // Cleanup
    return () => {
      document.removeEventListener('click', handleGlobalClick, true);
    };
  }, [focusedCommentId, editor]);

  // Initialize highlighting manager when editor is ready
  useEffect(() => {
    if (editor && !highlightingManager) {
      console.log('🎨 Creating HighlightingManager in EditorContainer');
      const manager = new HighlightingManager(editor, (mode: HighlightingMode) => {
        console.log(`📊 Highlighting Manager: Mode changed to ${mode}`);
        // Force a re-render when highlighting manager state changes
        setPopoverTrigger(prev => prev + 1);
      });
      setHighlightingManager(manager);

      // Expose globally for debugging
      (window as any).highlightingManager = manager;

      // Set initial mode to comments
      manager.switchMode('comments');

      // Set up flow hover listeners
      manager.setupFlowHoverListeners();
    }
  }, [editor, highlightingManager]);

  // Monitor sentence flow analysis state
  useEffect(() => {
    const checkSentenceFlowAnalysis = () => {
      const editorContainer = editor?.view.dom.closest('.editor-container');
      const isAnalyzing = editorContainer?.getAttribute('data-analyzing') === 'true';
      setIsSentenceFlowAnalyzing(isAnalyzing);
    };

    // Set up mutation observer to watch for data-analyzing attribute changes
    const editorContainer = editor?.view.dom.closest('.editor-container');
    if (editorContainer) {
      const observer = new MutationObserver(checkSentenceFlowAnalysis);
      observer.observe(editorContainer, {
        attributes: true,
        attributeFilter: ['data-analyzing']
      });

      // Initial check
      checkSentenceFlowAnalysis();

      return () => observer.disconnect();
    }
  }, [editor]);

  // Sentence flow popover action handlers
  const handleExitFlowMode = useCallback(() => {
    if (highlightingManager) {
      highlightingManager.exitFlowSentenceMode();
    }
  }, [highlightingManager]);

  const handleCopySentence = useCallback(() => {
    const popoverState = highlightingManager?.getSentenceFlowPopoverState();
    if (popoverState?.sentenceData?.text) {
      navigator.clipboard.writeText(popoverState.sentenceData.text);
      toast.success("Sentence copied to clipboard");
      highlightingManager?.hideSentenceFlowPopover();
    }
  }, [highlightingManager]);

  const handleAddCommentToSentence = useCallback(() => {
    // Find the selected sentence and add a comment to it
    if (highlightingManager && editor) {
      const selectedElement = editor.view.dom.querySelector('.flow-sentence-selected');
      if (selectedElement) {
        // Simulate a click to add comment functionality
        handleAddComment();
        highlightingManager.hideSentenceFlowPopover();
      }
    }
  }, [highlightingManager, editor, handleAddComment]);

  const handleAnalyzeConnections = useCallback(() => {
    // Re-run the sentence flow analysis
    if (highlightingManager && editor) {
      const selectedElement = editor.view.dom.querySelector('.flow-sentence-selected');
      if (selectedElement) {
        // Trigger a new analysis by simulating a click on the selected sentence
        const clickEvent = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true
        });
        selectedElement.dispatchEvent(clickEvent);
        highlightingManager.hideSentenceFlowPopover();
        toast.info("Re-analyzing sentence connections...");
      }
    }
  }, [highlightingManager, editor]);

  const handleExplainSentence = useCallback(() => {
    const popoverState = highlightingManager?.getSentenceFlowPopoverState();
    if (popoverState?.sentenceData?.text) {
      // TODO: Implement sentence explanation functionality
      toast.info("Sentence explanation feature coming soon!");
      highlightingManager?.hideSentenceFlowPopover();
    }
  }, [highlightingManager]);

  // Update highlighting manager with paragraph topics whenever they change
  useEffect(() => {
    if (highlightingManager && paragraphTopicTexts) {
      highlightingManager.setParagraphTopics(paragraphTopicTexts);
    }
  }, [highlightingManager, paragraphTopicTexts]);

  // Update highlighting manager with topics for hover functionality whenever they change
  useEffect(() => {
    if (highlightingManager) {
      highlightingManager.updateTopicsForHover(paragraphTopicTexts, essayTopicText);
    }
  }, [highlightingManager, paragraphTopicTexts, essayTopicText]);

  return (
    <div className={cn("w-full h-full relative", className)}>
      <InsightsContext.Provider value={[insights, setInsights]}>
        <div className="h-full flex flex-col">
          <div className="sticky top-0 z-[50] bg-background">
            <div className="rounded-lg overflow-hidden border border-border/40">
              <EditorHeader
                editor={editor}
                documentTitle={documentTitle}
                setDocumentTitle={setDocumentTitle}
                comments={comments}
                isInsightsOpen={isInsightsOpen}
                setIsInsightsOpen={setIsInsightsOpen}
                setIsHelpOpen={setIsHelpOpen}
                isHelpOpen={isHelpOpen}
                setComments={setComments}
                eventBatcher={eventBatcher}
                currentFileId={currentFileId}
                setCurrentFileId={setCurrentFileId}
                highlightingManager={highlightingManager}
                isAnalysisRunning={isAnalysisRunning}
                setIsAnalysisRunning={setIsAnalysisRunning}
                onLoadFile={(file) => {
                  setCurrentFileId(file.id);
                  setDocumentTitle(file.title);
                  editor.commands.setContent(file.content);
                  
                  // Load comments for this file
                  if (fileService) {
                    console.log("Loading comments for selected file:", file.id);
                    fileService.getComments(file.id).then(fileComments => {
                      console.log("Retrieved comments for selected file:", fileComments);
                      
                      // Convert DB comments to UI comments
                      const uiComments = fileComments.map(dbComment => dbCommentToUiComment(dbComment));
                      
                      console.log("Setting UI comments for selected file:", uiComments);
                      setComments(uiComments);
                      
                      // Apply comment marks to the editor content
                      uiComments.forEach(comment => {
                        if (comment.from !== undefined && comment.to !== undefined) {
                          editor.commands.setTextSelection({
                            from: comment.from,
                            to: comment.to
                          });
                          editor.chain().setComment(comment.id).run();
                        }
                      });
                      
                      // Reset selection after applying marks
                      editor.commands.setTextSelection(0);
                    });
                  }
                }}
              />
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
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-[#FAF9F6] dark:bg-background/10">
            <div className="mx-auto relative" style={{ width: '794px' }}>
              <div className="py-12">
                <div
                  className={cn(
                    "relative bg-[#FFFDF7] dark:bg-neutral-900 shadow-sm",
                    // Add loading styles when any analysis is running
                    isAnyAnalysisRunning && "cursor-wait"
                  )}
                  onClick={(e) => {
                    // Disable clicks when any analysis is running
                    if (isAnyAnalysisRunning) {
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }

                    // Only exit focus mode when clicking directly on editor content
                    const target = e.target as HTMLElement;
                    const isEditorContent = target.closest('.ProseMirror') || target.classList.contains('ProseMirror');

                    if (isEditorContent) {
                      // Exit focus mode by removing CSS classes
                      const editorElement = editor?.view.dom.closest('.ProseMirror') || editor?.view.dom;
                      if (editorElement?.classList.contains('focus-mode-active')) {
                        editorElement.classList.remove('focus-mode-active');
                        editorElement.removeAttribute('data-focused-comment');

                        // Remove focused-comment classes from all elements
                        const focusedElements = document.querySelectorAll('.focused-comment');
                        focusedElements.forEach(el => {
                          el.classList.remove('focused-comment');
                        });
                      }
                    }
                  }}
                >
                  {/* Loading overlay when any analysis is running */}
                  {isAnyAnalysisRunning && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 z-40 flex items-center justify-center backdrop-blur-sm">
                      <div className="flex flex-col items-center space-y-3">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <div className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                          {isSentenceFlowAnalyzing ? "Analyzing sentence connections..." : "Analyzing document..."}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {isSentenceFlowAnalyzing ? "Finding related sentences in flow mode" : "Please wait while we process your feedback"}
                        </div>
                      </div>
                    </div>
                  )}

                  <AIContextMenu
                    editor={editor}
                    onSelectAsParagraphTopic={handleSelectAsParagraphTopic}
                    onSelectAsEssayTopic={handleSelectAsEssayTopic}
                    activeCommentId={activeCommentId}
                    setActiveCommentId={setActiveCommentId}
                    onAddComment={handleAddComment}
                    comments={comments}
                    setComments={setComments}
                    runContextualAnalysis={runContextualAnalysis}
                  >
                    <div className="editor-container">
                    <EditorContent editor={editor} />
                    </div>
                  </AIContextMenu>
                </div>
              </div>

              {/* Comments sidebar */}
              <CommentsList
                isOpen={isInsightsOpen}
                setIsOpen={setIsInsightsOpen}
                comments={comments}
                setComments={setComments}
                activeCommentId={activeCommentId}
                setActiveCommentId={setActiveCommentId}
                editor={editor}
                focusedCommentId={focusedCommentId}
                setFocusedCommentId={setFocusedCommentId}
                sortCommentsRef={sortCommentsRef}
                highlightingManager={highlightingManager}
              />
            </div>
          </div>
        </div>

        <AISidePanel
          isOpen={isAIPanelOpen}
          onClose={toggleAIPanel}
          selectedText={selectedText}
          documentContext={getDocumentContent()}
        />

        <HelpSplashScreen
          isOpen={isHelpOpen}
          onClose={() => setIsHelpOpen(!isHelpOpen)}
        />

        {isFirstVisit && !isHelpOpen && (
          <div className="fixed bottom-4 right-4 p-4 bg-card rounded-lg shadow-lg max-w-xs border border-border/40 z-50 animate-in slide-in-from-bottom-10 flex items-center gap-3">
            <div className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full p-2">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-sm">Welcome to Ripple!</h4>
              <p className="text-muted-foreground text-xs mt-1">
                Check out our help section to learn how to use all Ripple features.
              </p>
            </div>
            <button
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2"
              onClick={() => setIsHelpOpen(!isHelpOpen)}
            >
              Learn More
            </button>
          </div>
        )}

        {/* Sentence Flow Action Panel */}
        {(() => {
          const actionPanelState = highlightingManager?.getSentenceFlowActionPanelState();
          console.log('🔧 Action panel render check:', {
            hasManager: !!highlightingManager,
            actionPanelState,
            isVisible: actionPanelState?.isVisible,
            sentenceData: actionPanelState?.sentenceData,
            trigger: popoverTrigger // Add trigger dependency
          });

          return actionPanelState?.isVisible && actionPanelState?.sentenceData && (
            <SentenceFlowActionPanel
              position={{ x: 0, y: 0 }} // Position is handled by the component's fixed positioning
              sentenceText={actionPanelState.sentenceData.text}
              connectionStrength={actionPanelState.sentenceData.connectionStrength}
              connectedSentences={actionPanelState.sentenceData.connectedSentences}
              paragraphCohesion={actionPanelState.sentenceData.paragraphCohesion}
              documentCohesion={actionPanelState.sentenceData.documentCohesion}
              onExitFlowMode={handleExitFlowMode}
              onAddComment={handleAddCommentToSentence}
              onCopySentence={handleCopySentence}
              onRedoAnalysis={() => highlightingManager?.redoSentenceFlowAnalysis()}
              onExplainSentence={handleExplainSentence}
              onClose={handleExitFlowMode} // Close button does the same as exit
              onUpdateSentence={(newSentenceText: string) => {
                // Update the sentence in the highlighting manager and re-run analysis
                if (highlightingManager) {
                  highlightingManager.updateAnalyzedSentence(newSentenceText);
                  highlightingManager.redoSentenceFlowAnalysis();
                }
              }}
              editor={editor}
              isAnalyzing={isSentenceFlowAnalyzing}
            />
          );
        })()}
      </InsightsContext.Provider>
    </div>
  );
}