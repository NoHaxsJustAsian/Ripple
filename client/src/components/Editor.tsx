import { $getRoot, $getSelection, $isRangeSelection, EditorState, ElementNode, FORMAT_TEXT_COMMAND, RangeSelection, SELECTION_CHANGE_COMMAND, TextNode } from 'lexical';
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
import { useCallback, useEffect, useState } from 'react';
// import { Button, Container, FormElement, Text, Textarea } from '@nextui-org/react'
import { v4 as uuidv4 } from 'uuid'
// import { FiMessageCircle } from 'react-icons/fi'
import { $isAtNodeEnd } from "@lexical/selection"

import LexicalPlainTextPlugin from '@lexical/react/LexicalPlainTextPlugin';
import LexicalContentEditable from '@lexical/react/LexicalContentEditable';
import LexicalOnChangePlugin from '@lexical/react/LexicalOnChangePlugin';
// import './styles/Lexical.scss'
import { CommentInstance, CommentNode, SET_COMMENT_COMMAND } from './lexical-nodes/comment';
import CommentPlugin, { $isCommentNode, UPDATE_COMMENT_COMMAND } from './lexical-nodes/comment';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { activeCommentState, allCommentInstancesState, lastUpdatedCommentInstanceState } from './store/commentStore';

import { COMMAND_PRIORITY_LOW } from 'lexical';
import { Button } from './ui/button';

const LowPriority = COMMAND_PRIORITY_LOW;



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
}

export default function Editor({ 
  className = '', 
  placeholder = 'Type @ to insert...',
  onEditorChange 
}: EditorProps) {
  const [editorState, setEditorState] = useState<string>();
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [documentTitle, setDocumentTitle] = useState('Untitled document');
  const [isSaving, setIsSaving] = useState(false);
  
  // Mock insights for now
  const [insights] = useState<AIInsight[]>([
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
      LinkNode,
      CommentNode
    ],
  };

  // const handleAddParagraphButton = () => {
  //   const [editor] = useLexicalComposerContext();
  //   console.log('handleAddParagraphButton called'); // Check if function is called
    
  //   editor.update(() => {
  //     const selection = $getSelection();
  //     console.log('Current selection:', selection);
      
  //     if ($isRangeSelection(selection)) {
  //       console.log('Selection is a range selection');
        
  //       const paragraphNode = $createParagraphNode();
  //       const buttonNode = $createParagraphButtonNode(paragraphNode.getKey());
        
  //       paragraphNode.append(buttonNode);
  //       console.log('Created paragraphNode and buttonNode:', paragraphNode, buttonNode);
        
  //       selection.insertNodes([paragraphNode]);
  //       console.log('Inserted nodes into selection');
  //     } else {
  //       console.log('Selection is not a range selection');
  //     }
  //   });
  // };
  

  
  // When the editor changes, you can get notified via the
  // LexicalOnChangePlugin!
  const onChange = (editorState: any) => {

    const editorStateJSON = editorState.toJSON();

    const jsonString = JSON.stringify(editorStateJSON);

    setEditorState(jsonString);

    onEditorChange?.(jsonString);

  };
  
  // Lexical React plugins are React components, which makes them
  // highly composable. Furthermore, you can lazy load plugins if
  // desired, so you don't pay the cost for plugins until you
  // actually use them.
  function MyCustomAutoFocusPlugin() {
    const [editor] = useLexicalComposerContext();
  
    useEffect(() => {
      // Focus the editor when the effect fires!
      editor.focus();
    }, [editor]);
  
    return null;
  }
  
  // Catch any errors that occur during Lexical updates and log them
  // or throw them as needed. If you don't throw them, Lexical will
  // try to recover gracefully without losing user data.
  function onError(error: Error) {
    console.error(error);
  }
  
  interface EditorProps {
    className?: string
  }
  
  function getSelectedNode(selection: RangeSelection): TextNode | ElementNode {
    const anchor = selection.anchor;
    const focus = selection.focus;
    const anchorNode = selection.anchor.getNode();
    const focusNode = selection.focus.getNode();
    if (anchorNode === focusNode) {
      return anchorNode;
    }
    const isBackward = selection.isBackward();
    if (isBackward) {
      return $isAtNodeEnd(focus) ? anchorNode : focusNode;
    } else {
      return $isAtNodeEnd(anchor) ? focusNode : anchorNode;
    }
  }
  
  
  const CommentStatePlugin: React.FC = () => {
    return null;
    const [editor] = useLexicalComposerContext()
  
    const [isComment, setIsComment] = useState<boolean>(false)
  
    const [activeCommentInstance, setActiveCommentInstance] = useRecoilState(activeCommentState)
  
    const setAllCommentInstances = useSetRecoilState(allCommentInstancesState)
  
    const [inputContent, setInputContent] = useState("")
  
    useEffect(() => {
      if (!activeCommentInstance) return
  
      const copyActiveCommentInstance: CommentInstance = JSON.parse(JSON.stringify(activeCommentInstance))
  
      const state = editor.getEditorState()
  
      state.read(() => {
        state._nodeMap.forEach((node) => {
          if ($isCommentNode(node) && (node as CommentNode).__commentInstance.uuid === activeCommentInstance.uuid) {
            const [prevCommentInstance, thisCommentInstance] = [JSON.stringify((node as CommentNode).__commentInstance), JSON.stringify(activeCommentInstance)]
            if (prevCommentInstance !== thisCommentInstance) editor.dispatchCommand(UPDATE_COMMENT_COMMAND, copyActiveCommentInstance)
          }
        })
      })
    }, [activeCommentInstance])
  
    const setActiveStates = useCallback(() => {
      const state = editor.getEditorState()
  
      state.read(() => {
        const commentInstances: CommentInstance[] = []
  
        state._nodeMap.forEach((node, key, map) => {
          node.__type === CommentNode.getType()
  
          const commentInstance = (node as CommentNode).__commentInstance || {}
  
          if (commentInstance.uuid) commentInstances.push(commentInstance)
        })
  
        setAllCommentInstances(commentInstances)
      })
  
      const selection = $getSelection()
  
      if ($isRangeSelection(selection)) {
        const node = getSelectedNode(selection as RangeSelection)
  
        const parent = node.getParent()
  
        let commentNode: CommentNode | undefined
  
        if ($isCommentNode(node)) commentNode = node as CommentNode
        else if (parent && $isCommentNode(parent)) commentNode = parent as CommentNode
  
        if (commentNode) {
          setIsComment(true)
          const activeCommentInstance: CommentInstance = JSON.parse(JSON.stringify(commentNode.__commentInstance))
          setActiveCommentInstance(activeCommentInstance)
        } else {
          setIsComment(false)
          setActiveCommentInstance(undefined)
        }
      }
    }, [editor])
  
    useEffect(() => {
      return editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (_payload, e) => {
          setActiveStates()
          return false
        },
        LowPriority
      )
    })
  }
  

