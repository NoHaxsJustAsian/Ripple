# text_segmentation.py
import spacy
from spacy.tokens.doc import Doc
from typing import List, Dict, Any
import logging
import sys
import traceback

# Set up more detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Helper function for safely logging text snippets
def debug_text(text, max_length=100):
    """Helper to safely log text snippets"""
    if not text:
        return "EMPTY"
    preview = text[:max_length] + ("..." if len(text) > max_length else "")
    return preview.replace("\n", "\\n")

# Load spaCy model once when module is imported
try:
    nlp = spacy.load("en_core_web_sm")
    logger.info("Successfully loaded spaCy model 'en_core_web_sm'")
except OSError:
    # Fallback if model not installed
    logger.warning("SpaCy model not found. Downloading model...")
    try:
        import spacy.cli
        spacy.cli.download("en_core_web_sm")
        nlp = spacy.load("en_core_web_sm")
        logger.info("Successfully downloaded and loaded spaCy model")
    except Exception as e:
        logger.error(f"Failed to download spaCy model: {str(e)}")
        raise

def basic_segmentation(original: str, suggested: str) -> List[Dict[str, Any]]:
    """Simple fallback segmentation for when NLP processing fails"""
    logger.info("Using basic segmentation fallback")
    segments = []
    
    # Split by sentences (simple approach)
    orig_parts = original.split('. ')
    sugg_parts = suggested.split('. ')
    
    # Handle case where there's no period
    if len(orig_parts) == 1 and len(sugg_parts) == 1:
        # Just split by words for very short texts
        orig_words = original.split()
        sugg_words = suggested.split()
        
        if len(orig_words) <= 3 and len(sugg_words) <= 3:
            # For very short texts, just use them as is
            return [{
                "original": original,
                "suggested": suggested,
                "similarity": 1.0 if original == suggested else 0.0
            }]
        
        # Group words into small chunks
        chunk_size = 3
        for i in range(0, max(len(orig_words), len(sugg_words)), chunk_size):
            orig_chunk = " ".join(orig_words[i:i+chunk_size]) if i < len(orig_words) else ""
            sugg_chunk = " ".join(sugg_words[i:i+chunk_size]) if i < len(sugg_words) else ""
            
            segments.append({
                "original": orig_chunk,
                "suggested": sugg_chunk,
                "similarity": 1.0 if orig_chunk == sugg_chunk else 0.0
            })
        
        return segments
    
    # Otherwise, split by sentences
    max_len = max(len(orig_parts), len(sugg_parts))
    
    for i in range(max_len):
        orig_text = (orig_parts[i] + '. ') if i < len(orig_parts) else ''
        sugg_text = (sugg_parts[i] + '. ') if i < len(sugg_parts) else ''
        
        # Skip empty segments
        if not orig_text and not sugg_text:
            continue
            
        segments.append({
            "original": orig_text,
            "suggested": sugg_text,
            "similarity": 1.0 if orig_text == sugg_text else 0.0
        })
    
    return segments

