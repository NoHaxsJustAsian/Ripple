// API utility functions for communicating with the backend

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Interface for analysis request
interface AnalysisRequest {
  content: string;
  type: 'paragraph' | 'section' | 'document' | 'theme';
  theme?: string;
}

// Enhanced interface for contextual analysis
interface ContextualAnalysisRequest {
  content: string;          // The specific section/paragraph to analyze
  fullContext: string;      // The entire document for context
  type: 'paragraph' | 'section' | 'document' | 'theme';
  targetType: 'coherence' | 'cohesion' | 'focus' | 'all';
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
}

// Interface for chat response
interface ChatResponse {
  message: string;
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
    // For now, this is a mock implementation that simulates an API call
    // In a real implementation, you'd make a fetch call to an endpoint that accepts the full context
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create a mock response with comments
    let mockComments = [];
    
    if (data.targetType === 'coherence' || data.targetType === 'all') {
      mockComments.push({
        text: "This paragraph could improve its coherence by linking the ideas more clearly.",
        highlightedText: data.content.substring(0, Math.min(data.content.length, 100)),
        highlightStyle: "#fef9c3" // yellow highlight for coherence issues
      });
    }
    
    if (data.targetType === 'cohesion' || data.targetType === 'all') {
      const sentenceBreak = data.content.indexOf('.') + 1;
      if (sentenceBreak > 0 && sentenceBreak < data.content.length) {
        mockComments.push({
          text: "Consider adding a transition between these sentences to improve flow.",
          highlightedText: data.content.substring(0, Math.min(sentenceBreak + 50, data.content.length)),
          highlightStyle: "#93c5fd", // blue highlight for transition issues
          suggestedEdit: {
            original: data.content.substring(sentenceBreak, sentenceBreak + 20).trim(),
            suggested: "Additionally, " + data.content.substring(sentenceBreak, sentenceBreak + 20).trim().toLowerCase()
          }
        });
      }
    }
    
    if (data.targetType === 'focus' || data.targetType === 'all') {
      mockComments.push({
        text: "This section may deviate slightly from the main theme of your document.",
        highlightedText: data.content.substring(Math.max(0, data.content.length - 100)),
        highlightStyle: "#c4b5fd" // purple highlight for focus issues
      });
    }
    
    return {
      success: true,
      data: {
        comments: mockComments
      },
      processedAt: new Date().toISOString()
    };
    
    // In a real implementation, you would call the actual API:
    /*
    const response = await fetch(`${API_BASE_URL}/api/analyze-context`, {
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
    */
  } catch (error) {
    console.error('Error analyzing text with context:', error);
    throw error;
  }
}

/**
 * Makes a request to the chat endpoint (placeholder for future implementation)
 */
export async function sendChatMessage(data: ChatRequest): Promise<ChatResponse> {
  // This is a placeholder for a future chat endpoint
  // In a real implementation, you would make a fetch call to the server
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    message: `Response to: "${data.message}". This is a placeholder response since the actual chat endpoint is not implemented yet.`
  };
} 