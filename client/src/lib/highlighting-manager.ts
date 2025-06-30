import { Editor } from '@tiptap/react';
import { CommentType } from '@/components/editor/types';
import { explainConnection, analyzeSentenceFlow } from './api';

export type HighlightingMode = 'comments' | 'flow' | 'flow-sentence' | 'write';

export interface HighlightingState {
    currentMode: HighlightingMode;
    commentHighlights: Map<string, CommentHighlightData>;
    referenceHighlights: Map<string, ReferenceHighlightData>;
    flowHighlights: Map<string, FlowHighlightData>;
}

export interface CommentHighlightData {
    commentId: string;
    commentType: string;
    severity: string;
    position: { from: number; to: number };
    content: string;
}

export interface ReferenceHighlightData {
    referenceId: string;
    referenceType: string;
    sourceText: string;
    targetSentence: string;
    position: { from: number; to: number };
    content: string;
}

export interface FlowHighlightData {
    sentenceId: string;
    connectionStrength: number;
    connectedSentences: string[];
    position: { from: number; to: number };
    content: string;
}

// interface FlowModeMark {
//     id: string;
//     sentenceId: string;
//     connectionStrength: number;
//     connectedSentences: string[];
//     position: { from: number; to: number };
// }

/**
 * Manages hover explanations for flow mode highlights
 */
class FlowHoverManager {
    private explanationCache = new Map<string, string>();
    private loadingStates = new Set<string>();
    private documentContext: string = '';
    private paragraphTopics: { [paragraphId: string]: string } = {};
    private essayTopic: string = '';

    setDocumentContext(context: string) {
        this.documentContext = context;
        // Clear cache when document changes
        this.explanationCache.clear();
    }

    setTopics(paragraphTopics: { [paragraphId: string]: string }, essayTopic: string) {
        this.paragraphTopics = paragraphTopics;
        this.essayTopic = essayTopic;
        // Clear cache when topics change
        this.explanationCache.clear();
    }

    async handleHover(sentenceText: string, connectionStrength: number): Promise<string | null> {
        // Check cache first
        if (this.explanationCache.has(sentenceText)) {
            return this.explanationCache.get(sentenceText) || null;
        }

        // Check if already loading
        if (this.loadingStates.has(sentenceText)) {
            return null; // Will show loading state
        }

        // Mark as loading and fetch explanation
        this.loadingStates.add(sentenceText);

        try {
            // Find paragraph topic for this sentence
            const paragraphTopic = this.findParagraphTopicForSentence(sentenceText);

            const response = await explainConnection({
                sentence: sentenceText,
                documentContext: this.documentContext,
                connectionStrength: connectionStrength,
                paragraphTopic: paragraphTopic,
                essayTopic: this.essayTopic || undefined
            });

            const explanation = response.explanation;

            // Cache the result
            this.explanationCache.set(sentenceText, explanation);

            return explanation;
        } catch (error) {
            console.error('Failed to get hover explanation:', error);

            // Fallback explanation based on strength
            let fallbackExplanation: string;
            if (connectionStrength >= 0.8) {
                fallbackExplanation = "Strong thematic and vocabulary connections";
            } else if (connectionStrength >= 0.4) {
                fallbackExplanation = "Moderate lexical overlap with main themes";
            } else {
                fallbackExplanation = "Limited connections to main document themes";
            }

            this.explanationCache.set(sentenceText, fallbackExplanation);
            return fallbackExplanation;
        } finally {
            this.loadingStates.delete(sentenceText);
        }
    }

    private findParagraphTopicForSentence(sentenceText: string): string | undefined {
        // Find which paragraph contains the sentence
        const documentText = this.documentContext; // Get current document text
        const paragraphs: string[] = documentText.split(/\n\s*\n/).filter((p: string) => p.trim());

        for (let i = 0; i < paragraphs.length; i++) {
            const paragraph = paragraphs[i];
            if (paragraph.includes(sentenceText)) {
                const paragraphId = `paragraph-${i}`;
                const topic = this.paragraphTopics[paragraphId];
                if (topic) {
                    console.log(`📍 Found paragraph topic for sentence: "${topic}"`);
                    return topic;
                }
                break; // Stop searching once we find the paragraph
            }
        }

        console.log('📍 No paragraph topic found for this sentence');
        return undefined;
    }

    isLoading(sentenceText: string): boolean {
        return this.loadingStates.has(sentenceText);
    }

    clearCache() {
        this.explanationCache.clear();
        this.loadingStates.clear();
    }
}

export class HighlightingManager {
    private editor: Editor;
    private state: HighlightingState;
    private onModeChange?: (mode: HighlightingMode) => void;
    private flowHoverManager: FlowHoverManager;
    private selectedFlowSentenceId: string | null = null;
    private sentenceConnectionHighlights: Map<string, any> = new Map();
    private isAnalyzing: boolean = false;
    private lastAnalyzedSentence: string | null = null;
    private lastAnalyzedSentenceContext: {
        originalText: string;
        documentSnapshot: string;
        paragraphIndex: number;
        sentenceIndexInParagraph: number;
        timestamp: number;
        semanticKeywords: string[];
    } | null = null;

    // Add sentence tracking for flow analysis (similar to CommentItem)
    private selectedSentenceTracker: {
        originalText: string;
        selectedSentenceId: string | null;
        position: { from: number; to: number } | null;
    } | null = null;

    // Store paragraph topics for enhanced cohesion analysis
    private paragraphTopics: { [paragraphId: string]: string } = {};

