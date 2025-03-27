from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import AzureOpenAI
from dotenv import load_dotenv
import os
import json
from datetime import datetime
from typing import Dict, List, Optional, Union, Literal

load_dotenv()
HOSTNAME = os.getenv('HOSTNAME')
# OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

# get configuration settings 
azure_openai_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
azure_openai_key = os.getenv("AZURE_OPENAI_KEY")
azure_deployment = "PROPILOT"

# initialize the Azure OpenAI client...
client = AzureOpenAI(
        azure_endpoint = azure_openai_endpoint, 
        api_key = azure_openai_key,  
        api_version = "2024-05-01-preview"
)

# Initialize Flask app
app = Flask(__name__)
CORS(app, supports_credentials=True, origins=[HOSTNAME])

# Custom exceptions
class DocumentProcessingError(Exception):
    pass

# Analysis types and their corresponding prompts
class AnalysisPrompts:
    PARAGRAPH = """You are an expert writing assistant analyzing a paragraph.
    Focus on internal coherence and cohesion:
    1. Check if ideas flow logically within the paragraph
    2. Verify if sentences connect smoothly using appropriate transitions
    3. Ensure the paragraph maintains a clear focus
    4. Check if the paragraph supports its main idea effectively
    
    For each issue found, you MUST quote the exact text span that needs attention.
    
    Provide analysis in the following format:
    {
        "coherence": {
            "score": float (0-1),
            "issues": [
                {
                    "text": string (exact quote from the text),
                    "issue": string (description of the issue),
                    "suggestion": string (how to improve),
                    "highlight_color": "#fef9c3" // yellow highlight for coherence issues
                }
            ]
        },
        "cohesion": {
            "score": float (0-1),
            "transitions": {
                "present": [string],
                "missing_between": [
                    {
                        "text": string (exact quote of the two sentences needing transition),
                        "suggestion": string (suggested transition or improvement),
                        "highlight_color": "#93c5fd" // blue highlight for transition issues
                    }
                ]
            }
        },
        "focus": {
            "mainIdea": string,
            "supporting": boolean,
            "unfocused_elements": [
                {
                    "text": string (exact quote of unfocused content),
                    "issue": string (why it deviates from main idea),
                    "suggestion": string (how to align with main idea),
                    "highlight_color": "#c4b5fd" // purple highlight for focus issues
                }
            ]
        }
    }"""

    CUSTOM = """You are an expert writing assistant analyzing a section of text.
    Focus on section-level coherence and thematic consistency:
    1. Evaluate how paragraphs connect and build upon each other
    2. Check if the section maintains its theme throughout
    3. Verify if ideas progress logically
    4. Assess if the section achieves its purpose
    
    For each issue found, you MUST quote the exact text that needs attention.
    
    Provide analysis in the following format:
    {
        "thematic_consistency": {
            "theme": string,
            "score": float (0-1),
            "deviations": [
                {
                    "text": string (exact quote of deviating content),
                    "issue": string (how it deviates),
                    "suggestion": string (how to align with theme),
                    "highlight_color": "#fef9c3" // yellow highlight for theme issues
                }
            ]
        },
        "paragraph_flow": {
            "score": float (0-1),
            "weak_connections": [
                {
                    "text": string (exact quotes of the paragraphs with weak connection),
                    "issue": string (why the connection is weak),
                    "suggestion": string (how to strengthen the connection),
                    "highlight_color": "#93c5fd" // blue highlight for flow issues
                }
            ]
        },
        "purpose": {
            "identified": string,
            "achieved": boolean,
            "misaligned_content": [
                {
                    "text": string (exact quote of content not serving the purpose),
                    "issue": string (why it doesn't serve the purpose),
                    "suggestion": string (how to align with purpose),
                    "highlight_color": "#c4b5fd" // purple highlight for purpose issues
                }
            ]
        }
    }"""

    ALL = """You are an expert writing assistant analyzing an entire document.
    Focus on overall document coherence and structure:
    1. Evaluate the logical progression of ideas throughout the document
    2. Assess thematic consistency across all sections
    3. Check if the document achieves its overall purpose
    4. Verify if the argument/narrative is well-developed
    
    For each issue found, you MUST quote the exact text that needs attention.
    
    Provide analysis in the following format:
    {
        "document_coherence": {
            "score": float (0-1),
            "structural_issues": [
                {
                    "text": string (exact quote of problematic structure),
                    "issue": string (description of structural problem),
                    "suggestion": string (how to restructure),
                    "highlight_color": "#fef9c3" // yellow highlight for structure issues
                }
            ]
        },
        "thematic_analysis": {
            "main_themes": [string],
            "development": {
                "score": float (0-1),
                "underdeveloped_elements": [
                    {
                        "text": string (exact quote needing development),
                        "issue": string (why it needs development),
                        "suggestion": string (how to develop it),
                        "highlight_color": "#93c5fd" // blue highlight for development issues
                    }
                ]
            }
        },
        "argument_flow": {
            "score": float (0-1),
            "weak_points": [
                {
                    "text": string (exact quote of weak argumentation),
                    "issue": string (why the argument is weak),
                    "suggestion": string (how to strengthen),
                    "highlight_color": "#c4b5fd" // purple highlight for argument issues
                }
            ]
        }
    }"""



