/**
 * ProseMirror-based text utilities for robust text finding and sentence expansion
 * Solves cross-node text search and positioning issues
 */

import { SearchQuery } from 'prosemirror-search';
import type { Node } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/react';

export interface TextPosition {
    from: number;
    to: number;
}

/**
 * Find text in document using ProseMirror's robust search
 * Handles cross-node text and complex document structures
 */
export function findTextWithProseMirrorSearch(editor: Editor, textToFind: string): TextPosition | null {
    try {
        const query = new SearchQuery({
            search: textToFind,
            caseSensitive: true,
            literal: true // Don't interpret special characters
        });

        const result = query.findNext(editor.state, 0);

        if (result) {
            console.log('🔍 ProseMirror search found text:', {
                searchText: textToFind.substring(0, 50),
                foundAt: { from: result.from, to: result.to },
                actualText: editor.state.doc.textBetween(result.from, result.to).substring(0, 50)
            });

            return { from: result.from, to: result.to };
        }

        console.warn('🔍 ProseMirror search: text not found:', textToFind.substring(0, 50));
        return null;
    } catch (error) {
        console.error('🔍 ProseMirror search error:', error);
        return null;
    }
}

/**
 * Expand text position to complete sentence boundaries using ProseMirror's ResolvedPos
 * Handles cross-node sentence expansion properly
 */
export function expandToSentenceBoundaries(doc: Node, from: number, to: number): TextPosition {
    try {
        const $start = doc.resolve(from);
        const $end = doc.resolve(to);

        // Expand backwards to sentence start
        let sentenceStart = from;
        let currentPos = from;

        while (currentPos > 0) {
            const beforePos = currentPos - 1;

            // Get some context around this position to check for sentence boundaries
            const contextStart = Math.max(0, beforePos - 2);
            const contextEnd = Math.min(doc.content.size, beforePos + 2);
            const context = doc.textBetween(contextStart, contextEnd);

            // Check if we hit a sentence boundary (period, exclamation, question mark followed by space/newline)
            const relativePos = beforePos - contextStart;
            if (relativePos >= 0 && relativePos < context.length) {
                const char = context[relativePos];
                const nextChar = relativePos + 1 < context.length ? context[relativePos + 1] : '';

                if (/[.!?]/.test(char) && /[\s\n]/.test(nextChar)) {
                    // Found sentence boundary, stop here
                    break;
                }

                // Check for paragraph breaks (double newlines)
                if (char === '\n' && relativePos > 0 && context[relativePos - 1] === '\n') {
                    break;
                }
            }

            sentenceStart = beforePos;
            currentPos = beforePos;
        }

        // Expand forwards to sentence end
        let sentenceEnd = to;
        currentPos = to;

        while (currentPos < doc.content.size) {
            // Get some context around this position
            const contextStart = Math.max(0, currentPos - 1);
            const contextEnd = Math.min(doc.content.size, currentPos + 3);
            const context = doc.textBetween(contextStart, contextEnd);

            const relativePos = currentPos - contextStart;
            if (relativePos >= 0 && relativePos < context.length) {
                const char = context[relativePos];

                // Check for sentence ending punctuation
                if (/[.!?]/.test(char)) {
                    sentenceEnd = currentPos + 1;
                    break;
                }

                // Check for paragraph breaks
                if (char === '\n' && relativePos + 1 < context.length && context[relativePos + 1] === '\n') {
                    sentenceEnd = currentPos;
                    break;
                }
            }

            currentPos++;
        }

        // Ensure we don't go beyond document bounds
        sentenceStart = Math.max(0, sentenceStart);
        sentenceEnd = Math.min(doc.content.size, sentenceEnd);

        // Trim whitespace from the beginning
        while (sentenceStart < sentenceEnd) {
            const char = doc.textBetween(sentenceStart, sentenceStart + 1);
            if (!/\s/.test(char)) break;
            sentenceStart++;
        }

        const expandedText = doc.textBetween(sentenceStart, sentenceEnd);
        console.log('📏 Sentence boundary expansion:', {
            original: { from, to },
            expanded: { from: sentenceStart, to: sentenceEnd },
            originalText: doc.textBetween(from, to).substring(0, 50),
            expandedText: expandedText.substring(0, 50),
            expansionStats: {
                expandedBackward: from - sentenceStart,
                expandedForward: sentenceEnd - to,
                finalLength: expandedText.length
            }
        });

        return { from: sentenceStart, to: sentenceEnd };
    } catch (error) {
        console.error('📏 Sentence expansion error:', error);
        // Fallback to original position if expansion fails
        return { from, to };
    }
}

/**
 * Find text and expand to sentence boundaries in one call
 * This is the main function to use for flow highlighting
 */
export function findAndExpandSentence(editor: Editor, textToFind: string): TextPosition | null {
    // Step 1: Find text using ProseMirror search
    const textPosition = findTextWithProseMirrorSearch(editor, textToFind);

    if (!textPosition) {
        return null;
    }

    // Step 2: Expand to sentence boundaries
    const expandedPosition = expandToSentenceBoundaries(
        editor.state.doc,
        textPosition.from,
        textPosition.to
    );

    console.log('🎯 Complete find and expand result:', {
        searchText: textToFind.substring(0, 50),
        foundPosition: textPosition,
        expandedPosition,
        finalText: editor.state.doc.textBetween(expandedPosition.from, expandedPosition.to).substring(0, 100)
    });

    return expandedPosition;
}

/**
 * Fallback text finding using the original approach
 * Used as backup if ProseMirror search fails
 */
export function fallbackTextSearch(editor: Editor, textToFind: string): TextPosition | null {
    let foundPosition: TextPosition | null = null;

    editor.state.doc.descendants((node, pos) => {
        const nodeText = node.textContent;
        if (nodeText.includes(textToFind)) {
            const startPos = pos + nodeText.indexOf(textToFind);
            const endPos = startPos + textToFind.length;
            foundPosition = { from: startPos, to: endPos };
            return false; // Stop traversal
        }
    });

    if (foundPosition) {
        console.log('🔄 Fallback search found text:', {
            searchText: textToFind.substring(0, 50),
            position: foundPosition
        });
    }

    return foundPosition;
}

/**
 * Robust text finding with ProseMirror search and fallback
 * This combines both approaches for maximum reliability
 */
export function robustTextFind(editor: Editor, textToFind: string): TextPosition | null {
    // Try ProseMirror search first
    let position = findTextWithProseMirrorSearch(editor, textToFind);

    // Fallback to original approach if needed
    if (!position) {
        console.log('🔄 ProseMirror search failed, trying fallback approach...');
        position = fallbackTextSearch(editor, textToFind);
    }

    return position;
} 