    private sentenceFlowPopoverState: {
        isVisible: boolean;
        position: { x: number; y: number };
        sentenceData: {
            text: string;
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
        } | null;
    } = {
            isVisible: false,
            position: { x: 0, y: 0 },
            sentenceData: null
        };

    private sentenceFlowActionPanelState: {
        isVisible: boolean;
        sentenceData: {
            text: string;
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
        } | null;
    } = {
            isVisible: false,
            sentenceData: null
        };
    private popoverTimeout: NodeJS.Timeout | null = null;
    private popoverHideTimeout: NodeJS.Timeout | null = null;

    constructor(editor: Editor, onModeChange?: (mode: HighlightingMode) => void) {
        this.editor = editor;
        this.onModeChange = onModeChange;
        this.state = {
            currentMode: 'comments',
            commentHighlights: new Map(),
            referenceHighlights: new Map(),
            flowHighlights: new Map(),
        };
        this.flowHoverManager = new FlowHoverManager();

        // Set up popover event listeners
        this.setupPopoverEventListeners();
    }

    // Mode Management
    switchMode(mode: HighlightingMode): void {
        const previousMode = this.state.currentMode;
        this.state.currentMode = mode;

        // Update DOM attribute for CSS switching
        const editorDom = this.editor.view.dom.closest('.editor-container') as HTMLElement;
        if (editorDom) {
            editorDom.setAttribute('data-highlighting-mode', mode);
        }

        this.onModeChange?.(mode);
    }

    getCurrentMode(): HighlightingMode {
        return this.state.currentMode;
    }

    // Method to exit flow-sentence mode and return to flow mode
    exitFlowSentenceMode(): void {

        if (this.state.currentMode === 'flow-sentence') {

            // Clear the selected sentence
            this.selectedFlowSentenceId = null;

            // Hide popover and action panel
            this.hideSentenceFlowPopover();
            this.hideSentenceFlowActionPanel();

            // Remove selected class from any selected sentences
            const selectedElements = this.editor.view.dom.querySelectorAll('.flow-sentence-selected');
            selectedElements.forEach(el => {
                el.classList.remove('flow-sentence-selected');
            });

            // Clear all sentence connection highlights
            this.clearSentenceConnectionHighlights();

            // Switch back to flow mode
            this.switchMode('flow');
        }
    }

    // Sentence Flow Popover Methods
    showSentenceFlowPopover(position: { x: number; y: number }, sentenceData: {
        text: string;
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
    }): void {

        // Clear any existing timeout
        if (this.popoverTimeout) {
            clearTimeout(this.popoverTimeout);
            this.popoverTimeout = null;
        }

        this.sentenceFlowPopoverState = {
            isVisible: true,
            position,
            sentenceData
        };

        // Trigger re-render if there's a callback
        if (this.onModeChange) {
            this.onModeChange(this.state.currentMode);
        }
    }

    hideSentenceFlowPopover(): void {
        // Clear any existing timeouts
        if (this.popoverTimeout) {
            clearTimeout(this.popoverTimeout);
            this.popoverTimeout = null;
        }
        if (this.popoverHideTimeout) {
            clearTimeout(this.popoverHideTimeout);
            this.popoverHideTimeout = null;
        }

        this.sentenceFlowPopoverState = {
            isVisible: false,
            position: { x: 0, y: 0 },
            sentenceData: null
        };

        if (this.onModeChange) {
            this.onModeChange(this.state.currentMode);
        }
    }

    getSentenceFlowPopoverState() {
        return this.sentenceFlowPopoverState;
    }

    // Sentence Flow Action Panel Methods
    showSentenceFlowActionPanel(sentenceData: {
        text: string;
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
    }): void {
        this.sentenceFlowActionPanelState = {
            isVisible: true,
            sentenceData
        };

        // Trigger re-render if there's a callback
        if (this.onModeChange) {
            this.onModeChange(this.state.currentMode);
        }
    }

    hideSentenceFlowActionPanel(): void {
        this.sentenceFlowActionPanelState = {
            isVisible: false,
            sentenceData: null
        };

        // Trigger re-render if there's a callback
        if (this.onModeChange) {
            this.onModeChange(this.state.currentMode);
        }
    }

    getSentenceFlowActionPanelState() {
        return this.sentenceFlowActionPanelState;
    }

    // Comment Mode Methods
    addCommentHighlights(comments: CommentType[]): void {
        // Clear existing comment highlights
        this.clearCommentHighlights();

        comments.forEach(comment => {
            if (comment.from !== undefined && comment.to !== undefined) {
                const commentType = comment.issueType || 'general';
                const severity = this.determineSeverity(comment);

                // Apply the mark to the editor
                this.editor.commands.setTextSelection({ from: comment.from, to: comment.to });
                this.editor.commands.setCommentHighlight(comment.id, commentType, severity);

                // Store highlight data
                this.state.commentHighlights.set(comment.id, {
                    commentId: comment.id,
                    commentType,
                    severity,
                    position: { from: comment.from, to: comment.to },
                    content: comment.content,
                });
            }
        });
    }

    clearCommentHighlights(): void {
        this.state.commentHighlights.forEach((_, commentId) => {
            this.editor.commands.unsetCommentHighlight(commentId);
        });
        this.state.commentHighlights.clear();
    }

