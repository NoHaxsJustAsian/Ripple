from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openai import AzureOpenAI
from dotenv import load_dotenv
import os
import json
from datetime import datetime
from typing import Dict, List, Optional, Union, Literal, Tuple
# Load environment variables
load_dotenv()
HOSTNAME = os.getenv('HOSTNAME')
AZURE_OPENAI_ENDPOINT = os.getenv('AZURE_OPENAI_ENDPOINT')
AZURE_OPENAI_KEY = os.getenv('AZURE_OPENAI_KEY')
AZURE_DEPLOYMENT = "PROPILOT"

# Initialize Flask app
app = Flask(__name__)

# Configure CORS - allow localhost for development if HOSTNAME not set
allowed_origins = [HOSTNAME] if HOSTNAME else [
    "http://localhost:3000",
    "http://localhost:5173", 
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173"
]
CORS(app, supports_credentials=True, origins=allowed_origins)

# Initialize OpenAI client
client = AzureOpenAI(
    azure_endpoint=AZURE_OPENAI_ENDPOINT,
    api_key=AZURE_OPENAI_KEY,
    api_version="2024-05-01-preview"
)



# Custom exceptions
class DocumentProcessingError(Exception):
    pass

def analyze_text_with_context(
    content: str,
    full_context: str,
    target_type: Literal["flow", "clarity", "focus", "all"],
    paragraph_topics: Dict[str, str] = None,
    essay_topic: str = None,
    flow_prompt: str = None 
) -> List[Dict]:
    """
    Analyze text content with document context using OpenAI's GPT model.
    
    Args:
        content: The specific text content to analyze
        full_context: The full document for context
        target_type: The specific aspect to target
        
    Returns:
        List of comments containing analysis and suggestions
        
    Raises:
        DocumentProcessingError: If analysis fails
    """
    try:
        topics_section = ""
        topic_guidance = ""

        if essay_topic:
            topics_section += f"\nMAIN ESSAY TOPIC/THESIS:\n{essay_topic}\n"
            topic_guidance += ("\nIMPORTANT: Consider this high-level thesis/topic when providing feedback. "
                               "Evaluate how well the text supports or advances this main idea. Your feedback should "
                               "help the writer better align their writing with this core thesis.")
        
        if paragraph_topics and len(paragraph_topics) > 0:
            topics_section += "\nPARAGRAPH TOPIC SENTENCES:\n"
            for para_id, topic in paragraph_topics.items():
                topics_section += f"- {topic}\n"
            topic_guidance += ("\nALSO IMPORTANT: Consider these paragraph topic sentences when providing feedback. "
                               "Evaluate how well the text maintains focus on these topics and creates cohesion between them.")
            
        context_prompt = f"""Analyze this text and generate specific, contextual feedback to improve its clarity, focus, or flow within the full document.

        TEXT TO ANALYZE:
        {content}

        {topics_section}
        {topic_guidance}

Your goal is to help the writer strengthen how their ideas are expressed and connected. Focus only on the highlighted portion of the text. Do not describe improvements to the suggested edit. Instead, explain what the selected text is trying to do and where it is falling short based on the overall structure and purpose of the document.

For each issue found, return a JSON object with:
- A short, descriptive "title" of the issue
- A required "issueType" field from this list only: clarity, flow, focus
- The "highlightedText" (exact text with the issue)
- A "highlightStyle" based on issue type
- A "suggestedEdit" object that includes:
  - "original": the original text
  - "suggested": a revision that improves clarity, flow, or focus while keeping the tone and style of the rest of the document
  - "explanation": a concise and respectful analysis of what the original text is trying to do, where it falls short, and how the revision strengthens the reader's understanding
  - "references": a list of allusions and references to help the writer locate the issue in context

EXPLANATION REQUIREMENTS:
- Never refer to the revised version in the explanation
- Keep the analysis short (2–3 sentences max)
- Focus on the original text's purpose, what's missing or unclear, and how the issue affects the reader
- Include specific references or allusions to the text that you're analyzing

REFERENCE FORMAT:
A "reference" should include:
  {{
    "allusion": a phrase from the explanation (e.g. "connection between activities"),
    "referenceText": the exact corresponding phrase or sentence from the text (e.g. "searching for solutions in these creative places...")
  }}

Use these highlightStyle colors:
- "clarity" → "#bae6fd"
- "focus" → "#fef9c3"
- "flow" → "#fdba74"

IMPORTANT STYLE GUIDELINES:
- Avoid second-person phrasing (don't address "you" or the writer directly)
- Maintain a neutral, respectful tone that treats all issues as opportunities to improve
- Use conditional, suggestive language: "This section could be clearer if...", "Consider clarifying...", etc.
- Use varied openings in your explanation: "This phrasing introduces...", "Readers might miss the connection between...", "The argument here would be stronger if..."

OUTPUT FORMAT:
Return a JSON array like:
[
  {{
    "title": "Short descriptive title",
    "issueType": "clarity",
    "highlightedText": "exact quote",
    "highlightStyle": "#bae6fd",
            "suggestedEdit": {{
      "original": "text...",
      "suggested": "revised text...",
      "explanation": "The original phrasing introduces [what it's trying to do] but fails to [issue]. This affects the reader by [impact]. <b>Clarifying or restructuring this idea</b> helps connect it more clearly to surrounding ideas.",
            "references": [
                {{
          "allusion": "connection between activities",
          "referenceText": "searching for solutions in these creative places floods back when I work on research..."
                }}
                ]
            }}
        }}
        ]
        """

        response = client.chat.completions.create(
            model=AZURE_DEPLOYMENT,
            messages=[{"role": "system", "content": context_prompt}],
            max_tokens=3000,
            temperature=0.5
        )

        result = response.choices[0].message.content.strip()
        print(f"Raw result from OpenAI: {result[:500]}...")

        import re
        json_match = re.search(r'(\[{.*}\])', result.replace('\n', ''))
        if json_match:
            extracted_json = json_match.group(1)
            comments = json.loads(extracted_json)
        else:
            comments = json.loads(result)
        
        if isinstance(comments, dict):
            comments = [comments]
            
        # postprocess and validation logic continues...

        return comments

    except Exception as e:
        print(f"Error in analyze_text_with_context: {str(e)}")
        raise DocumentProcessingError(f"Failed to analyze document: {str(e)}")
    
