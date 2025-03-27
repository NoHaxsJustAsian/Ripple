// API utility functions for communicating with the backend

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Interface for analysis request
interface AnalysisRequest {
  content: string;
  type: 'paragraph' | 'custom' | 'all';
  theme?: string;
}

// Enhanced interface for contextual analysis
interface ContextualAnalysisRequest {
  content: string;          // The specific section/paragraph to analyze
  fullContext: string;      // The entire document for context
  type: 'paragraph' | 'all' | 'custom';
  targetType: 'coherence' | 'cohesion' | 'both';
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
      throw new Error(errorData.error || 'Failed to analyze text with context');
    }

    return await response.json();
  } catch (error) {
    console.error('Error analyzing text with context:', error);
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