    // References Mode Methods
    addReferenceHighlights(references: Array<{
        id: string;
        type: string;
        sourceText: string;
        targetSentence: string;
        position: { from: number; to: number };
    }>): void {
        // Clear existing reference highlights
        this.clearReferenceHighlights();

        references.forEach(ref => {
            // Apply the mark to the editor
            this.editor.commands.setTextSelection(ref.position);
            this.editor.commands.setReferenceHighlight(ref.id, ref.type, ref.sourceText, ref.targetSentence);

            // Store highlight data
            this.state.referenceHighlights.set(ref.id, {
                referenceId: ref.id,
                referenceType: ref.type,
                sourceText: ref.sourceText,
                targetSentence: ref.targetSentence,
                position: ref.position,
                content: this.editor.state.doc.textBetween(ref.position.from, ref.position.to),
            });
        });
    }

    clearReferenceHighlights(): void {
        this.state.referenceHighlights.forEach((_, referenceId) => {
            this.editor.commands.unsetReferenceHighlight(referenceId);
        });
        this.state.referenceHighlights.clear();
    }

    // Flow Mode Methods
    addFlowHighlights(sentences: Array<{
        id: string;
        connectionStrength: number;
        connectedSentences: string[];
        position: { from: number; to: number };
    }>): void {
        // Clear existing flow highlights
        this.clearFlowHighlights();

        sentences.forEach(sentence => {
            // Apply the mark to the editor
            this.editor.commands.setTextSelection(sentence.position);
            this.editor.commands.setSentenceHighlight(
                sentence.id,
                sentence.connectionStrength,
                sentence.connectedSentences
            );

            // Store highlight data
            this.state.flowHighlights.set(sentence.id, {
                sentenceId: sentence.id,
                connectionStrength: sentence.connectionStrength,
                connectedSentences: sentence.connectedSentences,
                position: sentence.position,
                content: this.editor.state.doc.textBetween(sentence.position.from, sentence.position.to),
            });
        });
    }

    clearFlowHighlights(): void {
        this.state.flowHighlights.forEach((_, sentenceId) => {
            this.editor.commands.unsetSentenceHighlight(sentenceId);
        });
        this.state.flowHighlights.clear();
    }

    // Flow Hover Methods
    setDocumentContext(context: string): void {
        this.flowHoverManager.setDocumentContext(context);
    }

    updateTopicsForHover(paragraphTopics: { [paragraphId: string]: string }, essayTopic: string): void {
        this.flowHoverManager.setTopics(paragraphTopics, essayTopic);
    }

    async handleFlowHover(sentenceText: string, connectionStrength: number): Promise<string | null> {
        return await this.flowHoverManager.handleHover(sentenceText, connectionStrength);
    }

    isFlowHoverLoading(sentenceText: string): boolean {
        return this.flowHoverManager.isLoading(sentenceText);
    }

    clearFlowHoverCache(): void {
        this.flowHoverManager.clearCache();
    }

