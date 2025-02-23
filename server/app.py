from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
from dotenv import load_dotenv
import os
import json
from datetime import datetime
from typing import Dict, List, Optional, Union, Literal

load_dotenv()

# Environment configuration
class Config:
    HOSTNAME = os.getenv('HOSTNAME')
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

    @staticmethod
    def validate():
        missing_vars = []
        if not Config.OPENAI_API_KEY:
            missing_vars.append('OPENAI_API_KEY')
        if not Config.HOSTNAME:
            missing_vars.append('HOSTNAME')
        if missing_vars:
            raise ValueError(f"Missing environment variables: {', '.join(missing_vars)}")

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

    SECTION = """You are an expert writing assistant analyzing a section of text.
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

    DOCUMENT = """You are an expert writing assistant analyzing an entire document.
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

    THEME_CHECK = """You are an expert writing assistant checking for thematic consistency.
    Focus on how well the content aligns with the specified theme/topic:
    1. Evaluate relevance to the main theme
    2. Identify any tangents or deviations
    3. Suggest ways to better align with the theme
    
    For each issue found, you MUST quote the exact text that needs attention.
    
    Provide analysis in the following format:
    {
        "theme_alignment": {
            "score": float (0-1),
            "deviations": [
                {
                    "text": string (exact quote of deviating content),
                    "issue": string (how it deviates from theme),
                    "suggestion": string (how to align with theme),
                    "highlight_color": "#fef9c3" // yellow highlight for theme deviations
                }
            ]
        },
        "relevance": {
            "score": float (0-1),
            "irrelevant_elements": [
                {
                    "text": string (exact quote of irrelevant content),
                    "issue": string (why it's not relevant),
                    "suggestion": string (how to make it relevant),
                    "highlight_color": "#93c5fd" // blue highlight for relevance issues
                }
            ]
        }
    }"""

# Initialize Flask app
app = Flask(__name__)
CORS(app, supports_credentials=True, origins=[Config.HOSTNAME] if Config.HOSTNAME else "*")

# Initialize OpenAI client
client = OpenAI(api_key=Config.OPENAI_API_KEY)

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
            model="gpt-4o",
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
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    })

if __name__ == "__main__":
    # Validate configuration before starting
    Config.validate()
    app.run(host='127.0.0.1', port=5000, debug=True)
