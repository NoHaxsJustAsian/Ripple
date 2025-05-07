import { useState, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Pencil,
  Trash2,
  Check,
  X,
  RefreshCw,
  Loader2,
  Wand2,
  Copy,
  Check as CheckIcon,
  Pin,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ListRestartIcon,
} from 'lucide-react';
import { CommentType } from './types';
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
  onRegenerateSuggestion?: (commentId: string) => void;
  lastRefreshedTime?: { [commentId: string]: Date | null };
  isRefreshing?: boolean;
  isRegenerating?: boolean;
  onTogglePin?: (commentId: string, isPinned: boolean) => void;
  onMarkAsCompleted?: (commentId: string, action: 'accepted' | 'ignored', reason?: string) => void;
  onReviveComment?: (commentId: string) => void;
  isCompleted?: boolean;
}

export function CommentItem({
  comment,
  editor,
  activeCommentId,
  setActiveCommentId,
  setComments,
  comments,
  onRefreshFeedback,
  onRegenerateSuggestion,
  lastRefreshedTime,
  isRefreshing = false,
  isRegenerating = false,
  onTogglePin,
  onMarkAsCompleted,
  onReviveComment,
  isCompleted = false
}: CommentItemProps) {
  // State for tracking current text from the editor
  const [currentEditorText, setCurrentEditorText] = useState<string | null>(null);
  // State for copy button
  const [hasCopied, setHasCopied] = useState(false);

  // Pagination state
  const [historyIndex, setHistoryIndex] = useState(0);
  const [feedbackHistory, setFeedbackHistory] = useState<Array<{
    timestamp: string;
    original: string;
    currentText: string;
    suggested: string;
    explanation: string;
    issueType?: string;
  }>>([]);
  const [totalHistoryItems, setTotalHistoryItems] = useState(1);

  const issueType = comment.issueType ||
    (comment.suggestedEdit ? 'general' : 'clarity');

  // Determine card style based on feedback type
  const cardStyle = comment.isAIFeedback
    ? comment.feedbackType === 'general' : "shadow-[0_0_15px_rgba(168,85,247,0.15)]"; // User comments have no special style

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
        timestamp: comment.updatedAt || comment.createdAt,
        original: comment.suggestedEdit.original || '',
        currentText: currentEditorText || comment.suggestedEdit.original || '',
        suggested: comment.suggestedEdit.suggested || '',
        explanation: comment.suggestedEdit.explanation || '',
        issueType: comment.issueType
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
  }, [comment.id, comment.feedbackHistory]);

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
        issueType: comment.issueType
      };

      // Check if the new entry is meaningfully different from the previous one
      const lastItem = feedbackHistory.length > 0 ? feedbackHistory[feedbackHistory.length - 1] : null;
      const isDifferent = !lastItem ||
        lastItem.explanation !== newHistoryItem.explanation ||
        lastItem.suggested !== newHistoryItem.suggested;

      if (isDifferent) {
        const updatedHistory = [...feedbackHistory, newHistoryItem];
        setFeedbackHistory(updatedHistory);
        setTotalHistoryItems(updatedHistory.length);
        setHistoryIndex(updatedHistory.length - 1); // Move to the newest item
      }
    }
  }, [comment.suggestedEdit?.explanation, comment.suggestedEdit?.suggested]);

  // Update current text when editor content changes
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
        const text = editor.state.doc.textBetween(foundPos.from, foundPos.to);
        setCurrentEditorText(text);
      }
    };

    // Get the initial text
    getCurrentTextForComment();

    // Subscribe to editor updates
    const updateHandler = () => {
      getCurrentTextForComment();
    };

    // Add the event listener
    editor.on('update', updateHandler);

    // Clean up subscription
    return () => {
      editor.off('update', updateHandler);
    };
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
    timestamp: comment.updatedAt || comment.createdAt,
    original: comment.suggestedEdit?.original || '',
    currentText: currentEditorText || comment.suggestedEdit?.original || '',
    suggested: comment.suggestedEdit?.suggested || '',
    explanation: comment.suggestedEdit?.explanation || '',
    issueType: comment.issueType
  };

  const scrollToCommentInEditor = () => {
    if (!editor) return;

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
      // Get the current text at the comment position
      const currentText = editor.state.doc.textBetween(foundPos.from, foundPos.to);
      setCurrentEditorText(currentText);

      // Set the selection in the editor
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
      // Apply the suggested edit
      // If we're viewing history, use the suggestion from the history
      const suggestionToApply = historyIndex === totalHistoryItems - 1
        ? comment.suggestedEdit.suggested
        : currentHistoryItem.suggested;

      editor
        .chain()
        .focus()
        .setTextSelection(foundPos)
        .insertContent(suggestionToApply)
        .run();

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

  const handleRefreshFeedback = () => {
    if (onRefreshFeedback) {
      // Call the refresh function provided by the parent
      onRefreshFeedback(comment.id);
      // The parent component will handle updating the feedback content
      // and refreshing the lastRefreshedTime
    }
  };

  const handleRegenerateSuggestion = () => {
    if (onRegenerateSuggestion) {
      onRegenerateSuggestion(comment.id);
    }
  };

  const handleTogglePin = () => {
    if (onTogglePin) {
      onTogglePin(comment.id, !comment.isPinned);
    }
  };

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

  // Format the time since last refreshed in a human-readable relative format
  const getTimeSinceLastRefresh = () => {
    // Check if we have a refresh time for this comment
    const refreshTime = lastRefreshedTime?.[comment.id];

    // If no refresh time exists, return empty string
    if (!refreshTime) return "";

    // Calculate time difference in milliseconds
    const now = new Date();
    const refreshDate = new Date(refreshTime);
    const diffMs = now.getTime() - refreshDate.getTime();

    // Convert to minutes, hours, days
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Format the time difference with the appropriate unit
    if (diffMinutes < 60) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    }
  };

  // Format the timestamp for history items
  const formatHistoryTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
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

  return (
    <div
      className={cn(
        "bg-white dark:bg-background border border-border/40 rounded-md p-4 transition-all duration-200 relative",
        activeCommentId === comment.id && "ring-2 ring-blue-500",
        comment.isPinned && "border-yellow-400 dark:border-yellow-600",
        isCompleted && "opacity-80",
        cardStyle
      )}
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
          onClick={handleTogglePin}
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
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border border-blue-200 shadow-sm">Clarity</span>
                    )}
                    {issueType === 'focus' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 border border-yellow-200 shadow-sm">Focus</span>
                    )}
                    {issueType === 'flow' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-300 border border-orange-300 shadow-sm">Flow</span>
                    )}
                    {issueType && !['flow', 'focus', 'clarity'].includes(issueType) && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 shadow-sm">{issueType}</span>
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
                          <div className={cn(
                            "suggest-edit-deletion break-words mt-1",
                            hasTextChanged() && "bg-red-50 dark:bg-red-900/20"
                          )}>
                            {/* Show either current document text, or historical text as appropriate */}
                            {historyIndex === totalHistoryItems - 1
                              ? (currentEditorText !== null ? currentEditorText : comment.suggestedEdit?.original || '')
                              : currentHistoryItem.currentText}
                          </div>
                        </details>
                      </div>
                      <div>
                        <details className="mt-1" open>
                          <summary className="suggest-edit-label cursor-pointer">Suggested Text</summary>
                          {/* Use the ContextMenu component */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div className="suggest-edit-addition break-words relative">
                                {isRegenerating && historyIndex === totalHistoryItems - 1 ? (
                                  <div className="flex items-center justify-center py-2 text-muted-foreground italic">
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Creating new suggestion...
                                  </div>
                                ) : (
                                  <div className="py-1">
                                    {historyIndex === totalHistoryItems - 1
                                      ? comment.suggestedEdit?.suggested || ''
                                      : currentHistoryItem.suggested}
                                  </div>
                                )}
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-64">
                              <ContextMenuItem
                                onClick={handleRegenerateSuggestion}
                                disabled={isRegenerating || historyIndex !== totalHistoryItems - 1 || isCompleted}
                                className="flex items-center"
                              >
                                {isRegenerating ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    <span>Creating new suggestion...</span>
                                  </>
                                ) : (
                                  <>
                                    <ListRestartIcon className="h-4 w-4 mr-2" />
                                    <span>Generate new suggestion</span>
                                  </>
                                )}
                              </ContextMenuItem>
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
                          <div className="suggest-edit-label cursor-pointer flex justify-between items-center">
                            <div className="flex items-center">
                              <span>Feedback</span>
                            </div>

                            <div className="flex items-center gap-2">
                              {lastRefreshedTime?.[comment.id] && historyIndex === totalHistoryItems - 1 && (
                                <span className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px]">
                                  {/* {getTimeSinceLastRefresh()} */}
                                </span>
                              )}
                              {!isCompleted && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRefreshFeedback();
                                  }}
                                  title="Refresh feedback"
                                  disabled={isRefreshing || historyIndex !== totalHistoryItems - 1}
                                >
                                  {isRefreshing ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="suggest-edit-explanation break-words mt-1">
                            {isRefreshing && historyIndex === totalHistoryItems - 1 ? (
                              <div className="text-muted-foreground italic">Updating feedback...</div>
                            ) : (
                              <div dangerouslySetInnerHTML={{
                                __html: historyIndex === totalHistoryItems - 1
                                  ? comment.suggestedEdit?.explanation || ''
                                  : currentHistoryItem.explanation
                              }} />
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

              {activeCommentId === comment.id && (
                <div className="mt-3 space-y-2 bg-muted rounded-md p-2">
                  <div className="relative">
                    {comment.suggestedEdit ? (
                      <textarea
                        id={comment.id}
                        value={historyIndex === totalHistoryItems - 1
                          ? comment.suggestedEdit.suggested
                          : currentHistoryItem.suggested}
                        onChange={(e) => {
                          if (historyIndex === totalHistoryItems - 1) {
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
                          }
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
                        readOnly={historyIndex !== totalHistoryItems - 1 || isCompleted} // Read-only if viewing history or completed
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
                          readOnly={isCompleted}
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
                      className="h-8 px-6"
                      onClick={handleIgnore}
                    >
                      <X className="h-3.5 w-3.5 mr-2" />
                      Dismiss
                    </Button>

                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 px-6 pr-5 pl-3"
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
                    {new Date(comment.createdAt).toLocaleDateString()} {new Date(comment.createdAtTime || comment.createdAt).toLocaleTimeString('en-US', {
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