import { Editor } from '@tiptap/react';

export interface DebugStep {
    step: string;
    data: any;
    timestamp: number;
}

export class HighlightingDebugger {
    private logs: DebugStep[] = [];
    private isEnabled: boolean = true;

    enable() {
        this.isEnabled = true;
    }

    disable() {
        this.isEnabled = false;
    }

    clear() {
        this.logs = [];
    }

    log(step: string, data: any) {
        if (!this.isEnabled) return;

        this.logs.push({
            step,
            data: JSON.parse(JSON.stringify(data)), // Deep clone
            timestamp: Date.now()
        });

        console.log(`🔍 [DEBUG] ${step}:`, data);
    }

    getLogs() {
        return this.logs;
    }

    printSummary() {
        console.log('\n📊 HIGHLIGHTING DEBUG SUMMARY:');
        console.log('=====================================');
        this.logs.forEach((log, index) => {
            console.log(`${index + 1}. ${log.step}`);
            console.log(`   Data:`, log.data);
            console.log('');
        });
    }

    /**
     * Debug the entire highlighting process for a single comment
     */
    debugComment(editor: Editor, comment: any, fullDocumentText: string) {
        console.log('\n🐛 DEBUGGING COMMENT HIGHLIGHTING');
        console.log('=======================================');

        this.clear();

        // Step 1: Log the original comment data from backend
        this.log('1. Backend Comment Data', {
            title: comment.title,
            issueType: comment.issueType,
            highlightedText: comment.highlightedText,
            highlightedTextLength: comment.highlightedText?.length,
            suggestedEdit: comment.suggestedEdit ? {
                original: comment.suggestedEdit.original,
                suggested: comment.suggestedEdit.suggested
            } : null
        });

        // Step 2: Analyze the full document
        this.log('2. Document Analysis', {
            fullDocumentLength: fullDocumentText.length,
            fullDocumentPreview: fullDocumentText.substring(0, 200) + '...',
            editorTextContent: editor.state.doc.textContent.substring(0, 200) + '...',
            documentsMatch: fullDocumentText === editor.state.doc.textContent
        });

        // Step 3: Search for the text using current approach
        const textToFind = comment.highlightedText;
        let foundPositions: Array<{ from: number, to: number, nodePos: number, nodeText: string }> = [];

        editor.state.doc.descendants((node, pos) => {
            const nodeText = node.textContent;
            if (nodeText.includes(textToFind)) {
                const startPos = pos + nodeText.indexOf(textToFind);
                const endPos = startPos + textToFind.length;
                foundPositions.push({
                    from: startPos,
                    to: endPos,
                    nodePos: pos,
                    nodeText: nodeText.substring(0, 100) + (nodeText.length > 100 ? '...' : '')
                });
            }
        });

        this.log('3. Text Search Results', {
            searchText: textToFind,
            searchTextLength: textToFind.length,
            foundPositions,
            multipleMatches: foundPositions.length > 1
        });

        // Step 4: Check what text is actually at the found position
        if (foundPositions.length > 0) {
            const position = foundPositions[0]; // Use first match
            const actualText = editor.state.doc.textBetween(position.from, position.to);

            this.log('4. Position Verification', {
                expectedText: textToFind,
                actualTextAtPosition: actualText,
                textsMatch: textToFind === actualText,
                position: position,
                surroundingContext: {
                    before: editor.state.doc.textBetween(Math.max(0, position.from - 50), position.from),
                    after: editor.state.doc.textBetween(position.to, Math.min(editor.state.doc.content.size, position.to + 50))
                }
            });

            // Step 5: Analyze sentence boundaries around the found text
            this.analyzeSentenceBoundaries(editor, position, textToFind);
        } else {
            this.log('4. Position Verification', {
                error: 'No position found for text',
                searchText: textToFind
            });
        }

        this.printSummary();
        return this.getLogs();
    }

