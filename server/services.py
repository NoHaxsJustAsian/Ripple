from openai import AzureOpenAI
from .config import Config
from typing import Optional, Dict, List, Literal, Tuple
from .exceptions import DocumentProcessingError
import json
import re
import os
from dotenv import load_dotenv

# Load environment variables at module level
load_dotenv()

# Initialize client with better error handling
def get_client():
    """Get Azure OpenAI client with proper error handling"""
    try:
        return AzureOpenAI(
            azure_endpoint=Config.AZURE_ENDPOINT,
            api_key=Config.AZURE_KEY,
            api_version=Config.API_VERSION
        )
    except Exception as e:
        print(f"Warning: Failed to initialize Azure OpenAI client: {e}")
        return None

# Initialize client once
client = get_client()

def analyze_text(content: str, theme: Optional[str] = None) -> dict:
    """Basic text analysis function"""
    # This would be a basic analysis implementation
    # For now, delegating to the more comprehensive function
    return analyze_text_with_context(content, content, "all")

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
        paragraph_topics: Optional dictionary of paragraph topics
        essay_topic: Optional essay topic/thesis
        flow_prompt: Optional custom flow prompt
        
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

        if not client:
            raise DocumentProcessingError("Azure OpenAI client not initialized. Check your credentials.")
            
        response = client.chat.completions.create(
            model="PROPILOT",  # Using the Azure deployment name
            messages=[{"role": "system", "content": context_prompt}],
            max_tokens=3000,
            temperature=0.5
        )

        result = response.choices[0].message.content.strip()
        print(f"Raw result from OpenAI: {result[:500]}...")

        json_match = re.search(r'(\[{.*}\])', result.replace('\n', ''))
        if json_match:
            extracted_json = json_match.group(1)
            comments = json.loads(extracted_json)
        else:
            comments = json.loads(result)
        
        if isinstance(comments, dict):
            comments = [comments]
        
        return comments if isinstance(comments, list) else []

    except json.JSONDecodeError as e:
        print(f"JSON decode error: {e}")
        print(f"Response content: {result}")
        raise DocumentProcessingError(f"Failed to parse analysis response: {e}")
    except Exception as e:
        print(f"Error in analyze_text_with_context: {e}")
        raise DocumentProcessingError(f"Text analysis failed: {e}")

def handle_chat_message(message: str, document_context: Optional[str] = None) -> str:
    """Handle chat message with AI"""
    try:
        context_prefix = ""
        if document_context:
            context_prefix = f"Document context:\n{document_context}\n\nUser question: "
        
        full_prompt = f"{context_prefix}{message}"
        
        if not client:
            raise DocumentProcessingError("Azure OpenAI client not initialized. Check your credentials.")
            
        response = client.chat.completions.create(
            model="PROPILOT",
            messages=[
                {"role": "system", "content": "You are a helpful writing assistant. Provide clear, concise answers about writing, editing, and document improvement."},
                {"role": "user", "content": full_prompt}
            ],
            max_tokens=1000,
            temperature=0.7
        )
        
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        print(f"Error in handle_chat_message: {e}")
        raise DocumentProcessingError(f"Chat processing failed: {e}")

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

Do not refer to the "user" or "writer" in your response.

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

        if not client:
            raise DocumentProcessingError("Azure OpenAI client not initialized. Check your credentials.")
            
        # Make OpenAI API call
        response = client.chat.completions.create(
            model="PROPILOT",  # Using the Azure deployment name
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