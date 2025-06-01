import { Mark, mergeAttributes, Range } from "@tiptap/core";
import { Mark as PMMark } from "@tiptap/pm/model";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    comment: {
      /**
       * Set a comment (add)
       */
      setComment: (commentId: string) => ReturnType;
      /**
       * Unset a comment (remove)
       */
      unsetComment: (commentId: string) => ReturnType;
    };
  }
}

export interface MarkWithRange {
  mark: PMMark;
  range: Range;
}

export interface CommentOptions {
  HTMLAttributes: Record<string, any>;
  onCommentActivated: (commentId: string | null) => void;
  onCommentClicked?: (commentId: string) => void;
}

export interface CommentStorage {
  activeCommentId: string | null;
}

export const CommentExtension = Mark.create<CommentOptions, CommentStorage>({
  name: "comment",
}).extend({
  inclusive: false,

  addOptions() {
    return {
      HTMLAttributes: {},
      onCommentActivated: () => { },
      onCommentClicked: () => { },
    };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) =>
          (el as HTMLSpanElement).getAttribute("data-comment-id") || "",
        renderHTML: (attrs) => ({ "data-comment-id": attrs.commentId }),
      },
      content: {
        default: "",
        parseHTML: (el) =>
          (el as HTMLSpanElement).getAttribute("data-comment-content") || "",
        renderHTML: (attrs) => ({ "data-comment-content": attrs.content }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-comment-id]",
        getAttrs: (el) => {
          const id = (el as HTMLSpanElement).getAttribute("data-comment-id");
          return id?.trim() ? { commentId: id } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  onSelectionUpdate() {
    const { $from } = this.editor.state.selection;

    const marks = $from.marks();

    if (!marks.length) {
      this.storage.activeCommentId = null;
      this.options.onCommentActivated(this.storage.activeCommentId);
      return;
    }

    const commentMark = this.editor.schema.marks.comment;

    const activeCommentMark = marks.find((mark) => mark.type === commentMark);

    this.storage.activeCommentId = activeCommentMark?.attrs.commentId || null;

    this.options.onCommentActivated(this.storage.activeCommentId);
  },

  addStorage() {
    return {
      activeCommentId: null,
    };
  },

  onCreate() {
    // Add click handler for comment marks
    const handleCommentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      console.log('Comment click detected on:', target);

      // Check if the clicked element or any parent has a comment mark
      let commentElement = target.closest('[data-comment-id]') as HTMLElement | null;

      if (!commentElement) {
        // Also check if the target itself has the attribute
        commentElement = target.hasAttribute('data-comment-id') ? target : null;
      }

      if (commentElement) {
        const commentId = commentElement.getAttribute('data-comment-id');
        console.log('Found comment ID:', commentId);

        if (commentId && this.options.onCommentClicked) {
          event.preventDefault();
          event.stopPropagation();
          console.log('Triggering onCommentClicked for:', commentId);
          this.options.onCommentClicked(commentId);
        }
      } else {
        console.log('No comment element found for click');
      }
    };

    this.editor.view.dom.addEventListener('click', handleCommentClick);

    // Store the handler for cleanup
    (this as any).commentClickHandler = handleCommentClick;
  },

  onDestroy() {
    // Remove click handler
    if ((this as any).commentClickHandler) {
      this.editor.view.dom.removeEventListener('click', (this as any).commentClickHandler);
    }
  },

  addCommands() {
    return {
      setComment:
        (commentId) =>
        ({ commands }) => {
          if (!commentId) return false;

          return commands.setMark("comment", { commentId, content: "" });
        },
      unsetComment:
        (commentId) =>
        ({ tr, dispatch }) => {
          if (!commentId) return false;

          const commentMarksWithRange: MarkWithRange[] = [];

          tr.doc.descendants((node, pos) => {
            const commentMark = node.marks.find(
              (mark) =>
                mark.type.name === "comment" &&
                mark.attrs.commentId === commentId,
            );

            if (!commentMark) return;

            commentMarksWithRange.push({
              mark: commentMark,
              range: {
                from: pos,
                to: pos + node.nodeSize,
              },
            });
          });

          commentMarksWithRange.forEach(({ mark, range }) => {
            tr.removeMark(range.from, range.to, mark);
          });

          return dispatch?.(tr);
        },
    };
  },
}); 