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
import { HelpCircle } from 'lucide-react';  // Add missing Lucide icons
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
import { AIInsight, EditorProps, CommentType, dbCommentToUiComment } from './types';
import { useAuth } from '@/lib/auth-context';
import { FileService } from '@/lib/file-service';
import { EventType } from '@/lib/event-logger';
import { logEvent } from '@/lib/event-logger';

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

  return (
    <div className={cn("w-full h-full relative", className)}>
      <InsightsContext.Provider value={[insights, setInsights]}>
        <div className="h-full flex flex-col">
          <div className="relative z-30">
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
              <div className="flex-1 overflow-auto bg-[#FAF9F6] dark:bg-background/10 ">
                <div className="mx-auto relative" style={{ width: '794px' }}>
                  <div className="py-12">
                    <div className="relative bg-[#FFFDF7] dark:bg-card shadow-sm">
                      <AIContextMenu
                        editor={editor}
                        onSelectAsParagraphTopic={handleSelectAsParagraphTopic}
                        onSelectAsEssayTopic={handleSelectAsEssayTopic}
                        activeCommentId={activeCommentId}
                        setActiveCommentId={setActiveCommentId}
                        onAddComment={handleAddComment} 
                        comments={comments}
                        setComments={setComments}
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
      </InsightsContext.Provider>
    </div>
  );
}