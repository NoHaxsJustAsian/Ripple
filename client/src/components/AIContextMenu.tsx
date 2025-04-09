import { useState, Dispatch, SetStateAction, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { Wand2, Copy, Clipboard, TextSelect, RectangleEllipsis } from 'lucide-react';
import { InlineAIPrompt } from './InlineAIPrompt';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ContextMenuSeparator } from '@radix-ui/react-context-menu';

export interface CommentType {
  id: string;
  content: string;
  createdAt: Date;
  createdAtTime: Date;
  quotedText: string;
}

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
  const [promptPosition] = useState({ x: 0, y: 0 });

  // const handleAIAction = () => {
  //   if (!editor) return;
  //   const { from, to } = editor.state.selection;
  //   if (from === to) return; // No selection

  //   const mouseEvent = window.event as MouseEvent;

  //   setPromptPosition({
  //     x: Math.max(20, Math.min(mouseEvent.clientX, window.innerWidth - 420)),
  //     y: Math.max(20, mouseEvent.clientY - 20)
  //   });
  //   setShowInlinePrompt(true);
  // };

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

  // const handleClickQuotedText = (commentId: string) => {
  //   if (!editor) return;

  //   // Find the mark with this comment ID
  //   let foundPos: { from: number; to: number } | null = null;
  //   editor.state.doc.descendants((node, pos) => {
  //     const mark = node.marks.find(m =>
  //       m.type.name === 'comment' &&
  //       m.attrs.commentId === commentId
  //     );
  //     if (mark) {
  //       foundPos = { from: pos, to: pos + node.nodeSize };
  //       return false; // Stop searching
  //     }
  //   });

  //   if (foundPos) {
  //     // Set selection without scrolling
  //     editor.commands.setTextSelection(foundPos);
  //     // Only scroll if not in view
  //     const selection = window.getSelection();
  //     if (selection && selection.rangeCount > 0) {
  //       const range = selection.getRangeAt(0);
  //       const rect = range.getBoundingClientRect();
  //       if (rect.top < 0 || rect.bottom > window.innerHeight) {
  //         editor.commands.scrollIntoView();
  //       }
  //     }
  //   }
  // };

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
              <TextSelect className="mr-2 h-4 w-4" />
              <span>Add Comment</span>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem 
              onSelect={onSelectAsParagraphTopic}
              className="flex items-center"
            >
              <RectangleEllipsis className="mr-2 h-4 w-4" />
              <span>Select as Paragraph Topic</span>
            </ContextMenuItem>
            <ContextMenuItem 
              onSelect={onSelectAsEssayTopic}
              className="flex items-center"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              <span>Select as Essay Topic</span>
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
          <InlineAIPrompt
            onSubmit={(prompt: string) => {
              console.log('Inline prompt:', prompt);
              setShowInlinePrompt(false);
            }}
            onClose={() => setShowInlinePrompt(false)}
          />
        </div>
      )}
    </>
  );
}