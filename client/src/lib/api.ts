// API utility functions for communicating with the backend

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Interface for analysis request
interface AnalysisRequest {
  content: string;
  theme?: string;
}

// Enhanced interface for contextual analysis
interface ContextualAnalysisRequest {
  content: string;                            // The specific section/paragraph to analyze
  fullContext: string;                        // The entire document for context
  targetType: 'flow' | 'clarity' | 'focus' | 'all';
  paragraphTopics?: Record<string, string>;   // Dictionary of paragraph IDs to topic sentences
  essayTopic?: string;                        // The main essay topic/thesis statement
}

// Interface for analysis response
interface AnalysisResponse {
  success: boolean;
  data: any;
  processedAt: string;
}

// Interface for contextual analysis response
interface ContextualAnalysisResponse {
  success: boolean;
  data: {
    comments: {
      issueType: string | undefined;
      text: string;
      highlightedText: string;
      highlightStyle: string;
      suggestedEdit?: {
        explanation: string;
        original: string;
        suggested: string;
      };
    }[];
  };
  processedAt: string;
}

// Interface for chat request
interface ChatRequest {
  message: string;
  documentContext?: string; // Optional full document for context
}

// Interface for chat response
interface ChatResponse {
  success: boolean;
  message: string;
  processedAt: string;
}

// Interface for refresh feedback request
interface RefreshFeedbackRequest {
  originalText: string;     // The original text that received feedback
  currentText: string;      // The current text after edits
  originalFeedback: string; // The original feedback provided
  issueType?: string;       // The type of issue (clarity, focus, flow)
}

// Interface for refresh feedback response
interface RefreshFeedbackResponse {
  success: boolean;
  data: {
    updatedFeedback: string;
  };
  processedAt: string;
}

/**
 * Makes a request to refresh feedback based on edited text
 */
export async function refreshFeedback(data: RefreshFeedbackRequest): Promise<RefreshFeedbackResponse> {
  try {
    console.log('Sending refresh feedback request:', JSON.stringify(data, null, 2));

    const response = await fetch(`${API_BASE_URL}/api/refresh-feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Server response error:', errorData);
      throw new Error(errorData.error || 'Failed to refresh feedback');
    }

    return await response.json();
  } catch (error) {
    console.error('Error refreshing feedback:', error);
    throw error;
  }
}

/**
 * Makes a request to analyze text content
 */
export async function analyzeText(data: AnalysisRequest): Promise<AnalysisResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to analyze text');
    }

    return await response.json();
  } catch (error) {
    console.error('Error analyzing text:', error);
    throw error;
  }
}

/**
 * Makes a request to analyze text with full document context
 * This is used for more contextual analysis of paragraphs/sections
 */
export async function analyzeTextWithContext(data: ContextualAnalysisRequest): Promise<ContextualAnalysisResponse> {
  try {
    // Debug: Log the exact data being sent
    console.log('Sending analysis request:', JSON.stringify(data, null, 2));

    // Make a real API call to the analyze-context endpoint
    const response = await fetch(`${API_BASE_URL}/api/analyze-context`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Server response error:', errorData);
      throw new Error(errorData.error || 'Failed to analyze text with context');
    }

    return await response.json();
  } catch (error) {
    console.error('Error analyzing text with context:', error);
    throw error;
  }
}

// Interface for regenerate suggestion request
interface RegenerateSuggestionRequest {
  originalText: string;          // The original text that received feedback
  currentText: string;           // The current text after edits (if any)
  issueType?: string;            // The type of issue (clarity, focus, flow)
  originalExplanation?: string;  // The original explanation to preserve
}

// Interface for regenerate suggestion response
interface RegenerateSuggestionResponse {
  success: boolean;
  data: {
    suggestedEdit: {
      original: string;
      suggested: string;
      explanation: string;
    }
  };
  processedAt: string;
}

/**
 * Makes a request to regenerate a suggestion for text improvement
 */
export async function regenerateSuggestion(data: RegenerateSuggestionRequest): Promise<RegenerateSuggestionResponse> {
  try {
    console.log('Sending regenerate suggestion request:', JSON.stringify(data, null, 2));

    const response = await fetch(`${API_BASE_URL}/api/regenerate-suggestion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Server response error:', errorData);
      throw new Error(errorData.error || 'Failed to regenerate suggestion');
    }

    return await response.json();
  } catch (error) {
    console.error('Error regenerating suggestion:', error);
    throw error;
  }
}

/**
 * Makes a request to the chat endpoint
 */
export async function sendChatMessage(data: ChatRequest): Promise<ChatResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send chat message');
    }

    const responseData = await response.json();
    return responseData;
  } catch (error) {
    console.error('Error sending chat message:', error);
    throw error;
  }
}

// Add this to your apiUtils.ts file

// Interface for custom prompt request
interface CustomPromptRequest {
  selectedText: string;
  prompt: string;
  fullContext?: string;
}

// Custom prompt response
interface CustomPromptResponse {
  success: boolean;
  response: string;
  suggestedText: string;
  processedAt: string;
}

/**
 * Makes a request to a custom AI endpoint with your own prompt
 */
export async function sendCustomPrompt(data: CustomPromptRequest): Promise<CustomPromptResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/custom-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to process custom prompt');
    }

    return await response.json();
  } catch (error) {
    console.error('Error processing custom prompt:', error);
    throw error;
  }
}