    /**
     * Analyze sentence boundaries around a found position
     */
    private analyzeSentenceBoundaries(editor: Editor, position: { from: number, to: number }, searchText: string) {
        const fullText = editor.state.doc.textContent;

        // Find sentence boundaries using simple period detection
        const beforeText = fullText.substring(0, position.from);
        const afterText = fullText.substring(position.to);

        // Find last sentence ending before our text
        const lastPeriodBefore = Math.max(
            beforeText.lastIndexOf('.'),
            beforeText.lastIndexOf('!'),
            beforeText.lastIndexOf('?')
        );

        // Find next sentence ending after our text  
        const periodIndex = afterText.indexOf('.');
        const exclamationIndex = afterText.indexOf('!');
        const questionIndex = afterText.indexOf('?');

        const nextPeriodAfter = Math.min(
            periodIndex !== -1 ? periodIndex + position.to : Infinity,
            exclamationIndex !== -1 ? exclamationIndex + position.to : Infinity,
            questionIndex !== -1 ? questionIndex + position.to : Infinity
        );

        const sentenceStart = lastPeriodBefore === -1 ? 0 : lastPeriodBefore + 1;
        const sentenceEnd = nextPeriodAfter === Infinity ? fullText.length : nextPeriodAfter + 1;

        // Trim whitespace
        let trimmedStart = sentenceStart;
        while (trimmedStart < fullText.length && /\s/.test(fullText[trimmedStart])) {
            trimmedStart++;
        }

        const possibleSentence = fullText.substring(trimmedStart, sentenceEnd).trim();

        this.log('5. Sentence Boundary Analysis', {
            highlightedRange: `${position.from}-${position.to}`,
            highlightedText: searchText,
            estimatedSentenceRange: `${trimmedStart}-${sentenceEnd}`,
            estimatedSentence: possibleSentence,
            highlightedTextIsCompleteSentence: possibleSentence === searchText.trim(),
            sentenceBoundaryIssue: {
                startsInMiddle: position.from > trimmedStart,
                endsInMiddle: position.to < sentenceEnd,
                spansMultipleSentences: searchText.includes('.') || searchText.includes('!') || searchText.includes('?')
            }
        });
    }

    /**
     * Quick debug function to check a specific text highlighting
     */
    quickDebug(editor: Editor, textToFind: string) {
        console.log(`\n🔍 QUICK DEBUG: "${textToFind.substring(0, 50)}..."`);

        // Method 1: Current approach
        let currentMethod = null;
        editor.state.doc.descendants((node, pos) => {
            const nodeText = node.textContent;
            if (nodeText.includes(textToFind)) {
                const startPos = pos + nodeText.indexOf(textToFind);
                const endPos = startPos + textToFind.length;
                currentMethod = { from: startPos, to: endPos };
                return false;
            }
        });

        // Method 2: Simple indexOf on full text
        const fullText = editor.state.doc.textContent;
        const simpleIndex = fullText.indexOf(textToFind);
        const simpleMethod = simpleIndex !== -1 ? {
            from: simpleIndex,
            to: simpleIndex + textToFind.length
        } : null;

        console.log('Current Method:', currentMethod);
        console.log('Simple Method:', simpleMethod);

        if (currentMethod) {
            const actualText = editor.state.doc.textBetween(currentMethod.from, currentMethod.to);
            console.log('Actual text at position:', `"${actualText}"`);
            console.log('Matches expected:', actualText === textToFind);
        }

        return { currentMethod, simpleMethod };
    }
}

// Global debugger instance
export const highlightDebugger = new HighlightingDebugger();

