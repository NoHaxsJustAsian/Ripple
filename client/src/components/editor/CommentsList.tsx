import { useRef } from 'react';
import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { cn } from "@/lib/utils";
import { AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CommentType } from './types';
import { CommentItem } from './CommentItem';

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

  const sortComments = (value: string) => {
    const sorted = [...comments];
    if (value === 'newest') {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (value === 'oldest') {
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (value === 'smart') {
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
        top: "7rem"
      }}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full",
          "bg-background border border-border/40 border-r-0",
          "px-2 py-3 rounded-l-md",
          "transition-colors hover:bg-accent"
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <div className="rotate-180 [writing-mode:vertical-lr]">
            <span className="text-xs font-medium">Filter Feedback</span>
          </div>
        </div>
      </button>

      {/* Panel Content */}
      <div className="h-full overflow-y-auto">
        {/* Filter Tabs */}
        <div className="sticky top-0 z-10 bg-background p-4 pb-2">
          <div className="flex items-center justify-between mb-4">
            <span className="text-base">Filter Feedback</span>
            <div>
              <Select
                onValueChange={sortComments}
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
          </div>
          <div className="flex space-x-2">
            <button 
              className={cn(
                "px-4 py-2 rounded-md transition-colors text-sm",
                "bg-muted/40 hover:bg-muted"
              )}
            >
              Sentence
            </button>
            <button 
              className={cn(
                "px-4 py-2 rounded-md transition-colors text-sm",
                "bg-muted/40 hover:bg-muted"
              )}
            >
              Paragraph
            </button>
            <button 
              className={cn(
                "px-4 py-2 rounded-md transition-colors text-sm",
                "bg-background text-white",
                "bg-zinc-800 dark:bg-zinc-800"
              )}
            >
              General
            </button>
          </div>
        </div>

        {/* Comments List */}
        <div className="p-4 pt-0 space-y-3">
          {comments.length === 0 ? (
            <div className="text-center text-muted-foreground pt-8">
              No comments yet
            </div>
          ) : (
            <>
              {console.log("Rendering comments:", comments)}
              {comments.map((comment) => {
                console.log(`Comment ID ${comment.id}:`, {
                  hasEdit: !!comment.suggestedEdit,
                  issueType: comment.issueType,
                  feedbackType: comment.feedbackType,
                  isAI: comment.isAIFeedback
                });
                return (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    editor={editor}
                    activeCommentId={activeCommentId}
                    setActiveCommentId={setActiveCommentId}
                    setComments={setComments}
                    comments={comments}
                  />
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
} 