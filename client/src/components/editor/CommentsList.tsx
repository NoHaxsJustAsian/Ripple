import { useRef } from 'react';
import { Editor } from '@tiptap/react';
import { cn } from "@/lib/utils";
import { ArrowRightToLine, FileCheck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from '@/components/ui/multi-select';
import { CommentType } from './types';
import { CommentItem } from './CommentItem';
import { useState } from 'react';

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


  const filterOptions = [
    { value: 'flow', label: 'Flow' },
    { value: 'focus', label: 'Focus' },
    { value: 'clarity', label: 'Clarity' }
  ];

  const [selectedFilters, setSelectedFilters] = useState<string[]>(
    filterOptions.map(option => option.value)
  );

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
        <div className="flex items-center justify-around mb-4  pt-6">
          <div className="flex items-center">
            <div className="flex items-center gap-1 p-1">
              <label
                htmlFor="comment-sort"
                className="text-xs font-medium text-muted-foreground whitespace-nowrap"
              >
                Sort by:
              </label>
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
          {/* <div className="flex space-x-2">
            <button
              className={cn(
                "px-4 py-2 rounded-md transition-colors text-sm",
                "bg-muted/40 hover:bg-muted"
              )}
            >
              Focus
            </button>
            <button
              className={cn(
                "px-4 py-2 rounded-md transition-colors text-sm",
                "bg-muted/40 hover:bg-muted"
              )}
            >
              Flow
            </button>
            <button
              className={cn(
                "px-4 py-2 rounded-md transition-colors text-sm",
                "bg-background text-white",
                "bg-zinc-800 dark:bg-zinc-800"
              )}
            >
              Clarity
            </button>
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

        {/* Comments List */}
        <div className="p-4 pt-0 space-y-3">
          {comments.length === 0 ? (
            <div className="text-center text-muted-foreground pt-8">
              No comments yet
            </div>
          ) : (
            comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                editor={editor}
                activeCommentId={activeCommentId}
                setActiveCommentId={setActiveCommentId}
                setComments={setComments}
                comments={comments}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
} 