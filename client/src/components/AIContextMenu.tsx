import { useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { Wand2 } from 'lucide-react';
import { InlineAIPrompt } from './InlineAIPrompt';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface AIContextMenuProps {
  children: React.ReactNode;
}

export function AIContextMenu({ children }: AIContextMenuProps) {
  const [editor] = useLexicalComposerContext();
  const [showInlinePrompt, setShowInlinePrompt] = useState(false);
  const [promptPosition, setPromptPosition] = useState({ x: 0, y: 0 });

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