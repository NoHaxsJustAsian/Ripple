import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown, MessageSquare, FileText, RectangleEllipsis } from 'lucide-react';
// impor/ { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const FONT_SIZES = {
  'Small': '9pt',
  'Normal': '11pt',
  'Large': '14pt',
  'Huge': '18pt'
};

interface EditorToolbarProps {
  editor: Editor | null;
  hasSelection?: boolean;
  onAddComment?: () => void;
  onSuggestEdit?: () => void;
  showParagraphTopics?: boolean;
  showEssayTopics?: boolean;
  onToggleParagraphTopics?: () => void;
  onToggleEssayTopics?: () => void;
}

export function EditorToolbar({ 
  editor, 
  hasSelection = false, 
  onAddComment, 
  showParagraphTopics = false,
  showEssayTopics = false,
  onToggleParagraphTopics,
  onToggleEssayTopics
}: EditorToolbarProps) {
  const getCurrentFontSize = () => {
    if (!editor) return 'Normal';
    const attrs = editor.getAttributes('textStyle');
    const fontSize = attrs.fontSize || '11pt';
    return Object.entries(FONT_SIZES).find(([_, size]) => size === fontSize)?.[0] || 'Normal';
  };

  const updateFontSize = (size: string) => {
    if (!editor) return;
    editor.chain().focus().setMark('textStyle', { fontSize: size }).run();
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center px-4 py-2 h-12 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">      
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center space-x-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-3 text-xs flex items-center space-x-1"
              >
                <span>{getCurrentFontSize()}</span>
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
                  {getCurrentFontSize() === label && (
                    <Check className="h-4 w-4" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-4 w-px bg-border/40" />

          <div className="flex items-center space-x-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor?.isActive('bold') ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className="h-8 w-8 p-0"
                >
                  <span className="font-bold">B</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Bold</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor?.isActive('italic') ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className="h-8 w-8 p-0"
                >
                  <span className="italic">I</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Italic</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor?.isActive('underline') ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleUnderline().run()}
                  className="h-8 w-8 p-0"
                >
                  <span className="underline">U</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Underline</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="h-4 w-px bg-border/40" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onAddComment}
                disabled={!hasSelection}
                className="h-8 w-8 p-0"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Add Comment</p>
            </TooltipContent>
          </Tooltip>

          {/* <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSuggestEdit}
                disabled={!hasSelection}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Suggest Edit</p>
            </TooltipContent>
          </Tooltip> */}

          <div className="h-4 w-px bg-border/40" />

          {/* Topic Sentence Toggle Buttons */}
          <div className="flex items-center space-x-1">
            <Button
              variant={showParagraphTopics ? "secondary" : "ghost"}
              size="sm"
              onClick={onToggleParagraphTopics}
              className={`h-8 px-3 text-xs flex items-center space-x-1 transition-all duration-200 ${showParagraphTopics
                ? 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200'
                : 'hover:bg-gray-100 text-gray-600'
                }`}
            >
              <RectangleEllipsis className="h-3.5 w-3.5" />
              <span>{showParagraphTopics ? 'Hide' : 'Show'} Paragraph Topics</span>
              {showParagraphTopics && (
                <div className="ml-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              )}
            </Button>
            

            <Button
              variant={showEssayTopics ? "secondary" : "ghost"}
              size="sm"
              onClick={onToggleEssayTopics}
              className={`h-8 px-3 text-xs flex items-center space-x-1 transition-all duration-200 ${showEssayTopics
                ? 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200'
                : 'hover:bg-gray-100 text-gray-600'
                }`}
            >
              <FileText className="h-3.5 w-3.5" />

              <span>{showEssayTopics ? 'Hide' : 'Show'} Essay Topics</span>
              {showEssayTopics && (
                <div className="ml-1 w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              )}
            </Button>
          </div>
          
          <div className="h-4 w-px bg-border/40" />
        </div>
      </div>
    </TooltipProvider>
  );
} 