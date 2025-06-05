import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { X, GripVertical, Repeat2Icon } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface SentenceFlowActionPanelProps {
    position: { x: number; y: number };
    sentenceText: string;
    connectionStrength: number;
    connectedSentences: string[];
    paragraphCohesion?: {
        score: number;
        analysis: string;
        strengths: string[];
        weaknesses: string[];
    };
    documentCohesion?: {
        score: number;
        analysis: string;
        strengths: string[];
        weaknesses: string[];
    };
    onExitFlowMode: () => void;
    onAddComment: () => void;
    onCopySentence: () => void;
    onRedoAnalysis: () => void;
    onExplainSentence: () => void;
    onClose: () => void;
}

export function SentenceFlowActionPanel({
    position,
    sentenceText,
    connectionStrength,
    connectedSentences,
    paragraphCohesion,
    documentCohesion,
    onExitFlowMode,
    onAddComment,
    onCopySentence,
    onRedoAnalysis,
    onExplainSentence,
    onClose
}: SentenceFlowActionPanelProps) {
    // Draggable state
    const [panelPosition, setPanelPosition] = useState({ x: 70, y: window.innerHeight * 0.45 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const panelRef = useRef<HTMLDivElement>(null);

    // Handle drag start
    const handleMouseDown = (e: React.MouseEvent) => {
        if (panelRef.current) {
            const rect = panelRef.current.getBoundingClientRect();
            setDragOffset({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            });
            setIsDragging(true);
        }
    };

    // Handle drag move and end
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                const newX = e.clientX - dragOffset.x;
                const newY = e.clientY - dragOffset.y;

                // Constrain to viewport bounds
                const maxX = window.innerWidth - 288; // 288px is panel width (w-72)
                const maxY = window.innerHeight - 300; // Approximate panel height

                setPanelPosition({
                    x: Math.max(0, Math.min(newX, maxX)),
                    y: Math.max(0, Math.min(newY, maxY))
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    return (
        <div
            ref={panelRef}
            style={{
                position: 'fixed',
                left: `${panelPosition.x}px`,
                top: `${panelPosition.y}px`,
                zIndex: 1000,
                pointerEvents: 'auto',
                cursor: isDragging ? 'grabbing' : 'auto'
            }}
        >
            <Card className="w-72 shadow-xl border-green-200 bg-green-50/95 backdrop-blur-sm">
                <CardContent className="p-4">
                    {/* Header with drag handle and close button */}
                    <div
                        className="flex items-center justify-between mb-3 pb-2 border-b border-green-200 cursor-grab active:cursor-grabbing"
                        onMouseDown={handleMouseDown}
                    >
                        <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-green-600" />
                            <div className="text-sm font-semibold text-green-800">
                                Flow Analysis
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            className="h-6 w-6 p-0 text-green-600 hover:text-green-800"
                            onMouseDown={(e) => e.stopPropagation()} // Prevent drag when clicking close
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Sentence info */}
                    <div className="mb-4 pb-3 border-b border-green-100">
                        <div className="text-xs font-medium text-green-700 mb-2">
                            Selected Sentence:
                        </div>
                        <div className="text-xs text-gray-700 max-h-20 overflow-y-auto bg-white/50 p-2 rounded border">
                            {sentenceText.length > 150 ? `${sentenceText.substring(0, 150)}...` : sentenceText}
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                            <div className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded font-medium">
                                Flow Level: {connectionStrength.toFixed(2)}
                            </div>
                            <div className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded font-medium">
                                {connectedSentences.length} Connections
                            </div>
                        </div>
                    </div>
                    <hr />
                    <div className="pt-3 text-xs font-medium text-green-700 mb-2">
                        Paragraph Cohesion
                    </div>
                    {paragraphCohesion ? (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded font-medium">
                                    Score: {paragraphCohesion.score.toFixed(2)}
                                </div>
                            </div>
                            <div className="text-xs text-gray-700 bg-white/50 p-2 rounded border max-h-20 overflow-y-auto">
                                {paragraphCohesion.analysis}
                            </div>
                            {paragraphCohesion.strengths.length > 0 && (
                                <div>
                                    <div className="text-xs font-medium text-green-600 mb-1">Strengths:</div>
                                    <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                                        {paragraphCohesion.strengths.map((strength, idx) => (
                                            <li key={idx}>{strength}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {paragraphCohesion.weaknesses.length > 0 && (
                                <div>
                                    <div className="text-xs font-medium text-red-600 mb-1">Areas for Improvement:</div>
                                    <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                                        {paragraphCohesion.weaknesses.map((weakness, idx) => (
                                            <li key={idx}>{weakness}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-xs text-gray-500 bg-white/50 p-2 rounded border">
                            No paragraph cohesion data available
                        </div>
                    )}

                    <div className="pt-3 text-xs font-medium text-green-700 mb-2">
                        Document Cohesion
                    </div>
                    {documentCohesion ? (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded font-medium">
                                    Score: {documentCohesion.score.toFixed(2)}
                                </div>
                            </div>
                            <div className="text-xs text-gray-700 bg-white/50 p-2 rounded border max-h-20 overflow-y-auto">
                                {documentCohesion.analysis}
                            </div>
                            {documentCohesion.strengths.length > 0 && (
                                <div>
                                    <div className="text-xs font-medium text-green-600 mb-1">Strengths:</div>
                                    <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                                        {documentCohesion.strengths.map((strength, idx) => (
                                            <li key={idx}>{strength}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {documentCohesion.weaknesses.length > 0 && (
                                <div>
                                    <div className="text-xs font-medium text-red-600 mb-1">Areas for Improvement:</div>
                                    <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                                        {documentCohesion.weaknesses.map((weakness, idx) => (
                                            <li key={idx}>{weakness}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-xs text-gray-500 bg-white/50 p-2 rounded border">
                            No document cohesion data available
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="mt-4 space-y-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onRedoAnalysis}
                            className="w-full flex items-center gap-2 text-xs h-9 bg-white/70 hover:bg-white border-green-300"
                        >
                            <Repeat2Icon className="h-3 w-3" />
                            Redo Flow Analysis
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
} 