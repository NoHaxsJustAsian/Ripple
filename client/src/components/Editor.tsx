import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import { useEffect, useState, useCallback, useRef, useContext, createContext } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { cn } from "@/lib/utils";
import { MessageSquare, LightbulbIcon, Save, FileDown, X, Pencil, Trash2 } from 'lucide-react';
import { AISidePanel } from './AISidePanel';
import { AIContextMenu } from './AIContextMenu';
import { EditorToolbar } from './EditorToolbar';
import { toast } from "sonner";
import DropdownMenuWithCheckboxes from './ui/dropdown-menu-select';
import { updateHighlightedText } from "../utils/highlightUtils";
import { EditorView } from 'prosemirror-view';
import { CommentExtension } from '../extensions/Comment';
import '@/styles/comment.css';

interface EditorProps {
  className?: string;
  placeholder?: string;
  onEditorChange?: (content: string) => void;
}

interface AIInsight {
  id: number;
  content: string;
  type: 'comment' | 'improvement';
  highlightedText?: string;
  highlightStyle?: string;
  isHighlighted?: boolean;
}

interface PendingComment {
  text: string;
  highlightStyle: string;
  editingId?: number;
}

interface CommentType {
  id: string;
  content: string;
  createdAt: Date;
  quotedText: string;
}

// Create a context for insights
export const InsightsContext = createContext<[AIInsight[], React.Dispatch<React.SetStateAction<AIInsight[]>>]>([[], () => {}]);

