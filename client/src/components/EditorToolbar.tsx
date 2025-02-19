import { useState, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND } from 'lexical';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown } from 'lucide-react';
import { cn } from "@/lib/utils";

const FONT_SIZES = {
  'Small': '9pt',
  'Normal': '11pt',
  'Large': '14pt',
  'Huge': '18pt'
};

export function EditorToolbar() {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [fontSize, setFontSize] = useState('11pt');

  useEffect(() => {
    editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          setIsBold(selection.hasFormat('bold'));
          setIsItalic(selection.hasFormat('italic'));
          setIsUnderline(selection.hasFormat('underline'));
        }
      });
    });
  }, [editor]);

  const updateFontSize = (newSize: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        // You would need to implement the font size change command
        console.log('Changing font size to:', newSize);
      }
    });
    setFontSize(newSize);
  };

  // Get the label for the current font size
  const getCurrentFontSizeLabel = () => {
    return Object.entries(FONT_SIZES).find(([_, size]) => size === fontSize)?.[0] || 'Normal';
  };

  return (
    <div className="flex items-center px-4 py-2 h-12 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">      
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center space-x-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-3 text-xs flex items-center space-x-1"
            >
              <span>{getCurrentFontSizeLabel()}</span>
              <ChevronDown className="h-3.5 w-3.5 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-32">
            {Object.entries(FONT_SIZES).map(([label, size]) => (
              <DropdownMenuItem
                key={size}
                onClick={() => updateFontSize(size)}
                className="flex items-center justify-between"
              >
                <span>{label}</span>
                {fontSize === size && (
                  <Check className="h-4 w-4" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-4 w-px bg-border/40" />

        <div className="flex items-center space-x-1">
          <Button
            variant={isBold ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
            }}
            className="h-8 w-8 p-0"
          >
            <span className="font-bold">B</span>
          </Button>
          <Button
            variant={isItalic ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
            }}
            className="h-8 w-8 p-0"
          >
            <span className="italic">I</span>
          </Button>
          <Button
            variant={isUnderline ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
            }}
            className="h-8 w-8 p-0"
          >
            <span className="underline">U</span>
          </Button>
        </div>
      </div>
    </div>
  );
} 