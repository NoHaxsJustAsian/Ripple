// Simple test functions for highlighting debugging
// Use in browser console: rippleDebug.runTests()

export function testHighlightingDebug() {
    console.log('🧪 Testing Highlighting Debug Setup');

    // Check if debug utilities are available
    if (typeof window !== 'undefined' && (window as any).rippleDebug) {
        const debug = (window as any).rippleDebug;
        console.log('✅ Debug utilities found');

        // Test with some common problematic texts
        const testTexts = [
            'they offer a bachelors',
            'The first reason being',
            'respiratory therapy',
            'tutoring,coach,counselor'
        ];

        testTexts.forEach(text => {
            console.log(`\n🔍 Testing: "${text}"`);
            debug.debugText(text);
        });

    } else {
        console.error('❌ Debug utilities not found. Make sure editor is loaded.');
    }
}

// Add to window for easy access
if (typeof window !== 'undefined') {
    (window as any).testHighlighting = testHighlightingDebug;
} 