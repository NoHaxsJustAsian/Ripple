import { Mark, mergeAttributes, Range } from "@tiptap/core";
import { Mark as PMMark } from "@tiptap/pm/model";

// Shared interface for mark with range
export interface MarkWithRange {
    mark: PMMark;
    range: Range;
}

// Comment Mode Mark (extending your existing one)
export interface CommentModeOptions {
    HTMLAttributes: Record<string, any>;
    onCommentActivated?: (commentId: string | null) => void;
    onCommentClicked?: (commentId: string) => void;
}

export interface CommentModeStorage {
    activeCommentId: string | null;
}

export const CommentModeMark = Mark.create<CommentModeOptions, CommentModeStorage>({
    name: "commentMode",

    addOptions() {
        return {
            HTMLAttributes: {},
            onCommentActivated: () => { },
            onCommentClicked: () => { },
        };
    },

    addStorage() {
        return {
            activeCommentId: null,
        };
    },

    addAttributes() {
        return {
            commentId: {
                default: null,
                parseHTML: (el) => (el as HTMLSpanElement).getAttribute("data-comment-id") || "",
                renderHTML: (attrs) => ({ "data-comment-id": attrs.commentId }),
            },
            commentType: {
                default: "general",
                parseHTML: (el) => (el as HTMLSpanElement).getAttribute("data-comment-type") || "general",
                renderHTML: (attrs) => ({ "data-comment-type": attrs.commentType }),
            },
            severity: {
                default: "medium",
                parseHTML: (el) => (el as HTMLSpanElement).getAttribute("data-severity") || "medium",
                renderHTML: (attrs) => ({ "data-severity": attrs.severity }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-comment-id]',
                getAttrs: (el) => {
                    const element = el as HTMLElement;
                    return {
                        commentId: element.getAttribute('data-comment-id'),
                        commentType: element.getAttribute('data-comment-type') || 'general',
                        severity: element.getAttribute('data-severity') || 'medium',
                    };
                },
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
            class: 'comment-mode-highlight'
        }), 0];
    },

    addCommands() {
        return {
            setCommentHighlight: (commentId: string, commentType: string = 'general', severity: string = 'medium') =>
                ({ commands }) => {
                    if (!commentId) return false;
                    return commands.setMark(this.name, { commentId, commentType, severity });
                },

            unsetCommentHighlight: (commentId: string) =>
                ({ tr, dispatch }) => {
                    if (!commentId) return false;

                    const marksWithRange: MarkWithRange[] = [];
                    tr.doc.descendants((node, pos) => {
                        const mark = node.marks.find(
                            (mark) => mark.type.name === this.name && mark.attrs.commentId === commentId
                        );
                        if (mark) {
                            marksWithRange.push({
                                mark,
                                range: { from: pos, to: pos + node.nodeSize },
                            });
                        }
                    });

                    marksWithRange.forEach(({ mark, range }) => {
                        tr.removeMark(range.from, range.to, mark);
                    });

                    return dispatch?.(tr);
                },
        };
    },
});

// References Mode Mark
export interface ReferencesModeOptions {
    HTMLAttributes: Record<string, any>;
    onReferenceActivated?: (referenceId: string | null) => void;
    onReferenceClicked?: (referenceId: string) => void;
}

export interface ReferencesModeStorage {
    activeReferenceId: string | null;
}

