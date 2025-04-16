import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import { useEffect, useState, useCallback, useRef, createContext, useMemo } from 'react';
import { cn } from "@/lib/utils";
import { EditorView } from 'prosemirror-view';
import { HelpCircle } from 'lucide-react';
import { AIContextMenu } from '../AIContextMenu';
import { EditorToolbar } from '../EditorToolbar';
import { CommentExtension } from '../../extensions/Comment';
import { SuggestEditExtension } from '../../extensions/SuggestEdit';
import '@/styles/comment.css';
import { AISidePanel } from '../AISidePanel';
import { toast } from "sonner";
import { HelpSplashScreen } from '../HelpSplashScreen';
import { EditorHeader } from './EditorHeader';
import { CommentsList } from './CommentsList';
import { AIInsight, CommentType, EditorProps } from './types';
import { useAuth } from '@/lib/auth-context';
import { FileService } from '@/lib/file-service';
import { EventType } from '@/lib/event-logger';
import { supabase } from '@/lib/supabase';
import { logEvent } from '@/lib/event-logger';

// Create a context for insights
export const InsightsContext = createContext<[AIInsight[], React.Dispatch<React.SetStateAction<AIInsight[]>>]>([[], () => {}]);

// At the top of the file, add this constant
const DRAFT_CONTENT_KEY = 'ripple-draft-content';

