import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { cn } from "@/lib/utils";
import { MessageSquare, Pencil, Trash2, Check, X } from 'lucide-react';
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
  
  // Debug logging
  console.log("ISSUE TYPE: Comment item rendered with issue type:", comment.issueType);
  console.log("Full comment object:", comment);


  // Ensure there's a default issueType if it's undefined
  const issueType = comment.issueType || 
    (comment.suggestedEdit ? 'general' : 'clarity'); // Default to grammar for edits, clarity for comments
  // Add this after your const issueType declaration
  console.log("FINAL ISSUE TYPE used for rendering:", issueType);
  
  // Determine card style based on feedback type
  const cardStyle = comment.isAIFeedback
    ? comment.feedbackType === 'general' : "shadow-[0_0_15px_rgba(168,85,247,0.15)]"; // User comments have no special style
  
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
            {/* <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" /> */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-medium break-words">
                  {/* {comment.suggestedEdit ? comment.title || 'Suggested Edit' : comment.content || 'Comment'} */}
                  {comment.content}
                </h3>
                
                {/* Move badge next to the title for prominence */}
                {issueType === 'clarity' && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border border-blue-200 shadow-sm">Clarity</span>
                )}
                {issueType === 'coherence' && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 border border-yellow-200 shadow-sm">Coherence</span>
                )}
                {issueType === 'flow' && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-300 border border-orange-300 shadow-sm">Flow</span>
                )}
                {issueType && !['clarity', 'coherence', 'flow'].includes(issueType) && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 shadow-sm">{issueType}</span>
                )}
              </div>
              
              {/* Issue tag - replaced with badges above */}
              {/* {comment.issueType && (
                <div className="mt-1 mb-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                    {comment.issueType}
                  </span>
                </div>
              )} */}
              
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
                          {/* <div className="flex flex-wrap gap-1.5 mb-2">
                            {issueType === 'grammar' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">Grammar</span>
                            )}
                            {issueType === 'clarity' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">Clarity</span>
                            )}
                            {issueType === 'coherence' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">Coherence</span>
                            )}
                            {issueType === 'cohesion' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-300">Cohesion</span>
                            )}
                            {issueType === 'style' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Style</span>
                            )}
                            {issueType === 'structure' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-300">Structure</span>
                            )}
                            {issueType === 'flow' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-300">Flow</span>
                            )}
                            {issueType && !['grammar', 'clarity', 'coherence', 'cohesion', 'style', 'structure', 'flow'].includes(issueType) && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">{issueType}</span>
                            )}
                          </div> */}
                          <div className="suggest-edit-deletion break-words mt-1">{comment.suggestedEdit?.original || ''}</div>
                        </details>
                      </div>
                      <div>
                        <div className="suggest-edit-label">New Text</div>
                        <div className="suggest-edit-addition break-words">{comment.suggestedEdit?.suggested || ''}</div>
                      </div>
                      <div className="relative">
                        <details className="mt-1">
                          <summary className="suggest-edit-label cursor-pointer">Explanation</summary>
                          <div className="suggest-edit-explanation break-words mt-1">{comment.suggestedEdit?.explanation || ''}</div>
                        </details>
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
              
              <div className="flex items-center justify-left mt-3 space-x-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-6"
                  onClick={handleIgnore}
                >
                  <X className="h-3.5 w-3.5 mr-2" />
                  Ignore
                </Button>
                
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 px-6 pr-5 pl-3"
                  onClick={handleAcceptSuggestion}
                >
                  <Check className="h-3.5 w-3.5 mr-2" />
                  Accept
                </Button>
              </div>
              
              {/* <div className="flex items-center justify-center gap-2 mt-3">
                <Checkbox id={`do-not-show-${comment.id}`} />
                <label htmlFor={`do-not-show-${comment.id}`} className="text-sm text-muted-foreground">
                  Do not show this feedback again
                </label>
                {issueType === 'grammar' && (
                  <div className="inline-flex ml-1 cursor-help" title="Learn more about grammar suggestions">
                    <span className="sr-only">Learn more</span>
                    <span className="inline-flex items-center justify-center w-4 h-4 text-xs rounded-full text-blue-800 bg-blue-100 dark:text-blue-300 dark:bg-blue-900">?</span>
                  </div>
                )}
              </div> */}
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