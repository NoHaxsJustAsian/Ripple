import { $getRoot, $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND, $createTextNode, TextNode, COMMAND_PRIORITY_EDITOR, KEY_ENTER_COMMAND, KEY_BACKSPACE_COMMAND, KEY_DELETE_COMMAND } from 'lexical';
import { useEffect, useState, useCallback, useRef, useContext, createContext } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { HeadingNode } from '@lexical/rich-text';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode } from '@lexical/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { cn } from "@/lib/utils";
import { MessageSquare, LightbulbIcon, Save, FileDown, X, Pencil, Trash2 } from 'lucide-react';
import { AISidePanel } from './AISidePanel';
import { AIContextMenu } from './AIContextMenu';
import { EditorToolbar } from './EditorToolbar';
import { theme } from '@/lib/editor-theme';
import { toast } from "sonner";
import DropdownMenuWithCheckboxes from './ui/dropdown-menu-select';
import { updateHighlightedText } from "../utils/highlightUtils";
import { $createParagraphButtonNode, ParagraphButtonNode } from '../utils/paragraphButtonNode';
import { CommentNode } from './nodes/CommentNode';


// Error handler
function onError(error: Error): void {
  console.error(error);
}

interface OnChangePluginProps {
  onChange: (editorState: any) => void;
}

// OnChange Plugin to track editor changes
function OnChangePlugin({ onChange }: OnChangePluginProps): null {
  const [editor] = useLexicalComposerContext();
  
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      onChange(editorState);
    });
  }, [editor, onChange]);
  
  return null;
}

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

// Plugin to track text changes and update comments
function CommentSyncPlugin(): null {
  const [editor] = useLexicalComposerContext();
  const [insights, setInsights] = useContext(InsightsContext);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot();
        const nodes = root.getChildren();

        // Find all text nodes with background color style (highlighted)
        nodes.forEach(node => {
          if (node instanceof TextNode && node.getStyle()?.includes('background-color')) {
            const nodeText = node.getTextContent();
            const nodeStyle = node.getStyle();
            const bgColor = nodeStyle.match(/background-color:\s*([^;]+)/)?.[1];

            // Find the corresponding insight
            const matchingInsight = insights.find(insight => 
              insight.highlightStyle?.includes(bgColor || '') && 
              insight.highlightedText !== nodeText // Text has changed
            );

            if (matchingInsight) {
              // Update the insight with the new text
              setInsights(prev => prev.map(insight => 
                insight.id === matchingInsight.id
                  ? { ...insight, highlightedText: nodeText }
                  : insight
              ));
            }
          }
        });
      });
    });
  }, [editor, insights, setInsights]);

  return null;
}

// Plugin to control where users can type
function TypeControlPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Handle keypress events directly
    const removeKeyDownListener = editor.registerRootListener(
      (rootElement: null | HTMLElement) => {
        if (rootElement !== null) {
          rootElement.addEventListener('keydown', (event) => {
            if (event.key.length === 1) { // Single character keys
              const selection = $getSelection();
              if (!$isRangeSelection(selection)) {
                return;
              }

              const nodes = selection.getNodes();
              // Only allow typing if none of the selected text nodes are highlighted
              const canType = nodes.every(node => {
                if (node instanceof TextNode) {
                  const style = node.getStyle();
                  return !(style && style.includes('background-color'));
                }
                return true;
              });

              if (!canType) {
                event.preventDefault();
              }
            }
          });
        }
      }
    );

    return () => {
      removeKeyDownListener();
    };
  }, [editor]);

  return null;
}

// Create a context for insights
export const InsightsContext = createContext<[AIInsight[], React.Dispatch<React.SetStateAction<AIInsight[]>>]>([[], () => {}]);

