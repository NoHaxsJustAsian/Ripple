import { Editor } from '@tiptap/react';
import { CommentType } from '@/components/editor/types';
import { explainConnection, analyzeSentenceFlow } from './api';

export type HighlightingMode = 'comments' | 'flow' | 'flow-sentence';

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

    setDocumentContext(context: string) {
        this.documentContext = context;
        // Clear cache when document changes
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
            const response = await explainConnection({
                sentence: sentenceText,
                documentContext: this.documentContext,
                connectionStrength: connectionStrength
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
                strengths: string[];
                weaknesses: string[];
            };
            documentCohesion?: {
                score: number;
                analysis: string;
                strengths: string[];
                weaknesses: string[];
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
                strengths: string[];
                weaknesses: string[];
            };
            documentCohesion?: {
                score: number;
                analysis: string;
                strengths: string[];
                weaknesses: string[];
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

        console.log(`Switching highlighting mode from ${previousMode} to ${mode}`);

        // Special logging for flow modes
        if (mode === 'flow') {
            console.log('🌊 FLOW MODE ACTIVATED - Flow highlights should now be visible');
            console.log('Flow highlight data:', this.state.flowHighlights);
        } else if (mode === 'flow-sentence') {
            console.log('📝 FLOW-SENTENCE MODE ACTIVATED - All highlights hidden for clean view');
        } else if (previousMode === 'flow' || previousMode === 'flow-sentence') {
            console.log('🌊 FLOW MODE DEACTIVATED - Flow highlights should now be hidden');
        }

        this.onModeChange?.(mode);
    }

    getCurrentMode(): HighlightingMode {
        return this.state.currentMode;
    }

    // Method to exit flow-sentence mode and return to flow mode
    exitFlowSentenceMode(): void {
        console.log('🔙 Attempting to exit flow-sentence mode...');
        console.log('🔙 Current mode:', this.state.currentMode);

        if (this.state.currentMode === 'flow-sentence') {
            console.log('🔙 Exiting flow-sentence mode, returning to flow mode');

            // Clear the selected sentence
            this.selectedFlowSentenceId = null;

            // Hide popover and action panel
            this.hideSentenceFlowPopover();
            this.hideSentenceFlowActionPanel();

            // Remove selected class from any selected sentences
            const selectedElements = this.editor.view.dom.querySelectorAll('.flow-sentence-selected');
            console.log('🔙 Found selected elements to remove:', selectedElements.length);
            selectedElements.forEach(el => {
                el.classList.remove('flow-sentence-selected');
                console.log('🔙 Removed flow-sentence-selected from element');
            });

            // Clear all sentence connection highlights
            this.clearSentenceConnectionHighlights();

            // Switch back to flow mode
            this.switchMode('flow');
            console.log('🔙 Successfully returned to flow mode');
        } else {
            console.log('🔙 Not in flow-sentence mode, no action needed');
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
            strengths: string[];
            weaknesses: string[];
        };
        documentCohesion?: {
            score: number;
            analysis: string;
            strengths: string[];
            weaknesses: string[];
        };
    }): void {
        console.log('📝 Showing sentence flow popover at:', position);
        console.log('📝 Sentence data:', sentenceData);

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

        console.log('📝 Updated popover state:', this.sentenceFlowPopoverState);

        // Trigger re-render if there's a callback
        if (this.onModeChange) {
            console.log('📝 Triggering onModeChange callback');
            this.onModeChange(this.state.currentMode);
        } else {
            console.log('📝 No onModeChange callback available');
        }
    }

    hideSentenceFlowPopover(): void {
        console.log('📝 Hiding sentence flow popover');

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

        // Trigger re-render if there's a callback
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
            strengths: string[];
            weaknesses: string[];
        };
        documentCohesion?: {
            score: number;
            analysis: string;
            strengths: string[];
            weaknesses: string[];
        };
    }): void {
        console.log('🔧 Showing sentence flow action panel');
        console.log('🔧 Sentence data:', sentenceData);

        this.sentenceFlowActionPanelState = {
            isVisible: true,
            sentenceData
        };

        console.log('🔧 Updated action panel state:', this.sentenceFlowActionPanelState);

        // Trigger re-render if there's a callback
        if (this.onModeChange) {
            console.log('🔧 Triggering onModeChange callback');
            this.onModeChange(this.state.currentMode);
        } else {
            console.log('🔧 No onModeChange callback available');
        }
    }

    hideSentenceFlowActionPanel(): void {
        console.log('🔧 Hiding sentence flow action panel');

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
        console.log('Adding comment highlights:', comments.length);

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
        console.log('Adding reference highlights:', references.length);

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
        console.log('Adding flow highlights:', sentences.length);

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
        console.log('🎯 Setting up flow hover and click listeners');

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
        console.log('🎯 Setting up popover event listeners');

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
        console.log('🎯 Popover mouse leave - scheduling hide');

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

        console.log('🔍 Mouse enter detected on element:', {
            tagName: target.tagName,
            classList: Array.from(target.classList),
            currentMode: this.state.currentMode,
            hasSelectedClass: target.classList.contains('flow-sentence-selected'),
            hasFlowClass: target.classList.contains('flow-mode-highlight'),
            textContent: target.textContent?.substring(0, 50)
        });

        // Flow-sentence mode: Handle hover on selected sentence to show popover
        if (target.classList.contains('flow-sentence-selected') && this.state.currentMode === 'flow-sentence') {
            console.log('🎯 Flow-sentence-selected hover detected');

            const sentenceText = target.textContent || '';
            const connectionStrength = parseFloat(target.getAttribute('data-connection-strength') || '0');
            const connectedSentencesStr = target.getAttribute('data-connected-sentences') || '[]';

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

            console.log('🎯 Calculated popover position:', {
                mouseX: mouseEvent.clientX,
                mouseY: mouseEvent.clientY,
                rectTop: rect.top,
                rectLeft: rect.left,
                rectWidth: rect.width,
                rectHeight: rect.height,
                finalPosition: position,
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight
            });

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
            console.log('🔵 Flow hover detected on:', target.textContent?.substring(0, 50));

            const sentenceText = target.textContent || '';
            const connectionStrength = parseFloat(target.getAttribute('data-connection-strength') || '0');

            console.log('⏳ Loading explanation for strength:', connectionStrength);

            try {
                // Fetch explanation asynchronously
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
        } else {
            console.log('❌ Hover conditions not met:', {
                hasFlowClass: target.classList.contains('flow-mode-highlight'),
                hasSelectedClass: target.classList.contains('flow-sentence-selected'),
                isFlowMode: this.state.currentMode === 'flow',
                isFlowSentenceMode: this.state.currentMode === 'flow-sentence',
                currentMode: this.state.currentMode
            });
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

            // Get the clicked sentence text
            const sentenceText = target.textContent || '';

            // Get the full document context
            const documentText = this.editor.getText();

            // Store the selected sentence ID from the data attribute
            let sentenceId = target.getAttribute('data-sentence-id');
            console.log('📝 Sentence ID found:', sentenceId);

            // If no sentence ID, try to find it from flow highlights or generate a unique one
            if (!sentenceId) {
                // Try to find the sentence in our stored flow highlights
                for (const [id, highlight] of this.state.flowHighlights) {
                    if (highlight.content === sentenceText) {
                        sentenceId = id;
                        console.log('📝 Found sentence ID from stored highlights:', sentenceId);
                        break;
                    }
                }

                // If still no ID, generate one
                if (!sentenceId) {
                    sentenceId = `selected-${Date.now()}`;
                    console.log('📝 Generated new sentence ID:', sentenceId);
                }
            }

            this.selectedFlowSentenceId = sentenceId;

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

            // Make API call for sentence flow analysis
            try {
                console.log('📡 Making sentence flow analysis API call...');
                console.log('📡 API call parameters:', {
                    sentence: sentenceText.substring(0, 100),
                    documentLength: documentText.length,
                    prompt: 'Analyze this sentence in the context of the document'
                });

                const result = await analyzeSentenceFlow({
                    sentence: sentenceText,
                    document: documentText,
                    prompt: 'Analyze this sentence in the context of the document' // Default prompt for now
                });

                console.log('🎉 API call successful! Full result:', result);
                console.log('🎉 Result.result type:', typeof result.result);
                console.log('🎉 Result.result length:', result.result?.length);
                console.log('🎉 Result.result content:', result.result);

                // Process the connection data and apply highlights
                if (result.result && Array.isArray(result.result) && result.result.length > 0) {
                    console.log('🔗 About to apply connection highlights...');
                    console.log('🔗 Connection data:', result.result);
                    this.addSentenceConnectionHighlights(result.result);

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
        });

        // Debug: Test CSS rules
        this.debugCSSRules();

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

    // Method to redo sentence flow analysis with updated document content
    public async redoSentenceFlowAnalysis(): Promise<void> {
        if (!this.lastAnalyzedSentence) {
            console.warn('⚠️ No previous sentence to reanalyze');
            return;
        }

        console.log('🔄 Redoing sentence flow analysis for:', this.lastAnalyzedSentence.substring(0, 50) + '...');

        // Get current document text (this will include any user edits)
        const documentText = this.editor.getText();

        // Clear existing connection highlights
        this.clearSentenceConnectionHighlights();

        // Set analyzing state to true and show loading cursor
        this.setAnalyzing(true);

        try {
            console.log('📡 Making redo sentence flow analysis API call...');
            console.log('📡 Updated document length:', documentText.length);

            const result = await analyzeSentenceFlow({
                sentence: this.lastAnalyzedSentence,
                document: documentText,
                prompt: 'Analyze this sentence in the context of the updated document'
            });

            console.log('🎉 Redo API call successful! Full result:', result);

            // Process the connection data and apply highlights
            if (result.result && Array.isArray(result.result) && result.result.length > 0) {
                console.log('🔗 Applying updated connection highlights...');
                this.addSentenceConnectionHighlights(result.result);

                // Update the action panel with new analysis
                this.showSentenceFlowActionPanel({
                    text: this.lastAnalyzedSentence,
                    connectionStrength: result.result.length > 0 ? result.result[0].connectionStrength : 0,
                    connectedSentences: result.result.map(r => r.text),
                    paragraphCohesion: result.paragraphCohesion,
                    documentCohesion: result.documentCohesion
                });
            } else {
                console.log('ℹ️ No connections found in updated analysis');

                // Update action panel even if no connections found
                this.showSentenceFlowActionPanel({
                    text: this.lastAnalyzedSentence,
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

    // Debug helper to test CSS rules
    private debugCSSRules(): void {
        console.log('🎨 Testing CSS rules for sentence connections...');

        // Create a test element to check CSS
        const testElement = document.createElement('span');
        testElement.className = 'sentence-connection sentence-connection-strong';
        testElement.setAttribute('data-connection-id', 'test');
        testElement.setAttribute('data-connection-strength', '0.8');
        testElement.textContent = 'Test sentence connection';

        // Append to editor container to test CSS
        const editorContainer = this.editor.view.dom.closest('.editor-container') as HTMLElement;
        if (editorContainer) {
            editorContainer.appendChild(testElement);

            // Check computed styles
            const computedStyle = window.getComputedStyle(testElement);
            console.log('🎨 Test element computed styles:', {
                backgroundColor: computedStyle.backgroundColor,
                borderBottom: computedStyle.borderBottom,
                display: computedStyle.display,
                visibility: computedStyle.visibility
            });

            // Check if container has the right mode
            console.log('🎨 Container mode:', editorContainer.getAttribute('data-highlighting-mode'));

            // Remove test element
            setTimeout(() => {
                editorContainer.removeChild(testElement);
            }, 1000);
        }
    }
} 