def analyze_lexical_cohesion_simple(content: str) -> List[Dict]:
    """
    Analyze lexical cohesion using a simple, reliable parsing format.
    
    Args:
        content: The text content to analyze for lexical cohesion
        
    Returns:
        List of flow highlights with connection strength scores
        
    Raises:
        Exception: If analysis fails (caller should handle gracefully)
    """
    try:
        # Create a simple, focused prompt for lexical cohesion
        cohesion_prompt = f"""
Analyze the lexical cohesion of EVERY sentence in this document. You must analyze all sentences without exception.

Rate each sentence 0.0-1.0 based on:
- Shared vocabulary with other sentences
- Thematic consistency with main ideas
- Semantic relationships and word families
- Referential connections (pronouns, repeated concepts)

NEW SCORING GUIDE (no zero/no-highlighting range):
- 0.8-1.0: Strong cohesion (central themes, key vocabulary, main concepts)
- 0.4-0.7: Moderate cohesion (supporting ideas, some vocabulary overlap)
- 0.0-0.3: Weak cohesion (peripheral content, limited connections)

IMPORTANT: Every sentence must receive a score. No sentence should be skipped.

Text to analyze:
{content}

CRITICAL: Return one line per sentence in this exact format:
sentence_text|score|brief_reason

Example:
The main argument focuses on climate policy.|0.9|central thesis with key vocabulary
However, supporting evidence is also important.|0.6|supporting detail with thematic connection
This peripheral detail adds context.|0.2|limited connection to main themes

ANALYZE EVERY SENTENCE - do not skip any sentences. Return only the sentence analyses, no other text.
"""

        # Make the API call with increased token limit for complete coverage
        response = client.chat.completions.create(
            model=AZURE_DEPLOYMENT,
            messages=[
                {
                    "role": "system", 
                    "content": cohesion_prompt
                }
            ],
            max_tokens=2000,  # Increased from 1000 to ensure complete analysis
            temperature=0.2  # Low temperature for consistent analysis
        )
        
        # Get the response content
        response_text = response.choices[0].message.content.strip()
        
        # Parse the simple pipe-delimited format
        flow_highlights = []
        lines = response_text.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line or '|' not in line:
                continue
                
            try:
                # Split on pipe and extract components
                parts = line.split('|', 2)  # Split on first 2 pipes only
                if len(parts) >= 3:
                    sentence_text = parts[0].strip()
                    score_str = parts[1].strip()
                    reason = parts[2].strip()
                    
                    # Convert score to float
                    connection_strength = float(score_str)
                    
                    # Clamp score between 0.0 and 1.0
                    connection_strength = max(0.0, min(1.0, connection_strength))
                    
                    # Add to flow highlights
                    flow_highlights.append({
                        "text": sentence_text,
                        "connectionStrength": connection_strength,
                        "reason": reason
                    })
                    
            except (ValueError, IndexError) as e:
                # Skip malformed lines but continue processing
                print(f"Skipping malformed line: {line} - Error: {e}")
                continue
        
        return flow_highlights
        
    except Exception as e:
        print(f"Error in lexical cohesion analysis: {e}")
        raise  # Let caller handle the fallback

def generate_flow_highlights(content: str, flow_prompt: str) -> List[Dict]:
    """
    Generate flow highlights based on lexical cohesion analysis.
    Uses AI-powered analysis with fallback to mock implementation.
    """
    if not flow_prompt:
        return []
    
    try:
        # Try AI-powered lexical cohesion analysis
        print("🤖 Attempting AI-powered lexical cohesion analysis...")
        ai_highlights = analyze_lexical_cohesion_simple(content)
        
        if ai_highlights:
            print(f"✅ AI analysis successful: {len(ai_highlights)} highlights generated")
            return ai_highlights
        else:
            print("⚠️ AI analysis returned empty results, falling back to mock")
            raise Exception("Empty AI results")
            
    except Exception as e:
        print(f"❌ AI analysis failed: {e}")
        print("🔄 Falling back to mock keyword system...")
        
        # Fallback to existing mock implementation
        return generate_mock_flow_highlights(content, flow_prompt)

def generate_mock_flow_highlights(content: str, flow_prompt: str) -> List[Dict]:
    """
    Original mock implementation as fallback.
    Updated to cover entire document with new scoring scale.
    """
    # Split content into sentences for basic highlighting
    sentences = content.split('. ')
    flow_highlights = []
    
    # Simple logic based on prompt keywords
    high_keywords = ['important', 'crucial', 'key', 'main', 'primary', 'essential', 'significant']
    medium_keywords = ['supporting', 'argument', 'evidence', 'because', 'therefore', 'however', 'furthermore']
    low_keywords = ['also', 'additionally', 'meanwhile', 'for example', 'such as', 'in other words']
    
    for i, sentence in enumerate(sentences):  # Analyze ALL sentences, not just first 8
        sentence = sentence.strip()
        if not sentence or len(sentence) < 5:  # Skip very short fragments
            continue
            
        # Determine connection strength based on content and keywords using new scale
        connection_strength = 0.2  # Default weak strength (was 0.2, now still in weak range)
        
        # Check for high importance keywords
        if any(keyword in sentence.lower() for keyword in high_keywords):
            connection_strength = 0.9  # Strong cohesion
            reason = f"Strong cohesion: contains key terms like '{[k for k in high_keywords if k in sentence.lower()][0]}'"
        elif any(keyword in sentence.lower() for keyword in medium_keywords):
            connection_strength = 0.6  # Moderate cohesion
            reason = f"Moderate cohesion: contains supporting terms like '{[k for k in medium_keywords if k in sentence.lower()][0]}'"
        elif any(keyword in sentence.lower() for keyword in low_keywords):
            connection_strength = 0.3  # Weak cohesion
            reason = f"Weak cohesion: transitional or example content"
        else:
            # First sentence often important, middle sentences medium, last sentences weak
            if i == 0:
                connection_strength = 0.9  # Strong cohesion
                reason = "Strong cohesion: opening statement"
            elif i <= 2:
                connection_strength = 0.6  # Moderate cohesion
                reason = "Moderate cohesion: early supporting content"
            else:
                connection_strength = 0.3  # Weak cohesion
                reason = "Weak cohesion: later supporting content"
        
        # Remove the no-highlighting logic - every sentence gets highlighted
        
        flow_highlights.append({
            "text": sentence + ('.' if not sentence.endswith('.') else ''),
            "connectionStrength": connection_strength,
            "reason": reason
        })
    
    return flow_highlights

