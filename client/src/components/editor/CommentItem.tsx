import { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Pencil,
  Trash2,
  Check,
  X,
  Copy,
  Check as CheckIcon,
  Pin,
  ChevronLeft,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { CommentType, Reference } from './types';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { toast } from "sonner";


interface CommentItemProps {
  comment: CommentType;
  editor: Editor | null;
  activeCommentId: string | null;
  setActiveCommentId: (id: string | null) => void;
  setComments: React.Dispatch<React.SetStateAction<CommentType[]>>;
  comments: CommentType[];
  onRefreshFeedback?: (commentId: string) => void;
  isRefreshing?: boolean;
  onTogglePin?: (commentId: string, isPinned: boolean) => void;
  onMarkAsCompleted?: (commentId: string, action: 'accepted' | 'ignored', reason?: string) => void;
  onReviveComment?: (commentId: string) => void;
  isCompleted?: boolean;
  focusedCommentId?: string | null;
  setFocusedCommentId?: (id: string | null) => void;
  isWriteMode?: boolean;
}

export function CommentItem({
  comment,
  editor,
  activeCommentId,
  setActiveCommentId,
  setComments,
  comments,
  isRefreshing = false,
  onTogglePin,
  onMarkAsCompleted,
  onReviveComment,
  isCompleted = false,
  focusedCommentId,
  setFocusedCommentId,
  isWriteMode = false,
}: CommentItemProps) {
  // State for tracking current text from the editor
  const [currentEditorText, setCurrentEditorText] = useState<string | null>(null);
  // State for copy button
  const [hasCopied, setHasCopied] = useState(false);
  // State for focus mode
  const [isFocused, setIsFocused] = useState(false);


  // Pagination state
  const [historyIndex, setHistoryIndex] = useState(0);
  const [feedbackHistory, setFeedbackHistory] = useState<Array<{
    timestamp: string | Date;
    original?: string;
    currentText?: string;
    suggested?: string;
    explanation: string;
    issueType?: string;
    references?: Reference[];
  }>>([]);
  const [totalHistoryItems, setTotalHistoryItems] = useState(1);

  const issueType = comment.issueType ||
    (comment.suggestedEdit ? 'general' : 'clarity');

  // Determine card style based on feedback type
  const cardStyle = comment.isAIFeedback
    ? "shadow-[0_0_15px_rgba(168,85,247,0.15)]" 
    : ""; // User comments have no special style

  // Ref for autoscroll
  const commentRef = useRef<HTMLDivElement>(null);

  // State for double-click editing


  // Initialize feedback history when component mounts or comment changes
  useEffect(() => {
    // If we already have history in the comment, use it
    if (comment.feedbackHistory && comment.feedbackHistory.length > 0) {
      setFeedbackHistory(comment.feedbackHistory);
      setTotalHistoryItems(comment.feedbackHistory.length);
      // Start at the newest item (end of the array)
      setHistoryIndex(comment.feedbackHistory.length - 1);
    } else if (comment.suggestedEdit) {
      // Initialize with the current feedback as the only history item
      const initialHistory = [{
        timestamp: comment.updatedAt || (typeof comment.createdAt === 'string' ? comment.createdAt : comment.createdAt.toISOString()),
        original: comment.suggestedEdit.original || comment.quotedText || '',
        currentText: currentEditorText || comment.suggestedEdit.original || comment.quotedText || '',
        suggested: comment.suggestedEdit.suggested || '',
        explanation: comment.suggestedEdit.explanation || '',
        issueType: comment.issueType,
        references: comment.suggestedEdit.references
      }];
      setFeedbackHistory(initialHistory);
      setTotalHistoryItems(1);
      setHistoryIndex(0);
    } else {
      // Case for regular comments without suggestion
      setFeedbackHistory([]);
      setTotalHistoryItems(0);
      setHistoryIndex(0);
    }
    
    // Debug: check if we're properly recognizing suggestions
    console.log('Comment loaded:', {
      id: comment.id,
      isAIFeedback: comment.isAIFeedback,
      hasSuggestedEdit: !!comment.suggestedEdit,
      issueType: comment.issueType,
      suggestedEditData: comment.suggestedEdit,
      referencesCreated: comment.suggestedEdit?.references
    });
  }, [comment.id, comment.feedbackHistory, comment.suggestedEdit, comment.quotedText, currentEditorText]);

  // Update history when a refresh or regenerate completes
  useEffect(() => {
    if (comment.suggestedEdit?.explanation &&
      (feedbackHistory.length === 0 ||
        feedbackHistory[feedbackHistory.length - 1].explanation !== comment.suggestedEdit.explanation)) {

      // Only create a new history entry if it's actually different from the last one
      const newHistoryItem = {
        timestamp: new Date().toISOString(),
        original: comment.suggestedEdit.original || '',
        currentText: currentEditorText || comment.suggestedEdit.original || '',
        suggested: comment.suggestedEdit.suggested || '',
        explanation: comment.suggestedEdit.explanation,
        issueType: comment.issueType,
        references: comment.suggestedEdit.references
      };

      // Check if the new entry is meaningfully different from the previous one
      const lastItem = feedbackHistory.length > 0 ? feedbackHistory[feedbackHistory.length - 1] : null;
      const isDifferent = !lastItem ||
        lastItem.explanation !== newHistoryItem.explanation ||
        lastItem.suggested !== newHistoryItem.suggested ||
        JSON.stringify(lastItem.references) !== JSON.stringify(newHistoryItem.references);

      if (isDifferent) {
        const updatedHistory = [...feedbackHistory, newHistoryItem];
        setFeedbackHistory(updatedHistory);
        setTotalHistoryItems(updatedHistory.length);
        setHistoryIndex(updatedHistory.length - 1); // Move to the newest item
      }
    }
  }, [comment.suggestedEdit?.explanation, comment.suggestedEdit?.suggested, comment.suggestedEdit?.references]);

  // Load initial current text when component mounts (no auto-updates)
  useEffect(() => {
    if (!editor || !comment.id) return;

    // Function to get the current text for this comment
    const getCurrentTextForComment = () => {
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
        // Add type assertion to fix 'never' type error
        const pos = foundPos as { from: number; to: number };
        const text = editor.state.doc.textBetween(pos.from, pos.to);
        setCurrentEditorText(text);
      }
    };

    // Get the initial text only (no automatic updates)
    getCurrentTextForComment();

    // Note: Removed automatic editor update subscription to prevent 
    // current text from changing when editor content is modified
  }, [editor, comment.id]);

  // Reset copy state after 2 seconds
  useEffect(() => {
    if (hasCopied) {
      const timer = setTimeout(() => {
        setHasCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [hasCopied]);

  const handleCopyText = () => {
    // If we're viewing history, copy the suggestion from the history
    const textToCopy = historyIndex === totalHistoryItems - 1
      ? comment.suggestedEdit?.suggested
      : currentHistoryItem.suggested;

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          setHasCopied(true);
          toast.success("Copied to clipboard", {
            description: "Suggested text has been copied",
            duration: 2000
          });
        })
        .catch((err) => {
          console.error('Could not copy text: ', err);
          toast.error("Copy failed", {
            description: "Could not copy text to clipboard",
            duration: 2000
          });
        });
    }
  };

  // Add function to navigate history
  const navigateHistory = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
    } else if (direction === 'next' && historyIndex < totalHistoryItems - 1) {
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Get the current history item based on the history index
  const currentHistoryItem = feedbackHistory[historyIndex] || {
    timestamp: comment.updatedAt || (typeof comment.createdAt === 'string' ? comment.createdAt : comment.createdAt.toISOString()),
    original: comment.suggestedEdit?.original || '',
    currentText: currentEditorText || comment.suggestedEdit?.original || '',
    suggested: comment.suggestedEdit?.suggested || '',
    explanation: comment.suggestedEdit?.explanation || '',
    issueType: comment.issueType
  };

  const scrollToCommentInEditor = () => {
    if (!editor) return;

    // Don't scroll to comment in write mode for distraction-free writing
    if (isWriteMode) {
      console.log('Write mode active - not scrolling to comment for distraction-free writing');
      return;
    }

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
      // Add type assertion to fix 'never' type error
      const pos = foundPos as { from: number; to: number };
      // Get the current text at the comment position
      const currentText = editor.state.doc.textBetween(pos.from, pos.to);
      setCurrentEditorText(currentText);

      // Set the selection in the editor
      editor
        .chain()
        .focus()
        .setTextSelection(pos)
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
  };

  const handleAcceptSuggestion = () => {
    if (!editor || !comment.suggestedEdit) {
      // Just mark as accepted if there's no edit to apply
      if (onMarkAsCompleted) {
        onMarkAsCompleted(comment.id, 'accepted');
      } else {
        editor?.chain().focus().unsetComment(comment.id).run();
        setComments(prev => prev.filter(c => c.id !== comment.id));
      }
      return;
    }

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
      // Add type assertion to fix 'never' type error
      const pos = foundPos as { from: number; to: number };
      
      // Apply the suggested edit
      // If we're viewing history, use the suggestion from the history
      const suggestionToApply = historyIndex === totalHistoryItems - 1
        ? comment.suggestedEdit.suggested || ''
        : currentHistoryItem.suggested || '';

      // Ensure we don't try to insert undefined text
      if (suggestionToApply) {
        editor
          .chain()
          .focus()
          .setTextSelection(pos)
          .insertContent(suggestionToApply)
          .run();
      }

      // IMPORTANT: Do NOT unset the comment here - we need to keep it for tracking purposes
      // Instead, just mark it as completed
      if (onMarkAsCompleted) {
        onMarkAsCompleted(comment.id, 'accepted');
      }
    }
  };

  const handleIgnore = () => {
    if (onMarkAsCompleted) {
      onMarkAsCompleted(comment.id, 'ignored');
    } else {
      editor?.chain().focus().unsetComment(comment.id).run();
      setComments(comments.filter(c => c.id !== comment.id));
    }
  };

  const handleRevive = () => {
    if (onReviveComment) {
      onReviveComment(comment.id);
    }
  };




  const handleTogglePin = () => {
    if (onTogglePin) {
      onTogglePin(comment.id, !comment.isPinned);
    }
  };



  // Modify the formatHistoryTimestamp function to handle Date objects
  const formatHistoryTimestamp = (timestamp: string | Date) => {
    try {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return 'Unknown time';
    }
  };

  // Determine if the text has changed since the original
  const hasTextChanged = () => {
    if (!currentEditorText) return false;

    // Use either the current snapshot's original text, or the comment's original text
    const originalToCompare = historyIndex === totalHistoryItems - 1
      ? comment.suggestedEdit?.original
      : currentHistoryItem.original;

    if (!originalToCompare) return false;

    return currentEditorText !== originalToCompare;
  };

  // Get the completion info for display
  const getCompletionInfo = () => {
    if (!comment.completionInfo || comment.completionInfo.length === 0) {
      return null;
    }

    const latestInfo = comment.completionInfo[comment.completionInfo.length - 1];
    const action = latestInfo.action;
    const timestamp = latestInfo.timestamp;

    return {
      action,
      timestamp,
      actionText: action === 'active' ? 'Replaced' : 'Dismissed',
      date: formatHistoryTimestamp(timestamp)
    };
  };

  const completionInfo = getCompletionInfo();

  // Autoscroll to this comment when it becomes active (but not in write mode for distraction-free writing)
  useEffect(() => {
    if (activeCommentId === comment.id && commentRef.current && !isWriteMode) {
      commentRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeCommentId, comment.id, isWriteMode]);






  // Show references if available
  {
    currentHistoryItem.references && currentHistoryItem.references.length > 0 && (
      <div className="mt-3 p-2 bg-muted/20 rounded-md">
        <h4 className="text-xs font-medium mb-1">References:</h4>
        <div className="space-y-1">
          {currentHistoryItem.references.map((ref, idx) => (
            <div key={idx} className="text-xs">
              <div className="font-medium">{ref.allusion}</div>
              <div className="text-muted-foreground">{ref.referenceText}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Modify the highlightReferencedText function
  const highlightReferencedText = (referenceText: string) => {
    if (!editor) return;

    // Search for the text and highlight it
    const content = editor.state.doc.textContent;
    const startIndex = content.indexOf(referenceText);

    if (startIndex !== -1) {
      const from = startIndex;
      const to = startIndex + referenceText.length;

      // Add temporary highlight
      editor.commands.setTextSelection({ from, to });
      editor.commands.setHighlight({ color: 'purple' });

      // Remove highlight after delay
      setTimeout(() => {
        editor.commands.setTextSelection({ from, to });
        editor.commands.unsetHighlight();
      }, 2000);
    }
  };

  // Modify the processExplanationText function
  const processExplanationText = (text: string, references?: Reference[]) => {
    if (!text) return text;

    // First, process bold tags with blue color AND semibold, adding the external link icon
    let processedText = text.replace(/<b>(.*?)<\/b>/g, '<span class="text-blue-500 font-semibold inline">$1<svg class="inline-block w-[1em] h-[1em] ml-[0.1em] align-[-0.125em]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></span>');

    // Then process references if available
    if (references && references.length > 0) {
      // Sort references by position if available, otherwise by allusion length (longer matches first)
      const sortedRefs = [...references].sort((a, b) => {
        if (a.position && b.position) {
          return b.position.from - a.position.from;
        }
        // Use allusion property and add null checks
        const aLength = a.allusion?.length || 0;
        const bLength = b.allusion?.length || 0;
        return bLength - aLength;
      });
      // Process each reference
      for (const ref of sortedRefs) {
        const refText = ref.allusion;
        console.log(refText);
        const referenceText = ref.referenceText;
        console.log(referenceText);
        if (!refText || !referenceText) continue;

        // Create a styled span for the reference using Tailwind classes
        const styledSpan = `<span class="text-blue-500 underline cursor-pointer hover:text-blue-600">${refText}</span>`;

        // Replace the reference text with the styled span
        // Use case-insensitive replacement to catch variations
        const regex = new RegExp(refText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        processedText = processedText.replace(regex, styledSpan);
      }
    }

    return processedText;
  };

  // Add this effect to set up the global handler
  useEffect(() => {
    // Add the highlight handler to the window object
    (window as any).highlightReference = (referenceText: string) => {
      highlightReferencedText(referenceText);
    };

    // Cleanup
    return () => {
      delete (window as any).highlightReference;
    };
  }, [editor]);

  // Function to handle comment click and enter focus mode
  const handleCommentClick = () => {
    if (!editor || isCompleted) return;

    // Check if this comment is currently focused using the shared state
    const isCurrentlyFocused = focusedCommentId === comment.id;

    // Toggle behavior: if THIS comment is already focused, deselect it
    if (isCurrentlyFocused) {
      console.log('Comment deselected, exiting focus mode for:', comment.id);

      // Exit focus mode - restore normal yellow highlighting
      const editorElement = editor.view.dom.closest('.ProseMirror') || editor.view.dom;
      if (editorElement) {
        editorElement.classList.remove('focus-mode-active');
        editorElement.removeAttribute('data-focused-comment');
      }

      // Remove focused-comment classes from all elements
      const focusedElements = document.querySelectorAll('.focused-comment');
      focusedElements.forEach(el => {
        el.classList.remove('focused-comment');
      });

      // Update shared state
      if (setFocusedCommentId) {
        setFocusedCommentId(null);
      }
      setIsFocused(false);
      return;
    }

    console.log('Comment selected, entering focus mode for:', comment.id);

    // FIRST: Clear any existing focus states from other comments
    const allFocusedElements = document.querySelectorAll('.focused-comment');
    allFocusedElements.forEach(el => {
      el.classList.remove('focused-comment');
    });

    // THEN: Enter focus mode for this comment
    const editorElement = editor.view.dom.closest('.ProseMirror') || editor.view.dom;
    if (editorElement) {
      editorElement.classList.add('focus-mode-active');
      editorElement.setAttribute('data-focused-comment', comment.id);
    }

    // Find and mark the focused comment in the editor
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
      // Add focused-comment class to the comment elements in the editor
      const commentElements = document.querySelectorAll(`[data-comment-id="${comment.id}"]`);
      commentElements.forEach(el => {
        el.classList.add('focused-comment');
      });
    }

    // Update shared state
    if (setFocusedCommentId) {
      setFocusedCommentId(comment.id);
    }
    setIsFocused(true);
  };

  // Add effect to handle focus mode exit
  useEffect(() => {
    const handleFocusExit = () => {
      // Check if focus mode is still active for this comment
      const editorElement = editor?.view.dom.closest('.ProseMirror') || editor?.view.dom;
      const isFocusModeActive = editorElement?.classList.contains('focus-mode-active');
      const currentFocusedComment = editorElement?.getAttribute('data-focused-comment');

      // Only exit if focus mode is no longer active OR if another comment is now focused
      if (!isFocusModeActive || (currentFocusedComment && currentFocusedComment !== comment.id)) {
        setIsFocused(false);
      }
    };

    // Set up an interval to check focus mode status
    const interval = setInterval(handleFocusExit, 100);

    return () => {
      clearInterval(interval);
    };
  }, [editor, comment.id]);

  // Sync local isFocused state with shared focusedCommentId state
  useEffect(() => {
    const shouldBeFocused = focusedCommentId === comment.id;
    if (isFocused !== shouldBeFocused) {
      setIsFocused(shouldBeFocused);
    }
  }, [focusedCommentId, comment.id, isFocused]);

  return (
    <div ref={commentRef}
      className={cn(
        "bg-white dark:bg-background border border-border/40 rounded-md p-4 transition-all duration-200 relative cursor-pointer dark:bg-neutral-900",
        activeCommentId === comment.id && "ring-2 ring-blue-500",
        comment.isPinned && "border-yellow-400 dark:border-yellow-600",
        isCompleted && "opacity-80",
        isFocused && "ring-2 ring-blue-400",
        cardStyle
      )}
      onClick={handleCommentClick}
      data-comment-item={comment.id}
    >
      {/* Pin button - Now using different icons for pinned vs unpinned state */}
      {!isCompleted && (
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "absolute top-2 right-2 h-6 w-6 p-0",
            comment.isPinned
              ? "text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300"
              : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          )}
          onClick={(e) => {
            e.stopPropagation();
            handleTogglePin();
          }}
          title={comment.isPinned ? "Unpin comment" : "Pin comment"}
        >
          {comment.isPinned ? (
            <Pin className="h-3.5 w-3.5 fill-current" /> // Solid pin when pinned
          ) : (
            <Pin className="h-3.5 w-3.5" /> // Outline pin when unpinned
          )}
        </Button>
      )}

      <div className="flex flex-col space-y-3">
        {comment.isAIFeedback ? (
          // AI Feedback style with warning triangle and accept/ignore buttons
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-medium break-words">
                  {comment.content}
                </h3>

                {/* Display the appropriate issue type badge based on history */}
                {historyIndex === totalHistoryItems - 1 ? (
                  // Current issue type badges
                  <>
                    {issueType === 'clarity' && (
                      <div>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border border-blue-200 shadow-sm">Clarity</span>
                        {/* <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border border-blue-200 shadow-sm">+1</span> */}
                      </div>
                    )}
                    {issueType === 'focus' && (
                      <div>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 border border-yellow-200 shadow-sm">Focus</span>
                        {/* <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 border border-yellow-200 shadow-sm">+1</span> */}
                      </div>
                    )}
                    {issueType === 'flow' && (
                      <div>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-300 border border-orange-300 shadow-sm">Flow</span>
                        {/* <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-300 border border-orange-300 shadow-sm">+1</span> */}
                      </div>
                    )}
                    {issueType && !['flow', 'focus', 'clarity'].includes(issueType) && (
                      <div>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 shadow-sm">{issueType}</span>
                        {/* <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 shadow-sm">+1</span> */}
                      </div>
                    )}
                  </>
                ) : (
                  // Historical issue type badges based on the current snapshot
                  <>
                    {currentHistoryItem.issueType === 'clarity' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border border-blue-200 shadow-sm">Clarity</span>
                    )}
                    {currentHistoryItem.issueType === 'focus' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 border border-yellow-200 shadow-sm">Focus</span>
                    )}
                    {currentHistoryItem.issueType === 'flow' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-300 border border-orange-300 shadow-sm">Flow</span>
                    )}
                    {currentHistoryItem.issueType && !['flow', 'focus', 'clarity'].includes(currentHistoryItem.issueType) && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 shadow-sm">{currentHistoryItem.issueType}</span>
                    )}
                  </>
                )}

                {/* Completion status badge */}
                {completionInfo && (
                  <span className={cn(
                    "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border shadow-sm ml-auto",
                    completionInfo.action === 'active'
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-200"
                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 border-red-200"
                  )}>
                    {completionInfo.actionText}
                  </span>
                )}

                {/* Pagination controls */}
                {totalHistoryItems > 1 && (
                  <div className="flex items-center ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateHistory('prev');
                      }}
                      disabled={historyIndex === 0}
                      className="p-1 rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Previous version"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>

                    <span className="mx-1 text-xs text-muted-foreground">
                      {historyIndex + 1}/{totalHistoryItems}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateHistory('next');
                      }}
                      disabled={historyIndex === totalHistoryItems - 1}
                      className="p-1 rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Next version"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {comment.quotedText && (
                <div
                  className="text-sm text-muted-foreground bg-muted/50 p-0 rounded-md cursor-pointer hover:bg-muted/70 mt-3 break-words"
                  onClick={scrollToCommentInEditor}
                >
                  {comment.suggestedEdit ? (
                    <div className="suggest-edit-container overflow-hidden" tabIndex={0} >
                      <div className="relative">
                        <details className="mt-1" open>
                          <summary className="suggest-edit-label cursor-pointer">Current Text</summary>
                          <div
                            className={cn(
                              "suggest-edit-deletion break-words mt-1 relative",
                              hasTextChanged() && "bg-red-50 dark:bg-red-900/20"
                            )}

                          >
                            <div style={{ whiteSpace: "pre-wrap" }}>
                              {historyIndex === totalHistoryItems - 1
                                ? (currentEditorText !== null ? currentEditorText : comment.suggestedEdit?.original || '')
                                : currentHistoryItem.currentText}
                            </div>
                          </div>
                        </details>
                      </div>



                      <div>
                        <details className="mt-1" open>
                          <summary className="suggest-edit-label cursor-pointer">Suggested Text</summary>
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div className="suggest-edit-addition break-words relative">
                                <div className="py-1">
                                  {historyIndex === totalHistoryItems - 1
                                    ? comment.suggestedEdit?.suggested || ''
                                    : currentHistoryItem.suggested}
                                </div>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-64">
                              <ContextMenuItem
                                onClick={handleCopyText}
                                className="flex items-center"
                              >
                                {hasCopied ? (
                                  <>
                                    <CheckIcon className="h-4 w-4 mr-2 text-green-500" />
                                    <span>Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-4 w-4 mr-2" />
                                    <span>Copy text</span>
                                  </>
                                )}
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </details>
                      </div>
                      <div className="relative">
                        <div className="mt-1">
                          <div className="suggest-edit-label cursor-pointer">
                            <span>Feedback</span>
                          </div>
                          <div className="suggest-edit-explanation break-words mt-1">
                            {isRefreshing && historyIndex === totalHistoryItems - 1 ? (
                              <div className="text-muted-foreground italic">Updating feedback...</div>
                            ) : (
                                <div
                                  className="prose prose-sm dark:prose-invert max-w-none"
                                  dangerouslySetInnerHTML={{
                                    __html: processExplanationText(
                                      historyIndex === totalHistoryItems - 1
                                        ? comment.suggestedEdit?.explanation || ''
                                        : currentHistoryItem.explanation,
                                      historyIndex === totalHistoryItems - 1
                                        ? comment.suggestedEdit?.references
                                        : currentHistoryItem.references
                                    )
                                  }}
                                />
                            )}
                          </div>
                          {/* Show timestamp for historical items */}
                          {historyIndex !== totalHistoryItems - 1 && currentHistoryItem.timestamp && (
                            <div className="text-xs text-muted-foreground mt-1 italic">
                              Viewing feedback from {formatHistoryTimestamp(currentHistoryItem.timestamp)}
                            </div>
                          )}

                          {/* Show completion info if available */}
                          {completionInfo && (
                            <div className="text-xs text-muted-foreground mt-1 italic">
                              {completionInfo.actionText} on {completionInfo.date}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    `"${comment.quotedText}"`
                  )}
                </div>
              )}

              {/* Only show textarea for user comments when active */}
              {activeCommentId === comment.id && !comment.isAIFeedback && (
                <div className="mt-3 space-y-2 bg-muted rounded-md p-2">
                  <div className="relative">
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
                      readOnly={isCompleted}
                    />
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
              )}

              {/* Buttons section - show different buttons based on completed state */}
              {isCompleted ? (
                <div className="flex items-center justify-left mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-6"
                    onClick={handleRevive}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-2" />
                    Restore
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-left mt-3 space-x-3">
                  <Button
                    variant="ghost"
                    size="sm"
                      className="h-8 px-4"
                    onClick={handleIgnore}
                  >
                      <X className="h-3.5 w-2.5 mr-1" />
                    Dismiss
                    </Button>

                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 px-6 pr-4 pl-2 bg-blue-600 hover:bg-blue-700 dark:bg-neutral-600 dark:hover:bg-blue-700 text-white dark:text-white"
                    onClick={handleAcceptSuggestion}
                  >
                    <Check className="h-3.5 w-3.5 mr-2" />
                    Replace
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          // User Comment style - simpler without warning icon or accept/ignore buttons
          <div className="flex items-start gap-3">
            <MessageSquare className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-medium">Comment</h3>
                <span className="text-xs text-muted-foreground">
                  {new Date(comment.createdAt).toLocaleDateString()} {new Date(comment.createdAt).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </span>
              </div>

              {/* Completion status badge for user comments */}
              {completionInfo && (
                <div className="flex justify-end mt-1">
                  <span className={cn(
                    "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border shadow-sm",
                    completionInfo.action === 'active'
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-200"
                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 border-red-200"
                  )}>
                    {completionInfo.actionText}
                  </span>
                </div>
              )}

              {comment.quotedText && (
                <div
                  className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md cursor-pointer hover:bg-muted/70 mt-3"
                  onClick={scrollToCommentInEditor}
                >
                  {`"${comment.quotedText}"`}
                </div>
              )}

              {activeCommentId === comment.id ? (
                <div className="mt-3 space-y-2 bg-muted rounded-md p-2">
                  <div className="relative">
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
                      readOnly={isCompleted}
                    />
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
                <div className="mt-3 text-sm">{comment.content || "No content"}</div>
              )}

              {/* Show different buttons based on completed state */}
              {isCompleted ? (
                <div className="flex justify-center mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-6"
                    onClick={handleRevive}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-2" />
                    Restore
                  </Button>
                </div>
              ) : (
                <div className="flex justify-end mt-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3"
                      onClick={() => setActiveCommentId(comment.id)}
                      disabled={isCompleted}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3"
                      onClick={handleIgnore}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}