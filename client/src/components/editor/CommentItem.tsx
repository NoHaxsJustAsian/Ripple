import { useState } from 'react';
import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { cn } from "@/lib/utils";
import { MessageSquare, Pencil, Trash2, Check, AlertTriangle } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { CommentType } from './types';

interface CommentItemProps {
  comment: CommentType;
  editor: Editor | null;
  activeCommentId: string | null;
  setActiveCommentId: (id: string | null) => void;
  setComments: React.Dispatch<React.SetStateAction<CommentType[]>>;
  comments: CommentType[];
}

export function CommentItem({
  comment,
  editor,
  activeCommentId,
  setActiveCommentId,
  setComments,
  comments
}: CommentItemProps) {
  
  // Determine card style based on feedback type
  const cardStyle = comment.isAIFeedback
    ? comment.feedbackType === 'sentence'
      ? "shadow-[0_0_15px_rgba(245,158,11,0.15)]" // Amber glow for sentence feedback
      : comment.feedbackType === 'paragraph'
        ? "shadow-[0_0_15px_rgba(59,130,246,0.15)]" // Blue glow for paragraph feedback
        : "shadow-[0_0_15px_rgba(168,85,247,0.15)]" // Purple glow for general feedback
    : ""; // User comments have no special style
  
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
      editor?.chain().focus().unsetComment(comment.id).run();
      setComments(prev => prev.filter(c => c.id !== comment.id));
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
      editor
        .chain()
        .focus()
        .setTextSelection(foundPos)
        .insertContent(comment.suggestedEdit.suggested)
        .unsetComment(comment.id)
        .run();
      
      setComments(prev => prev.filter(c => c.id !== comment.id));
    }
  };

  const handleIgnore = () => {
    editor?.chain().focus().unsetComment(comment.id).run();
    setComments(comments.filter(c => c.id !== comment.id));
  };

  return (
    <div 
      className={cn(
        "bg-white dark:bg-background border border-border/40 rounded-md p-4 transition-all duration-200",
        activeCommentId === comment.id && "ring-2 ring-blue-500",
        cardStyle
      )}
    >
      <div className="flex flex-col space-y-3">
        {comment.isAIFeedback ? (
          // AI Feedback style with warning triangle and accept/ignore buttons
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-base font-medium">
                {comment.suggestedEdit ? 'Suggested Edit' : comment.content || 'Comment'}
              </h3>
              
              {comment.quotedText && (
                <div 
                  className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md cursor-pointer hover:bg-muted/70 mt-3"
                  onClick={scrollToCommentInEditor}
                >
                  {comment.suggestedEdit ? (
                    <div className="suggest-edit-container" tabIndex={0} >
                      <div>
                        <div className="suggest-edit-label">Current Text</div>
                        <div className="suggest-edit-deletion">{comment.suggestedEdit?.original || ''}</div>
                      </div>
                      <div>
                        <div className="suggest-edit-label">New Text</div>
                        <div className="suggest-edit-addition">{comment.suggestedEdit?.suggested || ''}</div>
                      </div>
                      <div>
                        <div className="suggest-edit-label">Explanation</div>
                        <div className="suggest-edit-explanation">{comment.suggestedEdit?.explanation || ''}</div>
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
              )}
              
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <Checkbox id={`do-not-show-${comment.id}`} />
                  <label htmlFor={`do-not-show-${comment.id}`} className="text-sm text-muted-foreground">
                    Do not show this feedback again
                  </label>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3"
                    onClick={handleIgnore}
                  >
                    Ignore
                  </Button>
                  
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 px-3"
                    onClick={handleAcceptSuggestion}
                  >
                    Accept
                  </Button>
                </div>
              </div>
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
                  {new Date(comment.createdAt).toLocaleDateString()} {new Date(comment.createdAtTime).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </span>
              </div>
              
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
              
              <div className="flex justify-end mt-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3"
                    onClick={() => setActiveCommentId(comment.id)}
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 