    // Set up DOM event listeners for flow hover functionality
    setupFlowHoverListeners(): void {
        // Remove any existing listeners first
        this.cleanupFlowHoverListeners();

        // Add event listeners to the editor DOM
        const editorElement = this.editor.view.dom;

        editorElement.addEventListener('mouseenter', this.handleFlowMouseEnter.bind(this), true);
        editorElement.addEventListener('mouseleave', this.handleFlowMouseLeave.bind(this), true);
        editorElement.addEventListener('click', this.handleFlowClick.bind(this), true);

        // Add keyboard event listener for escaping flow-sentence mode
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    cleanupFlowHoverListeners(): void {
        const editorElement = this.editor.view.dom;
        editorElement.removeEventListener('mouseenter', this.handleFlowMouseEnter.bind(this), true);
        editorElement.removeEventListener('mouseleave', this.handleFlowMouseLeave.bind(this), true);
        editorElement.removeEventListener('click', this.handleFlowClick.bind(this), true);
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    }

    // Set up event listeners for popover mouse interactions
    setupPopoverEventListeners(): void {
        document.addEventListener('popover-mouse-enter', this.handlePopoverMouseEnter.bind(this));
        document.addEventListener('popover-mouse-leave', this.handlePopoverMouseLeave.bind(this));
    }

    private handlePopoverMouseEnter(): void {
        console.log('🎯 Popover mouse enter - canceling hide timeout');

        // Cancel any pending hide timeout when hovering over popover
        if (this.popoverHideTimeout) {
            clearTimeout(this.popoverHideTimeout);
            this.popoverHideTimeout = null;
        }
    }

    private handlePopoverMouseLeave(): void {
        // Schedule hide when leaving popover (with longer delay)
        this.popoverHideTimeout = setTimeout(() => {
            this.hideSentenceFlowPopover();
        }, 500); // Longer delay to allow user to move back to sentence
    }

    private handleKeyDown(event: KeyboardEvent): void {
        // Exit flow-sentence mode when Escape is pressed
        if (event.key === 'Escape' && this.state.currentMode === 'flow-sentence') {
            console.log('⌨️ Escape pressed, exiting flow-sentence mode');
            event.preventDefault();
            this.exitFlowSentenceMode();
        }
    }

    private async handleFlowMouseEnter(event: Event): Promise<void> {
        const target = event.target as HTMLElement;


        // Flow-sentence mode: Handle hover on selected sentence to show popover
        if (target.classList.contains('flow-sentence-selected') && this.state.currentMode === 'flow-sentence') {
            // Get the sentence ID to find the complete stored text
            const sentenceId = target.getAttribute('data-sentence-id') || '';
            const connectionStrength = parseFloat(target.getAttribute('data-connection-strength') || '0');
            const connectedSentencesStr = target.getAttribute('data-connected-sentences') || '[]';

            // Use stored complete sentence text instead of partial DOM text
            let sentenceText = target.textContent || '';
            const storedHighlight = this.state.flowHighlights.get(sentenceId);
            if (storedHighlight) {
                sentenceText = storedHighlight.content;
                console.log('🔍 Using stored complete sentence for popover:', sentenceText.substring(0, 50));
            } else {
                console.warn('⚠️ No stored highlight found for popover, using DOM text:', sentenceText.substring(0, 50));
            }

            let connectedSentences: string[] = [];
            try {
                connectedSentences = JSON.parse(connectedSentencesStr);
            } catch (error) {
                console.warn('Failed to parse connected sentences:', error);
            }

            // Get mouse position for popover
            const mouseEvent = event as MouseEvent;
            const rect = target.getBoundingClientRect();

            // Position popover right below the sentence
            const position = {
                x: Math.min(mouseEvent.clientX + 10, window.innerWidth - 320),
                y: Math.min(rect.bottom + 5, window.innerHeight - 180) // 5px below the sentence
            };

            // Show popover with delay to prevent flickering
            this.popoverTimeout = setTimeout(() => {
                this.showSentenceFlowPopover(position, {
                    text: sentenceText,
                    connectionStrength,
                    connectedSentences
                });
            }, 500); // 500ms delay
        }
        // Regular flow mode hover handling (only in flow mode, not flow-sentence mode)
        else if (target.classList.contains('flow-mode-highlight') && this.state.currentMode === 'flow') {
            // Get the sentence ID to find the complete stored text
            const sentenceId = target.getAttribute('data-sentence-id') || '';
            const connectionStrength = parseFloat(target.getAttribute('data-connection-strength') || '0');

            // Use stored complete sentence text instead of partial DOM text
            let sentenceText = target.textContent || '';
            const storedHighlight = this.state.flowHighlights.get(sentenceId);
            if (storedHighlight) {
                sentenceText = storedHighlight.content;
                console.log('🔍 Using stored complete sentence for hover:', sentenceText.substring(0, 50));
            } else {
                console.warn('⚠️ No stored highlight found, using DOM text:', sentenceText.substring(0, 50));
            }

            try {
                // Fetch explanation asynchronously using complete sentence text
                const explanation = await this.flowHoverManager.handleHover(sentenceText, connectionStrength);

                // Set explanation if available
                if (explanation) {
                    target.setAttribute('data-explanation', explanation);
                    console.log('✅ Explanation loaded:', explanation);
                } else {
                    console.log('❌ No explanation returned');
                }
            } catch (error) {
                console.error('Failed to load hover explanation:', error);
            }
        }
    }

    private handleFlowMouseLeave(event: Event): void {
        const target = event.target as HTMLElement;

        // Hide popover when leaving flow-sentence-selected element
        if (target.classList.contains('flow-sentence-selected') && this.state.currentMode === 'flow-sentence') {
            console.log('🎯 Flow-sentence-selected mouse leave detected, scheduling popover hide');

            // Clear show timeout if it exists
            if (this.popoverTimeout) {
                clearTimeout(this.popoverTimeout);
                this.popoverTimeout = null;
            }

            // Schedule hide with a delay to allow moving to the popover
            this.popoverHideTimeout = setTimeout(() => {
                this.hideSentenceFlowPopover();
            }, 300);
        }

        // Keep the explanation cached for future hovers (no cleanup needed for regular flow mode)
    }

    private async handleFlowClick(event: Event): Promise<void> {
        const target = event.target as HTMLElement;

        console.log('🔍 Click detected on element:', {
            tagName: target.tagName,
            classList: Array.from(target.classList),
            attributes: {
                'data-sentence-id': target.getAttribute('data-sentence-id'),
                'data-connection-strength': target.getAttribute('data-connection-strength'),
            },
            currentMode: this.state.currentMode,
            textContent: target.textContent?.substring(0, 50)
        });

        // Check if this is a flow mode highlight and we're currently in flow mode
        if (target.classList.contains('flow-mode-highlight') && this.state.currentMode === 'flow') {
            console.log('🎯 Flow sentence clicked, entering flow-sentence mode');
            event.preventDefault();
            event.stopPropagation();

            // Get the clicked sentence text using stored content
            let sentenceText = target.textContent || '';
            let selectedSentenceId = target.getAttribute('data-sentence-id') || '';
            const storedHighlight = this.state.flowHighlights.get(selectedSentenceId);
            if (storedHighlight) {
                sentenceText = storedHighlight.content;
                console.log('🔍 Using stored complete sentence for analysis:', sentenceText.substring(0, 50));
            } else {
                console.warn('⚠️ No stored highlight found for analysis, using DOM text:', sentenceText.substring(0, 50));
            }

            // Get the full document context
            const documentText = this.editor.getText();

            console.log('📝 Sentence ID found:', selectedSentenceId);

            // If no sentence ID, try to find it from flow highlights or generate a unique one
            if (!selectedSentenceId) {
                // Try to find the sentence in our stored flow highlights
                for (const [id, highlight] of this.state.flowHighlights) {
                    if (highlight.content === sentenceText) {
                        selectedSentenceId = id;
                        console.log('📝 Found sentence ID from stored highlights:', selectedSentenceId);
                        break;
                    }
                }

                // If still no ID, generate one
                if (!selectedSentenceId) {
                    selectedSentenceId = `selected-${Date.now()}`;
                    console.log('📝 Generated new sentence ID:', selectedSentenceId);
                }
            }

            this.selectedFlowSentenceId = selectedSentenceId;

            // Remove selected class from any previously selected sentences
            const previousSelected = this.editor.view.dom.querySelector('.flow-sentence-selected');
            if (previousSelected) {
                previousSelected.classList.remove('flow-sentence-selected');
                console.log('🗑️ Removed previous selection');
            }

            // Add selected class to clicked sentence
            target.classList.add('flow-sentence-selected');
            console.log('✅ Added flow-sentence-selected class to element');
            console.log('🎨 Element classes after adding:', Array.from(target.classList));

            // Switch to flow-sentence mode
            this.switchMode('flow-sentence');

            // Set analyzing state to true and show loading cursor
            this.setAnalyzing(true);

            // Store the analyzed sentence for redo functionality
            this.lastAnalyzedSentence = sentenceText;
            // Store enhanced context for robust sentence tracking
            this.lastAnalyzedSentenceContext = this.captureSentenceContext(sentenceText, documentText);

            // Initialize sentence tracker for this selected sentence
            this.selectedSentenceTracker = this.initializeSentenceTracker(sentenceText, selectedSentenceId);

            // Make API call for sentence flow analysis
            try {
                console.log('📡 Making sentence flow analysis API call...');
                console.log('📡 API call parameters:', {
                    sentence: sentenceText.substring(0, 100),
                    documentLength: documentText.length,
                    prompt: 'Analyze this sentence in the context of the document'
                });

                // Find paragraph topic for this sentence
                const paragraphTopic = this.findParagraphTopicForSentence(sentenceText, documentText);

                const result = await analyzeSentenceFlow({
                    sentence: sentenceText,
                    document: documentText,
                    prompt: 'Analyze this sentence in the context of the document',
                    paragraphTopic: paragraphTopic // Include paragraph topic if available
                });

                console.log('🎉 API call successful! Full result:', result);
                console.log('🎉 Result.result type:', typeof result.result);
                console.log('🎉 Result.result length:', result.result?.length);
                console.log('🎉 Result.result content:', result.result);

                // Process the connection data and apply highlights
                if (result.result && Array.isArray(result.result) && result.result.length > 0) {
                    console.log('🔗 About to apply connection highlights...');
                    console.log('🔗 Connection data:', result.result);
                    // Add missing reason property to each connection
                    const connectionsWithReason = result.result.map(conn => ({
                        ...conn,
                        reason: `Connection strength: ${conn.connectionStrength.toFixed(2)}`
                    }));
                    this.addSentenceConnectionHighlights(connectionsWithReason);

                    // Show the persistent action panel after successful analysis
                    this.showSentenceFlowActionPanel({
                        text: sentenceText,
                        connectionStrength: result.result.length > 0 ? result.result[0].connectionStrength : 0,
                        connectedSentences: result.result.map(r => r.text),
                        paragraphCohesion: result.paragraphCohesion,
                        documentCohesion: result.documentCohesion
                    });
                } else {
                    console.log('ℹ️ No connections found or invalid result format');
                    console.log('ℹ️ Result structure:', {
                        hasResult: !!result.result,
                        isArray: Array.isArray(result.result),
                        length: result.result?.length,
                        type: typeof result.result
                    });

                    // Show action panel even if no connections found
                    this.showSentenceFlowActionPanel({
                        text: sentenceText,
                        connectionStrength: 0,
                        connectedSentences: [],
                        paragraphCohesion: result.paragraphCohesion,
                        documentCohesion: result.documentCohesion
                    });
                }
            } catch (error) {
                console.error('❌ API call failed:', error);
                if (error instanceof Error) {
                    console.error('❌ Error details:', error.message, error.stack);
                }
            } finally {
                // Set analyzing state back to false and remove loading cursor
                this.setAnalyzing(false);
            }
        }
        // Add handler for clicking when already in flow-sentence mode
        else if (this.state.currentMode === 'flow-sentence') {
            console.log('🔙 Already in flow-sentence mode, ignoring click (panel stays persistent)');
            // Don't exit flow-sentence mode on regular clicks - only via the X button
        }
        else {
            console.log('❌ Click conditions not met:', {
                hasFlowClass: target.classList.contains('flow-mode-highlight'),
                isFlowMode: this.state.currentMode === 'flow',
                currentMode: this.state.currentMode
            });
        }
    }

    // Sentence Connection Methods
    addSentenceConnectionHighlights(connections: Array<{
        text: string;
        position: { from: number; to: number };
        connectionStrength: number;
        reason: string;
    }>): void {
        console.log('🔗 Adding sentence connection highlights:', connections.length);
        console.log('🔗 Current mode:', this.state.currentMode);
        console.log('🔗 Editor container mode:', this.editor.view.dom.closest('.editor-container')?.getAttribute('data-highlighting-mode'));

        // Check if the command exists
        console.log('🔗 Available commands:', Object.keys(this.editor.commands));
        console.log('🔗 setSentenceConnectionHighlight available:', typeof this.editor.commands.setSentenceConnectionHighlight);

        // Clear existing connection highlights
        this.clearSentenceConnectionHighlights();

        connections.forEach((connection, index) => {
            const connectionId = `connection-${Date.now()}-${index}`;

            console.log(`🔗 Processing connection ${index + 1}:`, {
                text: connection.text.substring(0, 50) + '...',
                position: connection.position,
                connectionStrength: connection.connectionStrength,
                connectionId
            });

            // Apply the connection mark to the editor
            try {
                console.log(`🔗 Setting text selection for connection ${index + 1}...`);
                this.editor.commands.setTextSelection(connection.position);

                console.log(`🔗 Applying setSentenceConnectionHighlight for connection ${index + 1}...`);
                const success = this.editor.commands.setSentenceConnectionHighlight(
                    connectionId,
                    connection.connectionStrength,
                    connection.reason
                );

                console.log(`✅ Mark application ${success ? 'succeeded' : 'FAILED'} for connection ${index + 1}`);

                if (!success) {
                    console.error(`❌ Failed to apply mark for connection ${index + 1}`, {
                        connectionId,
                        connectionStrength: connection.connectionStrength,
                        reason: connection.reason,
                        position: connection.position
                    });
                }
            } catch (error) {
                console.error(`❌ Exception while applying mark for connection ${index + 1}:`, error);
                if (error instanceof Error) {
                    console.error(`❌ Error details:`, error.message, error.stack);
                }
            }

            // Store connection highlight data
            this.sentenceConnectionHighlights.set(connectionId, {
                connectionId,
                position: connection.position,
                connectionStrength: connection.connectionStrength,
                reason: connection.reason,
                text: connection.text
            });

            console.log(`✅ Added connection highlight: ${connection.text.substring(0, 30)}... (strength: ${connection.connectionStrength})`);
        })

        // Debug: Check what elements exist in the DOM after applying marks
        setTimeout(() => {
            const connectionElements = this.editor.view.dom.querySelectorAll('.sentence-connection');
            console.log('🔍 DOM Check: Found sentence-connection elements:', connectionElements.length);
            connectionElements.forEach((el, i) => {
                console.log(`🔍 Element ${i + 1}:`, {
                    classList: Array.from(el.classList),
                    attributes: {
                        'data-connection-id': el.getAttribute('data-connection-id'),
                        'data-connection-strength': el.getAttribute('data-connection-strength'),
                        'data-connection-reason': el.getAttribute('data-connection-reason')
                    },
                    computedStyle: {
                        backgroundColor: window.getComputedStyle(el).backgroundColor,
                        borderBottom: window.getComputedStyle(el).borderBottom
                    },
                    textContent: el.textContent?.substring(0, 30) + '...'
                });
            });

            const editorContainer = this.editor.view.dom.closest('.editor-container');
            console.log('🔍 Editor container mode attribute:', editorContainer?.getAttribute('data-highlighting-mode'));
        }, 100);
    }

    clearSentenceConnectionHighlights(): void {
        console.log('🧹 Clearing sentence connection highlights');

        // Use the TipTap command to clear all connection highlights
        this.editor.commands.clearAllSentenceConnectionHighlights();

        // Clear our internal state
        this.sentenceConnectionHighlights.clear();
    }

    // Method to update the analyzed sentence text
    public updateAnalyzedSentence(newSentenceText: string): void {
        console.log('📝 Updating analyzed sentence:', {
            oldSentence: this.lastAnalyzedSentence?.substring(0, 50) + '...',
            newSentence: newSentenceText.substring(0, 50) + '...'
        });
        this.lastAnalyzedSentence = newSentenceText;
    }

    // Method to redo sentence flow analysis with updated document content
    public async redoSentenceFlowAnalysis(): Promise<void> {
        if (!this.lastAnalyzedSentence) {
            console.warn('⚠️ No previous sentence to reanalyze');
            return;
        }

        console.log('🔄 Redoing sentence flow analysis for:', this.lastAnalyzedSentence.substring(0, 50) + '...');

        // Get current document text (this will include any user edits)
        const documentText = this.editor.getText();

        // Get the current version of the tracked sentence (this is where the magic happens!)
        const currentSentenceText = this.getCurrentTrackedSentenceText();
        const sentenceToAnalyze = currentSentenceText || this.lastAnalyzedSentence;

        console.log('🔍 Original sentence:', this.lastAnalyzedSentence.substring(0, 50) + '...');
        console.log('🔍 Current sentence:', sentenceToAnalyze.substring(0, 50) + '...');

        if (currentSentenceText && currentSentenceText !== this.lastAnalyzedSentence) {
            console.log('📝 Sentence has been modified since original analysis');
        }

        // Clear existing connection highlights
        this.clearSentenceConnectionHighlights();

        // Set analyzing state to true and show loading cursor
        this.setAnalyzing(true);

        try {
            console.log('📡 Making redo sentence flow analysis API call...');
            console.log('📡 Updated document length:', documentText.length);

            // Find paragraph topic for the current sentence
            const paragraphTopic = this.findParagraphTopicForSentence(sentenceToAnalyze, documentText);

            const result = await analyzeSentenceFlow({
                sentence: sentenceToAnalyze, // Use the current sentence text!
                document: documentText,
                prompt: 'Analyze this sentence in the context of the updated document',
                paragraphTopic: paragraphTopic // Include paragraph topic if available
            });

            // Process the connection data and apply highlights
            if (result.result && Array.isArray(result.result) && result.result.length > 0) {
                console.log('🔗 Applying updated connection highlights...');
                // Add missing reason property to each connection
                const connectionsWithReason = result.result.map(conn => ({
                    ...conn,
                    reason: `Connection strength: ${conn.connectionStrength.toFixed(2)}`
                }));
                this.addSentenceConnectionHighlights(connectionsWithReason);

                // Update the action panel with new analysis
                this.showSentenceFlowActionPanel({
                    text: sentenceToAnalyze, // Show the current sentence text
                    connectionStrength: result.result.length > 0 ? result.result[0].connectionStrength : 0,
                    connectedSentences: result.result.map(r => r.text),
                    paragraphCohesion: result.paragraphCohesion,
                    documentCohesion: result.documentCohesion
                });
            } else {
                console.log('ℹ️ No connections found in updated analysis');

                // Update action panel even if no connections found
                this.showSentenceFlowActionPanel({
                    text: sentenceToAnalyze, // Show the current sentence text
                    connectionStrength: 0,
                    connectedSentences: [],
                    paragraphCohesion: result.paragraphCohesion,
                    documentCohesion: result.documentCohesion
                });
            }
        } catch (error) {
            console.error('❌ Redo API call failed:', error);
            if (error instanceof Error) {
                console.error('❌ Error details:', error.message, error.stack);
            }
        } finally {
            // Set analyzing state back to false and remove loading cursor
            this.setAnalyzing(false);
        }
    }

    // Utility Methods
    private determineSeverity(comment: CommentType): string {
        // Logic to determine severity based on comment content/type
        if (comment.content.toLowerCase().includes('critical') ||
            comment.content.toLowerCase().includes('major')) {
            return 'high';
        }
        if (comment.content.toLowerCase().includes('minor') ||
            comment.content.toLowerCase().includes('suggestion')) {
            return 'low';
        }
        return 'medium';
    }

    // Text Change Handling
    onTextChange(): void {
        // Handle position updates when text changes
        // This is called from the editor's onChange handler
        this.updatePositionsAfterEdit();
    }

    private updatePositionsAfterEdit(): void {
        // For now, we'll rebuild highlights on text change
        // In a production system, you might want more sophisticated position tracking
        console.log('Text changed, may need to update highlight positions');
    }

    // State Access
    getHighlightData(mode: HighlightingMode): Map<string, any> {
        switch (mode) {
            case 'comments':
                return this.state.commentHighlights;
            case 'flow':
            case 'flow-sentence':
                return this.state.flowHighlights;
            default:
                return new Map();
        }
    }

    // Clear All Highlights
    clearAllHighlights(): void {
        this.clearCommentHighlights();
        this.clearReferenceHighlights();
        this.clearFlowHighlights();
    }

    // Mode Cycling (for keyboard shortcuts)
    cycleMode(): void {
        const modes: HighlightingMode[] = ['comments', 'flow', 'flow-sentence'];
        const currentIndex = modes.indexOf(this.state.currentMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.switchMode(modes[nextIndex]);
    }

    // Export state for persistence
    exportState(): HighlightingState {
        return JSON.parse(JSON.stringify({
            currentMode: this.state.currentMode,
            commentHighlights: Array.from(this.state.commentHighlights.entries()),
            referenceHighlights: Array.from(this.state.referenceHighlights.entries()),
            flowHighlights: Array.from(this.state.flowHighlights.entries()),
        }));
    }

    // Import state from persistence
    importState(savedState: any): void {
        this.state.currentMode = savedState.currentMode || 'none';
        this.state.commentHighlights = new Map(savedState.commentHighlights || []);
        this.state.referenceHighlights = new Map(savedState.referenceHighlights || []);
        this.state.flowHighlights = new Map(savedState.flowHighlights || []);

        // Reapply highlights to editor
        this.reapplyAllHighlights();
    }

    private reapplyAllHighlights(): void {
        // Reapply comment highlights
        this.state.commentHighlights.forEach(highlight => {
            this.editor.commands.setTextSelection(highlight.position);
            this.editor.commands.setCommentHighlight(
                highlight.commentId,
                highlight.commentType,
                highlight.severity
            );
        });

        // Reapply reference highlights
        this.state.referenceHighlights.forEach(highlight => {
            this.editor.commands.setTextSelection(highlight.position);
            this.editor.commands.setReferenceHighlight(
                highlight.referenceId,
                highlight.referenceType,
                highlight.sourceText,
                highlight.targetSentence
            );
        });

        // Reapply flow highlights
        this.state.flowHighlights.forEach(highlight => {
            this.editor.commands.setTextSelection(highlight.position);
            this.editor.commands.setSentenceHighlight(
                highlight.sentenceId,
                highlight.connectionStrength,
                highlight.connectedSentences
            );
        });

        // Set the current mode
        this.switchMode(this.state.currentMode);
    }

    private setAnalyzing(analyzing: boolean) {
        this.isAnalyzing = analyzing;
        const editorContainer = this.editor.view.dom.closest('.editor-container');
        if (editorContainer) {
            editorContainer.setAttribute('data-analyzing', analyzing.toString());
        }
    }

    private captureSentenceContext(sentenceText: string, documentText: string): {
        originalText: string;
        documentSnapshot: string;
        paragraphIndex: number;
        sentenceIndexInParagraph: number;
        timestamp: number;
        semanticKeywords: string[];
    } {
        const paragraphs = documentText.split(/\n\s*\n/).filter(p => p.trim());
        let paragraphIndex = -1;
        let sentenceIndexInParagraph = -1;

        // Find which paragraph contains the sentence
        for (let i = 0; i < paragraphs.length; i++) {
            const sentences = paragraphs[i].split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
            const sentenceIndex = sentences.findIndex(s => s === sentenceText.trim());
            if (sentenceIndex !== -1) {
                paragraphIndex = i;
                sentenceIndexInParagraph = sentenceIndex;
                break;
            }
        }

        // Extract semantic keywords (important words that define the sentence meaning)
        const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);

        const semanticKeywords = sentenceText.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !commonWords.has(word))
            .slice(0, 10); // Keep top 10 keywords

        return {
            originalText: sentenceText,
            documentSnapshot: documentText,
            paragraphIndex,
            sentenceIndexInParagraph,
            timestamp: Date.now(),
            semanticKeywords
        };
    }

