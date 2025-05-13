import { useState, Dispatch, SetStateAction, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { Wand2, Copy, Clipboard, RectangleEllipsis, FileText, MessageSquare } from 'lucide-react';
import { InlineAIPrompt } from './InlineAIPrompt';
import { InlineAIResponse } from './InlineAIResponse';
import { sendCustomPrompt } from '../lib/api';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuLabel,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { Card, CardContent } from '@/components/ui/card';
import { CommentType } from './editor/types';

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
  onAddComment
}: AIContextMenuProps) {
  const [showInlinePrompt, setShowInlinePrompt] = useState(false);
  const [promptPosition, setPromptPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<{
    response: string;
    suggestedText: string
  } | null>(null);

  const handleAIAction = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return; // No selection

    // Store the selected text
    const text = editor.state.doc.textBetween(from, to);
    setSelectedText(text);

    const mouseEvent = window.event as MouseEvent;

    setPromptPosition({
      x: Math.max(20, Math.min(mouseEvent.clientX, window.innerWidth - 420)),
      y: Math.max(20, mouseEvent.clientY - 20)
    });
    setShowInlinePrompt(true);
    setShowContextMenu(false); // Close context menu when showing prompt
    // Reset any previous responses
    setAiResponse(null);
  };

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
  };

  const handleUpdateComment = (commentId: string) => {
    if (!editor) return;

    // Find all marks with this comment ID
    const marks: { from: number; to: number }[] = [];
    editor.state.doc.descendants((node, pos) => {
      const mark = node.marks.find(m => m.type.name === 'comment' && m.attrs.commentId === commentId);
      if (mark) {
        marks.push({ from: pos, to: pos + node.nodeSize });
      }
    });

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

    const handleSelectionChange = () => {
      // Store current selection
      const { from: currentFrom, to: currentTo } = editor.state.selection;

      // Find all marks with this comment ID
      const marks: { from: number; to: number }[] = [];
      editor.state.doc.descendants((node, pos) => {
        const mark = node.marks.find(m => m.type.name === 'comment' && m.attrs.commentId === activeCommentId);
        if (mark) {
          marks.push({ from: pos, to: pos + node.nodeSize });
        }
      });

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
    };

    // Use transaction handler instead of selection update
    const handleTransaction = () => {
      handleSelectionChange();
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
              onSelect={onAddComment}
              className="flex items-center"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              <span>Add Comment</span>
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={handleAIAction}
              className="flex items-center"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              <span>Get Instant AI Feedback</span>
            </ContextMenuItem>
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
          </ContextMenuContent>
        </ContextMenu>
      </div>
      {showInlinePrompt && (
        <div
          style={{
            position: 'fixed',
            left: `${promptPosition.x}px`,
            top: `${promptPosition.y}px`,
            zIndex: 100
          }}
        >
          {isLoading ? (
            // Loading state
            <Card className="w-[400px] shadow-lg">
              <CardContent className="p-3 flex justify-center items-center h-16">
                <div className="text-sm">Processing your request...</div>
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
              onBackToMenu={handleBackToContextMenu} // Add this line
              title="AI Writing Assistant"
              placeholder="Ask AI to help with your selected text..."
            />
          )}
        </div>
      )}
    </>
  );
}