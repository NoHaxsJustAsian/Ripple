import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { ArrowLeft, Copy, MessageSquare, Lightbulb, Network } from 'lucide-react';

interface SentenceFlowPopoverProps {
    position: { x: number; y: number };
    sentenceText: string;
    connectionStrength: number;
    connectedSentences: string[];
    onExitFlowMode: () => void;
    onAddComment: () => void;
    onCopySentence: () => void;
    onAnalyzeConnections: () => void;
    onExplainSentence: () => void;
}

export function SentenceFlowPopover({
    position,
    sentenceText,
    connectionStrength,
    connectedSentences,
    onExitFlowMode,
    onAddComment,
    onCopySentence,
    onAnalyzeConnections,
    onExplainSentence
}: SentenceFlowPopoverProps) {
    return (
        <div
            style={{
                position: 'fixed',
                left: `${position.x}px`,
                top: `${position.y}px`,
                zIndex: 1000,
                pointerEvents: 'auto'
            }}
            onMouseEnter={() => {
                console.log('🎯 Mouse entered popover - keeping visible');
                // Cancel any pending hide timeouts when hovering over popover
                const event = new CustomEvent('popover-mouse-enter');
                document.dispatchEvent(event);
            }}
            onMouseLeave={() => {
                console.log('🎯 Mouse left popover - scheduling hide');
                // Schedule hide when leaving popover
                const event = new CustomEvent('popover-mouse-leave');
                document.dispatchEvent(event);
            }}
        >
            <Card className="w-80 shadow-lg border-green-200">
                <CardContent className="p-3">
                    {/* Header with sentence info */}
                    <div className="mb-3 pb-2 border-b border-green-100">
                        <div className="text-sm font-medium text-green-800 mb-1">
                            Selected Sentence
                        </div>
                        <div className="text-xs text-gray-600 max-h-16 overflow-y-auto">
                            {sentenceText.length > 100 ? `${sentenceText.substring(0, 100)}...` : sentenceText}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                Flow Strength: {connectionStrength.toFixed(2)}
                            </div>
                            <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                {connectedSentences.length} Connections
                            </div>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onExitFlowMode}
                            className="flex items-center gap-2 text-xs h-8"
                        >
                            <ArrowLeft className="h-3 w-3" />
                            Exit Flow-Sentence Mode
                        </Button>

                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onCopySentence}
                                className="flex items-center gap-1 text-xs h-8"
                            >
                                <Copy className="h-3 w-3" />
                                Copy
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onAddComment}
                                className="flex items-center gap-1 text-xs h-8"
                            >
                                <MessageSquare className="h-3 w-3" />
                                Comment
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onExplainSentence}
                                className="flex items-center gap-1 text-xs h-8"
                            >
                                <Lightbulb className="h-3 w-3" />
                                Explain
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onAnalyzeConnections}
                                className="flex items-center gap-1 text-xs h-8"
                            >
                                <Network className="h-3 w-3" />
                                Re-analyze
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
} 