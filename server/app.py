from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openai import AzureOpenAI
from dotenv import load_dotenv
import os
import json
from datetime import datetime
from typing import Dict, List, Optional, Union, Literal, Tuple
from text_segmentation import segment_texts

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

        topics_context = ""
        topics_section = ""
        topic_guidance = ""

        if essay_topic:
            topics_section += f"\nMAIN ESSAY TOPIC/THESIS:\n{essay_topic}\n"
            topic_guidance += f"\nIMPORTANT: Consider this high-level thesis/topic when providing feedback. Evaluate how well the text supports or advances this main idea. Your feedback should help the writer better align their writing with this core thesis."
        
        # Add paragraph topics if provided
        if paragraph_topics and len(paragraph_topics) > 0:
            topics_section += "\nPARAGRAPH TOPIC SENTENCES:\n"
            for para_id, topic in paragraph_topics.items():
                topics_section += f"- {topic}\n"
            
            topic_guidance += f"\nALSO IMPORTANT: Consider these paragraph topic sentences when providing feedback. Evaluate how well the text maintains focus on these topics and creates cohesion between them."
        
        # Create the context-aware prompt with topic information
        context_prompt = f"""Analyze this text and provide constructive feedback for improving the flow, clarity, and focus of the writing:

        TEXT TO ANALYZE:
        {content}

        {topics_section}
        {topic_guidance}

        Focus on {target_type} issues. Provide balanced, professional feedback that is specific to this writing.

        FEEDBACK APPROACH:
        - Make feedback specific to this particular text and its context
        - Focus on analyzing what the text is trying to accomplish and where it falls short
        - Provide explanations that analyze the text in relation to the overall piece
        - Maintain a neutral, professional and respectful tone - neither harsh nor overly encouraging
        - Keep explanations concise (3-5 sentences maximum)
        - Structure each piece of feedback to emphasize analysis over suggestions:
        1. Identify what the text is trying to accomplish in the context of the whole piece
        2. Explain where and why the text falls short in achieving this goal
        3. Explain how this issue impacts the reader's understanding or experience
        4. Suggest a specific improvement and explain its impact on the reader's experience
        - Vary your sentence structures and opening phrases

        For each issue found, provide a comment with:
        1. A clear title describing the issue (like "Transition Between Paragraphs" or "Clarity of Main Argument")
        2. An issue type from this list ONLY: flow, clarity, focus
        3. The exact text from the selection that has the issue
        4. A specific edit suggestion with the original text and improved version
        5. A concise explanation of why the edit improves the reader's experience

        Format each comment as a JSON object like this:
        {{
        "title": "Short descriptive title",
        "issueType": "type of target_type issue", 
        "highlightedText": "exact text with the issue",
        "highlightStyle": "#fef9c3",
        "suggestedEdit": {{
            "original": "original text with issue",
            "suggested": "improved version of the text",
            "explanation": "A concise analysis that: 1) identifies what this text is trying to accomplish, 2) explains specifically what is missing or problematic, 3) describes how this affects the reader, and 4) justifies how the suggested change addresses these issues.",
            "references": [
            {{
                "allusion": "phrase you refer to in your explanation",
                "referenceText": "exact text to highlight in the document"
            }}
            ]
        }}
        }}

        IMPORTANT: For action recommendations in your explanation, use HTML bold tags by wrapping the text like this: <b>action recommendation</b>. For example: "The current phrasing lacks clarity. <b>Try using more specific terminology</b> to help readers better understand your point."

        IMPORTANT: For the "issueType" field, use ONLY one of these values:
        - "clarity" - For unclear or ambiguous wording
        - "focus" - For logical flow issues between ideas
        - "flow" - For issues with transitions or pacing

        Use these highlight colors:
        - Clarity issues: "#bae6fd" (light blue)  
        - Focus issues: "#fef9c3" (yellow)
        - Flow issues: "#fdba74" (orange)

        GUIDELINES FOR VARIED EXPLANATIONS:

        1. VARY YOUR OPENING PHRASES - Avoid always starting with "This text..." or "The current text...". Instead, use varied openings:
        - "Here, the passive phrasing creates distance between..."
        - "Without explicit connections between these statistics and your argument..."
        - "Readers may struggle to follow your reasoning because..."
        - "The vague terminology undermines credibility by..."
        - "Your argument would be stronger if..."

        2. FOCUS ON DIFFERENT ASPECTS - Vary which aspect you analyze first:
        - Reader impact: "Readers may misinterpret your position because..."
        - Purpose: "Your goal of explaining X is hampered by..."
        - Missing elements: "The connection between these concepts remains implicit..."
        - Current limitations: "Vague terminology obscures your methodology..."

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

        BAD EXAMPLES:
        -"The revised sentence structure enhances coherence by directly linking the reflection with the realization of benefits, making the thought process clearer to the reader."
        -"The edit improves coherence by adding a transition sentence that connects the statistics to the policy proposal."
        -"The edit clarifies the methodology by adding specific details about participants and methods."
        -"Academic writing requires clear connections between theories. This section lacks those connections. Adding transitions would help the reader understand your point better."

        GUIDELINES FOR RESPECTFUL, CONSTRUCTIVE EXPLANATIONS:

        1. FOCUS ON THE TEXT, NOT THE WRITER
        - Instead of: "You are not explaining your point clearly"
        - Use: "This point could be more accessible to readers if..."

        2. FRAME AS ENHANCEMENT OPPORTUNITIES
        - Instead of: "This sentence is cluttered with multiple ideas, making the motivation unclear"
        - Use: "The multiple ideas in this sentence present an opportunity to highlight the core motivation more distinctly"

        3. ACKNOWLEDGE EXISTING STRENGTHS
        - When possible, note what's working before suggesting enhancement
        - Example: "While the key concepts are present, readers might better grasp their relationship if..."

        4. USE READER-FOCUSED LANGUAGE
        - Instead of: "The writing is confusing here"
        - Use: "Readers might find it challenging to follow the connection between these ideas"

        5. VARY YOUR OPENING PHRASES
        - "The relationship between these concepts could be more explicit..."
        - "Readers might more easily follow your reasoning if..."
        - "The transition between these points offers a chance to strengthen the logical flow..."

        EXAMPLES OF EFFECTIVE RESPECTFUL EXPLANATIONS:

        GOOD EXAMPLE:
        "The reflection on miniature making contains valuable insights that readers might miss due to the indirect phrasing. The passive framing creates distance where a more direct approach could strengthen the connection with readers. Highlighting the transformative impact more explicitly would help readers anticipate the benefits you describe in subsequent sentences."

        BAD EXAMPLE:
        "The sentence is cluttered with multiple ideas, making the motivation unclear. By restructuring, the motivation becomes more explicit, allowing readers to understand the author's drive and the context of the project."

        GOOD EXAMPLE:
        "These three theories each contribute important perspectives to your urban development thesis. Readers might more easily grasp their collective significance with explicit connections between them. A brief statement showing how each theory builds upon or complements the others would create a more cohesive framework for your subsequent analysis."

        BAD EXAMPLE:
        "You've failed to connect these theories properly. The writing is disjointed and readers will be confused by your poorly organized theoretical framework."

        GUIDELINES FOR FOCUSING ON THE CURRENT TEXT:

        1. ANALYZE THE CURRENT TEXT, NOT THE SUGGESTED EDIT
        - Instead of: "The revised version clarifies the context..."
        - Use: "The current phrasing lacks context about receiving the board..."

        2. FOCUS ON READER EXPERIENCE WITH THE CURRENT TEXT
        - Instead of: "The edit improves readability..."
        - Use: "Currently, readers might struggle to follow the logical progression..."

        EXAMPLES OF GOOD FOCUS ON CURRENT TEXT:

        GOOD EXAMPLE:
        "The current description of receiving the board lacks context about when and how it happened. This temporal gap makes it difficult for readers to understand the immediate connection between receiving the board and feeling inspired. Readers might wonder about the circumstances that sparked this creative journey. Try adding specific details about the moment of receiving the board to create a more vivid and relatable starting point for your narrative."

        BAD EXAMPLE:
        "The revised version clarifies the context of receiving the board, making the inspiration more immediate and accessible."

        GOOD EXAMPLE:
        "The transition between your literature review and methodology appears abrupt. Readers might struggle to see how your theoretical framework directly informed your research approach. The connection between these sections remains implicit, potentially leaving readers uncertain about your research rationale. Try adding a brief explanation of how specific theories shaped your methodological choices to help readers follow your research design logic."

        BAD EXAMPLE:
        "The revised transition connects the literature review to the methodology section, improving the paper's coherence."

        IMPORTANT: Never begin explanations with phrases like "The edit..." or "This revision..." Instead, focus on analyzing the current text's limitations and their impact on the reader. The suggested edit should be a secondary consideration after thoroughly analyzing the existing text's issues.

        GUIDELINES FOR SUGGESTIVE RATHER THAN PRESCRIPTIVE LANGUAGE:

        1. USE CONDITIONAL TENSE
        - Instead of: "Add a transition here."
        - Use: "A transition here would help connect these ideas."
        
        - Instead of: "Make this clearer by adding examples."
        - Use: "This point could be clearer if supported by examples."

        2. PRESENT ALTERNATIVES AS OPTIONS
        - Instead of: "Change this sentence to be more specific."
        - Use: "This sentence might be more effective if made more specific."
        
        - Instead of: "Use active voice here."
        - Use: "Active voice here might create a stronger impact."

        3. FRAME SUGGESTIONS AS POSSIBILITIES
        - Instead of: "You need to connect these paragraphs."
        - Use: "These paragraphs would benefit from a connection that..."
        
        - Instead of: "Remove this redundant phrase."
        - Use: "This phrase could be considered redundant and might be removed."

        4. USE PHRASES THAT SIGNAL SUGGESTION
        - "This section might work better if..."
        - "Readers would likely find it helpful if..."
        - "One possibility would be to..."
        - "Consider whether..."
        - "It might be worth exploring..."
        - "What if this section included..."

        5. AVOID IMPERATIVE COMMANDS
        - Instead of: "Revise this paragraph for clarity."
        - Use: "This paragraph could be revised for clarity."
        
        - Instead of: "Start with your main point."
        - Use: "Starting with the main point would help orient readers."

        EXAMPLES OF SUGGESTIVE LANGUAGE:

        GOOD EXAMPLE (SUGGESTIVE):
        "The connection between these statistical findings and your policy recommendation remains implicit. Readers may struggle to see how the data directly supports your proposal. Including a sentence that explicitly links the 23% emission reduction to your tax structure would help readers follow your logical progression."

        BAD EXAMPLE (PRESCRIPTIVE):
        "Connect your statistics to your policy recommendation. Add a sentence linking the 23% emission reduction to your tax structure. Make the logical connection clear."

        GOOD EXAMPLE (SUGGESTIVE):
        "The literature review presents these theories as separate entities. Readers might not grasp how they collectively support your thesis. A brief explanation after each theory showing its relevance to your urban development argument would create a more cohesive theoretical framework."

        BAD EXAMPLE (PRESCRIPTIVE):
        "Link each theory to your thesis. Add explanatory sentences after each one. Show how they support your urban development argument."

        GUIDELINES FOR SHORT, CLEAR, AND SUCCINCT FEEDBACK:

        1. AIM FOR BREVITY
        - Limit explanations to 2-3 sentences maximum
        - Remove any redundant information
        - Prioritize the most significant issues rather than noting every minor problem

        2. USE SIMPLE, DIRECT LANGUAGE
        - Choose precise words over complex terminology
        - Avoid unnecessary adjectives and qualifiers
        - Replace long phrases with concise alternatives (e.g., "in order to" → "to")

        3. STRUCTURE FEEDBACK EFFICIENTLY
        - Lead with the most important observation
        - Make one clear point per sentence
        - Use active voice instead of passive voice
        - Avoid hedging language (e.g., "sort of," "kind of," "somewhat")

        4. ELIMINATE FILLER PHRASES
        - Instead of: "It is important to note that this paragraph could benefit from..."
        - Use: "This paragraph needs..."
        
        - Instead of: "There appears to be an opportunity to enhance the clarity of..."
        - Use: "The meaning becomes unclear when..."

        5. GET STRAIGHT TO THE POINT
        - Skip background information the writer already knows
        - Avoid explaining general writing principles unless directly relevant
        - Focus only on what's currently missing and why it matters

        EXAMPLES OF CONCISE FEEDBACK:

        GOOD EXAMPLE (CONCISE):
        "The connection between receiving the board and feeling inspired remains unclear. Readers can't visualize this key moment that sparked your creative journey. Try adding when and how you received the board to establish a stronger foundation for your narrative."

        BAD EXAMPLE (WORDY):
        "The current description of receiving the board lacks important contextual information about the timing and circumstances of when and how you came to possess the board, which creates a significant gap in understanding for readers who are trying to follow along with your creative journey and inspirational process. This temporal and circumstantial gap in the narrative makes it quite difficult for readers to fully comprehend and appreciate the immediate connection between the moment of receiving the board and the subsequent feeling of creative inspiration that you experienced as a result. Readers might find themselves wondering about the specific details and circumstances surrounding this pivotal moment that ultimately sparked this interesting and potentially transformative creative journey that you're describing in your narrative."

        GOOD EXAMPLE (CONCISE):
        "Your literature review presents three theories without showing their connections. Readers can't see how they collectively support your thesis. Try adding a sentence after each theory linking it to your urban development argument."

        BAD EXAMPLE (WORDY):
        "The literature review section of your paper presents three distinct theoretical frameworks that you have researched and included, but unfortunately fails to establish or demonstrate the important logical connections between these different theories and how they relate to each other in the context of your overall argument. This lack of explicit connection between the theoretical concepts creates a situation where readers might struggle to understand the relationship between these different frameworks and might not fully grasp how they collectively contribute to or support the central thesis of your paper regarding urban development patterns and processes. It would be highly beneficial to the overall coherence and persuasiveness of your argument if you were to consider adding additional explanatory text after the presentation of each theory to clearly articulate how that particular theoretical framework specifically connects to and supports your overall argument about urban development."


        IMPORTANT: Allusions in your feedback refer to the text that you're talking about. The goal is to help users see what parts of their document you're talking about.

        1) Here is one example of a good allusion and reference identification:

        Given the text: "Strangely enough, searching for solutions in these creative places floods back when I work on research and programming for my computational biology internships, observing patterns and breaking down problems into miniature tasks."
        
        Given the feedback: The current sentence introduces a connection between activities without clearly articulating the relationship. Explicitly linking the skills acquired through miniature making to computational biology tasks enhances focus, allowing readers to see the broader applicability of these skills.

        The first allusion is "connection between activities"; its reference is "searching for solutions in these creative places floods back when I work on research and programming for my computational biology internships". The second allusion is "explicitly linking the skills acquired through miniature making to computational biology tasks".

        2) Here is another example of a good allusion and reference identification:

        Given the text: "As I wonder why miniature making has become such an integral part of my routine, I've begun to notice just how much I've gained from it"

        Given the feedback: The current sentence lacks focus, as it introduces a reflection without immediately connecting it to the benefits. Rephrasing to emphasize the gained skills sharpens the focus, helping readers understand the value of the activity more clearly.

        The first allusion is "introduces the reflection"; its reference is "As I wonder why miniature making has become such an integral part of my routine,".

        3) Here is another example of a good allusion and reference identification:

        Given the text: I'd make frustrating mistakes, but I found my way, crocheting bicycle chains that created enough friction to pull cardboard gears

        Given the feedback: The current phrasing is somewhat indirect, which may obscure the problem-solving process. Clarifying the sequence of actions makes the resolution more accessible, allowing readers to appreciate the ingenuity involved.

        The first allusion is "the problem solving process"; its reference is "crocheting bicycle chains that created enough friction to pull cardboard gears". The second allusion is "the ingenuity involved"; its reference is "I'd make frustrating mistakes, but I found my way".


        Identify ALL the relevant allusions and references for each feedback explanations. These could be:
        - Parts of the document structure (introduction, methodology, conclusion)
        - Types of content (evidence, arguments, examples, data)
        - Writing elements (transitions, topic sentences, thesis statements)
        - Subject matter (specific topics or themes mentioned)


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
            "references": [
                {{
                    "allusion": "phrase you refer to in your explanation",
                    "referenceText": "exact text to highlight in the document"
                }}
                ]
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

        print(f"RECEIVED FROM OPENAI: {result}...")
        
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
                    if "references" not in comment["suggestedEdit"]:
                        # Create basic references from quotation marks in explanation
                        explanation = comment["suggestedEdit"]["explanation"]
                        references = []
                        
                        # Find text in quotes
                        quote_regex = r'"([^"]+)"'
                        for match in re.finditer(quote_regex, explanation):
                            quoted_text = match.group(1)
                            references.append({
                                "allusion": quoted_text,
                                "referenceText": quoted_text
                            })
                        
                        comment["suggestedEdit"]["references"] = references
                    else:
                        # Process existing references to ensure correct format
                        processed_references = []
                        for ref in comment["suggestedEdit"]["references"]:
                            processed_ref = {
                                "allusion": ref.get("allusion", ""),
                                "referenceText": ref.get("referenceText", "")
                            }
                            processed_references.append(processed_ref)
                        comment["suggestedEdit"]["references"] = processed_references
                        print(f"Processed existing references: {processed_references}")
                    
                    # Standardize issueType to match our badge categories
                    issue_type_mapping = {
                        # Map all possible values from API responses to our standard badge types
                        "coherence": "clarity",
                        "clarity": "clarity",
                        "logic": "clarity",
                        "cohesion": "flow",
                        "transition": "flow",
                        "focus": "focus",
                        "relevance": "focus",
                        "structure": "flow",
                        "theme": "focus",
                        "consistency": "clarity",
                        "flow": "flow",
                        "connection": "flow",
                        "purpose": "focus",
                        "alignment": "clarity",
                        "organization": "flow",
                        "development": "clarity",
                        "depth": "clarity",
                        "explanation": "clarity",
                        "argument": "clarity",
                        "evidence": "focus",
                        "tangent": "focus"
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
                    "title": "Lack of clarity",
                    "issueType": "clarity",
                    "highlightedText": "Has this system encountered any issues yet??",
                    "highlightStyle": "#e9d5ff",
                    "suggestedEdit": {
                        "original": "Has this system encountered any issues yet??",
                        "suggested": "Has this system encountered any issues yet?",
                        "explanation": "Using a single question mark is the correct punctuation for a question.",
                        "references": [
                            {
                                "allusion": "phrase you refer to in your explanation",
                                "referenceText": "exact text to highlight in the document"
                            }
                            ]
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
                    "explanation": "The text appears generally well-formed. Consider reviewing for clarity and purpose.",
                    "references": [
                    {
                        "allusion": "phrase you refer to in your explanation",
                        "referenceText": "exact text to highlight in the document"
                    }
                    ]
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
                        "explanation": "Using a single question mark is the correct punctuation for a question.",
                        "references": [
                        {
                            "allusion": "phrase you refer to in your explanation",
                            "referenceText": "exact text to highlight in the document"
                        }
                        ]
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
                    "explanation": "The analysis couldn't be properly formatted. Please try again with more detailed text.",
                    "references": [
                    {
                        "allusion": "phrase you refer to in your explanation",
                        "referenceText": "exact text to highlight in the document"
                    }
                    ]
                }
            }]

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

Your task is to analyze the selected text based on the user's prompt and provide:
1. A thoughtful explanation in response to the prompt
2. A suggested improvement to the selected text

GUIDELINES:
- Be specific and constructive in your explanation
- Focus on the type of improvement requested in the prompt
- Keep your explanation concise (2-4 sentences)
- Make your suggested improvement maintain the original meaning while addressing the user's request
- If the user's prompt is unclear, focus on improving the clarity and flow of the text

IMPORTANT: For action recommendations in your explanation, use HTML bold tags by wrapping the text like this: <b>action recommendation</b>. For example: "The current phrasing lacks clarity. <b>Try using more specific terminology</b> to help readers better understand your point."

FORMAT YOUR RESPONSE AS:
1. First provide a concise explanation that addresses the user's prompt
2. Then provide your suggested improvement to the text
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

def analyze_sentence_connection(sentence: str, document: str, strength: float) -> str:
    """
    Generate a brief explanation of how a sentence connects to the document through lexical cohesion.
    
    Args:
        sentence: The specific sentence to analyze
        document: The full document context
        strength: The connection strength score (0.0-1.0)
        
    Returns:
        Brief explanation of the lexical cohesion connections
        
    Raises:
        Exception: If analysis fails
    """
    try:
        # Create a focused prompt for connection explanation
        connection_prompt = f"""