export function EditorContainer({ 
  className = '',
  onEditorChange,
  eventBatcher
}: EditorProps): JSX.Element {
  const { user } = useAuth();
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [documentTitle, setDocumentTitle] = useState('Untitled document');
  const [showCommentInput] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<number | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [essayTopicHighlight, setEssayTopicHighlight] = useState<{from: number, to: number} | null>(null);
  const [paragraphTopicHighlights, setParagraphTopicHighlights] = useState<{[paragraphId: string]: {from: number, to: number}}>({});
  const [selectedText, setSelectedText] = useState('');
  const [showParagraphTopics, setShowParagraphTopics] = useState(false);
  const [showEssayTopics, setShowEssayTopics] = useState(false);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [fileService] = useState<FileService | null>(user ? new FileService(user.id) : null);
  const [isSaving, setIsSaving] = useState(false);
  const [usingLocalStorage, setUsingLocalStorage] = useState(true);
  const [documentId, setDocumentId] = useState('');
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
      }),
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
      handleKeyDown: (_view: EditorView, event: KeyboardEvent) => {
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
      // Clear the selected insight when user types
      setSelectedInsight(null);
      
      // If this update was triggered by the user typing (not by a programmatic change),
      // we should remove any highlighting at the current cursor position
      if (transaction.docChanged && transaction.steps.some(step => step.toJSON().stepType === 'replace')) {
        editor.chain().unsetHighlight().run();
      }
    },
  });

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
        // First check localStorage for backward compatibility
        const savedLocal = localStorage.getItem('ripple-doc');
        if (savedLocal && editor) {
          const { title, content, comments: savedComments = [] } = JSON.parse(savedLocal);
      setDocumentTitle(title);
      setComments(savedComments);
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

  // Get the entire document content
  const getDocumentContent = useCallback(() => {
    if (!editor) return '';
    return editor.getHTML();
  }, [editor]);

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
      createdAtTime: new Date(),
      quotedText,
      isAIFeedback: false,
      from,
      to,
      issueType: 'suggestion',
      feedbackType: 'clarity'
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
      createdAtTime: new Date(),
      quotedText,
      from,
      to,
      issueType: 'suggestion',
      feedbackType: 'clarity',
      suggestedEdit: {
        original: quotedText,
        suggested: suggestedText,
        explanation: ''
      }
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
    if (!editor) return;

    setIsSaving(true);
    if (usingLocalStorage) {
      try {
        const content = editor.getHTML();
        localStorage.setItem(
          DRAFT_CONTENT_KEY,
          JSON.stringify({
            content,
            comments: comments.map((comment) => ({
              ...comment,
              // Ensure both text and content fields are properly set for compatibility
              text: comment.content || comment.text,
              content: comment.content || comment.text,
              createdAt: comment.createdAt instanceof Date ? comment.createdAt.toISOString() : comment.createdAt
            })),
            id: "local-draft",
          })
        );
        setIsSaving(false);
      } catch (e: any) {
        logEvent(user?.id || 'anonymous', EventType.ERROR, {
          error: e.message,
        });
      }
      return;
    }

    try {
      const content = editor.getHTML();
      const jsonComments = comments.map((comment) => ({
        ...comment,
        // Ensure both text and content fields are properly set for compatibility
        text: comment.content || comment.text,
        content: comment.content || comment.text,
        createdAt: comment.createdAt instanceof Date ? comment.createdAt.toISOString() : comment.createdAt
      }));

      await supabase
        .from("documents")
        .update({
          content,
          comments: jsonComments,
        })
        .eq("id", documentId);

      logEvent(user?.id || 'anonymous', EventType.FILE_SAVE, {
        documentId,
      });
    } catch (e: any) {
      console.error("Error saving document", e);
      logEvent(user?.id || 'anonymous', EventType.ERROR, {
        error: e.message,
      });
    }
    setIsSaving(false);
  }, [editor, comments, usingLocalStorage, documentId, user]);

  // Function to load a file from Supabase
  const handleLoadFile = useCallback(async (file: any) => {
    if (!editor) return;
    
    try {
      // Update the editor content
      editor.commands.setContent(file.content);
      
      // Update the document title
      setDocumentTitle(file.title);
      
      // Update the current file ID
      setCurrentFileId(file.id);
      
      // Clear any existing highlights and comments
      if (essayTopicHighlight) {
        editor.chain()
          .setTextSelection({ from: essayTopicHighlight.from, to: essayTopicHighlight.to })
          .unsetHighlight()
          .run();
      }
      
      Object.entries(paragraphTopicHighlights).forEach(([, { from, to }]) => {
        editor.chain()
          .setTextSelection({ from, to })
          .unsetHighlight()
          .run();
      });
      
      // Reset state for highlights
      setEssayTopicHighlight(null);
      setParagraphTopicHighlights({});
      
      // Load comments if they exist
      if (file.comments && Array.isArray(file.comments)) {
        try {
          console.log("Loading comments:", file.comments);
          
          // Convert the saved comment format to the application format
          const loadedComments = file.comments.map((comment: any) => {
            // Debug the comment
            console.log("Processing comment:", comment);
            
            // Create a new comment in the format expected by the application
            const appComment: CommentType = {
              id: comment.id || `c${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              // Map 'text' from DB to 'content' in app
              content: comment.text || '', 
              quotedText: comment.quotedText || '',
              createdAt: new Date(comment.createdAt || Date.now()),
              createdAtTime: new Date(comment.createdAt || Date.now()),
              from: comment.from || 0,
              to: comment.to || 0,
              isAIFeedback: comment.isAIFeedback || false,
              resolved: comment.resolved || false,
              // Add default values for issue type and feedback type
              issueType: comment.issueType || 'suggestion',
              feedbackType: comment.feedbackType || 'clarity'
            };
            
            // Handle suggested edits separately to ensure they're properly structured
            if (comment.suggestedEdit) {
              console.log("Found suggested edit:", comment.suggestedEdit);
              
              // For suggested edits, set content to 'Suggested Edit' as default if not present
              appComment.content = appComment.content || 'Suggested Edit';
              
              // If the suggestedEdit doesn't have the original text but quotedText exists, use that
              if (!comment.suggestedEdit.original && comment.quotedText) {
                comment.suggestedEdit.original = comment.quotedText;
              }
              
              appComment.suggestedEdit = {
                original: comment.suggestedEdit.original || '',
                suggested: comment.suggestedEdit.suggested || '',
                explanation: comment.suggestedEdit.explanation || ''
              };
              
              // For suggested edits, use specific types if they exist, otherwise defaults
              appComment.issueType = comment.issueType || 'grammar';
              appComment.feedbackType = comment.feedbackType || 'clarity';
              
              // Flag as AI feedback if not explicitly set
              if (appComment.isAIFeedback === undefined) {
                appComment.isAIFeedback = true;
              }
            }
            
            console.log("Converted to app comment:", appComment);
            return appComment;
          });
          
          console.log("All loaded comments:", loadedComments);
          
          // Set the comments in state
          setComments(loadedComments);
          
          // Apply comment marks in the editor
          loadedComments.forEach((comment: CommentType) => {
            // Only try to find and mark the text if we have quoted text but no valid from/to positions
            if (comment.quotedText && comment.quotedText.trim() !== '' && 
                (!comment.from || !comment.to || comment.from === 0 || comment.to === 0)) {
              try {
                // Find the quoted text in the document
                const docText = editor.state.doc.textContent;
                const quotedText = comment.quotedText.trim();
                const quotedTextPos = docText.indexOf(quotedText);
                
                if (quotedTextPos !== -1) {
                  // Update comment with found positions
                  comment.from = quotedTextPos;
                  comment.to = quotedTextPos + quotedText.length;
                  
                  console.log(`Found quoted text "${quotedText}" at positions ${comment.from}-${comment.to}`);
                  
                  // Apply the comment mark
                  editor.chain()
                    .setTextSelection({ from: comment.from, to: comment.to })
                    .setComment(comment.id)
                    .run();
                } else {
                  console.warn(`Could not find quoted text: "${quotedText}" in document`);
                }
              } catch (error) {
                console.error('Error finding and marking text:', error, comment);
              }
            } 
            // If we have valid from/to, apply directly
            else if (comment.from && comment.to && comment.from < comment.to) {
              try {
                editor.chain()
                  .setTextSelection({ from: comment.from, to: comment.to })
                  .setComment(comment.id)
                  .run();
              } catch (markError) {
                console.error('Error applying comment mark:', markError, comment);
              }
            }
          });
          
          // Reset cursor position
          editor.commands.setTextSelection(0);
          
          // Log comment loading
          eventBatcher?.addEvent(EventType.FILE_OPEN, {
            action: 'load_comments',
            comment_count: loadedComments.length
          });
        } catch (commentError) {
          console.error('Error loading comments:', commentError);
          // If we fail to load comments, clear them to avoid partial state
          setComments([]);
        }
      } else {
        // No comments to load
        setComments([]);
      }
      
      toast.success(`Loaded document: ${file.title}`);
      
      // Log file loaded event
      eventBatcher?.addEvent(EventType.FILE_OPEN, {
        file_id: file.id,
        title: file.title,
        success: true
      });
    } catch (error) {
      console.error('Error loading file:', error);
      toast.error('Failed to load document');
      
      // Log error
      eventBatcher?.addEvent(EventType.ERROR, {
        action: 'load_file',
        file_id: file.id,
        error: String(error)
      });
    }
  }, [editor, eventBatcher, setDocumentTitle, setCurrentFileId, 
      essayTopicHighlight, paragraphTopicHighlights, setComments,
      setEssayTopicHighlight, setParagraphTopicHighlights]);

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
          return {
            ...comment,
            from: foundPos.from,
            to: foundPos.to,
            quotedText: editor.state.doc.textBetween(foundPos.from, foundPos.to)
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

  return (
    <div className={cn("w-full h-full relative", className)}>
      <InsightsContext.Provider value={[insights, setInsights]}>
        <div className="h-full flex flex-col">
          <div className="sticky top-4 z-30">
            <div className="mx-4 rounded-lg overflow-hidden border border-border/40">
              <EditorHeader 
                editor={editor}
                documentTitle={documentTitle}
                setDocumentTitle={setDocumentTitle}
                comments={comments}
                toggleAIPanel={toggleAIPanel}
                isInsightsOpen={isInsightsOpen}
                setIsInsightsOpen={setIsInsightsOpen}
                setIsHelpOpen={setIsHelpOpen}
                setComments={setComments}
                eventBatcher={eventBatcher}
                currentFileId={currentFileId}
                setCurrentFileId={setCurrentFileId}
                onLoadFile={handleLoadFile}
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

                  {/* Comments sidebar */}
                  <CommentsList
                    isOpen={isInsightsOpen}
                    setIsOpen={setIsInsightsOpen}
                    comments={comments}
                    setComments={setComments}
                    activeCommentId={activeCommentId}
                    setActiveCommentId={setActiveCommentId}
                    editor={editor}
                  />
                </div>
              </div>
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
          onClose={() => setIsHelpOpen(false)}
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
              onClick={() => setIsHelpOpen(true)}
            >
              Learn More
            </button>
          </div>
        )}
      </InsightsContext.Provider>
    </div>
  );
} 