def segment_texts(original: str, suggested: str) -> List[Dict[str, Any]]:
    """
    Main function to segment and align two text versions using NLP.
    
    Args:
        original: The original text
        suggested: The suggested/edited text
        
    Returns:
        List of segment dictionaries with corresponding parts
    """
    try:
        # Print debug info
        logger.debug(f"Starting text segmentation:")
        logger.debug(f"Original text ({len(original)} chars): {debug_text(original)}")
        logger.debug(f"Suggested text ({len(suggested)} chars): {debug_text(suggested)}")
        
        # Handle empty input
        if not original and not suggested:
            logger.warning("Both original and suggested texts are empty")
            return []
            
        if not original:
            logger.warning("Original text is empty")
            return [{"original": "", "suggested": suggested, "similarity": 0.0}]
            
        if not suggested:
            logger.warning("Suggested text is empty")
            return [{"original": original, "suggested": "", "similarity": 0.0}]
        
        # Try processing with spaCy
        try:
            logger.debug("Processing with spaCy...")
            # Limit size to avoid memory issues
            max_chars = 5000
            
            # Debug info for truncation
            if len(original) > max_chars or len(suggested) > max_chars:
                logger.debug(f"Texts truncated to {max_chars} chars for processing")
                
            # Process text with spaCy
            original_doc = nlp(original[:max_chars])
            suggested_doc = nlp(suggested[:max_chars])
            
            logger.debug(f"SpaCy processing successful. Extracting linguistic units...")
            
            # Extract units with explicit error handling
            try:
                original_units = extract_linguistic_units(original_doc)
                logger.debug(f"Extracted {len(original_units)} units from original text")
            except Exception as e:
                logger.error(f"Error extracting units from original text: {str(e)}")
                logger.error(traceback.format_exc())
                raise
                
            try:
                suggested_units = extract_linguistic_units(suggested_doc)
                logger.debug(f"Extracted {len(suggested_units)} units from suggested text")
            except Exception as e:
                logger.error(f"Error extracting units from suggested text: {str(e)}")
                logger.error(traceback.format_exc())
                raise
            
            # Try to align units
            logger.debug(f"Aligning {len(original_units)} original units with {len(suggested_units)} suggested units...")
            segments = align_linguistic_units(original_units, suggested_units, original_doc, suggested_doc)
            logger.info(f"Successfully created {len(segments)} segments")
            
            # If processing the truncated text, add the remainder as a single segment
            if len(original) > max_chars or len(suggested) > max_chars:
                segments.append({
                    "original": original[max_chars:] if len(original) > max_chars else "",
                    "suggested": suggested[max_chars:] if len(suggested) > max_chars else "",
                    "similarity": 0.0
                })
                logger.debug("Added remainder segment for truncated text")
            
            return segments
        except Exception as e:
            logger.error(f"SpaCy processing failed: {str(e)}")
            logger.error(traceback.format_exc())
            raise
    except Exception as e:
        logger.error(f"Error in segment_texts: {str(e)}")
        logger.error(traceback.format_exc())
        logger.info("Falling back to basic segmentation")
        # Return basic fallback segmentation
        return basic_segmentation(original, suggested)

def extract_linguistic_units(doc: Doc) -> List[Dict[str, Any]]:
    """Extract linguistically meaningful units from the text using spaCy"""
    try:
        units = []
        
        # Special case for empty doc
        if len(doc) == 0:
            return units
            
        # Process by sentences first
        for sent in doc.sents:
            try:
                sent_text = sent.text
                
                # For very short sentences, just add the whole sentence
                if len(sent_text.split()) < 5:
                    units.append({
                        "text": sent_text,
                        "start": sent.start_char,
                        "end": sent.end_char
                    })
                    continue
                
                # For each sentence, find meaningful chunks
                chunks = list(sent.noun_chunks)
                
                # Add verb phrases
                for token in sent:
                    if token.pos_ == "VERB" and token.dep_ in ["ROOT", "ccomp", "xcomp"]:
                        try:
                            # Find verb phrase
                            chunks.append(doc[token.i:token.i+1])
                        except Exception as e:
                            logger.warning(f"Error adding verb token: {str(e)}")
                
                # Sort chunks by their position in the sentence
                chunks.sort(key=lambda x: x.start)
                
                # If no chunks were found, use the whole sentence
                if not chunks:
                    units.append({
                        "text": sent_text,
                        "start": sent.start_char,
                        "end": sent.end_char
                    })
                else:
                    # Process chunks
                    last_end = sent.start_char
                    for chunk in chunks:
                        chunk_text = chunk.text
                        chunk_start = sent.start_char + chunk.start_char
                        chunk_end = chunk_start + len(chunk_text)
                        
                        # Add any text between chunks
                        if chunk_start > last_end:
                            between_text = doc.text[last_end:chunk_start]
                            if between_text.strip():  # Only add non-empty text
                                units.append({
                                    "text": between_text,
                                    "start": last_end,
                                    "end": chunk_start
                                })
                        
                        # Add the chunk
                        units.append({
                            "text": chunk_text,
                            "start": chunk_start,
                            "end": chunk_end
                        })
                        
                        last_end = chunk_end
                    
                    # Add any remaining text after the last chunk
                    if last_end < sent.end_char:
                        remaining_text = doc.text[last_end:sent.end_char]
                        if remaining_text.strip():  # Only add non-empty text
                            units.append({
                                "text": remaining_text,
                                "start": last_end,
                                "end": sent.end_char
                            })
            except Exception as e:
                logger.warning(f"Error processing sentence: {str(e)}")
                # Add the whole sentence on error
                units.append({
                    "text": sent.text,
                    "start": sent.start_char,
                    "end": sent.end_char
                })
        
        return units
    except Exception as e:
        logger.error(f"Error in extract_linguistic_units: {str(e)}")
        # Fallback to sentence-level units
        units = []
        try:
            for sent in doc.sents:
                units.append({
                    "text": sent.text,
                    "start": sent.start_char,
                    "end": sent.end_char
                })
        except:
            # Ultimate fallback - treat the whole text as one unit
            units.append({
                "text": doc.text,
                "start": 0,
                "end": len(doc.text)
            })
        return units