export const ReferencesModeMark = Mark.create<ReferencesModeOptions, ReferencesModeStorage>({
    name: "referencesMode",

    addOptions() {
        return {
            HTMLAttributes: {},
            onReferenceActivated: () => { },
            onReferenceClicked: () => { },
        };
    },

    addStorage() {
        return {
            activeReferenceId: null,
        };
    },

    addAttributes() {
        return {
            referenceId: {
                default: null,
                parseHTML: (el) => (el as HTMLSpanElement).getAttribute("data-reference-id") || "",
                renderHTML: (attrs) => ({ "data-reference-id": attrs.referenceId }),
            },
            referenceType: {
                default: "citation",
                parseHTML: (el) => (el as HTMLSpanElement).getAttribute("data-reference-type") || "citation",
                renderHTML: (attrs) => ({ "data-reference-type": attrs.referenceType }),
            },
            sourceText: {
                default: "",
                parseHTML: (el) => (el as HTMLSpanElement).getAttribute("data-source-text") || "",
                renderHTML: (attrs) => ({ "data-source-text": attrs.sourceText }),
            },
            targetSentence: {
                default: "",
                parseHTML: (el) => (el as HTMLSpanElement).getAttribute("data-target-sentence") || "",
                renderHTML: (attrs) => ({ "data-target-sentence": attrs.targetSentence }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-reference-id]',
                getAttrs: (el) => {
                    const element = el as HTMLElement;
                    return {
                        referenceId: element.getAttribute('data-reference-id'),
                        referenceType: element.getAttribute('data-reference-type') || 'citation',
                        sourceText: element.getAttribute('data-source-text') || '',
                        targetSentence: element.getAttribute('data-target-sentence') || '',
                    };
                },
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
            class: 'references-mode-highlight'
        }), 0];
    },

    addCommands() {
        return {
            setReferenceHighlight: (referenceId: string, referenceType: string = 'citation', sourceText: string = '', targetSentence: string = '') =>
                ({ commands }) => {
                    if (!referenceId) return false;
                    return commands.setMark(this.name, { referenceId, referenceType, sourceText, targetSentence });
                },

            unsetReferenceHighlight: (referenceId: string) =>
                ({ tr, dispatch }) => {
                    if (!referenceId) return false;

                    const marksWithRange: MarkWithRange[] = [];
                    tr.doc.descendants((node, pos) => {
                        const mark = node.marks.find(
                            (mark) => mark.type.name === this.name && mark.attrs.referenceId === referenceId
                        );
                        if (mark) {
                            marksWithRange.push({
                                mark,
                                range: { from: pos, to: pos + node.nodeSize },
                            });
                        }
                    });

                    marksWithRange.forEach(({ mark, range }) => {
                        tr.removeMark(range.from, range.to, mark);
                    });

                    return dispatch?.(tr);
                },
        };
    },
});

// Flow Mode Mark
export interface FlowModeOptions {
    HTMLAttributes: Record<string, any>;
    onConnectionActivated?: (connectionId: string | null) => void;
    onConnectionClicked?: (connectionId: string) => void;
}

export interface FlowModeStorage {
    activeConnectionId: string | null;
}

export const FlowModeMark = Mark.create<FlowModeOptions, FlowModeStorage>({
    name: "flowMode",

    addOptions() {
        return {
            HTMLAttributes: {},
            onConnectionActivated: () => { },
            onConnectionClicked: () => { },
        };
    },

    addStorage() {
        return {
            activeConnectionId: null,
        };
    },

    addAttributes() {
        return {
            sentenceId: {
                default: null,
                parseHTML: (el) => (el as HTMLSpanElement).getAttribute("data-sentence-id") || "",
                renderHTML: (attrs) => ({ "data-sentence-id": attrs.sentenceId }),
            },
            connectionStrength: {
                default: 0,
                parseHTML: (el) => {
                    const strength = (el as HTMLSpanElement).getAttribute("data-connection-strength");
                    return strength ? parseFloat(strength) : 0;
                },
                renderHTML: (attrs) => ({ "data-connection-strength": String(attrs.connectionStrength) }),
            },
            connectedSentences: {
                default: "[]",
                parseHTML: (el) => (el as HTMLSpanElement).getAttribute("data-connected-sentences") || "[]",
                renderHTML: (attrs) => ({ "data-connected-sentences": attrs.connectedSentences }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-sentence-id]',
                getAttrs: (el) => {
                    const element = el as HTMLElement;
                    return {
                        sentenceId: element.getAttribute('data-sentence-id'),
                        connectionStrength: parseFloat(element.getAttribute('data-connection-strength') || '0'),
                        connectedSentences: element.getAttribute('data-connected-sentences') || '[]',
                    };
                },
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
            class: 'flow-mode-highlight'
        }), 0];
    },

    addCommands() {
        return {
            setSentenceHighlight: (sentenceId: string, connectionStrength: number = 0, connectedSentences: string[] = []) =>
                ({ commands }) => {
                    if (!sentenceId) return false;
                    return commands.setMark(this.name, {
                        sentenceId,
                        connectionStrength,
                        connectedSentences: JSON.stringify(connectedSentences)
                    });
                },

            unsetSentenceHighlight: (sentenceId: string) =>
                ({ tr, dispatch }) => {
                    if (!sentenceId) return false;

                    const marksWithRange: MarkWithRange[] = [];
                    tr.doc.descendants((node, pos) => {
                        const mark = node.marks.find(
                            (mark) => mark.type.name === this.name && mark.attrs.sentenceId === sentenceId
                        );
                        if (mark) {
                            marksWithRange.push({
                                mark,
                                range: { from: pos, to: pos + node.nodeSize },
                            });
                        }
                    });

                    marksWithRange.forEach(({ mark, range }) => {
                        tr.removeMark(range.from, range.to, mark);
                    });

                    return dispatch?.(tr);
                },
        };
    },
});

