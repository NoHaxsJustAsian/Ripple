// src/components/InlineAIResponse.tsx
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Wand2, X, Copy, Check, Menu } from 'lucide-react';

interface InlineAIResponseProps {
    response: string;
    suggestedText: string;
    onClose: () => void;
    onInsert: (text: string) => void;
    onBackToMenu?: () => void; // Add this prop for returning to context menu
}

export function InlineAIResponse({
    response,
    suggestedText,
    onClose,
    onInsert,
    onBackToMenu
}: InlineAIResponseProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const dragRef = useRef<{
        startX: number;
        startY: number;
        startMouseX: number;
        startMouseY: number
    }>({
        startX: 0,
        startY: 0,
        startMouseX: 0,
        startMouseY: 0
    });

    const handleCopySuggestion = () => {
        navigator.clipboard.writeText(suggestedText);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) {
            return;
        }

        setIsDragging(true);
        dragRef.current = {
            startX: position.x,
            startY: position.y,
            startMouseX: e.clientX,
            startMouseY: e.clientY
        };
        e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;

        const deltaX = e.clientX - dragRef.current.startMouseX;
        const deltaY = e.clientY - dragRef.current.startMouseY;

        setPosition({
            x: dragRef.current.startX + deltaX,
            y: dragRef.current.startY + deltaY
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging]);

    return (
        <Card
            className="w-[350px] shadow-lg select-none"
            style={{
                transform: `translate(${position.x}px, ${position.y}px)`,
                cursor: isDragging ? 'grabbing' : 'default'
            }}
        >
            <CardContent className="p-3">
                <div className="flex flex-col space-y-2">
                    <div
                        className="flex items-center justify-between cursor-grab active:cursor-grabbing"
                        onMouseDown={handleMouseDown}
                    >
                        <div className="flex items-center space-x-2">
                            <Wand2 className="h-4 w-4" />
                            <span className="text-sm font-medium">AI Response</span>
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

                    {/* AI's explanation/reaction */}
                    <div className="p-2 bg-muted rounded-md text-sm max-h-32 overflow-y-auto">
                        {response}
                    </div>

                    {/* AI's suggested text */}
                    <div
                        className="p-2 border border-primary rounded-md text-sm relative"
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                    >
                        <div className="text-xs text-muted-foreground mb-1">Suggested Text:</div>
                        <div className="max-h-24 overflow-y-auto pr-6">
                            {suggestedText}
                        </div>
                        {isHovered && (
                            <div className="absolute top-2 right-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCopySuggestion}
                                    className="h-6 w-6 p-0"
                                >
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex justify-between mt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onClose}
                            className="h-6 px-2 text-xs"
                        >
                            Dismiss
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => onInsert(suggestedText)}
                            className="h-6 px-2 text-xs bg-blue-500 text-white"
                        >
                            <Check className="h-3 w-3 mr-1" />
                            Insert
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}