def analyze_text(
    text: str,
    analysis_type: Literal["paragraph", "section", "document", "theme"],
    theme: Optional[str] = None
) -> Dict:
    """
    Analyze text content using OpenAI's GPT model for coherence and cohesion.
    
    Args:
        text: The text content to analyze
        analysis_type: The type of analysis to perform
        theme: Optional theme to check against
        
    Returns:
        Dict containing the analysis and suggestions
        
    Raises:
        DocumentProcessingError: If analysis fails
    """
    try:
        # Select appropriate prompt based on analysis type
        prompt = getattr(AnalysisPrompts, analysis_type.upper())
        
        # Add theme information if provided
        if theme and analysis_type == "theme":
            prompt = f"The main theme/topic is: {theme}\n\n" + prompt

        # Make OpenAI API call
        response = client.chat.completions.create(
            model="azure_deployment",
            messages=[
                {
                    "role": "system",
                    "content": prompt
                },
                {
                    "role": "user",
                    "content": text
                }
            ],
            max_tokens=2000,
            temperature=0.3  # Lower temperature for more consistent analysis
        )

        # Parse the response
        result = response.choices[0].message.content.strip()
        
        try:
            # Attempt to parse as JSON first
            analysis = json.loads(result)
        except json.JSONDecodeError:
            # If not JSON, structure it manually
            analysis = {
                "analysis": {
                    "content": text,
                    "raw_feedback": result,
                    "type": analysis_type
                }
            }

        return analysis

    except Exception as e:
        raise DocumentProcessingError(f"Failed to analyze document: {str(e)}")

