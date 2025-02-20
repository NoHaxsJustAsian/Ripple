import { useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, $createTextNode, $createParagraphNode } from 'lexical';
import { Wand2, Copy, Clipboard, TextSelect, RectangleEllipsis, MessageCirclePlus, MessageSquare } from 'lucide-react';
import { InlineAIPrompt } from './InlineAIPrompt';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ContextMenuSeparator } from '@radix-ui/react-context-menu';
// import { $createParagraphNode } from 'lexical';


interface AIContextMenuProps {
  children: React.ReactNode;
  onAddInsight?: (content: string, highlightedText: string, highlightStyle?: string) => void;
  onStartComment?: (text: string, highlightStyle: string) => void;
}

export function AIContextMenu({ children, onAddInsight, onStartComment }: AIContextMenuProps) {
  const [editor] = useLexicalComposerContext();
  const [showInlinePrompt, setShowInlinePrompt] = useState(false);
  const [promptPosition, setPromptPosition] = useState({ x: 0, y: 0 });
  const [paragraphTopics, setParagraphTopics] = useState<Set<string>>(new Set()); // Paragraph topics (yellow)
  const [essayTopics, setEssayTopics] = useState<Set<string>>(new Set()); // Essay topics (blue)
  const [commentMode, setCommentMode] = useState(false);
  const [selectedText, setSelectedText] = useState('');


  const handleAIAction = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    // Get the mouse position from the context menu event
    const mouseEvent = window.event as MouseEvent;
    
    // Position the prompt above the click position
    setPromptPosition({
      x: Math.max(20, Math.min(mouseEvent.clientX, window.innerWidth - 420)), // Keep prompt within viewport
      y: Math.max(20, mouseEvent.clientY - 20) // 20px above click position
    });
    setShowInlinePrompt(true);
  };

  const handleCopy = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const selectedText = selection.getTextContent();
        if (selectedText) {
          navigator.clipboard.writeText(selectedText).then(() => {
            console.log('Text copied to clipboard:', selectedText);
          }).catch((err) => {
            console.error('Failed to copy text:', err);
          });
        }
      }
    });
  };

  const handlePaste = () => {
    navigator.clipboard.readText().then((clipboardText) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const textNode = $createTextNode(clipboardText);
          selection.insertNodes([textNode]);
        }
      });
    }).catch((err) => {
      console.error('Failed to read from clipboard:', err);
    });
  };

  const handleSelectAsParagraphTopic = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const selectedText = selection.getTextContent();
        if (selectedText) {
          const isAlreadyTopic = paragraphTopics.has(selectedText);
  
          if (isAlreadyTopic) {
            selection.insertNodes([$createTextNode(selectedText)]); // Remove highlight
            setParagraphTopics((prev) => {
              const newSet = new Set(prev);
              newSet.delete(selectedText);
              return newSet;
            });
          } else {
            // Create highlighted node
            const highlightedNode = $createTextNode(selectedText);
            highlightedNode.setStyle("background-color: #93c5fd"); // Highlight blue
            const emptyTextNode = $createTextNode("");
            selection.insertNodes([highlightedNode, emptyTextNode]);
            selection.setTextNodeRange(emptyTextNode, 0, emptyTextNode, 0);
  
            setParagraphTopics((prev) => new Set(prev).add(selectedText));
          }
        }
      }
    });
  };

  const handleSelectAsEssayTopic = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const selectedText = selection.getTextContent();
        if (selectedText) {
          const isAlreadyEssayTopic = essayTopics.has(selectedText);
  
          if (isAlreadyEssayTopic) {
            selection.insertNodes([$createTextNode(selectedText)]); // Remove highlight
            setEssayTopics((prev) => {
              const newSet = new Set(prev);
              newSet.delete(selectedText);
              return newSet;
            });
          } else {
            // Create highlighted node
            const highlightedNode = $createTextNode(selectedText);
            highlightedNode.setStyle("background-color: #c4b5fd"); // Highlight purple
            const emptyTextNode = $createTextNode("");
            selection.insertNodes([highlightedNode, emptyTextNode]);
            selection.setTextNodeRange(emptyTextNode, 0, emptyTextNode, 0);
  
            setEssayTopics((prev) => new Set(prev).add(selectedText));
          }
        }
      }
    });
  };

  const handleAddComment = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !onStartComment) return;

    const text = selection.toString();
    
    // Add temporary highlight
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const textNode = $createTextNode(text);
        textNode.setStyle("background-color: #fef9c3"); // Light yellow highlight
        selection.insertNodes([textNode]);
      }
    });

    onStartComment(text, "#fef9c3");
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    e.preventDefault();
  };

  return (
    <>
      <div onContextMenu={handleContextMenu}>
        <ContextMenu>
          <ContextMenuTrigger>
            {children}
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem 
              onSelect={handleCopy}
              className="flex items-center"
            >
              <Copy className="mr-2 h-4 w-4" />
              <span>Copy</span>
            </ContextMenuItem>
            <ContextMenuItem 
              onSelect={handlePaste}
              className="flex items-center"
            >
              <Clipboard className="mr-2 h-4 w-4" />
              <span>Paste</span>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem 
              onSelect={handleAddComment}
              className="flex items-center"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              <span>Add Comment</span>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem 
              onSelect={handleSelectAsParagraphTopic}
              className="flex items-center"
            >
              <RectangleEllipsis className="mr-2 h-4 w-4" />
              <span>Select as Paragraph Topic</span>
            </ContextMenuItem>
            <ContextMenuItem 
              onSelect={handleSelectAsEssayTopic}
              className="flex items-center"
            >
              <TextSelect className="mr-2 h-4 w-4" />
              <span>Select as Essay Topic</span>
            </ContextMenuItem>
            <ContextMenuItem 
              onSelect={handleAIAction}
              className="flex items-center"
            >
              <MessageCirclePlus className="mr-2 h-4 w-4" />
              <span>Select for Custom Feedback</span>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem 
              onSelect={handleAIAction}
              className="flex items-center"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              <span>Ask AI Assistant</span>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      {showInlinePrompt && (
        <div 
          style={{ 
            position: 'fixed',
            left: `${promptPosition.x}px`,
            top: `${promptPosition.y}px`,
            zIndex: 100
          }}
        >
          <InlineAIPrompt
            onSubmit={(prompt: string) => {
              console.log('Inline prompt:', prompt);
              setShowInlinePrompt(false);
            }}
            onClose={() => setShowInlinePrompt(false)}
          />
        </div>
      )}
    </>
  );
}