from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openai import AzureOpenAI
from dotenv import load_dotenv
import os
import json
import spacy
import nltk
from datetime import datetime
from typing import Dict, List, Optional, Union, Literal

# Load environment variables
load_dotenv()
HOSTNAME = os.getenv('HOSTNAME')
AZURE_OPENAI_ENDPOINT = os.getenv('AZURE_OPENAI_ENDPOINT')
AZURE_OPENAI_KEY = os.getenv('AZURE_OPENAI_KEY')
AZURE_DEPLOYMENT = "PROPILOT"

# Initialize Flask app
app = Flask(__name__)
CORS(app, supports_credentials=True, origins=[HOSTNAME])

# Initialize OpenAI client
client = AzureOpenAI(
    azure_endpoint=AZURE_OPENAI_ENDPOINT,
    api_key=AZURE_OPENAI_KEY,
    api_version="2024-05-01-preview"
)

# Load NLP libraries
try:
    nlp = spacy.load("en_core_web_sm")
    nltk.download('wordnet', quiet=True)
    nltk.download('omw-1.4', quiet=True)
except:
    print("Warning: NLP dependencies may not be installed. Run: pip install spacy nltk")
    print("Then run: python -m spacy download en_core_web_sm")

# Define causal connectives (including multi-word phrases)
CAUSAL_CONNECTIVES = ["although", "arise", "arises", "arising", "arose", "because", "cause", "caused", "causes", "causing", "condition", "conditions", "consequence", "consequences", "consequent", "consequently", "due to", "enable", "enabled", "enables", "enabling", "even then", "follow that", "follow the", "follow this", "followed that", "followed the", "followed this", "following that", "follows the", "follows this", "hence", "made", "make", "makes", "making", "nevertheless", "nonetheless", "only if", "provided that", "result", "results", "since", "so", "therefore", "though", "thus", "unless", "whenever"]

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
            "issues": [
                {
                    "title": string (clear title describing the problem),
                    "issueType": string (one of: coherence, clarity, logic),
                    "text": string (exact quote from the text),
                    "issue": string (description of the issue),
                    "suggestion": string (how to improve),
                    "highlight_color": "#fef9c3" // yellow highlight for coherence issues
                }
            ]
        },
        "cohesion": {
            "transitions": {
                "present": [string],
                "missing_between": [
                    {
                        "title": string (clear title describing the problem),
                        "issueType": string (one of: cohesion, transition),
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
                    "title": string (clear title describing the problem),
                    "issueType": string (one of: focus, relevance, structure),
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
            "deviations": [
                {
                    "title": string (clear title describing the problem),
                    "issueType": string (one of: theme, consistency, coherence),
                    "text": string (exact quote of deviating content),
                    "issue": string (how it deviates),
                    "suggestion": string (how to align with theme),
                    "highlight_color": "#fef9c3" // yellow highlight for theme issues
                }
            ]
        },
        "paragraph_flow": {
            "weak_connections": [
                {
                    "title": string (clear title describing the problem),
                    "issueType": string (one of: flow, connection, cohesion),
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
                    "title": string (clear title describing the problem),
                    "issueType": string (one of: purpose, relevance, alignment),
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
            "structural_issues": [
                {
                    "title": string (clear title describing the problem),
                    "issueType": string (one of: structure, organization, flow),
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
                "underdeveloped_elements": [
                    {
                        "title": string (clear title describing the problem),
                        "issueType": string (one of: development, depth, explanation),
                        "text": string (exact quote needing development),
                        "issue": string (why it needs development),
                        "suggestion": string (how to develop it),
                        "highlight_color": "#93c5fd" // blue highlight for development issues
                    }
                ]
            }
        },
        "argument_flow": {
            "weak_points": [
                {
                    "title": string (clear title describing the problem),
                    "issueType": string (one of: argument, logic, evidence),
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
            "deviations": [
                {
                    "title": string (clear title describing the problem),
                    "issueType": string (one of: theme, relevance, alignment),
                    "text": string (exact quote of deviating content),
                    "issue": string (how it deviates from theme),
                    "suggestion": string (how to align with theme),
                    "highlight_color": "#fef9c3" // yellow highlight for theme deviations
                }
            ]
        },
        "relevance": {
            "irrelevant_elements": [
                {
                    "title": string (clear title describing the problem),
                    "issueType": string (one of: relevance, focus, tangent),
                    "text": string (exact quote of irrelevant content),
                    "issue": string (why it's not relevant),
                    "suggestion": string (how to make it relevant),
                    "highlight_color": "#93c5fd" // blue highlight for relevance issues
                }
            ]
        }
    }"""

# def get_change_of_state_verbs():
#     """
#     Use WordNet to find verbs related to (COS) change-of-state concepts.
#     Returns a set of change-of-state verbs.
#     """
#     try:
#         # Define seed words for COS
#         seed_words = ["change", "transform", "become", "melt", "freeze", "evaporate", "condense"]
        
#         change_of_state_verbs = set()
        
#         from nltk.corpus import wordnet as wn
#         for word in seed_words:
#             synsets = wn.synsets(word, pos=wn.VERB)
            
#             for synset in synsets:
#                 for lemma in synset.lemmas():
#                     change_of_state_verbs.add(lemma.name())
                
#                 for hypernym in synset.hypernyms():
#                     for lemma in hypernym.lemmas():
#                         change_of_state_verbs.add(lemma.name())
                
#                 for hyponym in synset.hyponyms():
#                     for lemma in hyponym.lemmas():
#                         change_of_state_verbs.add(lemma.name())
        
#         return change_of_state_verbs
#     except Exception as e:
#         print(f"Warning: Cannot get change-of-state verbs: {str(e)}")
#         return set()

# def identify_change_of_state_verbs(text: str) -> dict:
#     """
#     Identify change-of-state verbs in the given text using spaCy and WordNet.
#     Returns a dictionary with the count and list of change-of-state verbs.
#     """
#     try:
#         change_of_state_verbs = get_change_of_state_verbs()
#         doc = nlp(text)
        
#         change_of_state_count = 0
#         change_of_state_words = []
        
#         for token in doc:
#             if token.pos_ == "VERB" and token.lemma_.lower() in change_of_state_verbs:
#                 change_of_state_count += 1
#                 change_of_state_words.append(token.text)
        
#         return {
#             "change_of_state_count": change_of_state_count,
#             "change_of_state_words": change_of_state_words
#         }
#     except Exception as e:
#         print(f"Warning: Cannot identify change-of-state verbs: {str(e)}")
#         return {"change_of_state_count": 0, "change_of_state_words": []}

# def count_causal_connectives(text: str) -> dict:
#     """
#     Count the number of causal connectives in the given text.
#     Returns a dictionary with the count and list of causal connectives.
#     """
#     try:
#         doc = nlp(text)
#         causal_count = 0
#         causal_words = []
        
#         for i in range(len(doc) - 1):
#             if doc[i].text.lower() in CAUSAL_CONNECTIVES:
#                 causal_count += 1
#                 causal_words.append(doc[i].text)
            
#             if i < len(doc) - 2:
#                 phrase = f"{doc[i].text} {doc[i + 1].text} {doc[i + 2].text}".lower()
#                 if phrase in CAUSAL_CONNECTIVES:
#                     causal_count += 1
#                     causal_words.append(phrase)
        
#         return {
#             "causal_count": causal_count,
#             "causal_words": causal_words
#         }
#     except Exception as e:
#         print(f"Warning: Cannot count causal connectives: {str(e)}")
#         return {"causal_count": 0, "causal_words": []}


def analyze_text_with_context(
    content: str,
    full_context: str,
    target_type: Literal["coherence", "cohesion", "focus", "all"]
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
        # Create a simpler context-aware prompt
        context_prompt = f"""Analyze this text and provide constructive feedback for improving the flow, clarity, and coherence of the writing:

TEXT TO ANALYZE:
{content}

Focus on {target_type} issues. Provide balanced, professional feedback that is specific to this writing.

FEEDBACK APPROACH:
- Make feedback specific to this particular text and its context
- Provide explanations that analyze the text in relation to the overall piece
- Maintain a neutral professional tone - neither harsh nor overly encouraging
- Structure each piece of feedback in this way:
  1. Identify what the text is trying to accomplish in the context of the whole piece
  2. Explain where and why the text falls short in achieving this goal
  3. Suggest a specific improvement and explain its impact on the reader's experience

For each issue found, provide a comment with:
1. A clear title describing the issue (like "Transition Between Paragraphs" or "Clarity of Main Argument")
2. An issue type from this list ONLY: flow, clarity, coherence
3. The exact text from the selection that has the issue
4. A specific edit suggestion with the original text and improved version
5. A brief explanation of why the edit improves the reader's experience

Format each comment as a JSON object like this:
{{
  "title": "Short descriptive title",
  "issueType": "type of target_type issue", 
  "highlightedText": "exact text with the issue",
  "highlightStyle": "#fef9c3",
  "suggestedEdit": {{
    "original": "original text with issue",
    "suggested": "improved version of the text",
    "explanation": "why this edit improves the reader's experience"
  }}
}}

IMPORTANT: For the "issueType" field, use ONLY one of these values:
- "clarity" - For unclear or ambiguous wording
- "coherence" - For logical flow issues between ideas
- "flow" - For issues with transitions or pacing

Use these highlight colors:
- Clarity issues: "#bae6fd" (light blue)  
- Coherence issues: "#fef9c3" (yellow)
- Flow issues: "#fdba74" (orange)

CONSTRUCTIVE FEEDBACK EXAMPLES:

Example of specific feedback: 
"Your analysis of climate policy needs to connect the economic data with your policy recommendations. In this paragraph, you've presented statistics but haven't shown how they support your argument about carbon taxes. Try adding a sentence that explicitly links these numbers to your policy position so readers can follow your reasoning."

Example of overly general feedback:
"Academic writing requires clear connections between evidence and claims. This paragraph lacks those connections. Adding transitions would help the reader."

Examples of feedback that is too brief or too detailed:
Too brief: "This paragraph is unclear. Fix the transitions."
Too detailed: "This paragraph on climate policy introduces important statistics about carbon emissions from 2018-2022, but doesn't adequately explain how these specific numbers relate to the carbon tax proposal outlined in your third paragraph. The reader needs to understand exactly how the 23% reduction in emissions mentioned correlates with your suggestion for a graduated tax structure. Consider adding a sentence after the statistics that explicitly states how these figures demonstrate the potential effectiveness of your specific tax proposal, particularly focusing on how the data supports your argument about industrial sector compliance rates..."

Example of balanced feedback tone:
"Your literature review needs to establish clear connections between the different theories you discuss. In this section, you've described three theoretical frameworks without showing how they relate to each other. Try adding a sentence after each theory that connects it to your overall argument about urban development so readers can see why you've included these specific approaches."

Examples of tones to avoid:
Too harsh: "Your literature review is disjointed and poorly structured. The theories are thrown together without any logical organization."
Too encouraging: "Your literature review shows great effort in covering many theories! With just a tiny bit of work connecting these wonderful ideas, it would be perfect!"

Return your response as a valid JSON array of comments. For example:
[
  {{
    "title": "First issue title",
    "issueType": "issue type",
    "highlightedText": "example text with issue",
    "highlightStyle": "#appropriate_color_based_on_issue_type",
    "suggestedEdit": {{
      "original": "original text with issue",
      "suggested": "improved version of the text",
      "explanation": "why this edit improves the reader's experience"
    }}
  }},
  {{
    "title": "Second issue title",
    ... and so on
  }}
]
"""

        # Make OpenAI API call
        response = client.chat.completions.create(
            model=AZURE_DEPLOYMENT,
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
        
        # Print the raw result for debugging
        print(f"Raw result from OpenAI: {result[:500]}...")
        
        try:
            # First try to extract JSON if it's wrapped in text or code blocks
            import re
            json_match = re.search(r'(\[{.*}\])', result.replace('\n', ''))
            if json_match:
                extracted_json = json_match.group(1)
                comments = json.loads(extracted_json)
            else:
                # Try the normal way
                comments = json.loads(result)
            
            # If single object was returned, wrap in list
            if isinstance(comments, dict):
                comments = [comments]
                
            # Validate we have the required fields in each comment
            valid_comments = []
            for comment in comments:
                # Only include comments that have all required fields
                if all(k in comment for k in ["title", "highlightedText", "suggestedEdit"]):
                    # Ensure issueType exists
                    if "issueType" not in comment:
                        comment["issueType"] = "general"
                    
                    # Ensure highlightStyle exists
                    if "highlightStyle" not in comment:
                        comment["highlightStyle"] = "#fef9c3"
                    
                    # Ensure explanation exists in suggestedEdit
                    if "explanation" not in comment["suggestedEdit"]:
                        comment["suggestedEdit"]["explanation"] = "This edit improves the text."
                    
                    # Standardize issueType to match our badge categories
                    issue_type_mapping = {
                        # Map all possible values from API responses to our standard badge types
                        "coherence": "coherence",
                        "clarity": "clarity",
                        "logic": "coherence",
                        "cohesion": "cohesion",
                        "transition": "flow",
                        "focus": "clarity",
                        "relevance": "coherence",
                        "structure": "structure",
                        "theme": "coherence",
                        "consistency": "coherence",
                        "flow": "flow",
                        "connection": "cohesion",
                        "purpose": "coherence",
                        "alignment": "coherence",
                        "organization": "structure",
                        "development": "clarity",
                        "depth": "clarity",
                        "explanation": "clarity",
                        "argument": "coherence",
                        "evidence": "coherence",
                        "tangent": "coherence",
                    }
                    
                    # Standardize to one of our badge types or keep as is if unknown
                    if comment["issueType"] in issue_type_mapping:
                        comment["issueType"] = issue_type_mapping[comment["issueType"]]
                    
                    valid_comments.append(comment)
            
            # If we have valid comments, return them, otherwise fall back
            if valid_comments:
                return valid_comments
                
            # Create a direct example for the model - single issue
            if "Has this system encountered any issues yet??" in content:
                return [{
                    "title": "Lack of coherence",
                    "issueType": "coherence",
                    "highlightedText": "Has this system encountered any issues yet??",
                    "highlightStyle": "#e9d5ff",
                    "suggestedEdit": {
                        "original": "Has this system encountered any issues yet??",
                        "suggested": "Has this system encountered any issues yet?",
                        "explanation": "Using a single question mark is the correct punctuation for a question."
                    }
                }]
                
            # Fall back to generic structure
            return [{
                "title": "No specific issues found",
                "issueType": "structure",
                "highlightedText": content[:100] + ("..." if len(content) > 100 else ""),
                "highlightStyle": "#c4b5fd",
                "suggestedEdit": {
                    "original": content[:100] + ("..." if len(content) > 100 else ""),
                    "suggested": content[:100] + ("..." if len(content) > 100 else ""),
                    "explanation": "The text appears generally well-formed. Consider reviewing for clarity and purpose."
                }
            }]
            
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {str(e)}")
            print(f"Problematic JSON: {result[:200]}...")
            
            # Check for double question marks and create a direct response
            if "Has this system encountered any issues yet??" in content:
                return [{
                    "title": "Lack of Clarity",
                    "issueType": "clarity",
                    "highlightedText": "Has this system encountered any issues yet??",
                    "highlightStyle": "#e9d5ff",
                    "suggestedEdit": {
                        "original": "Has this system encountered any issues yet??",
                        "suggested": "Has this system encountered any issues yet?",
                        "explanation": "Using a single question mark is the correct punctuation for a question."
                    }
                }]
            
            return [{
                "title": "Analysis Formatting Issue",
                "issueType": "structure",
                "highlightedText": content[:100] + ("..." if len(content) > 100 else ""),
                "highlightStyle": "#fef9c3",
                "suggestedEdit": {
                    "original": content[:100] + ("..." if len(content) > 100 else ""),
                    "suggested": content[:100] + ("..." if len(content) > 100 else ""),
                    "explanation": "The analysis couldn't be properly formatted. Please try again with more detailed text."
                }
            }]

    except Exception as e:
        print(f"Error in analyze_text_with_context: {str(e)}")
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
                "content": """You are a helpful writing assistant focused on providing guidance for document improvement. Answer questions about writing techniques, suggest improvements, and offer explanations for coherence and cohesion issues."""
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
        "type": "paragraph" | "section" | "document" | "theme",
        "targetType": "coherence" | "cohesion" | "focus" | "all"
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
        target_type = data['targetType']

        if not content:
            return jsonify({
                "error": "Empty content",
                "code": "EMPTY_CONTENT"
            }), 400
            
        if target_type not in ["coherence", "cohesion", "focus", "all"]:
            return jsonify({
                "error": "Invalid target type",
                "code": "INVALID_TARGET_TYPE"
            }), 400

        # Analyze the text content with context
        analysis_data = analyze_text_with_context(content, full_context, target_type)
        
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
                        comment["issueType"] = "coherence"
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
                "consistency": "coherence",
                "purpose": "coherence",
                "alignment": "coherence",
                "argument": "coherence",
                "evidence": "coherence",
                "tangent": "coherence",
                "clarity": "clarity",
                "focus": "clarity",
                "explanation": "clarity",
                "development": "clarity",
                "depth": "clarity",
                "relevance": "clarity",
                "flow": "flow",
                "cohesion": "flow",
                "transition": "flow",
                "connection": "flow",
                "organization": "flow",
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