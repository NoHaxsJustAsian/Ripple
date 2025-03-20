import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AISidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function AISidePanel({ isOpen, onClose, className }: AISidePanelProps) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Loading state
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      // Small delay to ensure the panel is visible before focusing
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (input.trim()) {
      const userMessage: { role: 'user' | 'assistant'; content: string } = { role: 'user', content: input.trim() };
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);
  
      try {
        const response = await fetch('http://127.0.0.1:5000/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            system_message: "You are a helpful assistant.",
            user_prompt: input.trim(),
          }),
        });
        console.log("Backend response status:", response.status);  // Log the response status
        if (!response.ok) {
          throw new Error('Failed to fetch AI response');
        }
  
        const data = await response.json();
        console.log("Backend response data:", data);  // Log the response data
        const aiMessage: { role: 'user' | 'assistant'; content: string } = { role: 'assistant', content: data.response };
        setMessages((prev) => [...prev, aiMessage]);
      } catch (error) {
        console.error('Error fetching AI response:', error);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
        ]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
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
      </div>

      <div className="flex flex-col h-[calc(100%-3rem)]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <Card
              key={index}
              className={cn(
                "w-full",
                message.role === 'assistant' && "bg-muted"
              )}
            >
              <CardContent className="p-3">
                <div className="flex items-start space-x-2">
                  <MessageSquare className="h-4 w-4 mt-0.5" />
                  <p className="text-sm">{message.content}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {isLoading && (
            <Card className="w-full bg-muted">
              <CardContent className="p-3">
                <div className="flex items-start space-x-2">
                  <MessageSquare className="h-4 w-4 mt-0.5" />
                  <p className="text-sm">Thinking...</p>
                </div>
              </CardContent>
            </Card>
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
            />
            <div className="absolute right-2 bottom-2 flex items-center space-x-2">
              <span className="text-xs text-muted-foreground">
                Press Enter to send
              </span>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!input.trim() || isLoading}
                className="h-7 text-xs"
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}