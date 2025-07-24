import { useRef, useState, useCallback, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { cn } from "@/lib/utils";
import { ArrowRightToLine, ChevronDown, ChevronUp, FileCheck, XCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from '@/components/ui/multi-select';
import { CommentType } from './types';
import { CommentItem } from './CommentItem';
import { toast } from "sonner";
import { HighlightingManager } from '@/lib/highlighting-manager';

interface CommentsListProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  comments: CommentType[];
  setComments: React.Dispatch<React.SetStateAction<CommentType[]>>;
  activeCommentId: string | null;
  setActiveCommentId: (id: string | null) => void;
  editor: Editor | null;
  focusedCommentId: string | null;
  setFocusedCommentId: (id: string | null) => void;
  sortCommentsRef?: React.MutableRefObject<(() => void) | null>;
  highlightingManager?: HighlightingManager | null;
  isAnyAnalysisRunning?: boolean;
  onModeChange?: (mode: 'comments') => void;
}

export function CommentsList({
  isOpen,
  setIsOpen,
  comments,
  setComments,
  activeCommentId,
  setActiveCommentId,
  editor,
  focusedCommentId,
  setFocusedCommentId,
  sortCommentsRef,
  highlightingManager,
  isAnyAnalysisRunning,
  onModeChange
}: CommentsListProps) {
  const commentsSectionRef = useRef<HTMLDivElement | null>(null);

  // Current sort method
  const [sortMethod, setSortMethod] = useState<string>("default");

  // State for collapsed sections
  const [isReplacedOpen, setIsReplacedOpen] = useState<boolean>(false);
  const [isDismissedOpen, setIsDismissedOpen] = useState<boolean>(false);

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
  const applySort = useCallback((sortValue: string) => {
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
        const aPos = textPositions.get(a.quotedText || '') || 0;
        const bPos = textPositions.get(b.quotedText || '') || 0;

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
  }, [comments, editor, setComments]);

  // Expose the applySort function through the ref
  useEffect(() => {
    if (sortCommentsRef) {
      sortCommentsRef.current = () => applySort(sortMethod);
    }
  }, [sortCommentsRef, applySort, sortMethod]);

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
    return latestAction === 'replaced' ? 'replaced' : 'dismissed';
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

  const nonDismissedComments = comments.filter(
    (comment) => getCommentStatus(comment) !== 'dismissed'
  );

  const clarityCount = nonDismissedComments.filter(
    (c) => c.issueType === 'clarity'
  ).length;

  const flowCount = nonDismissedComments.filter(
    (c) => c.issueType === 'flow'
  ).length;

  const focusCount = nonDismissedComments.filter(
    (c) => c.issueType === 'focus'
  ).length;

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
      data-comments-sidebar="true"
    >
      {/* Toggle Button */}
      <button
        onClick={() => {
          if (!isOpen && onModeChange) {
            // If panel is closed, switch to comments mode (which will open the panel)
            onModeChange('comments');
          } else {
            // If panel is open, just close it
            setIsOpen(false);
          }
        }}
        className={cn(
          "absolute left-0 top-1/4 -translate-y-1/2 -translate-x-full",
          "bg-background border border-border/40 border-r-0",
          "px-2 py-3 rounded-l-md",
          "transition-colors hover:bg-accent",
          isAnyAnalysisRunning ? "opacity-50 cursor-not-allowed" : ""
        )}
        disabled={isAnyAnalysisRunning}
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
      <div className="h-full flex flex-col relative">
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto pb-16">
        <div className="flex items-center justify-left mb-4 pt-6 pl-4">

            <div className="flex items-center gap-2 mr-4">
              <label
                htmlFor="comment-sort"
                className="text-xs font-medium text-muted-foreground whitespace-nowrap"
              >
                Sort by:
              </label>
              <Select
                onValueChange={sortComments}
                defaultValue={"default"}
              >
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">In Order</SelectItem>
                  <SelectItem value="newest">Newest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                  onTogglePin={handleTogglePin}
                  onMarkAsCompleted={handleMarkAsCompleted}
                  onReviveComment={handleReviveComment}
                  focusedCommentId={focusedCommentId}
                  setFocusedCommentId={setFocusedCommentId}
                  isWriteMode={highlightingManager?.getCurrentMode() === 'write'}
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
                    onTogglePin={handleTogglePin}
                    onMarkAsCompleted={handleMarkAsCompleted}
                    onReviveComment={handleReviveComment}
                    isCompleted={true}
                    focusedCommentId={focusedCommentId}
                    setFocusedCommentId={setFocusedCommentId}
                    isWriteMode={highlightingManager?.getCurrentMode() === 'write'}
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

        {/* Fixed Bottom Filter Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-background border-t border-border/40 p-3">
          <div className="flex gap-2 justify-center">
            <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900 px-2.5 py-1 text-xs font-medium text-blue-800 dark:text-blue-300">
              Clarity: {clarityCount}
            </span>
            <span className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900 px-2.5 py-1 text-xs font-medium text-orange-800 dark:text-orange-300">
              Flow: {flowCount}
            </span>
            <span className="inline-flex items-center rounded-full bg-yellow-100 dark:bg-yellow-900 px-2.5 py-1 text-xs font-medium text-yellow-800 dark:text-yellow-300">
              Focus: {focusCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}