def analyze_text_with_context(
    content: str,
    full_context: str,
    analysis_type: Literal["paragraph", "section", "document", "theme"],
    target_type: Literal["coherence", "cohesion", "focus", "all"]
) -> List[Dict]:
    """
    Analyze text content with document context using OpenAI's GPT model.
    
    Args:
        content: The specific text content to analyze
        full_context: The full document for context
        analysis_type: The type of analysis to perform
        target_type: The specific aspect to target
        
    Returns:
        List of comments containing analysis and suggestions
        
    Raises:
        DocumentProcessingError: If analysis fails
    """
    try:
        # Select appropriate prompt based on analysis type
        base_prompt = getattr(AnalysisPrompts, analysis_type.upper())
        
        # Create a context-aware prompt
        context_prompt = f"""You are analyzing a specific {analysis_type} within a larger document.
        
First, here is the full document for context:
---DOCUMENT CONTEXT---
{full_context}
---END DOCUMENT CONTEXT---

Now, please analyze this specific {analysis_type}:
---SELECTION TO ANALYZE---
{content}
---END SELECTION---

Focus specifically on {target_type} issues.

{base_prompt}

Important: Your comments MUST refer ONLY to the specific selection, not the full document context.
For each issue found, provide:
1. A clear comment explaining the issue
2. The exact text from the selection that needs attention (this will be highlighted)
3. A suggestion for improvement
4. If appropriate, a specific edit suggestion

Format each comment as:
{{
  "text": "Clear explanation of the issue",
  "highlightedText": "The exact text from the selection that has the issue",
  "highlightStyle": "#COLORCODE",
  "suggestedEdit": {{
    "original": "Original text with issue",
    "suggested": "Improved version",
    "explanation": "Brief reason for the change, directly mentioning coherence or cohesion"
  }}
}}

Use these highlight colors:
- Coherence issues: "#fef9c3" (yellow)
- Transition/cohesion issues: "#93c5fd" (blue)
- Focus/theme issues: "#c4b5fd" (purple)

Return an array of comments in JSON format.
"""

        # Make OpenAI API call
        response = client.chat.completions.create(
            model=azure_deployment,
            messages=[
                {
                    "role": "system",
                    "content": context_prompt
                }
            ],
            max_tokens=2000,
            temperature=0.3  # Lower temperature for more consistent analysis
        )

        # Parse the response
        result = response.choices[0].message.content.strip()
        
        try:
            # Attempt to parse as JSON first
            comments = json.loads(result)
            
            # If single object was returned, wrap in list
            if isinstance(comments, dict):
                comments = [comments]
                
            return comments
            
        except json.JSONDecodeError:
            # If not JSON, create a simpler structure
            return [{
                "text": "Analysis completed but results need formatting. Raw feedback follows.",
                "highlightedText": content[:100] + ("..." if len(content) > 100 else ""),
                "highlightStyle": "#fef9c3"
            }]

    except Exception as e:
        raise DocumentProcessingError(f"Failed to analyze document: {str(e)}")

def handle_chat_message(message: str, document_context: Optional[str] = None) -> str:
    """
    Process a chat message using OpenAI's GPT model and generate a response.
    
    Args:
        message: The user's chat message
        document_context: Optional full document text for context
        
    Returns:
        String containing the AI response
        
    Raises:
        DocumentProcessingError: If processing fails
    """
    try:
        # Create messages array starting with system prompt
        messages = [
            {
                "role": "system",
                "content": """You are a helpful writing assistant focused on providing guidance for document 
                improvement. Answer questions about writing techniques, suggest improvements, 
                and offer explanations for coherence and cohesion issues."""
            }
        ]
        
        # Add document context if provided
        if document_context:
            messages.append({
                "role": "system",
                "content": f"Here is the document the user is working on for context:\n\n{document_context}"
            })
        
        # Add user message
        messages.append({
            "role": "user",
            "content": message
        })
        
        # Make OpenAI API call
        response = client.chat.completions.create(
            model=azure_deployment,
            messages=messages,
            max_tokens=1000,
            temperature=0.7  # Slightly higher temperature for more creative responses
        )
        
        # Extract and return the response text
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        raise DocumentProcessingError(f"Failed to process chat message: {str(e)}")