def calculate_unit_similarity(text1: str, text2: str, doc1: Doc, doc2: Doc) -> float:
    """Calculate semantic similarity between two text units with robust error handling"""
    try:
        if not text1 or not text2:
            return 0
        
        # Quick check for identical text
        if text1 == text2:
            return 1.0
            
        # Strip and normalize for comparison
        text1_norm = text1.strip().lower()
        text2_norm = text2.strip().lower()
        
        if text1_norm == text2_norm:
            return 1.0
        
        # For all texts, use simple word overlap as the primary method
        # This avoids spaCy's similarity which can be problematic
        words1 = set(text1_norm.split())
        words2 = set(text2_norm.split())
        
        if not words1 or not words2:
            return 0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        jaccard = len(intersection) / len(union) if union else 0
        
        # For longer texts where we have 3+ words, try to use spaCy's similarity
        # but only as a supplement to Jaccard similarity
        if len(words1) >= 3 and len(words2) >= 3:
            try:
                # Only use snippets that are not too long
                max_len = 100  # Characters
                snippet1 = nlp(text1[:max_len])
                snippet2 = nlp(text2[:max_len])
                
                # Check vectors are available
                if snippet1.has_vector and snippet2.has_vector:
                    cosine_sim = snippet1.similarity(snippet2)
                    
                    # Use a weighted average of both similarity metrics
                    # But only if spaCy similarity seems reasonable
                    if 0 <= cosine_sim <= 1:
                        return (jaccard * 0.7) + (cosine_sim * 0.3)
            except Exception as e:
                logger.debug(f"Using Jaccard similarity only: {str(e)}")
                # Just use Jaccard similarity
                pass
        
        return jaccard
    except Exception as e:
        logger.error(f"Error calculating similarity: {str(e)}")
        return 0  # Default to no similarity on error