export default function Editor({ 
  className = '', 
  placeholder = 'Type @ to insert...',
  onEditorChange 
}: EditorProps): JSX.Element {
  const [editorState, setEditorState] = useState<string>();
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [documentTitle, setDocumentTitle] = useState('Untitled document');
  const [isSaving, setIsSaving] = useState(false);
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  
  const [insights, setInsights] = useState<AIInsight[]>([
    { id: 2, content: "This paragraph could be more concise", type: 'improvement' },
    { id: 3, content: "Good use of active voice here", type: 'comment' },
  ]);

  const [selectedInsight, setSelectedInsight] = useState<number | null>(null);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(null);
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
    if (!editorState) return;

    setIsSaving(true);
    try {
      // TODO: Implement actual save to backend
      // For now, we'll just simulate a save
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Save to localStorage as a backup
      localStorage.setItem('ripple-doc', JSON.stringify({
        title: documentTitle,
        content: editorState,
        lastSaved: new Date().toISOString()
      }));

      toast.success("Document saved successfully");
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error("Failed to save document");
    } finally {
      setIsSaving(false);
    }
  }, [editorState, documentTitle]);

  const handleSaveAs = useCallback(async () => {
    if (!editorState) return;

    setIsSaving(true);
    try {
      // Create a new document with a timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const newTitle = `${documentTitle} - ${timestamp}`;
      
      // Save to localStorage with a new key
      const docKey = `ripple-doc-${Date.now()}`;
      localStorage.setItem(docKey, JSON.stringify({
        title: newTitle,
        content: editorState,
        lastSaved: new Date().toISOString()
      }));

      // Update current document title
      setDocumentTitle(newTitle);
      toast.success("Document saved as new copy");
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error("Failed to save document");
    } finally {
      setIsSaving(false);
    }
  }, [editorState, documentTitle]);

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
    if (saved) {
      const { title, content } = JSON.parse(saved);
      setDocumentTitle(title);
      setEditorState(content);
    }
  }, []);

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

  const initialConfig = {
    namespace: 'GoogleDocsEditor',
    theme,
    onError,
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      ParagraphButtonNode,
      LinkNode,
      CommentNode
    ],
    editable: true,
  };

  const onChange = (editorState: any) => {
    const editorStateJSON = editorState.toJSON();
    const jsonString = JSON.stringify(editorStateJSON);
    setEditorState(jsonString);
    onEditorChange?.(jsonString);
  };

  const handleAddInsight = useCallback((content: string, highlightedText: string, highlightStyle?: string) => {
    const newId = Date.now();
    setInsights(prev => [
      ...prev,
      {
        id: newId,
        content,
        type: 'comment',
        highlightedText,
        highlightStyle,
        isHighlighted: true
      }
    ]);
    setSelectedInsight(newId);
    setShowCommentInput(false);
    setPendingComment(null);
    setIsInsightsOpen(true);
  }, []);

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

  function EditorContent() {
    const [editor] = useLexicalComposerContext();
    const [hasSelection, setHasSelection] = useState(false);

    useEffect(() => {
      return editor.registerUpdateListener(() => {
        const selection = window.getSelection();
        setHasSelection(!!selection && !selection.isCollapsed);
      });
    }, [editor]);

    const handleToolbarComment = useCallback(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        return;
      }
  
      const text = selection.toString();
      
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const highlightedTextNode = $createTextNode(text);
          highlightedTextNode.setStyle("background-color: #fef9c3");
          selection.insertNodes([highlightedTextNode]);
          const plainTextNode = $createTextNode("");
          selection.insertNodes([plainTextNode]);
          // collapse selection to the plain text node by setting anchor and focus
          selection.anchor.key = plainTextNode.getKey();
          selection.anchor.offset = 0;
          selection.focus.key = plainTextNode.getKey();
          selection.focus.offset = 0;
        }
      });
  
      setPendingComment({ text, highlightStyle: "#fef9c3" });
      setShowCommentInput(true);
      setIsInsightsOpen(true);
    }, [editor]);

    return (
      <>
        <EditorToolbar onStartComment={handleToolbarComment} hasSelection={hasSelection} />
        <div className="flex-1 overflow-auto bg-[#FAF9F6] dark:bg-background/10">
          <div className="mx-auto" style={{ width: '794px' }}>
            <div className="py-12">
              <div className="relative bg-[#FFFDF7] dark:bg-card shadow-sm">
                <div className="absolute inset-0 pointer-events-none">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-full border-b border-dashed border-gray-200 dark:border-gray-800"
                      style={{ top: `${(i + 1) * 1028}px` }}
                    />
                  ))}
                </div>
                <AIContextMenu 
                  onAddInsight={handleAddInsight}
                  onStartComment={handleStartComment}
                >
                  <RichTextPlugin
                    contentEditable={
                      <ContentEditable 
                        className={cn(
                          "outline-none min-h-[1028px] text-[11pt]",
                          "px-[64px] py-[84px]",
                          "text-stone-800 dark:text-zinc-50",
                          "caret-blue-500",
                          "[&>div]:min-h-[24px]",
                          "[&>div]:break-words",
                          "[&>div]:max-w-[666px]"
                        )}
                      />
                    }
                    placeholder={
                      <div className={cn(
                        "absolute top-[84px] left-[64px]",
                        "text-[11pt] pointer-events-none",
                        "text-stone-400 dark:text-zinc-500"
                      )}>
                        {placeholder}
                      </div>
                    }
                    ErrorBoundary={LexicalErrorBoundary}
                  />
                </AIContextMenu>
              </div>
              <HistoryPlugin />
              <AutoFocusPlugin />
              <ListPlugin />
              <LinkPlugin />
              <TabIndentationPlugin />
              <OnChangePlugin onChange={onChange} />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className={cn("w-full h-full relative", className)}>
      <InsightsContext.Provider value={[insights, setInsights]}>
        <LexicalComposer initialConfig={initialConfig}>
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
                <EditorContent />
              </div>
            </div>
            <CommentSyncPlugin />
            <TypeControlPlugin />
          </div>

          {/* AI Insights Cards */}
          <div className={cn(
            "fixed right-[calc(50%-408px-316px)] top-[140px] bottom-0 w-[300px] transition-all duration-200 ease-in-out z-50",
            "pointer-events-none",
            isInsightsOpen ? "opacity-100 translate-x-0" : "opacity-0 translate-x-[316px]"
          )}>
            <div className="p-4 space-y-3">
              {showCommentInput && pendingComment && (
                <Card className="pointer-events-auto bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <CardContent className="p-3">
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {pendingComment.editingId ? 'Edit Comment' : 'Add Comment'}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleFinishEdit}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-sm text-muted-foreground pl-4 border-l-2 border-muted">
                        <p style={{ backgroundColor: pendingComment.highlightStyle }}>
                          "{pendingComment.text}"
                        </p>
                      </div>
                      <div className="relative">
                        <textarea
                          ref={commentInputRef}
                          placeholder="Write your comment..."
                          className="w-full h-24 p-2 text-sm resize-none rounded-md border border-input bg-background focus:outline-none"
                          defaultValue={pendingComment.editingId ? 
                            insights.find(i => i.id === pendingComment.editingId)?.content : 
                            ''
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              const comment = e.currentTarget.value.trim();
                              if (comment) {
                                if (pendingComment.editingId) {
                                  handleEditComment(pendingComment.editingId, comment);
                                  setShowCommentInput(false);
                                  setPendingComment(null);
                                } else {
                                  handleAddInsight(comment, pendingComment.text, pendingComment.highlightStyle);
                                }
                              }
                            }
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          Press Enter to {pendingComment.editingId ? 'save' : 'send'}
                        </span>
                        <Button
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={(e) => {
                            const textarea = e.currentTarget.parentElement?.previousElementSibling?.querySelector('textarea') as HTMLTextAreaElement;
                            const comment = textarea?.value.trim();
                            if (comment) {
                              if (pendingComment.editingId) {
                                handleEditComment(pendingComment.editingId, comment);
                                setShowCommentInput(false);
                                setPendingComment(null);
                              } else {
                                handleAddInsight(comment, pendingComment.text, pendingComment.highlightStyle);
                              }
                            }
                          }}
                        >
                          {pendingComment.editingId ? 'Save' : 'Comment'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {insights.map((insight) => (
                <Card 
                  key={insight.id} 
                  className={cn(
                    "pointer-events-auto bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
                    selectedInsight === insight.id && "ring-2 ring-blue-500",
                    isEditingComment && insight.id !== selectedInsight && "opacity-50 pointer-events-none"
                  )}
                  onClick={() => !isEditingComment && setSelectedInsight(selectedInsight === insight.id ? null : insight.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start space-x-2">
                      <LightbulbIcon className="h-4 w-4 mt-0.5 text-yellow-500" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-start justify-between">
                          <p className="text-sm flex-1">{insight.content}</p>
                          <div className="flex items-center space-x-1 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(insight);
                              }}
                              className="h-6 w-6 p-0"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Are you sure you want to delete this insight?')) {
                                  handleDeleteInsight(insight.id);
                                }
                              }}
                              className="h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {insight.highlightedText && (
                          <div className="text-sm text-muted-foreground pl-4 border-l-2 border-muted">
                            <p style={insight.isHighlighted && insight.highlightStyle ? { backgroundColor: insight.highlightStyle } : undefined}>
                              "{insight.highlightedText}"
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </LexicalComposer>
        
        <AISidePanel isOpen={isAIPanelOpen} onClose={toggleAIPanel} />
      </InsightsContext.Provider>
    </div>
  );
} 