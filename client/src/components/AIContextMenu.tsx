import { useState, Dispatch, SetStateAction, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { Copy, Clipboard, RectangleEllipsis, FileText, MessageSquare, FileCheck2, HighlighterIcon, MousePointer2 } from 'lucide-react';
import { InlineAIPrompt } from './InlineAIPrompt';
import { InlineAIResponse } from './InlineAIResponse';
import { sendCustomPrompt } from '../lib/api';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { Card, CardContent } from '@/components/ui/card';
import { CommentType } from './editor/types';
import { Button } from '@/components/ui/button';

// Comment type re-exported for convenience
export type { CommentType };

interface AIContextMenuProps {
  children: React.ReactNode;
  editor: Editor | null;
  onSelectAsParagraphTopic?: () => void;
  onSelectAsEssayTopic?: () => void;
  comments: CommentType[];
  setComments: Dispatch<SetStateAction<CommentType[]>>;
  activeCommentId: string | null;
  setActiveCommentId: Dispatch<SetStateAction<string | null>>;
  onAddComment: () => void;
  runContextualAnalysis?: (analysisType: 'all' | 'custom') => void;
}

export function AIContextMenu({
  children,
  editor,
  onSelectAsParagraphTopic,
  onSelectAsEssayTopic,
  comments,
  setComments,
  activeCommentId,
  setActiveCommentId,
  onAddComment,
  runContextualAnalysis
}: AIContextMenuProps) {
  const [showInlinePrompt, setShowInlinePrompt] = useState(false);
  const [promptPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<{
    response: string;
    suggestedText: string
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isSelectedTextHovered, setIsSelectedTextHovered] = useState(false);
  const [originalSelection, setOriginalSelection] = useState<{ from: number; to: number } | null>(null);
  const [isWaitingForReselection, setIsWaitingForReselection] = useState(false);
  const activeMouseUpListener = useRef<((e: MouseEvent) => void) | null>(null);
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



  const handleBackToContextMenu = () => {
    setShowInlinePrompt(false);
    setAiResponse(null);

    // Trigger the context menu at the current position
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: promptPosition.x,
      clientY: promptPosition.y
    });
    editor?.view.dom.dispatchEvent(event);
  };

  const handleCopy = () => {
    if (!editor) return;
    const text = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to
    );
    navigator.clipboard.writeText(text);
  };

  const handlePaste = () => {
    if (!editor) return;
    navigator.clipboard.readText().then((text) => {
      editor.commands.insertContent(text);
    });
  };

  const handleSubmitPrompt = async (prompt: string) => {
    if (!editor) return;

    setIsLoading(true);

    try {
      // Get the full document for context
      const fullContext = editor.getHTML();

      // Use the custom prompt endpoint
      const response = await sendCustomPrompt({
        selectedText,
        prompt,
        fullContext
      });

      // Set the response
      setAiResponse({
        response: response.response,
        suggestedText: response.suggestedText
      });

    } catch (error) {
      console.error('Error getting AI response:', error);
      setAiResponse({
        response: "Sorry, I couldn't process your request properly.",
        suggestedText: selectedText
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInsertText = (text: string) => {
    if (!editor) return;

    // Get the original selection
    const { from, to } = editor.state.selection;

    // Delete the selected content and insert the new text
    editor.commands.deleteRange({ from, to });
    editor.commands.insertContent(text);

    // Close the prompt
    setShowInlinePrompt(false);
    setAiResponse(null);
  };

  const handleClosePrompt = () => {
    setShowInlinePrompt(false);
    setAiResponse(null);
    setDragOffset({ x: 0, y: 0 });
    setOriginalSelection(null);
    setIsSelectedTextHovered(false);
    setIsWaitingForReselection(false);

    // Clean up any active mouseup listener
    if (activeMouseUpListener.current) {
      document.removeEventListener('mouseup', activeMouseUpListener.current);
      activeMouseUpListener.current = null;
    }
  };

  const handleReselectText = () => {
    if (!editor || !originalSelection) return;

    // Clean up any existing listener first
    if (activeMouseUpListener.current) {
      document.removeEventListener('mouseup', activeMouseUpListener.current);
      activeMouseUpListener.current = null;
    }

    // Set waiting state
    setIsWaitingForReselection(true);

    // Reselect the original text in the editor
    editor.commands.setTextSelection({
      from: originalSelection.from,
      to: originalSelection.to
    });

    // Focus the editor
    editor.commands.focus();

    // Set up a listener to detect when the user finishes making a new selection
    const handleMouseUp = () => {
      // Small delay to ensure selection is finalized
      setTimeout(() => {
        const { from, to } = editor.state.selection;
        if (from !== to) {
          // User made a new selection
          const newText = editor.state.doc.textBetween(from, to);
          if (newText !== selectedText && newText.trim().length > 0) {
            // Update the selected text and original selection
            setSelectedText(newText);
            setOriginalSelection({ from, to });
            setIsWaitingForReselection(false);

            // Remove the listener after updating
            document.removeEventListener('mouseup', handleMouseUp);
            activeMouseUpListener.current = null;
          }
        }
      }, 50); // Small delay to ensure selection is complete
    };

    // Store the listener reference and add it to the document
    activeMouseUpListener.current = handleMouseUp;
    document.addEventListener('mouseup', handleMouseUp);

    // Clean up the listener after a timeout in case user doesn't make a new selection
    setTimeout(() => {
      if (activeMouseUpListener.current === handleMouseUp) {
        document.removeEventListener('mouseup', handleMouseUp);
        activeMouseUpListener.current = null;
        setIsWaitingForReselection(false);
      }
    }, 10000); // 10 seconds timeout
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start dragging if clicking on buttons, inputs, or textareas
    if ((e.target as HTMLElement).closest('button, input, textarea')) {
      return;
    }

    setIsDragging(true);
    dragRef.current = {
      startX: dragOffset.x,
      startY: dragOffset.y,
      startMouseX: e.clientX,
      startMouseY: e.clientY
    };
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragRef.current.startMouseX;
    const deltaY = e.clientY - dragRef.current.startMouseY;

    setDragOffset({
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

  const handleUpdateComment = (commentId: string) => {
    if (!editor) return;

    // Guard against invalid document state
    const doc = editor.state.doc;
    if (!doc || doc.nodeSize === 0) {
      return;
    }

    // Find all marks with this comment ID
    const marks: { from: number; to: number }[] = [];

    try {
      doc.descendants((node, pos) => {
        // Additional safety checks
        if (!node || !node.marks) return;

        const mark = node.marks.find(m => m.type.name === 'comment' && m.attrs.commentId === commentId);
        if (mark) {
          marks.push({ from: pos, to: pos + node.nodeSize });
        }
      });
    } catch (error) {
      console.warn('AIContextMenu handleUpdateComment descendants error:', error);
      return;
    }

    if (marks.length > 0) {
      // Get the combined text from all marks
      const quotedText = marks.map(({ from, to }) =>
        editor.state.doc.textBetween(from, to)
      ).join(' ');

      // Update the comment with the new quoted text
      setComments(prev => prev.map(comment =>
        comment.id === commentId
          ? { ...comment, quotedText }
          : comment
      ));
    } else {
      // If no marks found, remove the comment
      setComments(prev => prev.filter(comment => comment.id !== commentId));
      setActiveCommentId(null);
    }
  };

  // Add observer for comment changes
  useEffect(() => {
    if (!editor) return;

    const observer = new MutationObserver(() => {
      // Update all existing comments
      comments.forEach(comment => handleUpdateComment(comment.id));
    });

    const element = editor.view.dom;
    observer.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    return () => observer.disconnect();
  }, [editor, comments]);

  // Handle selection changes to update comment text
  useEffect(() => {
    if (!editor || !activeCommentId) return;

    let isProcessing = false; // Guard against infinite recursion

    const handleSelectionChange = () => {
      // Prevent infinite recursion
      if (isProcessing) return;
      isProcessing = true;

      try {
        // Store current selection
        const { from: currentFrom, to: currentTo } = editor.state.selection;

        // Guard against invalid document state
        const doc = editor.state.doc;
        if (!doc || doc.nodeSize === 0) {
          return;
        }

        // Find all marks with this comment ID
        const marks: { from: number; to: number }[] = [];

        try {
          doc.descendants((node, pos) => {
            // Additional safety checks
            if (!node || !node.marks) return;

            const mark = node.marks.find(m => m.type.name === 'comment' && m.attrs.commentId === activeCommentId);
            if (mark) {
              marks.push({ from: pos, to: pos + node.nodeSize });
            }
          });
        } catch (error) {
          console.warn('AIContextMenu descendants error:', error);
          return;
        }

        if (marks.length > 0) {
          // Get the combined text from all marks
          const quotedText = marks.map(({ from, to }) =>
            editor.state.doc.textBetween(from, to)
          ).join(' ');

          // Only update the quoted text if it changed
          setComments(prev => prev.map(comment =>
            comment.id === activeCommentId && comment.quotedText !== quotedText
              ? { ...comment, quotedText }
              : comment
          ));

          // If we're currently inside the comment mark, restore the cursor position
          const isInsideComment = marks.some(({ from, to }) =>
            currentFrom >= from && currentTo <= to
          );

          if (isInsideComment) {
            editor.commands.setTextSelection({ from: currentFrom, to: currentTo });
          }
        }
      } finally {
        // Reset guard after a short delay
        setTimeout(() => {
          isProcessing = false;
        }, 10);
      }
    };

    // Use transaction handler instead of selection update
    const handleTransaction = () => {
      // Add debouncing to prevent excessive calls
      setTimeout(() => {
        handleSelectionChange();
      }, 50);
    };

    editor.on('transaction', handleTransaction);
    return () => {
      editor.off('transaction', handleTransaction);
    };
  }, [editor, activeCommentId]);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
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
              onSelect={handleCopy}
              className="flex items-center"
            >
              <Copy className="mr-2 h-4 w-4" />
              <span>Copy</span>
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={handlePaste}
              className="flex items-center"
            >
              <Clipboard className="mr-2 h-4 w-4" />
              <span>Paste</span>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => runContextualAnalysis?.('all')}
              className="flex items-center"
            >
              <FileCheck2 className="mr-2 h-4 w-4" />
              <span>Check Everything</span>
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => runContextualAnalysis?.('custom')}
              className="flex items-center"
            >
              <HighlighterIcon className="mr-2 h-4 w-4" />
              <span>Check Custom Selection</span>
            </ContextMenuItem>
            {/* <ContextMenuItem
              onSelect={handleAIAction}
              className="flex items-center"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              <span>Get Instant AI Feedback</span>
            </ContextMenuItem> */}
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={onSelectAsParagraphTopic}
              className="flex items-center"
            >
              <RectangleEllipsis className="mr-2 h-4 w-4" />
              <span>Set as Paragraph Topic</span>
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={onSelectAsEssayTopic}
              className="flex items-center"
            >
              <FileText className="mr-2 h-4 w-4" />
              <span>Set as Essay Topic</span>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={onAddComment}
              className="flex items-center"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              <span>Add Comment</span>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
      {showInlinePrompt && (
        <div
          className="select-none"
          style={{
            position: 'fixed',
            left: `${promptPosition.x + dragOffset.x}px`,
            top: `${promptPosition.y + dragOffset.y}px`,
            zIndex: 100,
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
          onMouseDown={handleMouseDown}
        >
          <div className="flex flex-col space-y-2">
            <div
              className={`text-xs text-gray-600 mb-2 p-2 bg-blue-50 border border-blue-200 rounded max-w-[300px] min-h-fit relative${isWaitingForReselection ? ' border-blue-400 bg-blue-100' : ''
                }`}
              onMouseEnter={() => setIsSelectedTextHovered(true)}
              onMouseLeave={() => setIsSelectedTextHovered(false)}
            >
              <span className="italic break-words">"{selectedText}"</span>

              {/* Waiting indicator */}
              {isWaitingForReselection && (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-50/80 rounded">
                  <span className="text-xs text-blue-600 font-medium">Select new text in editor...</span>
                </div>
              )}

              {/* Hover button for reselection */}
              {isSelectedTextHovered && !isWaitingForReselection && (
                <Button
                  variant="outline"
                  size="sm"
                  className={`absolute top-1 right-1 h-6 w-6 p-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border shadow-md hover:shadow-lg transition-all duration-200`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReselectText();
                  }}
                  title="Reselect this text in editor"
                >
                  <MousePointer2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            {isLoading ? (
            // Loading state
              <Card className="w-[300px] shadow-lg">
                <CardContent className="p-3 flex justify-center items-center h-16">
                  <div className="text-sm">Analyzing your request...</div>
                </CardContent>
              </Card>
            ) : aiResponse ? (
              // AI response state

                <InlineAIResponse
                  response={aiResponse.response}
                  suggestedText={aiResponse.suggestedText}
                  onClose={handleClosePrompt}
                  onInsert={handleInsertText}
                  onBackToMenu={handleBackToContextMenu}
                />
              ) : (
                // Initial prompt state
                <InlineAIPrompt
                  onSubmit={handleSubmitPrompt}
                  onClose={handleClosePrompt}
                onBackToMenu={handleBackToContextMenu}
                title="AI Writing Assistant"
                placeholder="Ask AI to help with your selected text..."
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}