def refresh_feedback(
    original_text: str, 
    current_text: str, 
    original_feedback: str, 
    issue_type: str
) -> str:
    """
    Generate updated feedback based on changes made to the text.
    
    Args:
        original_text: The original text that received feedback
        current_text: The current text after edits
        original_feedback: The original feedback provided
        issue_type: The type of issue (clarity, focus, flow)
        
    Returns:
        Updated feedback text based on the changes
        
    Raises:
        DocumentProcessingError: If processing fails
    """
    try:
        # Create a prompt for the feedback refresh
        prompt = f"""You are an AI writing assistant helping a user improve their writing.

ORIGINAL TEXT (that received feedback):
"{original_text}"

CURRENT TEXT (after user edits):
"{current_text}"

ORIGINAL FEEDBACK (about the original text):
"{original_feedback}"

ISSUE TYPE: {issue_type}

Your task is to analyze if the user's changes have addressed the issues mentioned in the original feedback. Provide updated feedback that:

1. Acknowledges any improvements made
2. Indicates if the original issues have been resolved
3. Offers further suggestions if issues remain
4. Maintains a professional, constructive tone

Guidelines:
- If the text hasn't changed, simply note that no changes have been made
- If the text has completely addressed the issues, offer positive reinforcement
- If issues remain, be specific about what still needs improvement
- Keep your feedback concise (2-3 sentences maximum)
- Focus on the specific issue type: {issue_type}
- For action recommendations in your explanation, use HTML bold tags by wrapping the text like this: <b>action recommendation</b>. For example: "The current phrasing lacks clarity. <b>Try using more specific terminology</b> to help readers better understand your point."

Format your response as:
1. Your feedback text (with HTML bold tags for action recommendations)
2. A list of references in this format:
   REFERENCES:
   - text: "part of your feedback that refers to the text"
     referenceText: "actual text from the document being referenced"

For example:
"The transition between methodology and results has improved significantly, providing a clearer connection between the two sections. The significance of the patterns is now better articulated, though <b>consider elaborating on why these patterns warrant further investigation</b>."

REFERENCES:
- text: "transition between methodology and results"
  referenceText: "The methodology section outlines our approach. The results demonstrate several key findings"
- text: "significance of the patterns"
  referenceText: "the data reveals compelling patterns that warrant further investigation"
"""

        # Make OpenAI API call
        response = client.chat.completions.create(
            model=AZURE_DEPLOYMENT,
            messages=[
                {
                    "role": "system",
                    "content": prompt
                }
            ],
            max_tokens=500,
            temperature=0.3  # Lower temperature for more consistent analysis
        )
        
        # Extract the feedback text and references
        full_response = response.choices[0].message.content.strip()
        
        # Split into feedback and references
        parts = full_response.split("REFERENCES:", 1)
        feedback_text = parts[0].strip().strip('"')  # Remove any quotes
        references_part = parts[1].strip() if len(parts) > 1 else ""
        
        # Parse references
        references = []
        if references_part:
            # Split by reference entries
            ref_entries = references_part.split("- text:")
            for entry in ref_entries[1:]:  # Skip first empty entry
                try:
                    # Extract text and referenceText
                    text_match = entry.split('referenceText:')[0].strip()
                    ref_match = entry.split('referenceText:')[1].strip()
                    
                    # Clean up quotes
                    text = text_match.strip('"')
                    ref_text = ref_match.strip('"')
                    # Find position in feedback text
                    start_pos = feedback_text.lower().find(text.lower())
                    if start_pos != -1:
                        # Get the actual text from the feedback (preserve case)
                        actual_text = feedback_text[start_pos:start_pos + len(text)]
                        references.append({
                            "text": actual_text,
                            "referenceText": ref_text,
                            "position": {
                                "start": start_pos,
                                "end": start_pos + len(text)
                            }
                        })
                except:
                    continue
        
        return feedback_text, references
        
    except Exception as e:
        raise DocumentProcessingError(f"Failed to refresh feedback: {str(e)}")