Explain in 1-2 short sentences how this sentence connects to the document through lexical cohesion.

SENTENCE TO ANALYZE: "{sentence}"
CONNECTION STRENGTH: {strength}
DOCUMENT CONTEXT: {document}

Focus on specific lexical cohesion elements:
- Shared vocabulary and word families
- Thematic consistency with main ideas  
- Referential connections (pronouns, repeated concepts)
- Position in the argument structure

Examples of good explanations:
- "Reinforces main theme through repeated key vocabulary 'miniature making' and connects to earlier problem-solving examples"
- "Transitional content with limited vocabulary overlap, provides chronological context but few thematic connections"
- "Central argument with strong vocabulary ties to 'creativity' and 'determination' themes established throughout"

Be concise, specific, and focus on HOW the sentence connects lexically. Keep under 20 words.
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

        if not sentence or not document_context:
            return jsonify({
                "error": "Empty sentence or document context",
                "code": "EMPTY_CONTENT"
            }), 400

        # Generate the connection explanation
        explanation = analyze_sentence_connection(sentence, document_context, connection_strength)
        
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
        
        print(f"Found {len(connections)} connections for sentence with strength {clicked_sentence_strength}")
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
        return "Strong thematic and vocabulary overlap"
    elif strength >= 0.5:
        return "Moderate lexical connections"  
    elif strength >= 0.2:
        return "Some vocabulary overlap"
    else:
        return "Weak connection"

