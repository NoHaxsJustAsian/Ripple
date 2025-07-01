from flask import request, jsonify
from datetime import datetime
from typing import Optional, Dict
from .services import (
    analyze_text,
    analyze_text_with_context,
    handle_chat_message,
    process_custom_prompt
)
from .exceptions import DocumentProcessingError
from . import bp  # Import blueprint from __init__.py

@bp.route("/analyze", methods=["POST"])
def analyze_document():
    """
    API endpoint to analyze text content and return suggestions.
    
    Expected JSON body:
    {
        "content": string,
        "type": "paragraph" | "section" | "document" | "theme",
        "theme"?: string  // Optional, only for theme analysis
    }
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

@bp.route("/analyze-context", methods=["POST"])
def analyze_with_context():
    """
    API endpoint to analyze text content with full document context.
    
    Expected JSON body:
    {
        "content": string,
        "fullContext": string,
        "type": "paragraph" | "section" | "document" | "theme",
        "targetType": "focus" | "flow" | "clarity" | "all",
        "paragraphTopics"?: {[paragraphId: string]: string},  // Optional dictionary of paragraph topics
        "essayTopic"?: string                                 // Optional essay topic/thesis
    }
    """
    try:
        data = request.get_json()
        required_fields = ['content', 'type', 'fullContext', 'targetType']
        if not data or any(field not in data for field in required_fields):
            return jsonify({
                "error": "Missing required fields",
                "code": "MISSING_FIELDS"
            }), 400

        content = data['content'].strip()
        full_context = data['fullContext'].strip()
        analysis_type = data['type']  # This value is now used directly
        target_type = data['targetType']
        
        # Get optional topic fields
        paragraph_topics = data.get('paragraphTopics', {})
        essay_topic = data.get('essayTopic', '')

        if not content:
            return jsonify({
                "error": "Empty content",
                "code": "EMPTY_CONTENT"
            }), 400

        # Pass the additional parameters to the function
        analysis_data = analyze_text_with_context(
            content, 
            full_context, 
            target_type,
            paragraph_topics,
            essay_topic
        )

        return jsonify({
            "success": True,
            "data": {"comments": analysis_data},
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


@bp.route("/custom-prompt", methods=["POST"])
def custom_prompt():
    """
    API endpoint to process a custom prompt for text improvement.
    
    Expected JSON body:
    {
        "selectedText": string,    // The text selected by the user
        "prompt": string,          // The user's custom prompt
        "fullContext": string      // Optional full document for context
    }
    
    Returns:
        JSON response with the explanation and suggested text
    """
    try:
        data = request.get_json()

        print(f"Received data: {data}")
        if not data or 'selectedText' not in data or 'prompt' not in data:
            return jsonify({
                "error": "Missing required fields",
                "code": "MISSING_FIELDS"
            }), 400

        selected_text = data['selectedText'].strip()
        prompt = data['prompt'].strip()
        full_context = data.get('fullContext', '').strip()  # Optional

        if not selected_text or not prompt:
            return jsonify({
                "error": "Empty text or prompt",
                "code": "EMPTY_CONTENT"
            }), 400

        # Process the custom prompt
        result = process_custom_prompt(
            selected_text, 
            prompt,
            full_context if full_context else None
        )
        
        return jsonify({
            "success": True,
            "response": result["response"],
            "suggestedText": result["suggestedText"],
            "processedAt": datetime.utcnow().isoformat()
        })

    except DocumentProcessingError as e:
        print(f"Error in custom prompt: {str(e)}")
        return jsonify({
            "error": str(e),
            "code": "DOCUMENT_PROCESSING_ERROR"
        }), 500
    except Exception as e:
        print(f"Error in custom prompt: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred",
            "code": "INTERNAL_ERROR",
            "detail": str(e)
        }), 500    

@bp.route("/chat", methods=["POST"])
def chat():
    """
    API endpoint to handle chat messages.
    
    Expected JSON body:
    {
        "message": string,
        "documentContext"?: string
    }
    """
    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({
                "error": "Missing required field: 'message'",
                "code": "MISSING_FIELDS"
            }), 400

        message = data['message'].strip()
        document_context = data.get('documentContext', '').strip()

        if not message:
            return jsonify({
                "error": "Empty message",
                "code": "EMPTY_MESSAGE"
            }), 400

        response_message = handle_chat_message(message, document_context if document_context else None)

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

@bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    })