@app.route("/api/refresh-feedback", methods=["POST"])
def refresh_feedback_endpoint():
    """
    API endpoint to refresh feedback based on edited text.
    
    Expected JSON body:
    {
        "originalText": string,     // The original text that received feedback
        "currentText": string,      // The current text after edits
        "originalFeedback": string, // The original feedback provided
        "issueType": string         // The type of issue (clarity, focus, flow)
    }
    
    Returns:
        JSON response with updated feedback or error message
    """
    try:
        data = request.get_json()
        if not data or 'originalText' not in data or 'currentText' not in data or 'originalFeedback' not in data:
            return jsonify({
                "error": "Missing required fields",
                "code": "MISSING_FIELDS"
            }), 400

        original_text = data['originalText'].strip()
        current_text = data['currentText'].strip()
        original_feedback = data['originalFeedback'].strip()
        issue_type = data.get('issueType', 'clarity')  # Default to clarity if not specified

        # Call the refresh feedback function
        updated_feedback, references = refresh_feedback(
            original_text, 
            current_text,
            original_feedback,
            issue_type
        )
        
        return jsonify({
            "success": True,
            "data": {
                "updatedFeedback": updated_feedback,
                "references": references
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
                "content": """You are a helpful writing assistant focused on providing guidance for document improvement. Answer questions about writing techniques, suggest improvements, and offer explanations for coherence and cohesion issues, which we categorize using the labels of clarity, focus, and flow."""
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
            model=AZURE_DEPLOYMENT,
            messages=messages,
            max_tokens=1000,
            temperature=0.7  # Slightly higher temperature for more creative responses
        )
        
        # Extract and return the response text
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        raise DocumentProcessingError(f"Failed to process chat message: {str(e)}")

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
        "targetType": "flow" | "clarity" | "focus" | "all"
    }
    
    Returns:
        JSON response with targeted analysis or error message
    """
    try:
        data = request.get_json()
        if not data or 'content' not in data or 'fullContext' not in data or 'targetType' not in data:
            return jsonify({
                "error": "Missing required fields",
                "code": "MISSING_FIELDS"
            }), 400

        content = data['content'].strip()
        full_context = data['fullContext'].strip()
        target_type = data['targetType']
        paragraph_topics = data.get('paragraphTopics', {})
        essay_topic = data.get('essayTopic', '')
        flow_prompt = data.get('flowPrompt', '')

        if not content:
            return jsonify({
                "error": "Empty content",
                "code": "EMPTY_CONTENT"
            }), 400
            
        if target_type not in ["flow", "clarity", "focus", "all"]:
            return jsonify({
                "error": "Invalid target type",
                "code": "INVALID_TARGET_TYPE"
            }), 400

        # Analyze the text content with context
        analysis_data = analyze_text_with_context(content, full_context, target_type, paragraph_topics, essay_topic, flow_prompt)

        # Generate flow highlights if flow_prompt is provided
        flow_highlights = generate_flow_highlights(content, flow_prompt)
        
        # Ensure each comment has the required fields for the new UI format
        for comment in analysis_data:
            # Make sure all comments have a title
            if "title" not in comment:
                if "text" in comment:
                    comment["title"] = comment["text"][:50] + ("..." if len(comment["text"]) > 50 else "")
                else:
                    comment["title"] = "Suggested Edit"
            
            # Make sure all comments have an issueType
            if "issueType" not in comment:
                # Determine issue type based on highlight color or default to "clarity"
                if "highlightStyle" in comment:
                    if comment["highlightStyle"] == "#fef9c3":
                        comment["issueType"] = "flow"
                    elif comment["highlightStyle"] == "#c4b5fd":
                        comment["issueType"] = "focus"
                    else:
                        comment["issueType"] = "clarity"
                else:
                    comment["issueType"] = "clarity"
            
            # Standardize issueType to match our badge categories
            issue_type_mapping = {
                # Map all possible values from API responses to our standard badge types
                "coherence": "coherence",
                "logic": "coherence",
                "theme": "coherence",
                "consistency": "focus",
                "purpose": "coherence",
                "alignment": "coherence",
                "argument": "coherence",
                "evidence": "coherence",
                "tangent": "focus",
                "clarity": "clarity",
                "focus": "focus",
                "flow": "flow",
                "cohesion": "flow",
                "transition": "flow",
                "connection": "flow",
                "organization": "focus",
                "structure": "flow"
            }
            
            # Standardize to one of our badge types or keep as is if unknown
            if comment["issueType"] in issue_type_mapping:
                comment["issueType"] = issue_type_mapping[comment["issueType"]]
            
            # Ensure suggestedEdit has explanation field
            if "suggestedEdit" in comment and "explanation" not in comment["suggestedEdit"]:
                if "text" in comment:
                    comment["suggestedEdit"]["explanation"] = comment["text"]
                else:
                    comment["suggestedEdit"]["explanation"] = "This edit improves the text."

        return jsonify({
            "success": True,
            "data": {
                "comments": analysis_data,
                "flowHighlights": flow_highlights
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
    
def regenerate_suggestion(
    original_text: str, 
    current_text: str, 
    issue_type: str,
    original_explanation: str = ""
) -> dict:
    """
    Generate a new suggestion for improving text based on the issue type.
    
    Args:
        original_text: The original text that received feedback
        current_text: The current text after edits (if any)
        issue_type: The type of issue (clarity, focus, flow)
        original_explanation: The original explanation to preserve
        
    Returns:
        Dict with the suggested edit
        
    Raises:
        DocumentProcessingError: If processing fails
    """
    try:
        # Use the text that's currently in the editor
        text_to_improve = current_text
        
        # Create a prompt for generating a new suggestion
        prompt = f"""You are an AI writing assistant helping a user improve their writing.

TEXT TO IMPROVE:
"{text_to_improve}"

ISSUE TYPE: {issue_type}

Generate a new suggestion to improve this text based on the issue type. The user has requested a fresh perspective on how to improve their writing.

Guidelines:
- Consider whether, compared to the original text, if the current text resolves {issue_type} issue
- Based on the original issue, {original_explanation}, offer a suggested paraphrase or edit
- Provide feedback on whether the change satisfies the {issue_type} issue
- For action recommendations in your explanation, use HTML bold tags by wrapping the text like this: <b>action recommendation</b>. For example: "The current phrasing lacks clarity. <b>Try using more specific terminology</b> to help readers better understand your point."

Format your response as:
1. Your feedback text (with HTML bold tags for action recommendations)
2. A list of references in this format:
   REFERENCES:
   - text: "part of your feedback that refers to the text"
     referenceText: "actual text from the document being referenced"

For example:
"The transition between methodology and results has improved significantly, providing a clearer connection between the two sections. The significance of the patterns is now better articulated, though <b>consider elaborating on why these patterns warrant further investigation</b>."

REFERENCES:
- text: "transition between methodology and results"
  referenceText: "The methodology section outlines our approach. The results demonstrate several key findings"
- text: "significance of the patterns"
  referenceText: "the data reveals compelling patterns that warrant further investigation"
"""

        # Make OpenAI API call
        response = client.chat.completions.create(
            model=AZURE_DEPLOYMENT,
            messages=[
                {
                    "role": "system",
                    "content": prompt
                }
            ],
            max_tokens=800,
            temperature=0.7  # Slightly higher temperature for creative suggestions
        )
        
        # Extract the suggested text and references
        full_response = response.choices[0].message.content.strip()
        
        # Split into suggestion and references
        parts = full_response.split("REFERENCES:", 1)
        suggestion_part = parts[0].strip()
        references_part = parts[1].strip() if len(parts) > 1 else ""
        
        # Parse references and find their positions in the suggestion text
        references = []
        if references_part:
            # Split by reference entries
            ref_entries = references_part.split("- text:")
            for entry in ref_entries[1:]:  # Skip first empty entry
                try:
                    # Extract text and referenceText
                    text_match = entry.split('referenceText:')[0].strip()
                    ref_match = entry.split('referenceText:')[1].strip()
                    
                    # Clean up quotes
                    text = text_match.strip('"')
                    ref_text = ref_match.strip('"')
                    
                    # Find position in suggestion text
                    start_pos = suggestion_part.find(text)
                    if start_pos != -1:
                        references.append({
                            "text": text,
                            "referenceText": ref_text,
                            "position": {
                                "start": start_pos,
                                "end": start_pos + len(text)
                            }
                        })
                except:
                    continue
        
        # Keep the original explanation if provided, otherwise use a generic one
        explanation = original_explanation
        if not explanation:
            explanation = f"This suggestion aims to improve the text's {issue_type}."
                
        return {
            "original": original_text,
            "suggested": suggestion_part,
            "explanation": explanation,
            "references": references
        }
        
    except Exception as e:
        raise DocumentProcessingError(f"Failed to regenerate suggestion: {str(e)}")

@app.route("/api/regenerate-suggestion", methods=["POST"])
def regenerate_suggestion_endpoint():
    """
    API endpoint to regenerate a suggestion for text improvement.
    
    Expected JSON body:
    {
        "originalText": string,     // The original text that received feedback
        "currentText": string,      // The current text after edits (if any)
        "issueType": string,        // The type of issue (clarity, focus, flow)
        "originalExplanation": string // The original explanation to preserve
    }
    
    Returns:
        JSON response with the new suggestion or error message
    """
    try:
        data = request.get_json()
        if not data or 'originalText' not in data or 'currentText' not in data:
            return jsonify({
                "error": "Missing required fields",
                "code": "MISSING_FIELDS"
            }), 400

        original_text = data['originalText'].strip()
        current_text = data['currentText'].strip()
        issue_type = data.get('issueType', 'clarity')  # Default to clarity if not specified
        original_explanation = data.get('originalExplanation', '')  # Get original explanation if provided

        # Call the regenerate suggestion function
        new_suggestion = regenerate_suggestion(
            original_text, 
            current_text,
            issue_type,
            original_explanation
        )
        
        return jsonify({
            "success": True,
            "data": {
                "suggestedEdit": new_suggestion
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
    
# @app.route("/api/segment-texts", methods=["POST"])
# def segment_texts_endpoint():
    """
    API endpoint to segment and align original and suggested text using NLP.
    
    Expected JSON body:
    {
        "original": string,    // The original text
        "suggested": string    // The suggested/edited text
    }
    
    Returns:
        JSON response with segments that align corresponding parts
    """
    try:
        data = request.get_json()
        if not data or 'original' not in data or 'suggested' not in data:
            return jsonify({
                "error": "Missing required fields: 'original' and 'suggested'",
                "code": "MISSING_FIELDS"
            }), 400

        original = data['original'].strip()
        suggested = data['suggested'].strip()

        if not original or not suggested:
            return jsonify({
                "error": "Empty text content",
                "code": "EMPTY_CONTENT"
            }), 400

        # Use the text segmentation module to segment and align the texts
        segments = segment_texts(original, suggested)
        
        return jsonify({
            "success": True,
            "segments": segments,
            "processedAt": datetime.utcnow().isoformat()
        })

    except Exception as e:
        return jsonify({
            "error": "An error occurred while segmenting text",
            "code": "SEGMENTATION_ERROR",
            "detail": str(e)
        }), 500
    
    
# @app.route("/api/segment-nlp-texts", methods=["POST"])
# def api_segment_texts():
#     """
#     API endpoint to segment and align original and suggested text using NLP.
    
#     Expected JSON body:
#     {
#         "original": string,    // The original text
#         "suggested": string    // The suggested/edited text
#     }
    
#     Returns:
#         JSON response with segments that align corresponding parts
#     """
#     try:
#         data = request.get_json()
#         if not data or 'original' not in data or 'suggested' not in data:
#             return jsonify({
#                 "error": "Missing required fields: 'original' and 'suggested'",
#                 "code": "MISSING_FIELDS"
#             }), 400

#         original = data['original'].strip()
#         suggested = data['suggested'].strip()

#         if not original or not suggested:
#             return jsonify({
#                 "error": "Empty text content",
#                 "code": "EMPTY_CONTENT"
#             }), 400

#         # Use the text segmentation module to segment and align the texts
#         segments = segment_texts(original, suggested)
        
#         return jsonify({
#             "success": True,
#             "segments": segments,
#             "processedAt": datetime.utcnow().isoformat()
#         })

#     except Exception as e:
#         return jsonify({
#             "error": "An error occurred while segmenting text",
#             "code": "SEGMENTATION_ERROR",
#             "detail": str(e)
#         }), 500

@app.route("/api/custom-prompt", methods=["POST"])
def custom_prompt_endpoint():
    """
    API endpoint to process a custom prompt for text improvement.
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

    except Exception as e:
        print(f"Error in custom prompt: {str(e)}")
        return jsonify({
            "error": str(e),
            "code": "INTERNAL_ERROR",
            "detail": str(e)
        }), 500

def process_custom_prompt(
    selected_text: str,
    prompt: str,
    full_context: str = None
) -> dict:
    """
    Process a custom prompt for text improvement.
    
    Args:
        selected_text: The text selected by the user
        prompt: The user's custom prompt
        full_context: Optional full document for context
        
    Returns:
        Dict with the suggested edit and response
        
    Raises:
        DocumentProcessingError: If processing fails
    """
    try:
        # Create a prompt for the custom request
        system_prompt = f"""You are an AI writing assistant helping a user improve their writing.

USER'S SELECTED TEXT:
"{selected_text}"

USER'S PROMPT:
"{prompt}"

Your task is to analyze the selected text in light of the user's prompt and provide:

A clear and specific explanation that responds directly to the user's request

A revised version of the selected text that improves it based on your explanation

GUIDELINES:

Make your explanation specific to what the selected text is trying to do within its context. Focus on how well it achieves that and what is missing or unclear.

Avoid generic statements. Always reference what the sentence is trying to convey or accomplish.

Do not refer to grammar, clarity, or structure as isolated categories—always connect your feedback to the text's ideas or purpose.

Maintain a respectful and professional tone, focused on improving the reader's experience.

Keep your explanation brief (2–4 sentences) and use straightforward language.

Your improvement should maintain the original tone and meaning while addressing the user's request.

If the user's prompt is vague, default to improving clarity, focus, or flow.

If the user's prompt is unrelated to writing feedback or text improvement, respond with "I'm sorry, I can only help with writing feedback and text improvement."

FORMAT YOUR RESPONSE AS:

First, provide a concise explanation that addresses the user's prompt. Do not include any extra formatting, labels, or bullet points.

Second, provide only the improved version of the selected text. Do not include any extra text or formatting.
"""

        # Add full context if provided
        if full_context:
            system_prompt += f"\n\nFULL DOCUMENT CONTEXT:\n{full_context}\n"
            system_prompt += "\nConsider this context when providing your response, but focus primarily on improving the selected text."

        # Make OpenAI API call
        response = client.chat.completions.create(
            model=AZURE_DEPLOYMENT,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                }
            ],
            max_tokens=1000,
            temperature=0.7  # Slightly higher temperature for creative suggestions
        )
        
        # Extract the response text
        full_response = response.choices[0].message.content.strip()
        
        # Split into explanation and suggested text
        # This is a simple approach; you may want to use more sophisticated parsing
        parts = full_response.split("\n\n", 1)
        
        explanation = parts[0]
        suggested_text = parts[1] if len(parts) > 1 else selected_text
        
        # Clean up the suggested text (remove quotes if present)
        if suggested_text.startswith('"') and suggested_text.endswith('"'):
            suggested_text = suggested_text[1:-1]
        
        return {
            "response": explanation,
            "suggestedText": suggested_text
        }
        
    except Exception as e:
        raise DocumentProcessingError(f"Failed to process custom prompt: {str(e)}")

def analyze_sentence_connection(sentence: str, document: str, strength: float, paragraph_topic: str = None, essay_topic: str = None) -> str:
    """
    Generate a brief explanation of how a sentence connects to the document through lexical cohesion.
    
    Args:
        sentence: The specific sentence to analyze
        document: The full document context
        strength: The connection strength score (0.0-1.0)
        paragraph_topic: Optional paragraph topic sentence
        essay_topic: Optional essay topic/thesis statement
        
    Returns:
        Brief explanation of the lexical cohesion connections
        
    Raises:
        Exception: If analysis fails
    """
    try:
        # Build topic context conditionally
        topic_context = ""
        if essay_topic:
            topic_context += f"\nESSAY TOPIC: \"{essay_topic}\""
        else:
            topic_context += f"\nESSAY TOPIC: [Not specified]"
            
        if paragraph_topic:
            topic_context += f"\nPARAGRAPH TOPIC: \"{paragraph_topic}\""
        else:
            topic_context += f"\nPARAGRAPH TOPIC: [Not specified]"

        # Create a focused prompt for connection explanation
        connection_prompt = f"""
TASK
Explain in 1–2 short sentences how this sentence connects to the document through lexical and thematic cohesion.

INPUTS

SENTENCE TO ANALYZE: "{sentence}"
{topic_context}

CONNECTION STRENGTH: {strength}

DOCUMENT CONTEXT: {document}

INSTRUCTIONS
Provide a concise explanation of how the sentence connects (or doesn't) to the surrounding document using lexical and thematic elements. Start the explanation with 2–3 lowercase keywords that summarize the connection type. These keywords should reflect the strength and nature of the connection in a professional, student-friendly tone.

{"Strong connections: use keywords like well-integrated, reinforces theme, supports argument, consistent wording, clear connection, builds on ideas" if strength >= 0.7 else ""}
{"Moderate connections: use keywords like partial overlap, loosely related, general alignment, somewhat relevant, idea shift" if 0.3 <= strength < 0.7 else ""}
{"Weak or unclear connections: use keywords like unclear link, vague reference, disconnected idea, off-topic drift, limited cohesion" if strength < 0.3 else ""}

GUIDELINES
- Be specific and concise (under 20 words total).
- Do not define the keywords — just prepend them.
- Focus on how the sentence connects in terms of:
  * Shared vocabulary or word families
  * Thematic alignment with {"essay/paragraph topics" if essay_topic or paragraph_topic else "document themes"}
  * Repetition of ideas or phrasing
  * Logical progression or argument structure
- If strength < 0.8, the explanation should reflect the weaker cohesion more critically, while remaining respectful and constructive.
{"- Reference the essay topic when analyzing thematic alignment." if essay_topic else ""}
{"- Consider the paragraph topic when evaluating local coherence." if paragraph_topic else ""}

FORMAT
Write a single sentence that begins with the 2–3 keywords, followed by a short explanation (no labels, no extra formatting).
For example:
partial overlap, vague reference — introduces a new concept without clearly linking to earlier ideas about community impact.
"""

        # Make the API call
        response = client.chat.completions.create(
            model=AZURE_DEPLOYMENT,
            messages=[
                {
                    "role": "system",
                    "content": connection_prompt
                }
            ],
            max_tokens=100,  # Keep it brief
            temperature=0.3  # Low temperature for consistent analysis
        )
        
        # Get the response content and clean it up
        explanation = response.choices[0].message.content.strip()
        
        # Remove quotes if present
        if explanation.startswith('"') and explanation.endswith('"'):
            explanation = explanation[1:-1]
            
        return explanation
        
    except Exception as e:
        print(f"Error in sentence connection analysis: {e}")
        # Return a fallback explanation based on strength
        if strength >= 0.8:
            return "Strong thematic and vocabulary connections"
        elif strength >= 0.4:
            return "Moderate lexical overlap with main themes"
        else:
            return "Weak connection"

@app.route("/api/explain-connection", methods=["POST"])
def explain_connection():
    """
    API endpoint to explain how a specific sentence connects to the document.
    
    Expected JSON body:
    {
        "sentence": string,          // The specific sentence text
        "documentContext": string,   // Full document text  
        "connectionStrength": number // The connection strength score
    }
    
    Returns:
        JSON response with explanation or error message
    """
    try:
        data = request.get_json()
        if not data or 'sentence' not in data or 'documentContext' not in data:
            return jsonify({
                "error": "Missing required fields",
                "code": "MISSING_FIELDS"
            }), 400

        sentence = data['sentence'].strip()
        document_context = data['documentContext'].strip()
        connection_strength = data.get('connectionStrength', 0.5)
        paragraph_topic = data.get('paragraphTopic')  # Optional
        essay_topic = data.get('essayTopic')          # Optional

        if not sentence or not document_context:
            return jsonify({
                "error": "Empty sentence or document context",
                "code": "EMPTY_CONTENT"
            }), 400

        # Generate the connection explanation with optional topics
        explanation = analyze_sentence_connection(
            sentence, 
            document_context, 
            connection_strength,
            paragraph_topic,
            essay_topic
        )
        
        return jsonify({
            "success": True,
            "explanation": explanation,
            "processedAt": datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        print(f"Error in explain connection endpoint: {str(e)}")
        return jsonify({
            "error": "Failed to generate connection explanation",
            "code": "EXPLANATION_ERROR",
            "detail": str(e)
        }), 500

def analyze_sentence_connections(clicked_sentence: str, full_document: str, clicked_sentence_strength: float) -> List[Dict]:
    """
    Analyze how a clicked sentence connects to all other sentences in the document.
    The strength of the clicked sentence influences how many connections are found.
    
    Args:
        clicked_sentence: The sentence that was clicked
        full_document: The complete document text
        clicked_sentence_strength: The connection strength of the clicked sentence (0.0-1.0)
        
    Returns:
        List of connection data with positions and strengths
    """
    try:
        # Split document into sentences with positions
        import re
        
        # Find sentence boundaries (periods, exclamation marks, question marks)
        sentence_pattern = r'[.!?]+\s+'
        sentences = []
        current_pos = 0
        
        # Split by sentence pattern but keep track of positions
        parts = re.split(sentence_pattern, full_document)
        
        for i, part in enumerate(parts):
            if part.strip():  # Skip empty parts
                sentence_text = part.strip()
                if sentence_text:
                    # Find the actual position in the document
                    start_pos = full_document.find(sentence_text, current_pos)
                    if start_pos != -1:
                        end_pos = start_pos + len(sentence_text)
                        
                        # Add punctuation if not the last sentence
                        if i < len(parts) - 1:
                            # Look for punctuation after this sentence
                            remaining_text = full_document[end_pos:end_pos + 3]
                            punct_match = re.match(r'[.!?]+', remaining_text)
                            if punct_match:
                                end_pos += len(punct_match.group())
                                sentence_text += punct_match.group()
                        
                        sentences.append({
                            "text": sentence_text,
                            "position": {"from": start_pos, "to": end_pos}
                        })
                        current_pos = end_pos
        
        # Analyze connections between clicked sentence and all other sentences
        connections = []
        
        # Calculate connection threshold based on clicked sentence strength
        # Higher strength sentences should find more connections
        if clicked_sentence_strength >= 0.8:
            connection_threshold = 0.05  # Very liberal - show almost all connections
        elif clicked_sentence_strength >= 0.5:
            connection_threshold = 0.08  # Moderately liberal
        else:
            connection_threshold = 0.12  # Still less conservative than before
        
        print(f"Using connection threshold: {connection_threshold} (based on clicked strength: {clicked_sentence_strength})")
        
        for sentence_data in sentences:
            sentence_text = sentence_data["text"]
            
            # Skip the clicked sentence itself
            if sentence_text.strip() == clicked_sentence.strip():
                continue
            
            # Calculate base connection strength
            base_strength = calculate_sentence_connection_strength(clicked_sentence, sentence_text)
            
            # Boost connection strength based on clicked sentence's strength
            # Higher strength sentences should have stronger connections to other sentences
            strength_multiplier = 1.0 + (clicked_sentence_strength * 0.5)  # 1.0 to 1.5x multiplier
            boosted_strength = min(base_strength * strength_multiplier, 1.0)
            
            # Only include sentences above the threshold
            if boosted_strength > connection_threshold:
                # Map to fixed highlighting scale: 0.8, 0.5, 0.2
                if boosted_strength >= 0.4:
                    final_strength = 0.8  # Strong connection
                elif boosted_strength >= 0.15:
                    final_strength = 0.5  # Moderate connection  
                else:
                    final_strength = 0.2  # Weak connection
                
                connections.append({
                    "text": sentence_text,
                    "position": sentence_data["position"],
                    "connectionStrength": final_strength,
                    "reason": get_connection_reason(clicked_sentence, sentence_text, final_strength)
                })
        
        print(f"Found {len(connections)} sentence connections")
        return connections
        
    except Exception as e:
        print(f"Error analyzing sentence connections: {e}")
        return []

def calculate_sentence_connection_strength(sentence1: str, sentence2: str) -> float:
    """
    Calculate connection strength between two sentences based on lexical overlap.
    """
    # Simple implementation - can be enhanced with more sophisticated NLP
    words1 = set(word.lower().strip('.,!?;:') for word in sentence1.split())
    words2 = set(word.lower().strip('.,!?;:') for word in sentence2.split())
    
    # Remove common stop words
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'was', 'are', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their'}
    
    words1 = words1 - stop_words
    words2 = words2 - stop_words
    
    if not words1 or not words2:
        return 0.0
    
    # Calculate Jaccard similarity
    intersection = len(words1.intersection(words2))
    union = len(words1.union(words2))
    
    if union == 0:
        return 0.0
    
    jaccard = intersection / union
    
    # Scale to our 0-1 range and add some randomness for demo
    base_strength = min(jaccard * 2, 1.0)  # Scale up jaccard
    
    # Add thematic keywords boost
    thematic_keywords = ['miniature', 'making', 'creative', 'problem', 'solving', 'computational', 'biology', 'research', 'programming']
    thematic_boost = 0
    for keyword in thematic_keywords:
        if keyword in sentence1.lower() and keyword in sentence2.lower():
            thematic_boost += 0.2
    
    final_strength = min(base_strength + thematic_boost, 1.0)
    return round(final_strength, 2)

def get_connection_reason(sentence1: str, sentence2: str, strength: float) -> str:
    """
    Generate a brief reason for the connection strength.
    """
    if strength >= 0.8:
        return "Strong thematic and vocabulary connections"
    elif strength >= 0.5:
        return "Moderate lexical connections"  
    elif strength >= 0.2:
        return "Some vocabulary overlap"
    else:
        return "Weak connection"

def analyze_paragraph_cohesion(sentence: str, document: str, paragraph_topic: str = None) -> dict:
    """
    Analyze how a sentence coheres with its paragraph's main message.
    
    Args:
        sentence: The sentence to analyze
        document: The full document context
        
    Returns:
        Dictionary with cohesion score, analysis, strengths, and weaknesses
    """
    try:
        # Find the paragraph containing this sentence
        paragraphs = document.split('\n\n')
        target_paragraph = None
        
        for paragraph in paragraphs:
            if sentence.strip() in paragraph:
                target_paragraph = paragraph.strip()
                break
        
        if not target_paragraph:
            # If not found in paragraph splits, use the whole document as context
            target_paragraph = document
        
        # Build the input section with optional paragraph topic
        input_section = f"""
        PARAGRAPH: {target_paragraph}
        SENTENCE: {sentence}"""
        
        if paragraph_topic:
            input_section += f"""
        PARAGRAPH TOPIC: {paragraph_topic}"""
        
        prompt = f"""
# Sentence Cohesion Analysis Prompt

        ## Task
        Analyze how well the target sentence contributes to its paragraph's cohesion and main message.

        **Input:**
        ```{input_section}
        ```

        ## Analysis Framework
        Evaluate these aspects:
        1. **Sentence-to-Sentence Relationships**: How does this sentence interact with specific other sentences in the paragraph? Does it build on them, compete with them, or disconnect from them?
        2. **Word and Theme Connections**: What specific words, concepts, or themes from other sentences does this sentence connect to, ignore, or contradict?
        3. **Reader Flow**: How do readers move from the previous sentence to this one, and from this one to the next?
        4. **Progression**: Does this sentence advance, repeat, or disrupt the ideas established by surrounding sentences?{f'''
        5. **Topic Alignment**: How well does this sentence support or relate to the paragraph topic: "{paragraph_topic}"? Does it advance, support, or deviate from this main focus?''' if paragraph_topic else ''}

## Response Guidelines

        ### Tone & Approach
        - Professional and helpful, focusing on specific sentence relationships
        - Show how readers experience transitions between sentences ("Readers move from..." "This shift from...")
        - Point out where sentences build on each other or where they disconnect
        - Frame suggestions as ways to strengthen specific connections between sentences

        ### Content Requirements
        - **Specific Sentence Connections**: Show how the target sentence relates to particular other sentences in the paragraph
        - **Word/Theme Analysis**: Point out specific words or concepts that connect, clash, or are missing between sentences
        - **Context References**: Use brief quotes (3-8 words) from other sentences to show these specific relationships
        - **Concise Analysis**: Limit feedback to exactly 2-3 sentences maximum
        - **Helpful Suggestions**: Frame suggestions as ways to strengthen connections between specific sentences using <b>bold tags</b>

        ### Language Style
        - Use clear, accessible language appropriate for high school level
        - Maintain professional tone without overly complex vocabulary
        - Use conditional/suggestive phrasing ("could be," "might help," "would strengthen")
        - Vary opening phrases beyond "This sentence..." or "The text..."
        - Avoid difficult terminology when simpler words convey the same meaning

        **Score Scale:**
        - 0.9-1.0: Excellent connection, clearly helps the paragraph's purpose
        - 0.7-0.8: Good connection with minor gaps
        - 0.5-0.6: Moderate connection, some unclear relationships
        - 0.3-0.4: Weak connection, limited tie to main message
        - 0.0-0.2: Poor connection, disrupts paragraph flow

        ## Example Analysis Style
        **Good (sentence-to-sentence focus):** "This sentence introduces 'cost-effective alternatives' but doesn't connect to the previous sentence's focus on 'rising emissions despite international agreements.' The word 'alternatives' also shifts away from the opening's emphasis on 'coordinated global action,' suggesting individual choice rather than collective effort. <b>Consider linking how affordability addresses the emission problem or enables the international cooperation mentioned earlier</b>."

**Good (word/theme analysis):** "The sentence shifts from 'international agreements' to economic benefits without bridging these concepts. Both discuss solutions, but the move from political cooperation to market forces could confuse readers about what type of solution is being advocated. <b>Try showing how cost-effectiveness supports the international cooperation mentioned earlier</b>."

        **Good (competing themes):** "This sentence emphasizes individual technology benefits while surrounding sentences focus on collective action ('coordinated global action,' 'international agreements'). <b>Consider showing how affordability makes global coordination more feasible</b>."
        
        {f'''**Good (topic alignment):** "This sentence discusses cost reduction but doesn't clearly connect to the paragraph topic '{paragraph_topic}.' While cost is mentioned, the connection to the main focus isn't explicit. <b>Consider showing how cost reduction specifically supports {paragraph_topic[:30]}{'...' if len(paragraph_topic) > 30 else ''}</b>."''' if paragraph_topic else ''}

    **Avoid:** "This sentence is unclear and doesn't connect properly. Fix the transitions and make it more specific."

Format your response as JSON:
{{
    "score": 0.8,
    "analysis": "Brief analysis here"
}}
"""

        # Call Azure OpenAI
        try:
            client = AzureOpenAI(
                api_key=AZURE_OPENAI_KEY,
                api_version="2024-02-01",
                azure_endpoint=AZURE_OPENAI_ENDPOINT
            )

            response = client.chat.completions.create(
                model=AZURE_DEPLOYMENT,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=500,
                temperature=0.3
            )

            result_text = response.choices[0].message.content.strip()
            
            # Clean markdown code blocks if present
            if result_text.startswith('```json'):
                result_text = result_text.replace('```json', '').replace('```', '').strip()
            elif result_text.startswith('```'):
                result_text = result_text.replace('```', '').strip()
            
            # Try to parse as JSON
            result = json.loads(result_text)
            
            # Validate and set defaults
            return {
                "score": float(result.get("score", 0.5)),
                "analysis": result.get("analysis", "Unable to analyze paragraph cohesion."),
            }
            
        except json.JSONDecodeError:
            print(f"Failed to parse paragraph cohesion JSON: {result_text}")
            return {
                "score": 0.5,
                "analysis": "Unable to analyze paragraph cohesion due to parsing error."
            }
        except Exception as e:
            print(f"Error calling Azure OpenAI for paragraph cohesion: {e}")
            return {
                "score": 0.5,
                "analysis": "Unable to analyze paragraph cohesion due to API error."
            }
            
    except Exception as e:
        print(f"Error in analyze_paragraph_cohesion: {e}")
        return {
            "score": 0.5,
            "analysis": "Unable to analyze paragraph cohesion."
        }

def analyze_document_cohesion(sentence: str, document: str) -> dict:
    """
    Analyze how a sentence coheres with the document's main message.
    
    Args:
        sentence: The sentence to analyze
        document: The full document context
        
    Returns:
        Dictionary with cohesion score, analysis, strengths, and weaknesses
    """
    try:
        prompt = f"""
# Document Cohesion Analysis Prompt

## Task
Analyze how well the target sentence contributes to the overall document's cohesion and main message.

**Input:**
```
FULL DOCUMENT: {document}
SENTENCE: {sentence}
```

## Analysis Framework
Evaluate these aspects:
1. **Thesis/Argument Connections**: How does this sentence relate to specific arguments, claims, or themes from other parts of the document?
2. **Vocabulary and Concept Links**: What specific words, phrases, or concepts from this sentence connect to, build on, or clash with other sections?
3. **Document Progression**: Does this sentence advance the document's overall argument or repeat/contradict points made elsewhere?
4. **Reader Understanding**: How does this sentence help or hinder readers following the document's main message?

## Response Guidelines

### Tone & Approach
- Professional and helpful, focusing on specific document relationships
- Show how the sentence connects to or disconnects from other parts of the document
- Point out where the sentence builds on earlier ideas or where it conflicts with them
- Frame suggestions as ways to strengthen specific connections within the document

### Content Requirements
- **Specific Document Connections**: Show how the target sentence relates to particular other sections, arguments, or themes in the document
- **Word/Concept Analysis**: Point out specific words or concepts that connect, clash, or are missing between this sentence and other parts
- **Context References**: Use brief quotes (3-8 words) from other parts of the document to show these specific relationships
- **Concise Analysis**: Limit feedback to exactly 2 sentences maximum
- **Helpful Suggestions**: Frame suggestions as ways to strengthen connections within the overall document using <b>bold tags</b>

### Language Style
- Use clear, accessible language appropriate for high school level
- Maintain professional tone without overly complex vocabulary
- Use conditional/suggestive phrasing ("could strengthen," "might connect," "would help")
- Avoid difficult terminology when simpler words convey the same meaning

**Score Scale:**
- 0.9-1.0: Excellent connection, clearly advances document's main message
- 0.7-0.8: Good connection with minor gaps in supporting the overall argument
- 0.5-0.6: Moderate connection, some unclear relationships to document themes
- 0.3-0.4: Weak connection, limited tie to main arguments or thesis
- 0.0-0.2: Poor connection, disrupts or contradicts document's main message

## Example Analysis Style
**Good (document-specific connections):** "This sentence introduces economic concerns but doesn't build on the environmental focus established in the opening paragraphs ('urgent climate action'). The shift to cost considerations contradicts the earlier emphasis on 'moral responsibility' without showing how these perspectives connect. <b>Consider linking economic factors to the environmental arguments or establishing this as a counterpoint to address</b>."

**Good (vocabulary/concept analysis):** "The sentence uses 'individual responsibility' while the document's conclusion emphasizes 'collective action' and 'systemic change.' This creates competing themes that could confuse readers about the document's main stance. <b>Try aligning the responsibility framework with the collective approach established elsewhere</b>."

**Good (progression analysis):** "This sentence repeats the same statistical data mentioned in paragraph two ('75% increase') without advancing the argument or providing new insights. <b>Consider how this information builds on or complicates the earlier discussion</b>."

**Avoid:** "This sentence doesn't fit well with the document. It should be more connected to the main idea."

Format your response as JSON:
{{
    "score": 0.7,
    "analysis": "Brief analysis here"
}}

"""

        # Call Azure OpenAI
        try:
            client = AzureOpenAI(
                api_key=AZURE_OPENAI_KEY,
                api_version="2024-02-01",
                azure_endpoint=AZURE_OPENAI_ENDPOINT
            )

            response = client.chat.completions.create(
                model=AZURE_DEPLOYMENT,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=500,
                temperature=0.3
            )

            result_text = response.choices[0].message.content.strip()
            
            # Clean markdown code blocks if present
            if result_text.startswith('```json'):
                result_text = result_text.replace('```json', '').replace('```', '').strip()
            elif result_text.startswith('```'):
                result_text = result_text.replace('```', '').strip()
            
            # Try to parse as JSON
            result = json.loads(result_text)
            
            # Validate and set defaults
            return {
                "score": float(result.get("score", 0.5)),
                "analysis": result.get("analysis", "Unable to analyze document cohesion.")
            }
            
        except json.JSONDecodeError:
            print(f"Failed to parse document cohesion JSON: {result_text}")
            return {
                "score": 0.5,
                "analysis": "Unable to analyze document cohesion due to parsing error."
            }
        except Exception as e:
            print(f"Error calling Azure OpenAI for document cohesion: {e}")
            return {
                "score": 0.5,
                "analysis": "Unable to analyze document cohesion due to API error."
            }
            
    except Exception as e:
        print(f"Error in analyze_document_cohesion: {e}")
        return {
            "score": 0.5,
            "analysis": "Unable to analyze document cohesion."
        }

@app.route("/api/analyze-sentence-flow", methods=["POST"])
def analyze_sentence_flow():
    """
    API endpoint to analyze sentence flow in the context of a document.
    
    Expected JSON body:
    {
        "sentence": string,    // The sentence to analyze
        "document": string,    // The full document context
        "prompt": string       // Analysis prompt
    }
    
    Returns:
        JSON response with flow analysis result
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        sentence = data.get('sentence', '').strip()
        document = data.get('document', '').strip()
        prompt = data.get('prompt', '').strip()
        paragraph_topic = data.get('paragraphTopic', '').strip()  # Get paragraph topic if provided
        
        print(f"📝 Sentence Flow Analysis Request:")
        print(f"   Sentence: {sentence[:50]}...")
        print(f"   Document length: {len(document)} chars")
        print(f"   Prompt: {prompt}")
        print(f"   Paragraph Topic: {paragraph_topic[:50] if paragraph_topic else 'None'}...")
        
        # First, we need to get the strength of the clicked sentence
        # We'll do this by running our flow analysis on the document and finding the clicked sentence
        try:
            flow_highlights = generate_flow_highlights(document, "Analyze lexical cohesion")
            clicked_sentence_strength = 0.5  # Default strength
            
            # Find the clicked sentence in the flow highlights
            for highlight in flow_highlights:
                if highlight.get('text', '').strip() == sentence.strip():
                    clicked_sentence_strength = highlight.get('connectionStrength', 0.5)
                    print(f"📊 Found clicked sentence strength: {clicked_sentence_strength}")
                    break
            
            if clicked_sentence_strength == 0.5:
                print(f"⚠️ Using default strength (0.5) - clicked sentence not found in flow highlights")
        except Exception as e:
            print(f"⚠️ Error getting sentence strength, using default: {e}")
            clicked_sentence_strength = 0.5
        
        # Analyze sentence connections with the clicked sentence's strength
        connections = analyze_sentence_connections(sentence, document, clicked_sentence_strength)
        
        print(f"✅ Found {len(connections)} sentence connections")
        for conn in connections[:3]:  # Log first few for debugging
            print(f"   - {conn['text'][:30]}... (strength: {conn['connectionStrength']})")
        
        # Analyze paragraph and document cohesion
        print(f"🔍 Analyzing paragraph cohesion for sentence...")
        paragraph_cohesion = analyze_paragraph_cohesion(sentence, document, paragraph_topic)
        
        print(f"🔍 Analyzing document cohesion for sentence...")
        document_cohesion = analyze_document_cohesion(sentence, document)
        
        print(f"✅ Cohesion analysis complete:")
        print(f"   Paragraph score: {paragraph_cohesion.get('score', 'N/A')}")
        print(f"   Document score: {document_cohesion.get('score', 'N/A')}")
        
        return jsonify({
            'result': connections,
            'paragraphCohesion': paragraph_cohesion,
            'documentCohesion': document_cohesion
        })
        
    except Exception as e:
        print(f"❌ Error in analyze_sentence_flow: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Add frontend route handler if needed
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    """
    Serve frontend static files if configured
    """
    static_folder = os.getenv('STATIC_FOLDER', '../client/dist')
    if path and os.path.exists(os.path.join(static_folder, path)):
        return send_from_directory(static_folder, path)
    return send_from_directory(static_folder, 'index.html')

if __name__ == "__main__":
    # Validate configuration before starting
    if not AZURE_OPENAI_KEY:
        print("ERROR: AZURE_OPENAI_KEY not set in .env file!")
    else:
        app.run(host='127.0.0.1', port=5000, debug=True)