export default function Editor({ 
  className = '', 
  placeholder = 'Type @ to insert...',
  onEditorChange 
}: EditorProps): JSX.Element {
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(true);
  const [documentTitle, setDocumentTitle] = useState('Untitled document');
  const [isSaving, setIsSaving] = useState(false);
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<number | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentType[]>([]);
  const commentsSectionRef = useRef<HTMLDivElement | null>(null);
  
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
          if (commentId) setTimeout(() => focusCommentWithActiveId(commentId));
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
      handlePaste: (view: EditorView, event: ClipboardEvent) => {
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
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onEditorChange?.(html);
    },
  });

  const handleToolbarComment = useCallback(() => {
    if (!editor) return;
    
    const { from, to } = editor.state.selection;
    if (from === to) return; // No selection
    
    const text = editor.state.doc.textBetween(from, to);
    
    editor.chain()
      .setHighlight({ color: '#fef9c3' })
      .setTextSelection(to)
      .run();

    setPendingComment({ text, highlightStyle: "#fef9c3" });
    setShowCommentInput(true);
    setIsInsightsOpen(true);
  }, [editor]);

  const handleSelectAsParagraphTopic = useCallback(() => {
    if (!editor) return;
    
    const { from, to } = editor.state.selection;
    if (from === to) return; // No selection
    
    const text = editor.state.doc.textBetween(from, to);
    
    editor.chain()
      .setHighlight({ color: '#93c5fd' })
      .setTextSelection(to)
      .run();
  }, [editor]);

  const handleSelectAsEssayTopic = useCallback(() => {
    if (!editor) return;
    
    const { from, to } = editor.state.selection;
    if (from === to) return; // No selection
    
    const text = editor.state.doc.textBetween(from, to);
    
    editor.chain()
      .setHighlight({ color: '#c4b5fd' })
      .setTextSelection(to)
      .run();
  }, [editor]);

  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const [isEditingComment, setIsEditingComment] = useState(false);

  useEffect(() => {
    if (showCommentInput && commentInputRef.current) {
      // Small delay to ensure the panel is visible
      setTimeout(() => {
        commentInputRef.current?.focus();
      }, 100);
    }
  }, [showCommentInput, pendingComment]);

  const handleSave = useCallback(async () => {
    if (!editor) return;

    setIsSaving(true);
    try {
      localStorage.setItem('ripple-doc', JSON.stringify({
        title: documentTitle,
        content: editor.getHTML(),
        comments,
        lastSaved: new Date().toISOString()
      }));

      toast.success("Document saved successfully");
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error("Failed to save document");
    } finally {
      setIsSaving(false);
    }
  }, [editor, documentTitle, comments]);

  const handleSaveAs = useCallback(async () => {
    if (!editor) return;

    setIsSaving(true);
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const newTitle = `${documentTitle} - ${timestamp}`;
      
      const docKey = `ripple-doc-${Date.now()}`;
      localStorage.setItem(docKey, JSON.stringify({
        title: newTitle,
        content: editor.getHTML(),
        comments,
        lastSaved: new Date().toISOString()
      }));

      setDocumentTitle(newTitle);
      toast.success("Document saved as new copy");
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error("Failed to save document");
    } finally {
      setIsSaving(false);
    }
  }, [editor, documentTitle, comments]);

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
  }, [handleSave]);

  // Load saved content on mount
  useEffect(() => {
    const saved = localStorage.getItem('ripple-doc');
    if (saved && editor) {
      const { title, content, comments: savedComments = [] } = JSON.parse(saved);
      setDocumentTitle(title);
      setComments(savedComments);
      editor.commands.setContent(content);
    }
  }, [editor]);

  const handleSelectionChange = (items: string[]) => {
    setSelectedItems(items);
    updateHighlightedText(items, Editor);
  };

  const toggleAIPanel = () => {
    setIsAIPanelOpen(!isAIPanelOpen);
  };

  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const topic_items = [
    { id: "1", label: "Paragraph Topics" },
    { id: "2", label: "Essay Topics" }
  ];

  const feedback_items = [
    { id: "1", label: "Overall Feedback" },
    { id: "2", label: "Paragraph Feedback" },
    { id: "3", label: "Sentence Feedback" },
    { id: "4", label: "Custom Feedback" }
  ];

  const handleAddInsight = useCallback((content: string, highlightedText: string, highlightStyle?: string) => {
    console.log('Adding insight:', { content, highlightedText, highlightStyle });
    const newId = Date.now();
    const newInsight: AIInsight = {
      id: newId,
      content,
      type: 'comment',
      highlightedText,
      highlightStyle,
      isHighlighted: true
    };
    setInsights(prev => {
      const newInsights = [...prev, newInsight];
      console.log('New insights state:', newInsights);
      return newInsights;
    });
    setSelectedInsight(newId);
    setShowCommentInput(false);
    setPendingComment(null);
    setIsInsightsOpen(true);
  }, []);

  // Log insights whenever they change
  useEffect(() => {
    console.log('Current insights:', insights);
  }, [insights]);

  const handleStartComment = useCallback((text: string, highlightStyle: string) => {
    setPendingComment({ text, highlightStyle });
    setShowCommentInput(true);
    setIsInsightsOpen(true);
  }, []);

  const handleStartEdit = useCallback((insight: AIInsight) => {
    setPendingComment({ 
      text: insight.highlightedText || '', 
      highlightStyle: insight.highlightStyle || '',
      editingId: insight.id 
    });
    setShowCommentInput(true);
    setIsEditingComment(true);
    setSelectedInsight(insight.id);
  }, []);

  const handleFinishEdit = useCallback(() => {
    setShowCommentInput(false);
    setPendingComment(null);
    setIsEditingComment(false);
    setSelectedInsight(null);
  }, []);

  // Update highlights when selection changes
  useEffect(() => {
    if (selectedInsight === null) {
      setInsights(prev => prev.map(insight => ({ ...insight, isHighlighted: false })));
    } else {
      setInsights(prev => prev.map(insight => ({
        ...insight,
        isHighlighted: insight.id === selectedInsight
      })));
    }
  }, [selectedInsight]);

  const handleEditComment = useCallback((insightId: number, newContent: string) => {
    setInsights(prev => prev.map(insight => 
      insight.id === insightId 
        ? { ...insight, content: newContent }
        : insight
    ));
  }, []);

  const handleDeleteInsight = useCallback((insightId: number) => {
    setInsights(prev => prev.filter(insight => insight.id !== insightId));
    setSelectedInsight(null);
  }, []);

  const focusCommentWithActiveId = (id: string) => {
    if (!commentsSectionRef.current) return;

    const commentInput = commentsSectionRef.current.querySelector<HTMLTextAreaElement>(`textarea#${id}`);
    if (!commentInput) return;

    commentInput.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    });
    commentInput.focus();
  };

  useEffect(() => {
    if (!activeCommentId) return;
    focusCommentWithActiveId(activeCommentId);
  }, [activeCommentId]);

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
      quotedText
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

  return (
    <div className={cn("w-full h-full relative", className)}>
      <InsightsContext.Provider value={[insights, setInsights]}>
        <div className="h-full flex flex-col">
          <div className="sticky top-4 z-30">
            <div className="mx-4 rounded-lg overflow-hidden border border-border/40">
              <div className="px-4 py-2 border-b border-border/40 bg-blue-100/60 dark:bg-blue-900/10 backdrop-blur supports-[backdrop-filter]:bg-blue-100/40 dark:supports-[backdrop-filter]:bg-blue-900/5">
                <div className="flex items-center justify-between space-x-4">
                  {/* Left section */}
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-stone-200 dark:bg-zinc-700" />
                      <span className="text-sm font-semibold">Ripple</span>
                    </div>
                    <div className="w-[1px] h-7 bg-border/40 dark:bg-zinc-800 rounded-full" />
                    <input 
                      type="text" 
                      value={documentTitle}
                      onChange={(e) => setDocumentTitle(e.target.value)}
                      placeholder="Untitled document"
                      className="bg-transparent border-none text-sm focus:outline-none focus:ring-0 p-0 h-6 text-stone-800 dark:text-zinc-100"
                    />
                    <div className="w-[1px] h-7 bg-border/40 dark:bg-zinc-800 rounded-full" />
                    <ModeToggle />
                    <div className="w-[1px] h-7 bg-border/40 dark:bg-zinc-800 rounded-full" />
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="h-7 px-3 text-xs flex items-center space-x-2"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>Save</span>
                        <span className="text-xs text-muted-foreground ml-1">{isMac ? '⌘S' : 'Ctrl+S'}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSaveAs}
                        disabled={isSaving}
                        className="h-7 px-3 text-xs flex items-center space-x-2"
                      >
                        <FileDown className="h-3.5 w-3.5" />
                        <span>Save As</span>
                      </Button>
                    </div>
                  </div>

                  {/* Right section */}
                  <div className="flex items-center space-x-4">
                    <div className="flex space-x-1 text-sm">
                      <DropdownMenuWithCheckboxes
                        label="View Topic Sentences"
                        items={topic_items}
                        selectedItems={selectedItems}
                        onSelectedItemsChange={handleSelectionChange}
                      />
                      <DropdownMenuWithCheckboxes
                        label="Check for Feedback"
                        items={feedback_items}
                        selectedItems={selectedItems}
                        onSelectedItemsChange={handleSelectionChange}
                      />
                    </div>
                    <div className="w-[1px] h-7 bg-border/40 dark:bg-zinc-800 rounded-full" />
                    <Button
                      variant={isInsightsOpen ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setIsInsightsOpen(!isInsightsOpen)}
                      className="h-7 px-3 text-xs flex items-center space-x-1"
                    >
                      <LightbulbIcon className="h-3.5 w-3.5" />
                      <span>Insights</span>
                    </Button>
                    <Button
                      variant={isAIPanelOpen ? "secondary" : "ghost"}
                      size="sm"
                      onClick={toggleAIPanel}
                      className="h-7 px-3 text-xs flex items-center space-x-1"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Chat</span>
                    </Button>
                  </div>
                </div>
              </div>
              <EditorToolbar 
                editor={editor} 
                hasSelection={!!editor?.state.selection.content()}
                onAddComment={handleAddComment}
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

                  {/* Comments Section */}
                  <div 
                    ref={commentsSectionRef} 
                    className={cn(
                      "absolute top-0 right-0 w-[300px] space-y-2 py-12",
                      "transition-all duration-150 ease-in-out",
                      isInsightsOpen 
                        ? "opacity-100 pointer-events-auto translate-x-0" 
                        : "opacity-0 pointer-events-none translate-x-8"
                    )}
                    style={{
                      right: "-332px"
                    }}
                  >
                    {comments.length === 0 ? (
                      <div className="text-center text-muted-foreground pt-8">
                        No comments yet
                      </div>
                    ) : (
                      comments.map((comment) => (
                        <Card 
                          key={comment.id}
                          className={cn(
                            "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
                            "border border-border/40 shadow-sm transition-all duration-200",
                            activeCommentId === comment.id && "ring-2 ring-blue-500"
                          )}
                        >
                          <CardContent className="p-3">
                            <div className="flex flex-col space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">Comment</span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(comment.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => setActiveCommentId(comment.id)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => {
                                      editor?.chain().focus().unsetComment(comment.id).run();
                                      setComments(comments.filter(c => c.id !== comment.id));
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              {comment.quotedText && (
                                <div 
                                  className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md cursor-pointer hover:bg-muted/70"
                                  onClick={() => {
                                    if (!editor) return;
                                    
                                    // Find the comment mark
                                    let foundPos: { from: number; to: number } | null = null;
                                    editor.state.doc.descendants((node, pos) => {
                                      const mark = node.marks.find(m => 
                                        m.type.name === 'comment' && 
                                        m.attrs.commentId === comment.id
                                      );
                                      if (mark) {
                                        foundPos = { from: pos, to: pos + node.nodeSize };
                                        return false; // Stop searching once found
                                      }
                                    });

                                    if (foundPos) {
                                      // Set selection and focus editor
                                      editor
                                        .chain()
                                        .focus()
                                        .setTextSelection(foundPos)
                                        .run();

                                      // Only scroll if not in view
                                      const selection = window.getSelection();
                                      if (selection && selection.rangeCount > 0) {
                                        const range = selection.getRangeAt(0);
                                        const rect = range.getBoundingClientRect();
                                        if (rect.top < 0 || rect.bottom > window.innerHeight) {
                                          editor.commands.scrollIntoView();
                                        }
                                      }
                                    }
                                  }}
                                >
                                  "{comment.quotedText}"
                                </div>
                              )}
                              <div className={cn(
                                "text-sm",
                                activeCommentId === comment.id && "bg-muted rounded-md p-2"
                              )}>
                                {activeCommentId === comment.id ? (
                                  <div className="space-y-2">
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
                                  comment.content || "No content"
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <AISidePanel isOpen={isAIPanelOpen} onClose={toggleAIPanel} />
      </InsightsContext.Provider>
    </div>
  );
} 