    private initializeSentenceTracker(sentenceText: string, sentenceId: string): {
        originalText: string;
        selectedSentenceId: string | null;
        position: { from: number; to: number } | null;
    } {
        // Find the position of the selected sentence in the editor
        let foundPosition: { from: number; to: number } | null = null;

        // Look for the sentence in flow highlights first
        const flowHighlight = this.state.flowHighlights.get(sentenceId);
        if (flowHighlight) {
            foundPosition = flowHighlight.position;
        } else {
            // Fallback: search for the sentence text in the document
            const documentText = this.editor.getText();
            const sentenceIndex = documentText.indexOf(sentenceText);
            if (sentenceIndex !== -1) {
                foundPosition = {
                    from: sentenceIndex,
                    to: sentenceIndex + sentenceText.length
                };
            }
        }

        console.log('🎯 Initialized sentence tracker:', {
            originalText: sentenceText.substring(0, 50) + '...',
            sentenceId,
            position: foundPosition
        });

        return {
            originalText: sentenceText,
            selectedSentenceId: sentenceId,
            position: foundPosition
        };
    }

    // Method to get the current text of the tracked sentence (called only on refresh)
    private getCurrentTrackedSentenceText(): string | null {
        if (!this.selectedSentenceTracker) {
            console.warn('⚠️ No sentence tracker initialized');
            return null;
        }

        // Strategy 1: Try to find by sentence ID in flow highlights
        if (this.selectedSentenceTracker.selectedSentenceId) {
            const flowHighlight = this.state.flowHighlights.get(this.selectedSentenceTracker.selectedSentenceId);
            if (flowHighlight) {
                // Get current text at the stored position
                const currentText = this.editor.state.doc.textBetween(
                    flowHighlight.position.from,
                    flowHighlight.position.to
                );
                if (currentText.trim()) {
                    console.log('✅ Found current sentence via flow highlight:', currentText.substring(0, 50) + '...');
                    return currentText;
                }
            }
        }

        // Strategy 2: Try to find by stored position
        if (this.selectedSentenceTracker.position) {
            try {
                const currentText = this.editor.state.doc.textBetween(
                    this.selectedSentenceTracker.position.from,
                    this.selectedSentenceTracker.position.to
                );
                if (currentText.trim()) {
                    console.log('✅ Found current sentence via stored position:', currentText.substring(0, 50) + '...');
                    return currentText;
                }
            } catch (error) {
                console.warn('⚠️ Position out of bounds, trying fallback methods');
            }
        }

        // Strategy 3: Search for similar sentence in document (fuzzy matching)
        const documentText = this.editor.getText();
        const originalWords = this.selectedSentenceTracker.originalText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const sentences = documentText.split(/[.!?]+/).filter(s => s.trim().length > 10);

        let bestMatch = null;
        let bestScore = 0;

        for (const sentence of sentences) {
            const sentenceWords = sentence.toLowerCase().split(/\s+/);
            const overlap = originalWords.filter(word =>
                sentenceWords.some(sw => sw.includes(word) || word.includes(sw))
            ).length;
            const score = originalWords.length > 0 ? overlap / originalWords.length : 0;

            if (score > bestScore && score > 0.6) { // 60% similarity threshold
                bestScore = score;
                bestMatch = sentence.trim();
            }
        }

        if (bestMatch) {
            console.log(`✅ Found current sentence via fuzzy matching (${(bestScore * 100).toFixed(1)}% similarity):`, bestMatch.substring(0, 50) + '...');
            return bestMatch;
        }

        // Strategy 4: Fallback to original text
        console.warn('⚠️ Could not find updated sentence, using original text');
        return this.selectedSentenceTracker.originalText;
    }

    // Methods for paragraph topic management
    setParagraphTopics(topics: { [paragraphId: string]: string }): void {
        this.paragraphTopics = { ...topics };
        console.log('📝 Updated paragraph topics in HighlightingManager:', this.paragraphTopics);
    }

    private findParagraphTopicForSentence(sentenceText: string, documentText: string): string | undefined {
        // Find which paragraph contains the sentence
        const paragraphs: string[] = documentText.split(/\n\s*\n/).filter((p: string) => p.trim());

        for (let i = 0; i < paragraphs.length; i++) {
            const paragraph = paragraphs[i];
            if (paragraph.includes(sentenceText.trim())) {
                const paragraphId = `paragraph-${i}`;
                const topic = this.paragraphTopics[paragraphId];
                if (topic) {
                    console.log(`📍 Found paragraph topic for sentence: "${topic}"`);
                    return topic;
                }
                break; // Stop searching once we find the paragraph
            }
        }

        console.log('📍 No paragraph topic found for this sentence');
        return undefined;
    }
} 