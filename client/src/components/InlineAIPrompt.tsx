import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Wand2, X, Menu } from 'lucide-react';

interface InlineAIPromptProps {
  onSubmit: (prompt: string) => void;
  onClose: () => void;
  onBackToMenu?: () => void; // Add this prop for returning to context menu
  title?: string;
  placeholder?: string;
}

export function InlineAIPrompt({
  onSubmit,
  onClose,
  onBackToMenu,
  title = "AI Writing Assistant",
  placeholder = "Ask AI to help with your selected text..."
}: InlineAIPromptProps) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = () => {
    if (prompt.trim()) {
      onSubmit(prompt.trim());
      setPrompt('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Card
      className="w-[300px] shadow-lg select-none"
    >
      <CardContent className="p-3">
        <div className="flex flex-col space-y-2">
          <div
            className="flex items-center justify-between cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center space-x-2">
              <Wand2 className="h-4 w-4" />
              <span className="text-sm font-medium">{title}</span>
            </div>
            <div className="flex items-center space-x-1">
              {onBackToMenu && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBackToMenu}
                  className="h-6 w-6 p-0"
                  title="Back to Context Menu"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full h-24 p-2 text-sm resize-none rounded-md border border-input bg-background focus:outline-none"
              autoFocus
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              Press Enter to send
            </span>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!prompt.trim()}
              className="h-6 px-2 text-xs"
            >
              Send
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}