// Sentence Connection Mode Mark (for flow-sentence mode connections)
export interface SentenceConnectionModeOptions {
    HTMLAttributes: Record<string, any>;
}

export const SentenceConnectionModeMark = Mark.create<SentenceConnectionModeOptions>({
    name: "sentenceConnectionMode",

    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },

    addAttributes() {
        return {
            connectionId: {
                default: null,
                parseHTML: (el) => (el as HTMLSpanElement).getAttribute("data-connection-id") || "",
                renderHTML: (attrs) => ({ "data-connection-id": attrs.connectionId }),
            },
            connectionStrength: {
                default: 0,
                parseHTML: (el) => {
                    const strength = (el as HTMLSpanElement).getAttribute("data-connection-strength");
                    return strength ? parseFloat(strength) : 0;
                },
                renderHTML: (attrs) => ({ "data-connection-strength": String(attrs.connectionStrength) }),
            },
            reason: {
                default: "",
                parseHTML: (el) => (el as HTMLSpanElement).getAttribute("data-connection-reason") || "",
                renderHTML: (attrs) => ({ "data-connection-reason": attrs.reason }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-connection-id]',
                getAttrs: (el) => {
                    const element = el as HTMLElement;
                    return {
                        connectionId: element.getAttribute('data-connection-id'),
                        connectionStrength: parseFloat(element.getAttribute('data-connection-strength') || '0'),
                        reason: element.getAttribute('data-connection-reason') || '',
                    };
                },
            },
        ];
    },

    renderHTML({ HTMLAttributes, mark }) {
        const strength = mark.attrs.connectionStrength;
        let strengthClass = 'sentence-connection-weak';

        if (strength >= 0.7) {
            strengthClass = 'sentence-connection-strong';
        } else if (strength >= 0.4) {
            strengthClass = 'sentence-connection-moderate';
        }

        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
            class: `sentence-connection ${strengthClass}`
        }), 0];
    },

    addCommands() {
        return {
            setSentenceConnectionHighlight: (connectionId: string, connectionStrength: number = 0, reason: string = '') =>
                ({ commands }) => {
                    if (!connectionId) return false;
                    return commands.setMark(this.name, {
                        connectionId,
                        connectionStrength,
                        reason
                    });
                },

            unsetSentenceConnectionHighlight: (connectionId: string) =>
                ({ tr, dispatch }) => {
                    if (!connectionId) return false;

                    const marksWithRange: MarkWithRange[] = [];
                    tr.doc.descendants((node, pos) => {
                        const mark = node.marks.find(
                            (mark) => mark.type.name === this.name && mark.attrs.connectionId === connectionId
                        );
                        if (mark) {
                            marksWithRange.push({
                                mark,
                                range: { from: pos, to: pos + node.nodeSize },
                            });
                        }
                    });

                    marksWithRange.forEach(({ mark, range }) => {
                        tr.removeMark(range.from, range.to, mark);
                    });

                    return dispatch?.(tr);
                },

            clearAllSentenceConnectionHighlights: () =>
                ({ tr, dispatch }) => {
                    const marksWithRange: MarkWithRange[] = [];
                    tr.doc.descendants((node, pos) => {
                        const mark = node.marks.find(
                            (mark) => mark.type.name === this.name
                        );
                        if (mark) {
                            marksWithRange.push({
                                mark,
                                range: { from: pos, to: pos + node.nodeSize },
                            });
                        }
                    });

                    marksWithRange.forEach(({ mark, range }) => {
                        tr.removeMark(range.from, range.to, mark);
                    });

                    return dispatch?.(tr);
                },
        };
    },
});

// Declare module augmentation for commands
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        commentMode: {
            setCommentHighlight: (commentId: string, commentType?: string, severity?: string) => ReturnType;
            unsetCommentHighlight: (commentId: string) => ReturnType;
        };
        referencesMode: {
            setReferenceHighlight: (referenceId: string, referenceType?: string, sourceText?: string, targetSentence?: string) => ReturnType;
            unsetReferenceHighlight: (referenceId: string) => ReturnType;
        };
        flowMode: {
            setSentenceHighlight: (sentenceId: string, connectionStrength?: number, connectedSentences?: string[]) => ReturnType;
            unsetSentenceHighlight: (sentenceId: string) => ReturnType;
        };
        sentenceConnectionMode: {
            setSentenceConnectionHighlight: (connectionId: string, connectionStrength?: number, reason?: string) => ReturnType;
            unsetSentenceConnectionHighlight: (connectionId: string) => ReturnType;
            clearAllSentenceConnectionHighlights: () => ReturnType;
        };
    }
} 