@app.route("/api/analyze", methods=["POST"])
def analyze_document():
    """
    API endpoint to analyze text content and return suggestions.
    
    Expected JSON body:
    {
        "content": string,
        "type": "paragraph" | "section" | "document" | "theme",
        "theme"?: string  // Optional, only for theme analysis
    }
    
    Returns:
        JSON response with document analysis or error message
    """
    try:
        data = request.get_json()
        if not data or 'content' not in data or 'type' not in data:
            return jsonify({
                "error": "Missing required fields: 'content' and 'type'",
                "code": "MISSING_FIELDS"
            }), 400

        text_content = data['content'].strip()
        analysis_type = data['type']
        theme = data.get('theme')  # Optional

        if not text_content:
            return jsonify({
                "error": "Empty content",
                "code": "EMPTY_CONTENT"
            }), 400

        if analysis_type not in ["paragraph", "section", "document", "theme"]:
            return jsonify({
                "error": "Invalid analysis type",
                "code": "INVALID_TYPE"
            }), 400

        # Analyze the text content
        analysis_data = analyze_text(text_content, analysis_type, theme)

        return jsonify({
            "success": True,
            "data": analysis_data,
            "processedAt": datetime.utcnow().isoformat()
        })

    except DocumentProcessingError as e:
        return jsonify({
            "error": str(e),
            "code": "DOCUMENT_PROCESSING_ERROR"
        }), 500
    except Exception as e:
        return jsonify({
            "error": "An unexpected error occurred",
            "code": "INTERNAL_ERROR",
            "detail": str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Health check endpoint to verify API status.
    """
    return jsonify({
        "status": "ok",
        "version": "1.0.0"
    })

@app.route("/api/analyze-context", methods=["POST"])
def analyze_with_context():
    """
    API endpoint to analyze text content with full document context and return targeted suggestions.
    
    Expected JSON body:
    {
        "content": string,         // The specific content to analyze
        "fullContext": string,     // The full document for context
        "type": "paragraph" | "sentence" | "all" | "custom",
        "targetType": "coherence" | "cohesion" | "both"
    }
    
    Returns:
        JSON response with targeted analysis or error message
    """
    try:
        data = request.get_json()
        if not data or 'content' not in data or 'type' not in data or 'fullContext' not in data or 'targetType' not in data:
            return jsonify({
                "error": "Missing required fields",
                "code": "MISSING_FIELDS"
            }), 400

        content = data['content'].strip()
        full_context = data['fullContext'].strip()
        analysis_type = data['type']
        target_type = data['targetType']

        if not content:
            return jsonify({
                "error": "Empty content",
                "code": "EMPTY_CONTENT"
            }), 400

        # if analysis_type not in ["paragraph", "section", "document", "theme"]:
        #     return jsonify({
        #         "error": "Invalid analysis type",
        #         "code": "INVALID_TYPE"
        #     }), 400
            
        # if target_type not in ["coherence", "cohesion", "focus", "all"]:
        #     return jsonify({
        #         "error": "Invalid target type",
        #         "code": "INVALID_TARGET_TYPE"
        #     }), 400

        # Analyze the text content with context
        analysis_data = analyze_text_with_context(content, full_context, analysis_type, target_type)

        return jsonify({
            "success": True,
            "data": {
                "comments": analysis_data
            },
            "processedAt": datetime.utcnow().isoformat()
        })

    except DocumentProcessingError as e:
        return jsonify({
            "error": str(e),
            "code": "DOCUMENT_PROCESSING_ERROR"
        }), 500
    except Exception as e:
        return jsonify({
            "error": "An unexpected error occurred",
            "code": "INTERNAL_ERROR",
            "detail": str(e)
        }), 500

@app.route("/api/chat", methods=["POST"])
def chat():
    """
    API endpoint to handle chat messages and generate responses.
    
    Expected JSON body:
    {
        "message": string,           // The user's chat message
        "documentContext"?: string   // Optional full document for context
    }
    
    Returns:
        JSON response with the AI's reply or error message
    """
    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({
                "error": "Missing required field: 'message'",
                "code": "MISSING_FIELDS"
            }), 400

        message = data['message'].strip()
        document_context = data.get('documentContext', '').strip()  # Optional

        if not message:
            return jsonify({
                "error": "Empty message",
                "code": "EMPTY_MESSAGE"
            }), 400

        # Process the chat message
        response_message = handle_chat_message(message, document_context if document_context else None)

        # Return in format expected by client ChatResponse interface
        return jsonify({
            "success": True,
            "message": response_message,
            "processedAt": datetime.utcnow().isoformat()
        })

    except DocumentProcessingError as e:
        return jsonify({
            "error": str(e),
            "code": "DOCUMENT_PROCESSING_ERROR"
        }), 500
    except Exception as e:
        return jsonify({
            "error": "An unexpected error occurred",
            "code": "INTERNAL_ERROR",
            "detail": str(e)
        }), 500

if __name__ == "__main__":
    # Validate configuration before starting
    app.run(host='127.0.0.1', port=5000, debug=True)