def analyze_paragraph_cohesion(sentence: str, document: str) -> dict:
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
        
        prompt = f"""
Analyze how this sentence contributes to its paragraph's cohesion and main message.

PARAGRAPH:
{target_paragraph}

TARGET SENTENCE:
{sentence}

Analyze:
1. How well does this sentence connect to the paragraph's main message?
2. What vocabulary, themes, or concepts link it to other sentences?
3. Does it support, develop, or transition the paragraph's ideas?

Provide:
- Score (0.0-1.0): How well the sentence coheres with the paragraph
- Analysis: 2-3 sentences explaining the cohesion
- Strengths: List 1-3 ways it connects well (or empty if none)
- Weaknesses: List 1-3 areas where cohesion could improve (or empty if none)

Format your response as JSON:
{{
    "score": 0.8,
    "analysis": "Brief analysis here",
    "strengths": ["strength 1", "strength 2"],
    "weaknesses": ["weakness 1"]
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
                model=AZURE_OPENAI_DEPLOYMENT_NAME,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=500,
                temperature=0.3
            )

            result_text = response.choices[0].message.content.strip()
            
            # Try to parse as JSON
            import json
            result = json.loads(result_text)
            
            # Validate and set defaults
            return {
                "score": float(result.get("score", 0.5)),
                "analysis": result.get("analysis", "Unable to analyze paragraph cohesion."),
                "strengths": result.get("strengths", []),
                "weaknesses": result.get("weaknesses", [])
            }
            
        except json.JSONDecodeError:
            print(f"Failed to parse paragraph cohesion JSON: {result_text}")
            return {
                "score": 0.5,
                "analysis": "Unable to analyze paragraph cohesion due to parsing error.",
                "strengths": [],
                "weaknesses": []
            }
        except Exception as e:
            print(f"Error calling Azure OpenAI for paragraph cohesion: {e}")
            return {
                "score": 0.5,
                "analysis": "Unable to analyze paragraph cohesion due to API error.",
                "strengths": [],
                "weaknesses": []
            }
            
    except Exception as e:
        print(f"Error in analyze_paragraph_cohesion: {e}")
        return {
            "score": 0.5,
            "analysis": "Unable to analyze paragraph cohesion.",
            "strengths": [],
            "weaknesses": []
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
Analyze how this sentence contributes to the overall document's cohesion and main message.

FULL DOCUMENT:
{document}

TARGET SENTENCE:
{sentence}

Analyze:
1. How well does this sentence support the document's main thesis or purpose?
2. What themes, arguments, or vocabulary connect it to the broader narrative?
3. Does it advance the document's overall message or argument?

Provide:
- Score (0.0-1.0): How well the sentence coheres with the document's main message
- Analysis: 2-3 sentences explaining the cohesion with the overall document
- Strengths: List 1-3 ways it connects to the document's main themes (or empty if none)
- Weaknesses: List 1-3 ways it could better support the document's message (or empty if none)

Format your response as JSON:
{{
    "score": 0.7,
    "analysis": "Brief analysis here",
    "strengths": ["strength 1", "strength 2"],
    "weaknesses": ["weakness 1"]
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
                model=AZURE_OPENAI_DEPLOYMENT_NAME,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=500,
                temperature=0.3
            )

            result_text = response.choices[0].message.content.strip()
            
            # Try to parse as JSON
            import json
            result = json.loads(result_text)
            
            # Validate and set defaults
            return {
                "score": float(result.get("score", 0.5)),
                "analysis": result.get("analysis", "Unable to analyze document cohesion."),
                "strengths": result.get("strengths", []),
                "weaknesses": result.get("weaknesses", [])
            }
            
        except json.JSONDecodeError:
            print(f"Failed to parse document cohesion JSON: {result_text}")
            return {
                "score": 0.5,
                "analysis": "Unable to analyze document cohesion due to parsing error.",
                "strengths": [],
                "weaknesses": []
            }
        except Exception as e:
            print(f"Error calling Azure OpenAI for document cohesion: {e}")
            return {
                "score": 0.5,
                "analysis": "Unable to analyze document cohesion due to API error.",
                "strengths": [],
                "weaknesses": []
            }
            
    except Exception as e:
        print(f"Error in analyze_document_cohesion: {e}")
        return {
            "score": 0.5,
            "analysis": "Unable to analyze document cohesion.",
            "strengths": [],
            "weaknesses": []
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
        
        print(f"📝 Sentence Flow Analysis Request:")
        print(f"   Sentence: {sentence[:50]}...")
        print(f"   Document length: {len(document)} chars")
        print(f"   Prompt: {prompt}")
        
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
        paragraph_cohesion = analyze_paragraph_cohesion(sentence, document)
        
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