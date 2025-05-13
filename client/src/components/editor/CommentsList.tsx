import { useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { cn } from "@/lib/utils";
import { ArrowRightToLine, ChevronDown, ChevronUp, FileCheck, RefreshCw, XCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from '@/components/ui/multi-select';
import { CommentType } from './types';
import { CommentItem } from './CommentItem';
import { refreshFeedback, regenerateSuggestion } from '@/lib/api';
import { toast } from "sonner";

// Update the CommentType to include completion info as an array
declare module './types' {
  interface CommentType {
    isPinned?: boolean;
    // Array for tracking completion status and history
    completionInfo?: Array<{
      action: 'accepted' | 'ignored';
      timestamp: string;
      reason?: string;  // Optional reason for accepting/ignoring
    }>;
    feedbackHistory?: Array<{
      timestamp: string;
      original: string;      // The original text at this point in time
      currentText: string;   // The current editor text at this point
      suggested: string;     // The suggested text at this point
      explanation: string;   // The feedback explanation at this point
      issueType?: string;    // The issue type at this point (could change)
    }>;
  }
}

interface CommentsListProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  comments: CommentType[];
  setComments: React.Dispatch<React.SetStateAction<CommentType[]>>;
  activeCommentId: string | null;
  setActiveCommentId: (id: string | null) => void;
  editor: Editor | null;
}

export function CommentsList({
  isOpen,
  setIsOpen,
  comments,
  setComments,
  activeCommentId,
  setActiveCommentId,
  editor
}: CommentsListProps) {
  const commentsSectionRef = useRef<HTMLDivElement | null>(null);

  // Track the last refreshed times for each comment
  const [lastRefreshedTimes, setLastRefreshedTimes] = useState<{ [commentId: string]: Date }>({});

  // Track loading states for comments
  const [refreshingComments, setRefreshingComments] = useState<{ [commentId: string]: boolean }>({});
  const [regeneratingComments, setRegeneratingComments] = useState<{ [commentId: string]: boolean }>({});

  // Current sort method
  const [sortMethod, setSortMethod] = useState<string>("default");

  // State for collapsed sections
  const [isReplacedOpen, setIsReplacedOpen] = useState<boolean>(false);
  const [isDismissedOpen, setIsDismissedOpen] = useState<boolean>(false);

  // Helper function to get the current text from the editor for a comment
  const getCurrentTextForComment = (commentId: string) => {
    if (!editor) return null;

    let foundPos: { from: number; to: number } | null = null;
    editor.state.doc.descendants((node, pos) => {
      const mark = node.marks.find(m =>
        m.type.name === 'comment' &&
        m.attrs.commentId === commentId
      );
      if (mark) {
        foundPos = { from: pos, to: pos + node.nodeSize };
        return false;
      }
    });

    if (foundPos) {
      return editor.state.doc.textBetween(foundPos.from, foundPos.to);
    }

    return null;
  };

  // This function will be called when a user clicks the refresh button on a comment
  const handleRefreshFeedback = async (commentId: string) => {
    console.log("Refreshing feedback for comment ID:", commentId);

    // Find the comment that needs to be refreshed
    const commentToRefresh = comments.find(c => c.id === commentId);
    if (!commentToRefresh) return;

    // Get the current text from the editor where the comment is located
    if (!editor) return;

    // Find the position of the commented text in the editor
    let foundPos: { from: number; to: number } | null = null;
    editor.state.doc.descendants((node, pos) => {
      const mark = node.marks.find(m =>
        m.type.name === 'comment' &&
        m.attrs.commentId === commentId
      );
      if (mark) {
        foundPos = { from: pos, to: pos + node.nodeSize };
        return false;
      }
    });

    if (!foundPos) return;

    // Get the current text content at the comment location
    const currentText = editor.state.doc.textBetween(foundPos.from, foundPos.to);

    // Set loading state for this comment
    setRefreshingComments(prev => ({
      ...prev,
      [commentId]: true
    }));

    try {
      // If we have the original feedback and suggestedEdit, use the API
      if (commentToRefresh.suggestedEdit && commentToRefresh.suggestedEdit.explanation) {
        const originalText = commentToRefresh.suggestedEdit.original || commentToRefresh.quotedText;
        const originalFeedback = commentToRefresh.suggestedEdit.explanation;

        // Call the API to refresh the feedback
        const response = await refreshFeedback({
          originalText: originalText,
          currentText: currentText,
          originalFeedback: originalFeedback,
          issueType: commentToRefresh.issueType
        });

        if (response.success) {
          // Create a new history entry with a complete snapshot
          const now = new Date().toISOString();

          // Ensure we have a feedbackHistory array, or create a new one with the current state
          const previousHistory = commentToRefresh.feedbackHistory || [];

          // If there's no history yet, add the initial state first
          if (previousHistory.length === 0 && commentToRefresh.suggestedEdit) {
            previousHistory.push({
              timestamp: commentToRefresh.updatedAt || commentToRefresh.createdAt,
              original: commentToRefresh.suggestedEdit.original || '',
              currentText: commentToRefresh.suggestedEdit.original || '',  // Initially, current text is the original
              suggested: commentToRefresh.suggestedEdit.suggested || '',
              explanation: commentToRefresh.suggestedEdit.explanation || '',
              issueType: commentToRefresh.issueType
            });
          }

          // Create a new complete snapshot with all current values
          const newHistoryEntry = {
            timestamp: now,
            original: commentToRefresh.suggestedEdit.original || '',
            currentText: currentText || '',
            suggested: commentToRefresh.suggestedEdit.suggested || '',
            explanation: response.data.updatedFeedback,
            issueType: commentToRefresh.issueType
          };

          // Update the comment with new feedback and the updated history
          setComments(prevComments =>
            prevComments.map(c =>
              c.id === commentId
                ? {
                  ...c,
                  updatedAt: now,
                  suggestedEdit: c.suggestedEdit
                    ? {
                      ...c.suggestedEdit,
                      explanation: response.data.updatedFeedback
                    }
                    : undefined,
                  feedbackHistory: [...previousHistory, newHistoryEntry]
                }
                : c
            )
          );
        }
      } else {
        // Fallback to simulated response for comments without suggestedEdit
        const simulateApiResponse = () => {
          return new Promise<string>((resolve) => {
            setTimeout(() => {
              // Check if text has changed
              if (currentText !== commentToRefresh.quotedText) {
                resolve(`This text has been updated. ${Math.random() > 0.5
                  ? "The issues have been resolved, good job!"
                  : "There are still some issues to address."
                  }`);
              } else {
                resolve("The text hasn't changed since the last feedback.");
              }
            }, 500);
          });
        };

        const updatedFeedbackText = await simulateApiResponse();
        const now = new Date().toISOString();

        // Ensure we have a feedbackHistory array, or create a new one with the current state
        const previousHistory = commentToRefresh.feedbackHistory || [];

        // If there's no history yet and there's an existing suggestedEdit, add the initial state first
        if (previousHistory.length === 0 && commentToRefresh.suggestedEdit) {
          previousHistory.push({
            timestamp: commentToRefresh.updatedAt || commentToRefresh.createdAt,
            original: commentToRefresh.suggestedEdit.original || '',
            currentText: commentToRefresh.suggestedEdit.original || '',
            suggested: commentToRefresh.suggestedEdit.suggested || '',
            explanation: commentToRefresh.suggestedEdit.explanation || '',
            issueType: commentToRefresh.issueType
          });
        }

        // Create a complete snapshot with all current values
        const newHistoryEntry = {
          timestamp: now,
          original: commentToRefresh.suggestedEdit?.original || commentToRefresh.quotedText || '',
          currentText: currentText || '',
          suggested: commentToRefresh.suggestedEdit?.suggested || commentToRefresh.quotedText || '',
          explanation: updatedFeedbackText,
          issueType: commentToRefresh.issueType
        };

        // Update the comment with new feedback
        setComments(prevComments =>
          prevComments.map(c =>
            c.id === commentId
              ? {
                ...c,
                updatedAt: now,
                suggestedEdit: c.suggestedEdit
                  ? {
                    ...c.suggestedEdit,
                    explanation: updatedFeedbackText
                  }
                  : {
                    original: c.quotedText || '',
                    suggested: c.quotedText || '',
                    explanation: updatedFeedbackText
                  },
                feedbackHistory: [...previousHistory, newHistoryEntry]
              }
              : c
          )
        );
      }

      // Update the last refreshed timestamp
      setLastRefreshedTimes(prev => ({
        ...prev,
        [commentId]: new Date()
      }));

    } catch (error) {
      console.error("Error refreshing feedback:", error);
      toast.error("Failed to refresh feedback", {
        description: "Please try again later."
      });
    } finally {
      // Clear loading state
      setRefreshingComments(prev => ({
        ...prev,
        [commentId]: false
      }));
    }
  };

  // This function will be called when a user clicks the regenerate button on a comment
  const handleRegenerateSuggestion = async (commentId: string) => {
    console.log("Regenerating suggestion for comment ID:", commentId);

    // Find the comment that needs regeneration
    const commentToRegenerate = comments.find(c => c.id === commentId);
    if (!commentToRegenerate) return;

    // Get the current text from the editor where the comment is located
    if (!editor) return;

    // Find the position of the commented text in the editor
    let foundPos: { from: number; to: number } | null = null;
    editor.state.doc.descendants((node, pos) => {
      const mark = node.marks.find(m =>
        m.type.name === 'comment' &&
        m.attrs.commentId === commentId
      );
      if (mark) {
        foundPos = { from: pos, to: pos + node.nodeSize };
        return false;
      }
    });

    if (!foundPos) return;

    // Get the current text content at the comment location
    const currentText = editor.state.doc.textBetween(foundPos.from, foundPos.to);

    // Set loading state for this comment
    setRegeneratingComments(prev => ({
      ...prev,
      [commentId]: true
    }));

    try {
      const originalText = commentToRegenerate.suggestedEdit?.original || commentToRegenerate.quotedText || '';
      // Preserve the original explanation if it exists
      const originalExplanation = commentToRegenerate.suggestedEdit?.explanation || '';

      // Call the API to regenerate the suggestion
      const response = await regenerateSuggestion({
        originalText: originalText,
        currentText: currentText,
        issueType: commentToRegenerate.issueType,
        originalExplanation: originalExplanation
      });

      if (response.success) {
        const now = new Date().toISOString();

        // Ensure we have a feedbackHistory array, or create a new one with the current state
        const previousHistory = commentToRegenerate.feedbackHistory || [];

        // If there's no history yet and there's an existing suggestedEdit, add the initial state first
        if (previousHistory.length === 0 && commentToRegenerate.suggestedEdit) {
          previousHistory.push({
            timestamp: commentToRegenerate.updatedAt || commentToRegenerate.createdAt,
            original: commentToRegenerate.suggestedEdit.original || '',
            currentText: commentToRegenerate.suggestedEdit.original || '',
            suggested: commentToRegenerate.suggestedEdit.suggested || '',
            explanation: commentToRegenerate.suggestedEdit.explanation || '',
            issueType: commentToRegenerate.issueType
          });
        }

        // Create a new complete snapshot with all current values
        const newHistoryEntry = {
          timestamp: now,
          original: commentToRegenerate.suggestedEdit?.original || commentToRegenerate.quotedText || '',
          currentText: currentText || '',
          suggested: response.data.suggestedEdit.suggested,
          explanation: response.data.suggestedEdit.explanation,
          issueType: commentToRegenerate.issueType
        };

        // Update the comment with the new suggestion
        setComments(prevComments =>
          prevComments.map(c =>
            c.id === commentId
              ? {
                ...c,
                updatedAt: now,
                suggestedEdit: response.data.suggestedEdit,
                feedbackHistory: [...previousHistory, newHistoryEntry]
              }
              : c
          )
        );
      }

    } catch (error) {
      console.error("Error regenerating suggestion:", error);
      toast.error("Failed to generate new suggestion", {
        description: "Please try again later."
      });
    } finally {
      // Clear loading state
      setRegeneratingComments(prev => ({
        ...prev,
        [commentId]: false
      }));
    }
  };

  // Handle toggling the pin status of a comment
  const handleTogglePin = (commentId: string, isPinned: boolean) => {
    setComments(prevComments =>
      prevComments.map(comment =>
        comment.id === commentId
          ? { ...comment, isPinned }
          : comment
      )
    );

    toast(isPinned ? "Comment pinned" : "Comment unpinned", {
      duration: 2000
    });
  };

  // New function to handle marking comments as completed
  const handleMarkAsCompleted = (commentId: string, action: 'accepted' | 'ignored', reason?: string) => {
    const now = new Date().toISOString();

    setComments(prevComments =>
      prevComments.map(comment =>
        comment.id === commentId
          ? {
            ...comment,
            // Add to the completion info array
            completionInfo: [
              ...(comment.completionInfo || []),
              {
                action,
                timestamp: now,
                reason
              }
            ]
          }
          : comment
      )
    );

    toast(`Suggestion ${action === 'accepted' ? 'replaced' : 'dismissed'}`, {
      duration: 2000
    });

    // Open the relevant section when first item is completed
    if (action === 'accepted' && !isReplacedOpen) {
      setIsReplacedOpen(true);
    } else if (action === 'ignored' && !isDismissedOpen) {
      setIsDismissedOpen(true);
    }
  };

  // New function to handle reviving comments
  const handleReviveComment = (commentId: string) => {
    setComments(prevComments =>
      prevComments.map(comment =>
        comment.id === commentId
          ? {
            ...comment,
            // Remove the completion info to make it active again
            completionInfo: []
          }
          : comment
      )
    );

    toast("Comment revived", {
      description: "Comment has been moved back to active items",
      duration: 2000
    });
  };

  // Sort comments based on the selected sort method
  const sortComments = (value: string) => {
    setSortMethod(value);

    // Apply sorting
    applySort(value);
  };

  // Apply the current sort method to the comments
  const applySort = (sortValue: string) => {
    const sorted = [...comments];

    if (sortValue === "newest") {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortValue === "oldest") {
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortValue === "smart") {
      const textPositions = new Map<string, number>();
      const docText = editor?.state.doc.textContent || '';

      comments.forEach(comment => {
        if (comment.quotedText && !textPositions.has(comment.quotedText)) {
          const position = docText.indexOf(comment.quotedText);
          if (position >= 0) {
            textPositions.set(comment.quotedText, position);
          }
        }
      });

      sorted.sort((a, b) => {
        if (a.quotedText === b.quotedText) {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }

        const aPos = textPositions.get(a.quotedText) || 0;
        const bPos = textPositions.get(b.quotedText) || 0;

        return aPos - bPos;
      });
    } else {
      const commentPositions = new Map<string, number>();
      const docText = editor?.state.doc.textContent || '';

      comments.forEach(comment => {
        if (comment.quotedText) {
          const position = docText.indexOf(comment.quotedText);
          if (position >= 0) {
            commentPositions.set(comment.id, position);
          }
        }
      });

      sorted.sort((a, b) => {
        const aPos = commentPositions.get(a.id) || 0;
        const bPos = commentPositions.get(b.id) || 0;
        return aPos - bPos;
      });
    }

    setComments(sorted);
  };

  const filterOptions = [
    { value: 'flow', label: 'Flow' },
    { value: 'focus', label: 'Focus' },
    { value: 'clarity', label: 'Clarity' }
  ];

  const [selectedFilters, setSelectedFilters] = useState<string[]>(
    filterOptions.map(option => option.value)
  );

  // Helper function to check comment status
  const getCommentStatus = (comment: CommentType): 'active' | 'replaced' | 'dismissed' => {
    if (!comment.completionInfo || comment.completionInfo.length === 0) {
      return 'active';
    }

    // Get the latest action
    const latestAction = comment.completionInfo[comment.completionInfo.length - 1].action;
    return latestAction === 'accepted' ? 'replaced' : 'dismissed';
  };

  // Separate comments by their status
  const activeComments = comments.filter(comment => getCommentStatus(comment) === 'active');
  const replacedComments = comments.filter(comment => getCommentStatus(comment) === 'replaced');
  const dismissedComments = comments.filter(comment => getCommentStatus(comment) === 'dismissed');

  // Sort and filter comments for display
  const displayCommentsByStatus = (status: 'active' | 'replaced' | 'dismissed') => {
    let statusComments;

    if (status === 'active') {
      statusComments = activeComments;
    } else if (status === 'replaced') {
      statusComments = replacedComments;
    } else {
      statusComments = dismissedComments;
    }

    // Filter the comments
    const filteredComments = statusComments.filter(comment => {
      // Skip filtering if all filters are selected
      if (selectedFilters.length === filterOptions.length) return true;
      // Show comments that match selected filters
      return comment.issueType ? selectedFilters.includes(comment.issueType) : true;
    });

    // For active comments, separate pinned and unpinned
    if (status === 'active') {
      const pinnedComments = filteredComments.filter(comment => comment.isPinned);
      const unpinnedComments = filteredComments.filter(comment => !comment.isPinned);
      return [...pinnedComments, ...unpinnedComments];
    }

    return filteredComments;
  };

  return (
    <div
      ref={commentsSectionRef}
      className={cn(
        "fixed right-0 h-[calc(100vh-7rem)] bg-background border-l border-border/40",
        "transition-all duration-300 ease-in-out transform",
        isOpen ? "translate-x-0" : "translate-x-full",
        "w-[360px]"
      )}
      style={{
        zIndex: 40,
        top: "6rem"
      }}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "absolute left-0 top-1/4 -translate-y-1/2 -translate-x-full",
          "bg-background border border-border/40 border-r-0",
          "px-2 py-3 rounded-l-md",
          "transition-colors hover:bg-accent"
        )}
      >
        <div className="flex flex-col items-center gap-2">
          {isOpen ? (
            <ArrowRightToLine className="mr-2 h-4.0 w-4.0" strokeWidth={1.5} />
          ) : (
            <FileCheck className="mr-2 h-4.0 w-4.0" strokeWidth={1.5} />
          )}
        </div>
      </button>

      {/* Panel Content */}
      <div className="h-full overflow-y-auto">
        {/* Filter Tabs */}
        <div className="flex items-center justify-left mb-4 pt-6 pl-4">
          {/* <div className="flex items-center">
            <div className="flex items-center gap-1 p-1">
              <label
                htmlFor="comment-sort"
                className="text-xs font-medium text-muted-foreground whitespace-nowrap"
              >
                Sort by:
              </label>
              <Select
                onValueChange={sortComments}
                defaultValue={sortMethod}
              >
                <SelectTrigger className="h-8 text-xs w-24">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="smart">Smart</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div> */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="comment-sort"
              className="text-xs font-medium text-muted-foreground whitespace-nowrap"
            >
              Filter by:
            </label>
            <MultiSelect
              options={filterOptions}
              selected={selectedFilters}
              onChange={setSelectedFilters}
            />
          </div>
        </div>

        {/* Active Comments Section - Always Open (without visible title) */}
        <div className="border-b border-border/40 pb-4">
          <div className="p-4 space-y-3">
            {activeComments.length === 0 ? (
              <div className="text-center text-muted-foreground py-2">
                No active comments
              </div>
            ) : (
              displayCommentsByStatus('active').map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  editor={editor}
                  activeCommentId={activeCommentId}
                  setActiveCommentId={setActiveCommentId}
                  setComments={setComments}
                  comments={comments}
                  onRefreshFeedback={handleRefreshFeedback}
                  onRegenerateSuggestion={handleRegenerateSuggestion}
                  onTogglePin={handleTogglePin}
                  onMarkAsCompleted={handleMarkAsCompleted}
                  onReviveComment={handleReviveComment}
                  lastRefreshedTime={lastRefreshedTimes}
                  isRefreshing={refreshingComments[comment.id] || false}
                  isRegenerating={regeneratingComments[comment.id] || false}
                />
              ))
            )}
          </div>
        </div>

        {/* Replaced Comments Section - Collapsible */}
        {/* <div className="border-b border-border/40">
          <button
            onClick={() => setIsReplacedOpen(!isReplacedOpen)}
            className="flex items-center justify-between w-full px-4 py-2 bg-accent/30 hover:bg-accent/50"
          >
            <div className="flex items-center">
              <RefreshCw className="mr-2 h-4 w-4" strokeWidth={1.5} />
              <span className="text-sm font-medium">Replaced Items ({replacedComments.length})</span>
            </div>
            {isReplacedOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {isReplacedOpen && (
            <div className="p-4 pt-2 space-y-3">
              {replacedComments.length === 0 ? (
                <div className="text-center text-muted-foreground py-2">
                  No replaced comments
                </div>
              ) : (
                displayCommentsByStatus('replaced').map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    editor={editor}
                    activeCommentId={activeCommentId}
                    setActiveCommentId={setActiveCommentId}
                    setComments={setComments}
                    comments={comments}
                    onRefreshFeedback={handleRefreshFeedback}
                    onRegenerateSuggestion={handleRegenerateSuggestion}
                    onTogglePin={handleTogglePin}
                    onMarkAsCompleted={handleMarkAsCompleted}
                    onReviveComment={handleReviveComment}
                    lastRefreshedTime={lastRefreshedTimes}
                    isRefreshing={refreshingComments[comment.id] || false}
                    isRegenerating={regeneratingComments[comment.id] || false}
                    isCompleted={true}
                  />
                ))
              )}
            </div>
          )}
        </div> */}

        {/* Dismissed Comments Section - Collapsible */}
        <div className="border-b border-border/40">
          <button
            onClick={() => setIsDismissedOpen(!isDismissedOpen)}
            className="flex items-center justify-between w-full px-4 py-2 bg-accent/30 hover:bg-accent/50"
          >
            <div className="flex items-center">
              <XCircle className="mr-2 h-4 w-4" strokeWidth={1.5} />
              <span className="text-sm font-medium">Dismissed Suggestions ({dismissedComments.length})</span>
            </div>
            {isDismissedOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {isDismissedOpen && (
            <div className="p-4 pt-2 space-y-3">
              {dismissedComments.length === 0 ? (
                <div className="text-center text-muted-foreground py-2">
                  No dismissed comments
                </div>
              ) : (
                displayCommentsByStatus('dismissed').map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    editor={editor}
                    activeCommentId={activeCommentId}
                    setActiveCommentId={setActiveCommentId}
                    setComments={setComments}
                    comments={comments}
                    onRefreshFeedback={handleRefreshFeedback}
                    onRegenerateSuggestion={handleRegenerateSuggestion}
                    onTogglePin={handleTogglePin}
                    onMarkAsCompleted={handleMarkAsCompleted}
                    onReviveComment={handleReviveComment}
                    lastRefreshedTime={lastRefreshedTimes}
                    isRefreshing={refreshingComments[comment.id] || false}
                    isRegenerating={regeneratingComments[comment.id] || false}
                    isCompleted={true}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Empty state when no comments exist */}
        {comments.length === 0 && (
          <div className="text-center text-muted-foreground pt-8">
            No comments yet
          </div>
        )}
      </div>
    </div>
  );
}