import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sendChatMessage } from '@/lib/api';

interface AISidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
  selectedText?: string;
}

export function AISidePanel({ isOpen, onClose, className, selectedText = '' }: AISidePanelProps) {
  // Chat state
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      // Small delay to ensure the panel is visible before focusing
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);
  
  useEffect(() => {
    if (selectedText && isOpen) {
      setInput(selectedText);
    }
  }, [selectedText, isOpen]);

  const handleSubmitChat = async () => {
    if (input.trim()) {
      const userMessage = input.trim();
      setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
      setInput('');
      setIsSending(true);
      
      try {
        const response = await sendChatMessage({ message: userMessage });
        setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
      } catch (error) {
        console.error('Chat error:', error);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error. Please try again.' 
        }]);
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitChat();
    }
  };

  return (
    <div
      className={cn(
        "fixed right-4 top-[80px] bottom-4 w-[300px] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        "border border-border/40 transition-transform duration-200 ease-in-out z-50 rounded-lg overflow-hidden",
        isOpen ? "translate-x-0" : "translate-x-[316px]",
        className
      )}
    >
      <div className="flex items-center h-12 px-4 border-b border-border/40">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-4 w-4" />
          <h2 className="text-sm font-medium">Chat</h2>
        </div>
        <div className="flex-grow"></div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose} 
          className="h-7 w-7 ml-2 text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col h-[calc(100%-3rem)]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs mt-1">Ask anything about your writing!</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <Card key={index} className={cn(
                "w-full",
                message.role === 'assistant' && "bg-muted"
              )}>
                <CardContent className="p-3">
                  <div className="flex items-start space-x-2">
                    <MessageSquare className="h-4 w-4 mt-0.5" />
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
          {isSending && (
            <div className="flex items-center justify-center p-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border/40">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              className="w-full h-24 p-2 text-sm resize-none rounded-md border border-input bg-background focus:outline-none"
              disabled={isSending}
            />
            <div className="absolute right-2 bottom-2 flex items-center space-x-2">
              <span className="text-xs text-muted-foreground">
                Press Enter to send
              </span>
              <Button
                size="sm"
                onClick={handleSubmitChat}
                disabled={!input.trim() || isSending}
                className="h-7 text-xs"
              >
                {isSending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  'Send'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 