def align_linguistic_units(
    original_units: List[Dict[str, Any]], 
    suggested_units: List[Dict[str, Any]], 
    original_doc: Doc, 
    suggested_doc: Doc
) -> List[Dict[str, Any]]:
    """Align linguistic units between original and suggested text"""
    try:
        # Handle empty input
        if not original_units and not suggested_units:
            return []
        if not original_units:
            return [{"original": "", "suggested": unit["text"], "similarity": 0} for unit in suggested_units]
        if not suggested_units:
            return [{"original": unit["text"], "suggested": "", "similarity": 0} for unit in original_units]
            
        # Use similarity to align units
        segments = []
        i, j = 0, 0
        
        while i < len(original_units) and j < len(suggested_units):
            try:
                original_unit = original_units[i]
                suggested_unit = suggested_units[j]
                
                # Calculate similarity between units
                similarity = calculate_unit_similarity(
                    original_unit["text"], 
                    suggested_unit["text"],
                    original_doc, 
                    suggested_doc
                )
                
                if similarity > 0.7:  # Units are considered similar
                    segments.append({
                        "original": original_unit["text"],
                        "suggested": suggested_unit["text"],
                        "similarity": similarity
                    })
                    i += 1
                    j += 1
                else:
                    # Units differ - check for best match ahead
                    max_lookahead = min(3, len(original_units) - i, len(suggested_units) - j)
                    best_original_match = -1
                    best_suggested_match = -1
                    best_similarity = 0
                    
                    # Look ahead in original text
                    for k in range(1, max_lookahead + 1):
                        if i + k >= len(original_units):
                            break
                        sim = calculate_unit_similarity(
                            original_units[i + k]["text"],
                            suggested_unit["text"],
                            original_doc,
                            suggested_doc
                        )
                        if sim > 0.7 and sim > best_similarity:
                            best_original_match = i + k
                            best_similarity = sim
                    
                    # Look ahead in suggested text
                    for k in range(1, max_lookahead + 1):
                        if j + k >= len(suggested_units):
                            break
                        sim = calculate_unit_similarity(
                            original_unit["text"],
                            suggested_units[j + k]["text"],
                            original_doc,
                            suggested_doc
                        )
                        if sim > 0.7 and sim > best_similarity:
                            best_suggested_match = j + k
                            best_similarity = sim
                    
                    if best_original_match != -1:
                        # Original text has been replaced or deleted
                        combined_original = ""
                        for k in range(i, best_original_match):
                            combined_original += original_units[k]["text"]
                        
                        segments.append({
                            "original": combined_original,
                            "suggested": "",
                            "similarity": 0
                        })
                        
                        i = best_original_match
                    elif best_suggested_match != -1:
                        # New text has been added in suggested
                        combined_suggested = ""
                        for k in range(j, best_suggested_match):
                            combined_suggested += suggested_units[k]["text"]
                        
                        segments.append({
                            "original": "",
                            "suggested": combined_suggested,
                            "similarity": 0
                        })
                        
                        j = best_suggested_match
                    else:
                        # Units are different but no clear match ahead
                        segments.append({
                            "original": original_unit["text"],
                            "suggested": suggested_unit["text"],
                            "similarity": similarity
                        })
                        
                        i += 1
                        j += 1
            except Exception as e:
                logger.warning(f"Error aligning specific units: {str(e)}")
                # On error, move forward and try to continue
                segments.append({
                    "original": original_units[i]["text"] if i < len(original_units) else "",
                    "suggested": suggested_units[j]["text"] if j < len(suggested_units) else "",
                    "similarity": 0
                })
                i += 1
                j += 1
        
        # Handle any remaining units
        while i < len(original_units):
            original_unit = original_units[i]
            segments.append({
                "original": original_unit["text"],
                "suggested": "",
                "similarity": 0
            })
            i += 1
        
        while j < len(suggested_units):
            suggested_unit = suggested_units[j]
            segments.append({
                "original": "",
                "suggested": suggested_unit["text"],
                "similarity": 0
            })
            j += 1
        
        # Merge very short segments for better readability
        if len(segments) > 1:
            merged_segments = []
            current = segments[0]
            
            for i in range(1, len(segments)):
                # If current segment is very short, merge with next
                if (len(current["original"].split()) <= 1 and len(current["suggested"].split()) <= 1) or \
                   (not current["original"] and len(current["suggested"].split()) <= 2) or \
                   (not current["suggested"] and len(current["original"].split()) <= 2):
                    current = {
                        "original": current["original"] + segments[i]["original"],
                        "suggested": current["suggested"] + segments[i]["suggested"],
                        "similarity": 0.0  # Recomputing similarity is complex, so just set to 0
                    }
                else:
                    merged_segments.append(current)
                    current = segments[i]
            
            merged_segments.append(current)
            segments = merged_segments
            
        return segments
    except Exception as e:
        logger.error(f"Error in align_linguistic_units: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Fallback to basic segmentation
        try:
            original_text = original_doc.text if original_doc else ""
            suggested_text = suggested_doc.text if suggested_doc else ""
            return basic_segmentation(original_text, suggested_text)
        except:
            # Ultimate fallback - whole text as one segment
            return [{
                "original": original_doc.text if original_doc else "",
                "suggested": suggested_doc.text if suggested_doc else "",
                "similarity": 0.0
            }]