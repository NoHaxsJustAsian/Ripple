import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { X, GripVertical, CornerDownLeftIcon, AlignLeft, FileText, ChevronRight, Pencil, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { toast } from "sonner";

interface SentenceFlowActionPanelProps {
    position: { x: number; y: number };
    sentenceText: string;
    connectionStrength: number;
    connectedSentences: string[];
    paragraphCohesion?: {
        score: number;
        analysis: string;
    };
    documentCohesion?: {
        score: number;
        analysis: string;
    };
    onExitFlowMode: () => void;
    onAddComment: () => void;
    onCopySentence: () => void;
    onRedoAnalysis: () => void;
    onExplainSentence: () => void;
    onClose: () => void;
    onUpdateSentence?: (newSentenceText: string) => void;
    editor?: any; // TipTap editor instance
    isAnalyzing?: boolean;
}

export function SentenceFlowActionPanel({
    sentenceText,
    connectedSentences,
    paragraphCohesion,
    documentCohesion,
    onClose,
    onUpdateSentence,
    editor,
    isAnalyzing = false
}: SentenceFlowActionPanelProps) {
    // Draggable state
    const [panelPosition, setPanelPosition] = useState({ x: 70, y: window.innerHeight * 0.15 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const panelRef = useRef<HTMLDivElement>(null);

    // Collapsible state
    const [isParagraphCohesionExpanded, setIsParagraphCohesionExpanded] = useState(true);
    const [isDocumentCohesionExpanded, setIsDocumentCohesionExpanded] = useState(true);

    // Text selection state
    const [isCurrentTextHovered, setIsCurrentTextHovered] = useState(false);
    const [isInSelectionMode, setIsInSelectionMode] = useState(false);
    const [selectedEditorText, setSelectedEditorText] = useState<string>('');

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

    // Track editor text selection when in selection mode
    useEffect(() => {
        if (!editor || !isInSelectionMode) return;

        const handleSelectionUpdate = () => {
            const { selection } = editor.state;
            const { from, to } = selection;

            if (from !== to) {
                const selectedText = editor.state.doc.textBetween(from, to);
                setSelectedEditorText(selectedText);
                // toast.success("Text selected", {
                //     description: `Selected: "${selectedText.substring(0, 50)}${selectedText.length > 50 ? '...' : ''}"`,
                //     duration: 2000
                // });
            } else {
                setSelectedEditorText('');
            }
        };

        // Add selection update listener
        editor.on('selectionUpdate', handleSelectionUpdate);

        // Disable other editor functionality by making it read-only
        editor.setEditable(false);

        // Add CSS class to editor for selection mode cursor styling
        const editorElement = editor.view.dom.closest('.ProseMirror') || editor.view.dom;
        if (editorElement) {
            editorElement.classList.add('text-selection-mode');
        }

        // Clean up
        return () => {
            editor.off('selectionUpdate', handleSelectionUpdate);
            editor.setEditable(true);

            // Remove CSS class
            if (editorElement) {
                editorElement.classList.remove('text-selection-mode');
            }
        };
    }, [editor, isInSelectionMode]);

    // Handler to enter selection mode
    const handleEnterSelectionMode = () => {
        setIsInSelectionMode(true);
        setSelectedEditorText('');
        toast.info("Selection mode active", {
            description: "Select text from the editor, then click Done",
            duration: 3000
        });
    };

    // Handler to cancel selection mode
    const handleCancelSelection = () => {
        setIsInSelectionMode(false);
        setSelectedEditorText('');
        toast.info("Selection mode cancelled", {
            duration: 2000
        });
    };

    // Handler when Done is clicked in selection mode
    const handleDoneSelection = () => {
        if (!selectedEditorText.trim()) {
            toast.error("No text selected", {
                description: "Please select text from the editor before clicking Done",
                duration: 3000
            });
            setIsInSelectionMode(false);
            setSelectedEditorText('');
            return;
        }

        // Check if the selected text is the same as the current text
        if (selectedEditorText.trim() === sentenceText.trim()) {
            toast.info("No changes needed", {
                description: "Selected text is the same as current sentence",
                duration: 2000
            });
            setIsInSelectionMode(false);
            setSelectedEditorText('');
            return;
        }

        // Exit selection mode
        setIsInSelectionMode(false);
        setSelectedEditorText('');

        // Call the update callback if provided
        if (onUpdateSentence) {
            onUpdateSentence(selectedEditorText);
            toast.success("Updating flow analysis", {
                description: "Re-analyzing with selected text",
                duration: 2000
            });
        }
    };

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
            <Card className="w-72 bg-white dark:bg-background border border-border/40 backdrop-blur-sm max-h-[80vh] flex flex-col">
                <CardContent className="p-4 flex flex-col h-full overflow-hidden">
                    {/* Header with drag handle and close button */}
                    <div
                        className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 cursor-grab active:cursor-grabbing flex-shrink-0"
                        onMouseDown={handleMouseDown}
                    >
                        <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-gray-600" />
                            <div className="text-sm font-semibold text-gray-800">
                                Flow Analysis 
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            className="h-6 w-6 p-0 text-gray-600 hover:text-gray-800"
                            onMouseDown={(e) => e.stopPropagation()} // Prevent drag when clicking close
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Scrollable content area */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden">
                        {/* Sentence info */}
                        <div className="mb-4 pb-3 border-b border-gray-100">
                            <div className="text-xs font-medium text-gray-700 mb-2">
                            Selected Sentence:
                        </div>
                            <div
                                className="text-xs text-gray-700 max-h-20 overflow-y-auto bg-white/50 p-2 rounded border relative"
                                onMouseEnter={() => setIsCurrentTextHovered(true)}
                                onMouseLeave={() => setIsCurrentTextHovered(false)}
                            >
                            {sentenceText.length > 150 ? `${sentenceText.substring(0, 150)}...` : sentenceText}

                                {/* Hover button */}
                                {isCurrentTextHovered && !isInSelectionMode && editor && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="absolute top-1 right-1 h-6 w-6 p-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border shadow-md hover:shadow-lg transition-all duration-200"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEnterSelectionMode();
                                        }}
                                        title="Select new text from editor"
                                    >
                                        <Pencil className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>

                            {/* Selection mode UI */}
                            {isInSelectionMode && (
                                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                            Text Selection Mode
                                        </h4>
                                    </div>
                                    <p className="text-xs text-blue-600 dark:text-blue-300 mb-3">
                                        Select text from the editor above, then click Done to update the sentence and re-run flow analysis.
                                    </p>

                                    {selectedEditorText && (
                                        <div className="mb-3 p-2 bg-white dark:bg-gray-800 rounded border">
                                            <div className="text-xs text-muted-foreground mb-1">Selected text:</div>
                                            <div className="text-sm">
                                                {selectedEditorText.length > 100
                                                    ? `${selectedEditorText.substring(0, 100)}...`
                                                    : selectedEditorText
                                                }
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end space-x-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCancelSelection();
                                            }}
                                            className="h-8 px-3"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDoneSelection();
                                            }}
                                            className="h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white"
                                            disabled={!selectedEditorText.trim()}
                                        >
                                            Done
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-2 mt-3">
                                <div className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded font-medium">
                                    {connectedSentences.length} Connections
                                </div>
                            </div>
                        </div>
                        {/* Loading overlay */}
                        {isAnalyzing && (
                            <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-50 flex items-center justify-center">
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg flex items-center gap-3">
                                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                                    <span className="text-sm font-medium">Updating flow analysis...</span>
                                </div>
                            </div>
                        )}

                        {paragraphCohesion ? (
                            <div className={`rounded-lg border-l-2 border-blue-400 bg-blue-50/60 p-3 mb-4 relative ${isAnalyzing ? 'opacity-50' : ''}`}>
                                <div
                                    className="flex items-center justify-between cursor-pointer"
                                    onClick={() => setIsParagraphCohesionExpanded(!isParagraphCohesionExpanded)}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <AlignLeft className="h-4 w-4 text-blue-500" />
                                        <span className="font-semibold text-blue-700 text-xs uppercase tracking-wide">Paragraph Cohesion</span>
                                    </div>
                                    <ChevronRight className={`h-4 w-4 text-blue-500 transition-transform duration-300 ease-in-out ${isParagraphCohesionExpanded ? 'rotate-90' : 'rotate-0'
                                        }`} />
                                </div>
                                <div
                                    className={`overflow-hidden transition-all duration-300 ease-in-out ${isParagraphCohesionExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                                        }`}
                                >
                                    <div
                                        className="text-xs text-gray-700 mt-2 [&_b]:font-semibold"
                                        dangerouslySetInnerHTML={{ __html: paragraphCohesion.analysis }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className={`rounded-lg border-l-2 border-gray-300 bg-gray-50/60 p-3 mb-4 relative ${isAnalyzing ? 'opacity-50' : ''}`}>
                                <div
                                    className="flex items-center justify-between cursor-pointer"
                                    onClick={() => setIsParagraphCohesionExpanded(!isParagraphCohesionExpanded)}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <AlignLeft className="h-4 w-4 text-gray-400" />
                                        <span className="font-semibold text-gray-500 text-xs uppercase tracking-wide">Paragraph Cohesion</span>
                                </div>
                                        <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform duration-300 ease-in-out ${isParagraphCohesionExpanded ? 'rotate-90' : 'rotate-0'
                                            }`} />
                                    </div>
                                    <div
                                        className={`overflow-hidden transition-all duration-300 ease-in-out ${isParagraphCohesionExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                                            }`}
                                    >
                                        <div className="text-xs text-gray-400 mt-2">No data</div>
                                    </div>
                            </div>
                        )}
                        {/* Divider */}
                        <div className="h-2" />
                        {documentCohesion ? (
                            <div className={`rounded-lg border-l-2 border-purple-400 bg-purple-50/60 p-3 relative ${isAnalyzing ? 'opacity-50' : ''}`}>
                                <div
                                    className="flex items-center justify-between cursor-pointer"
                                    onClick={() => setIsDocumentCohesionExpanded(!isDocumentCohesionExpanded)}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <FileText className="h-4 w-4 text-purple-500" />
                                        <span className="font-semibold text-purple-700 text-xs uppercase tracking-wide">Document Cohesion</span>
                                </div>
                                    <ChevronRight className={`h-4 w-4 text-purple-500 transition-transform duration-300 ease-in-out ${isDocumentCohesionExpanded ? 'rotate-90' : 'rotate-0'
                                        }`} />
                            </div>
                                <div
                                    className={`overflow-hidden transition-all duration-300 ease-in-out ${isDocumentCohesionExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                                        }`}
                                >
                                    <div
                                        className="text-xs text-gray-700 mt-2 [&_b]:font-semibold"
                                        dangerouslySetInnerHTML={{ __html: documentCohesion.analysis }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className={`rounded-lg border-l-2 border-gray-300 bg-gray-50/60 p-3 relative ${isAnalyzing ? 'opacity-50' : ''}`}>
                                <div
                                    className="flex items-center justify-between cursor-pointer"
                                    onClick={() => setIsDocumentCohesionExpanded(!isDocumentCohesionExpanded)}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <FileText className="h-4 w-4 text-gray-400" />
                                        <span className="font-semibold text-gray-500 text-xs uppercase tracking-wide">Document Cohesion</span>
                                    </div>
                                        <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform duration-300 ease-in-out ${isDocumentCohesionExpanded ? 'rotate-90' : 'rotate-0'
                                            }`} />
                                    </div>
                                    <div
                                        className={`overflow-hidden transition-all duration-300 ease-in-out ${isDocumentCohesionExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                                            }`}
                                    >
                                        <div className="text-xs text-gray-400 mt-2">No data</div>
                                    </div>
                        </div>
                    )}
                    </div>

                    {/* Action buttons - hide during selection mode */}
                    {!isInSelectionMode && (
                        <div className="mt-4 space-y-2 flex-shrink-0">
                            {/* <Button
                                variant="default"
                                size="sm"
                                onClick={onRedoAnalysis}
                                className="w-full flex items-center gap-2 text-xs h-9 bg-blue-500 hover:bg-blue-700 text-white border-blue-600 shadow-sm"
                            >
                                <Repeat2Icon className="h-3 w-3 text-white" />
                                Redo Flow Analysis
                            </Button> */}
                            <Button
                                variant="default"
                                size="sm"
                                onClick={onClose}
                                className="w-full flex items-center gap-2 text-xs h-9 bg-blue-500 hover:bg-blue-700 text-white border-blue-600 shadow-sm"
                                onMouseDown={(e) => e.stopPropagation()} // Prevent drag when clicking close
                                disabled={isAnalyzing}
                            >
                                <CornerDownLeftIcon className="h-3 w-3 text-white-400" />
                                Return to Flow Mode
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
} 