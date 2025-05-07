import React, { useState } from 'react';
import { SuggestedEdit } from './types'; // Import your existing type

interface TextCorrespondenceProps {
    suggestedEdit: SuggestedEdit;
}

export function TextCorrespondence({ suggestedEdit }: TextCorrespondenceProps) {
    const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);

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
                // Words don't match - look for next matching point
                let matchFound = false;

                // Look ahead for matches
                for (let lookAhead = 1; lookAhead < 5; lookAhead++) {
                    // Check original text ahead
                    if (origIndex + lookAhead < originalWords.length &&
                        suggIndex < suggestedWords.length &&
                        originalWords[origIndex + lookAhead] === suggestedWords[suggIndex]) {
                        // Collect words up to match
                        for (let i = 0; i < lookAhead; i++) {
                            origSegment += originalWords[origIndex + i];
                        }
                        // Store segment and reset
                        segments.push({
                            original: origSegment,
                            suggested: suggSegment
                        });
                        origSegment = '';
                        suggSegment = '';
                        origIndex += lookAhead;
                        matchFound = true;
                        break;
                    }

                    // Check suggested text ahead
                    if (origIndex < originalWords.length &&
                        suggIndex + lookAhead < suggestedWords.length &&
                        originalWords[origIndex] === suggestedWords[suggIndex + lookAhead]) {
                        // Collect words up to match
                        for (let i = 0; i < lookAhead; i++) {
                            suggSegment += suggestedWords[suggIndex + i];
                        }
                        // Store segment and reset
                        segments.push({
                            original: origSegment,
                            suggested: suggSegment
                        });
                        origSegment = '';
                        suggSegment = '';
                        suggIndex += lookAhead;
                        matchFound = true;
                        break;
                    }
                }

                // If no match found, add current words and advance
                if (!matchFound) {
                    if (origIndex < originalWords.length) {
                        origSegment += originalWords[origIndex];
                        origIndex++;
                    }

                    if (suggIndex < suggestedWords.length) {
                        suggSegment += suggestedWords[suggIndex];
                        suggIndex++;
                    }

                    // Store accumulated non-matching text periodically
                    if ((origIndex % 3 === 0 || suggIndex % 3 === 0) && (origSegment || suggSegment)) {
                        segments.push({
                            original: origSegment,
                            suggested: suggSegment
                        });
                        origSegment = '';
                        suggSegment = '';
                    }
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

    return (
        <div className="space-y-4">
            {/* Original Text Section */}
            <div className="bg-muted/30 p-4 rounded-md border border-muted">
                <h3 className="text-sm font-medium mb-2">Current Text:</h3>
                <div className="text-sm leading-relaxed">
                    {segments.map((segment, index) => (
                        <span
                            key={`original-${index}`}
                            className={`cursor-pointer transition-colors duration-200 ${hoveredSegment === index
                                    ? 'bg-blue-100 dark:bg-blue-900/30 rounded-sm'
                                    : (segment.original !== segment.suggested)
                                        ? 'bg-red-50 dark:bg-red-900/10'
                                        : ''
                                }`}
                            onMouseEnter={() => setHoveredSegment(index)}
                            onMouseLeave={() => setHoveredSegment(null)}
                        >
                            {segment.original}
                        </span>
                    ))}
                </div>
            </div>

            {/* Suggested Text Section */}
            <div className="bg-muted/30 p-4 rounded-md border border-muted">
                <h3 className="text-sm font-medium mb-2">Edited Text:</h3>
                <div className="text-sm leading-relaxed">
                    {segments.map((segment, index) => (
                        <span
                            key={`suggested-${index}`}
                            className={`cursor-pointer transition-colors duration-200 ${hoveredSegment === index
                                    ? 'bg-blue-100 dark:bg-blue-900/30 rounded-sm'
                                    : (segment.original !== segment.suggested)
                                        ? 'bg-green-50 dark:bg-green-900/10'
                                        : ''
                                }`}
                            onMouseEnter={() => setHoveredSegment(index)}
                            onMouseLeave={() => setHoveredSegment(null)}
                        >
                            {segment.suggested}
                        </span>
                    ))}
                </div>
            </div>

            {/* Optional: Add explanation section */}
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