export function debugFlowHoverTextMismatch() {
    console.log('🔍 === FLOW HOVER TEXT MISMATCH DEBUG ===');

    // Find all flow highlights
    const flowHighlights = document.querySelectorAll('.flow-mode-highlight');
    console.log(`Found ${flowHighlights.length} flow highlights`);

    flowHighlights.forEach((highlight, index) => {
        const element = highlight as HTMLElement;
        const textContent = element.textContent || '';
        const connectionStrength = element.getAttribute('data-connection-strength');
        const sentenceId = element.getAttribute('data-sentence-id');

        console.log(`\n--- Flow Highlight ${index + 1} ---`);
        console.log('DOM textContent:', JSON.stringify(textContent));
        console.log('Connection strength:', connectionStrength);
        console.log('Sentence ID:', sentenceId);
        console.log('Character count:', textContent.length);
        console.log('Starts with uppercase:', /^[A-Z]/.test(textContent.trim()));
        console.log('Ends with punctuation:', /[.!?]$/.test(textContent.trim()));

        // Check if this looks like a partial sentence
        const isPartialSentence = !(/^[A-Z]/.test(textContent.trim()) && /[.!?]$/.test(textContent.trim()));
        if (isPartialSentence) {
            console.log('⚠️ POTENTIAL PARTIAL SENTENCE DETECTED');

            // Try to find the parent elements
            const parent = element.parentElement;
            const siblings = parent ? Array.from(parent.children) : [];
            console.log('Parent tag:', parent?.tagName);
            console.log('Sibling count:', siblings.length);

            if (siblings.length > 1) {
                console.log('🔍 Checking siblings for sentence fragments:');
                siblings.forEach((sibling, sibIndex) => {
                    if (sibling !== element) {
                        console.log(`  Sibling ${sibIndex}: "${sibling.textContent?.slice(0, 50)}..."`);
                    }
                });
            }
        }
    });

    // Also check the hover cache
    console.log('\n🗄️ === FLOW HOVER CACHE CONTENTS ===');
    // Access the highlighting manager if available
    const editorContainer = document.querySelector('.editor-container');
    if (editorContainer && (window as any).highlightingManager) {
        const manager = (window as any).highlightingManager;
        console.log('Hover manager cache size:', manager.flowHoverManager?.explanationCache?.size || 'unknown');

        // Try to access cache contents (this might not work due to private fields)
        try {
            const cache = manager.flowHoverManager?.explanationCache;
            if (cache && cache.entries) {
                console.log('Cache entries:');
                for (const [key, value] of cache.entries()) {
                    console.log(`  "${key.slice(0, 50)}..." -> "${value.slice(0, 100)}..."`);
                }
            }
        } catch (error) {
            console.log('Could not access cache contents (private field)');
        }
    }

    console.log('🔍 === END FLOW HOVER DEBUG ===');
}

// Make it available globally for manual testing
(window as any).debugFlowHoverTextMismatch = debugFlowHoverTextMismatch;

export function debugProseMirrorSearch(editor: Editor, textToFind: string) {
    console.log('🔍 === PROSEMIRROR SEARCH DEBUG ===');

    try {
        // Import the utilities dynamically to avoid circular dependencies
        const proseMirrorUtils = require('./prosemirror-text-utils');
        const { findTextWithProseMirrorSearch, findAndExpandSentence, fallbackTextSearch } = proseMirrorUtils;

        console.log('Testing text:', JSON.stringify(textToFind));

        // Test 1: ProseMirror search only
        const proseMirrorResult = findTextWithProseMirrorSearch(editor, textToFind);
        console.log('1. ProseMirror search result:', proseMirrorResult);

        if (proseMirrorResult) {
            const actualText = editor.state.doc.textBetween(proseMirrorResult.from, proseMirrorResult.to);
            console.log('   Actual text at position:', JSON.stringify(actualText));
            console.log('   Matches expected:', actualText === textToFind);
        }

        // Test 2: Full find and expand
        const expandedResult = findAndExpandSentence(editor, textToFind);
        console.log('2. Find and expand result:', expandedResult);

        if (expandedResult) {
            const expandedText = editor.state.doc.textBetween(expandedResult.from, expandedResult.to);
            console.log('   Expanded text:', JSON.stringify(expandedText.substring(0, 100)));
            console.log('   Contains original:', expandedText.includes(textToFind));
        }

        // Test 3: Fallback search
        const fallbackResult = fallbackTextSearch(editor, textToFind);
        console.log('3. Fallback search result:', fallbackResult);

        if (fallbackResult) {
            const fallbackText = editor.state.doc.textBetween(fallbackResult.from, fallbackResult.to);
            console.log('   Fallback text:', JSON.stringify(fallbackText));
            console.log('   Matches expected:', fallbackText === textToFind);
        }

        // Compare all methods
        console.log('4. Method comparison:', {
            proseMirrorFound: !!proseMirrorResult,
            expandedFound: !!expandedResult,
            fallbackFound: !!fallbackResult,
            allMatch: !!(proseMirrorResult && expandedResult && fallbackResult)
        });

    } catch (error) {
        console.error('❌ Debug error:', error);
    }

    console.log('🔍 === END PROSEMIRROR SEARCH DEBUG ===');
}

// Make it available globally
(window as any).debugProseMirrorSearch = debugProseMirrorSearch; 