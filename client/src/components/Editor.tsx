import { $getRoot, $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND } from 'lexical';
import { useEffect, useState, useCallback } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MessageSquare, LightbulbIcon, Save, FileDown } from 'lucide-react';
import { AISidePanel } from './AISidePanel';
import { AIContextMenu } from './AIContextMenu';
import { EditorToolbar } from './EditorToolbar';
import { theme } from '@/lib/editor-theme';
import { toast } from "sonner";
import DropdownMenuWithCheckboxes from './ui/dropdown-menu-select';
import { updateHighlightedText } from "../utils/highlightUtils";
import { $createParagraphButtonNode, ParagraphButtonNode } from '../utils/paragraphButtonNode';
import { $createParagraphNode } from 'lexical';


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
  type: 'suggestion' | 'comment' | 'improvement';
  highlightedText?: string;
  highlightStyle?: string;
}

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
  
  const [insights, setInsights] = useState<AIInsight[]>([
    { id: 1, content: "Consider rephrasing this sentence for clarity", type: 'suggestion' },
    { id: 2, content: "This paragraph could be more concise", type: 'improvement' },
    { id: 3, content: "Good use of active voice here", type: 'comment' },
  ]);

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
      LinkNode
    ],
  };

  const onChange = (editorState: any) => {
    const editorStateJSON = editorState.toJSON();
    const jsonString = JSON.stringify(editorStateJSON);
    setEditorState(jsonString);
    onEditorChange?.(jsonString);
  };

  const handleAddInsight = useCallback((content: string, highlightedText: string, highlightStyle?: string) => {
    setInsights(prev => [
      ...prev,
      {
        id: Date.now(),
        content,
        type: 'comment',
        highlightedText,
        highlightStyle
      }
    ]);
    // Automatically open insights panel when adding a comment
    setIsInsightsOpen(true);
  }, []);

  return (
    <div className={cn("w-full h-full relative", className)}>
      <LexicalComposer initialConfig={initialConfig}>
        <div className="h-full flex flex-col">
          <div className="px-4 py-2 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center space-x-4 relative">
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
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center space-x-4">
                <div className="w-[1px] h-7 bg-border/40 dark:bg-zinc-800 rounded-full mx-2" />
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
                <div className="w-[1px] h-7 bg-border/40 dark:bg-zinc-800 rounded-full mx-2" />
              </div>
              <div className="ml-auto flex items-center space-x-2">
                <ModeToggle />
                <div className="w-[1px] h-7 bg-border/40 dark:bg-zinc-800 rounded-full mx-2" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-3 text-xs">
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      <span>{isSaving ? "Saving..." : "Save"}</span>
                      <span className="ml-auto text-xs text-muted-foreground">⌘S</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleSaveAs}
                      disabled={isSaving}
                      className="flex items-center"
                    >
                      <FileDown className="mr-2 h-4 w-4" />
                      <span>Save As...</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
          <div className="sticky top-4 z-30 px-4">
            <div className="relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2">
                <div className="w-[1px] h-8 bg-border/40 dark:bg-zinc-800 rounded-full mx-2" />
              </div>
              <div className="absolute right-0 top-1/2 -translate-y-1/2">
                <div className="w-[1px] h-8 bg-border/40 dark:bg-zinc-800 rounded-full mx-2" />
              </div>
              <EditorToolbar />
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-[#FAF9F6] dark:bg-background/10">
            <div className="mx-auto" style={{ width: '816px' }}>
              <div className="py-12">
                <div className="relative bg-[#FFFDF7] dark:bg-card min-h-[1056px] shadow-sm">
                  <AIContextMenu onAddInsight={handleAddInsight}>
                    <RichTextPlugin
                      contentEditable={
                        <ContentEditable 
                          className={cn(
                            "outline-none min-h-[1056px] text-[11pt]",
                            "px-[72px] py-[96px]",
                            "text-stone-800 dark:text-zinc-50",
                            "caret-blue-500"
                          )}
                        />
                      }
                      placeholder={
                        <div className={cn(
                          "absolute top-[96px] left-[72px]",
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
        </div>
      </LexicalComposer>
      
      {/* Fixed AI buttons */}
      <div className="fixed right-4 top-[10px] flex items-center space-x-2 z-50">
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

      <AISidePanel isOpen={isAIPanelOpen} onClose={toggleAIPanel} />

      {/* AI Insights Cards */}
      <div className={cn(
        "fixed right-[calc(50%-408px-316px)] top-[140px] bottom-0 w-[300px] transition-all duration-200 ease-in-out",
        "pointer-events-none",
        isInsightsOpen ? "opacity-100 translate-x-0" : "opacity-0 translate-x-[316px]"
      )}>
        <div className="p-4 space-y-3">
          {insights.map((insight) => (
            <Card key={insight.id} className="pointer-events-auto bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <CardContent className="p-3">
                <div className="flex items-start space-x-2">
                  <LightbulbIcon className="h-4 w-4 mt-0.5 text-yellow-500" />
                  <div className="space-y-1">
                    <p className="text-sm">{insight.content}</p>
                    {insight.highlightedText && (
                      <div className="text-sm text-muted-foreground pl-4 border-l-2 border-muted">
                        <p style={insight.highlightStyle ? { backgroundColor: insight.highlightStyle } : undefined}>
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
    </div>
    
  );
} 