const AddCommentPlugin: React.FC = () => {
  const [editor] = useLexicalComposerContext()

  const [inputContent, setInputContent] = useState("I love lexical!!!")

  const addComment = () => {
    if (!inputContent) return

    editor.update(() => {
      const sel = $getSelection()
      const textContent = sel?.getTextContent() || ""

      const dummyCommentInstance: CommentInstance = {
        uuid: uuidv4(),
        textContent,
        comments: [
          {
            content: inputContent,
            time: 'just now',
            userName: 'sereneinserenade'
          }
        ]
      }

      editor.dispatchCommand(SET_COMMENT_COMMAND, dummyCommentInstance)

      setInputContent("")
    })
  }

  const onKeyboardEvent = (event: React.KeyboardEvent<HTMLInputElement>) => event.code === 'Enter' && event.metaKey && addComment()


  return (
    <div className={cn("w-full h-full relative", className)}>
      <LexicalComposer initialConfig={{ ...initialConfig, nodes: [CommentNode] }}>
        <CommentStatePlugin />
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
                <Button color="secondary" onClick={addComment} style={{ marginTop: '2ch' }}> Add New Comment (⌘/Ctrl + ↵) </Button>
                  
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
                  <AIContextMenu>
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
                {/* <CommentPlugin />
                <AddCommentPlugin /> */}
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
          variant={isInsightsOpen ? "default" : "ghost"}
          size="sm"
          onClick={() => setIsInsightsOpen(!isInsightsOpen)}
          className="h-7 px-3 text-xs flex items-center space-x-1"
        >
          <LightbulbIcon className="h-3.5 w-3.5" />
          <span>Insights</span>
        </Button>
        <Button
          variant={isAIPanelOpen ? "default" : "ghost"}
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
                  <p className="text-sm">{insight.content}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
    
  );
} }