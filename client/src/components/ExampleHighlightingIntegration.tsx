import React, { useState, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { HighlightingManager, HighlightingMode } from '@/lib/highlighting-manager';
import { HighlightingModeSwitcher } from './HighlightingModeSwitcher';

interface ExampleHighlightingIntegrationProps {
    editor: Editor | null;
}

export function ExampleHighlightingIntegration({ editor }: ExampleHighlightingIntegrationProps) {
    const [highlightingManager, setHighlightingManager] = useState<HighlightingManager | null>(null);
    const [currentMode, setCurrentMode] = useState<HighlightingMode>('comments');

    // Initialize highlighting manager when editor is ready
    useEffect(() => {
        if (editor && !highlightingManager) {
            const manager = new HighlightingManager(editor, (mode: HighlightingMode) => {
                setCurrentMode(mode);
                console.log(`📊 Highlighting Manager: Mode changed to ${mode}`);
            });
            setHighlightingManager(manager);

            // Add some mock flow highlights for testing
            addMockFlowHighlights(manager);
        }
    }, [editor, highlightingManager]);

    const addMockFlowHighlights = (manager: HighlightingManager) => {
        // Mock sentence data for testing flow mode
        const mockSentences = [
            {
                id: 'sent-1',
                connectionStrength: 0.8,
                connectionType: 'logical',
                connectedSentences: ['sent-2', 'sent-3'],
                position: { from: 0, to: 50 }, // Adjust these to match your actual text positions
            },
            {
                id: 'sent-2',
                connectionStrength: 0.6,
                connectionType: 'causal',
                connectedSentences: ['sent-1', 'sent-3'],
                position: { from: 51, to: 100 },
            },
            {
                id: 'sent-3',
                connectionStrength: 0.3,
                connectionType: 'support',
                connectedSentences: ['sent-1'],
                position: { from: 101, to: 150 },
            }
        ];

        console.log('🧪 Adding mock flow highlights for testing...');
        manager.addFlowHighlights(mockSentences);
    };

    const handleModeChange = (mode: HighlightingMode) => {
        if (highlightingManager) {
            highlightingManager.switchMode(mode);
        }
    };

    if (!editor || !highlightingManager) {
        return <div>Loading highlighting system...</div>;
    }

    return (
        <div className="highlighting-integration-example">
            <HighlightingModeSwitcher
                currentMode={currentMode}
                onModeChange={handleModeChange}
                commentCount={5}
                flowConnectionCount={8}
                className="mb-4"
            />

            {/* Debug info */}
            <div className="text-xs text-gray-500 mb-2">
                Current mode: <strong>{currentMode}</strong>
                {currentMode === 'flow' && (
                    <span className="ml-2 text-green-600">
                        🌊 Flow mode active - Check console for flow highlight data
                    </span>
                )}
            </div>
        </div>
    );
}

// Mock data generator for testing
export const generateMockFlowData = (documentText: string) => {
    // Split document into sentences (simple approach)
    const sentences = documentText.split(/[.!?]+/).filter(s => s.trim().length > 0);

    return sentences.map((sentence, index) => ({
        id: `sent-${index + 1}`,
        connectionStrength: Math.random() * 0.7 + 0.3, // Random strength between 0.3-1.0
        connectionType: ['logical', 'causal', 'support', 'reference'][Math.floor(Math.random() * 4)],
        connectedSentences: sentences
            .map((_, i) => `sent-${i + 1}`)
            .filter((_, i) => i !== index && Math.random() > 0.7), // Random connections
        position: {
            from: documentText.indexOf(sentence),
            to: documentText.indexOf(sentence) + sentence.length,
        },
    }));
}; 