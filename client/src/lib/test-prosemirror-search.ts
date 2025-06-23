/**
 * Test file for ProseMirror search implementation
 * Run these tests in the browser console to validate functionality
 */

import type { Editor } from '@tiptap/react';
import { findTextWithProseMirrorSearch, findAndExpandSentence, robustTextFind } from './prosemirror-text-utils';

// Test cases for problematic student text
const TEST_CASES = [
    {
        name: "Missing space after comma",
        text: "teacher,coach,counselor because",
        description: "Text with missing spaces that often causes positioning issues"
    },
    {
        name: "Lowercase sentence start",
        text: "student are going to have a better knowledge",
        description: "Sentence starting with lowercase letter"
    },
    {
        name: "Run-on sentence",
        text: "School should let student enjoy take their high school seriously",
        description: "Long sentence with grammar issues"
    },
    {
        name: "Missing punctuation",
        text: "I want to be a teacher,coach,counselor because I enjoy helping people",
        description: "Sentence missing ending punctuation"
    },
    {
        name: "Partial sentence fragment",
        text: "because I enjoy helping people",
        description: "Fragment that might be found mid-sentence"
    }
];

/**
 * Test ProseMirror search against the current editor
 */
export function testProseMirrorSearch(editor: Editor) {
    console.log('🧪 === PROSEMIRROR SEARCH TESTS ===');

    const results = {
        passed: 0,
        failed: 0,
        details: [] as any[]
    };

    TEST_CASES.forEach((testCase, index) => {
        console.log(`\n--- Test ${index + 1}: ${testCase.name} ---`);
        console.log(`Description: ${testCase.description}`);
        console.log(`Searching for: "${testCase.text}"`);

        try {
            // Test 1: Basic ProseMirror search
            const basicResult = findTextWithProseMirrorSearch(editor, testCase.text);

            // Test 2: Find and expand sentence
            const expandedResult = findAndExpandSentence(editor, testCase.text);

            // Test 3: Robust search (with fallback)
            const robustResult = robustTextFind(editor, testCase.text);

            const testResult: any = {
                testCase: testCase.name,
                searchText: testCase.text,
                basicFound: !!basicResult,
                expandedFound: !!expandedResult,
                robustFound: !!robustResult,
                basicPosition: basicResult,
                expandedPosition: expandedResult,
                robustPosition: robustResult,
                success: !!(basicResult || expandedResult || robustResult)
            };

            // Validate actual text matches
            if (basicResult) {
                const actualText = editor.state.doc.textBetween(basicResult.from, basicResult.to);
                testResult.basicActualText = actualText;
                testResult.basicMatches = actualText === testCase.text;
                console.log(`✅ Basic search: Found at ${basicResult.from}-${basicResult.to}`);
                console.log(`   Expected: "${testCase.text}"`);
                console.log(`   Actual: "${actualText}"`);
                console.log(`   Match: ${testResult.basicMatches}`);
            } else {
                console.log(`❌ Basic search: Not found`);
            }

            if (expandedResult) {
                const expandedText = editor.state.doc.textBetween(expandedResult.from, expandedResult.to);
                testResult.expandedActualText = expandedText.substring(0, 100);
                testResult.expandedContainsOriginal = expandedText.includes(testCase.text);
                console.log(`✅ Expanded search: Found at ${expandedResult.from}-${expandedResult.to}`);
                console.log(`   Expanded text: "${expandedText.substring(0, 100)}..."`);
                console.log(`   Contains original: ${testResult.expandedContainsOriginal}`);
            } else {
                console.log(`❌ Expanded search: Not found`);
            }

            if (testResult.success) {
                results.passed++;
                console.log(`✅ Test ${index + 1} PASSED`);
            } else {
                results.failed++;
                console.log(`❌ Test ${index + 1} FAILED`);
            }

            results.details.push(testResult);

        } catch (error) {
            console.error(`💥 Test ${index + 1} ERROR:`, error);
            results.failed++;
            results.details.push({
                testCase: testCase.name,
                error: (error as Error).message,
                success: false
            });
        }
    });

    console.log(`\n🧪 === TEST SUMMARY ===`);
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

    return results;
}

/**
 * Quick test function for a specific piece of text
 */
export function quickTestSearch(editor: Editor, text: string) {
    console.log(`\n🔍 Quick test for: "${text.substring(0, 50)}..."`);

    // Test all three methods
    const basic = findTextWithProseMirrorSearch(editor, text);
    const expanded = findAndExpandSentence(editor, text);
    const robust = robustTextFind(editor, text);

    console.log('Results:', {
        basic,
        expanded,
        robust,
        allMatch: !!(basic && expanded && robust)
    });

    // Show actual text for each result
    if (basic) {
        const actualText = editor.state.doc.textBetween(basic.from, basic.to);
        console.log(`Basic result text: "${actualText}"`);
    }

    if (expanded) {
        const expandedText = editor.state.doc.textBetween(expanded.from, expanded.to);
        console.log(`Expanded result text: "${expandedText.substring(0, 100)}..."`);
    }

    return { basic, expanded, robust };
}

// Make functions available globally for browser console testing
declare global {
    interface Window {
        testProseMirrorSearch: typeof testProseMirrorSearch;
        quickTestSearch: typeof quickTestSearch;
    }
}

if (typeof window !== 'undefined') {
    window.testProseMirrorSearch = testProseMirrorSearch;
    window.quickTestSearch = quickTestSearch;
} 