import { Editor } from '@tiptap/react';
import { CommentType } from '../components/AIContextMenu';

export const sortComments = (
    comments: CommentType[],
    sortType: 'default' | 'newest' | 'oldest' | 'smart',
    editor?: Editor
): CommentType[] => {
    const sorted = [...comments];

    if (sortType === 'newest') {
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortType === 'oldest') {
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortType === 'smart') {
        const docText = editor?.state.doc.textContent || '';
        const textPositions = new Map<string, number>();

        comments.forEach(comment => {
            if (comment.quotedText && !textPositions.has(comment.quotedText)) {
                const position = docText.indexOf(comment.quotedText);
                if (position >= 0) textPositions.set(comment.quotedText, position);
            }
        });

        sorted.sort((a, b) => {
            if (a.quotedText === b.quotedText) {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }
            return (textPositions.get(a.quotedText || '') || 0) - (textPositions.get(b.quotedText || '') || 0);
        });
    } else { // default
        const docText = editor?.state.doc.textContent || '';
        const commentPositions = new Map<string, number>();

        comments.forEach(comment => {
            if (comment.quotedText) {
                const position = docText.indexOf(comment.quotedText);
                if (position >= 0) commentPositions.set(comment.id, position);
            }
        });

        sorted.sort((a, b) => {
            return (commentPositions.get(a.id) || 0) - (commentPositions.get(b.id) || 0);
        });
    }

    return sorted;
};