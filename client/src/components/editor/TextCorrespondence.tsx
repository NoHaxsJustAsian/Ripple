import { useState } from 'react';
import { SuggestedEdit, Reference } from './types';

interface TextCorrespondenceProps {
    suggestedEdit: SuggestedEdit;
}

export function TextCorrespondence({ suggestedEdit }: TextCorrespondenceProps) {
    const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);
    const [hoveredReference, setHoveredReference] = useState<Reference | null>(null);

    // Text segmentation logic
    const computeSegments = (original: string, suggested: string) => {
        const originalWords = original.split(/(\s+)/);
        const suggestedWords = suggested.split(/(\s+)/);

        const segments = [];
        let origSegment = '';
        let suggSegment = '';
        let origIndex = 0;
        let suggIndex = 0;

        while (origIndex < originalWords.length || suggIndex < suggestedWords.length) {
            // If words match
            if (origIndex < originalWords.length &&
                suggIndex < suggestedWords.length &&
                originalWords[origIndex] === suggestedWords[suggIndex]) {
                // Add to current segment
                origSegment += originalWords[origIndex];
                suggSegment += suggestedWords[suggIndex];
                origIndex++;
                suggIndex++;
            } else {
                // Add any current segment
                if (origSegment || suggSegment) {
                    segments.push({
                        original: origSegment,
                        suggested: suggSegment
                    });
                    origSegment = '';
                    suggSegment = '';
                }

                // Handle mismatched words
                if (origIndex < originalWords.length) {
                    segments.push({
                        original: originalWords[origIndex],
                        suggested: ''
                    });
                    origIndex++;
                }
                if (suggIndex < suggestedWords.length) {
                    segments.push({
                        original: '',
                        suggested: suggestedWords[suggIndex]
                    });
                    suggIndex++;
                }
            }
        }

        // Add any remaining segment
        if (origSegment || suggSegment) {
            segments.push({
                original: origSegment,
                suggested: suggSegment
            });
        }

        return segments;
    };

    const segments = computeSegments(suggestedEdit.original, suggestedEdit.suggested);

    // Helper function to check if a segment contains a reference
    const getSegmentReferences = (segment: string, isOriginal: boolean) => {
        if (!suggestedEdit.references) return null;
        return suggestedEdit.references.filter(ref => {
            const text = isOriginal ? ref.allusion : ref.referenceText;
            return segment.includes(text);
        });
    };

    return (
        <div className="space-y-4">
            {/* Original Text Section */}
            <div className="bg-muted/30 p-4 rounded-md border border-muted">
                <h3 className="text-sm font-medium mb-2">Current Text:</h3>
                <div className="text-sm leading-relaxed">
                    {segments.map((segment, index) => {
                        const references = getSegmentReferences(segment.original, true);
                        return (
                            <span
                                key={`original-${index}`}
                                className={`cursor-pointer transition-colors duration-200 ${hoveredSegment === index
                                    ? 'bg-blue-100 dark:bg-blue-900/30 rounded-sm'
                                    : (segment.original !== segment.suggested)
                                        ? 'bg-red-50 dark:bg-red-900/10'
                                        : ''
                                    }`}
                                onMouseEnter={() => {
                                    setHoveredSegment(index);
                                    if (references?.length) {
                                        setHoveredReference(references[0]);
                                    }
                                }}
                                onMouseLeave={() => {
                                    setHoveredSegment(null);
                                    setHoveredReference(null);
                                }}
                            >
                                {segment.original}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Suggested Text Section */}
            <div className="bg-muted/30 p-4 rounded-md border border-muted">
                <h3 className="text-sm font-medium mb-2">Edited Text:</h3>
                <div className="text-sm leading-relaxed">
                    {segments.map((segment, index) => {
                        const references = getSegmentReferences(segment.suggested, false);
                        return (
                            <span
                                key={`suggested-${index}`}
                                className={`cursor-pointer transition-colors duration-200 ${hoveredSegment === index
                                    ? 'bg-blue-100 dark:bg-blue-900/30 rounded-sm'
                                    : (segment.original !== segment.suggested)
                                        ? 'bg-green-50 dark:bg-green-900/10'
                                        : ''
                                    }`}
                                onMouseEnter={() => {
                                    setHoveredSegment(index);
                                    if (references?.length) {
                                        setHoveredReference(references[0]);
                                    }
                                }}
                                onMouseLeave={() => {
                                    setHoveredSegment(null);
                                    setHoveredReference(null);
                                }}
                            >
                                {segment.suggested}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* References Section */}
            {suggestedEdit.references && suggestedEdit.references.length > 0 && (
                <div className="mt-4 p-3 bg-muted/20 rounded-md border border-muted">
                    <h3 className="text-sm font-medium mb-2">References:</h3>
                    <div className="space-y-2">
                        {suggestedEdit.references.map((ref, index) => (
                            <div
                                key={`ref-${index}`}
                                className={`text-sm p-2 rounded-md transition-colors ${hoveredReference === ref
                                        ? 'bg-blue-50 dark:bg-blue-900/20'
                                        : 'bg-muted/30'
                                    }`}
                                onMouseEnter={() => setHoveredReference(ref)}
                                onMouseLeave={() => setHoveredReference(null)}
                            >
                                <div className="font-medium">{ref.allusion}</div>
                                <div className="text-muted-foreground">{ref.referenceText}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Explanation Section */}
            {suggestedEdit.explanation && (
                <div className="mt-2">
                    <details>
                        <summary className="cursor-pointer text-sm font-medium hover:text-blue-600">
                            View explanation
                        </summary>
                        <div className="mt-2 p-3 text-sm text-muted-foreground bg-muted/30 rounded-md">
                            {suggestedEdit.explanation}
                        </div>
                    </details>
                </div>
            )}
        </div>
    );
}