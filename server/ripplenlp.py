import spacy
from nltk.corpus import wordnet as wn
import nltk


nltk.download('wordnet')
nltk.download('omw-1.4') 

nlp = spacy.load("en_core_web_sm")

def get_change_of_state_verbs():
    """
    Use WordNet to find verbs related to (COS) change-of-state concepts.
    Returns a set of change-of-state verbs.
    """
    # Define seed words for COS
    seed_words = ["change", "transform", "become", "melt", "freeze", "evaporate", "condense"]

    change_of_state_verbs = set()

    for word in seed_words:
        synsets = wn.synsets(word, pos=wn.VERB)

        for synset in synsets:
            for lemma in synset.lemmas():
                change_of_state_verbs.add(lemma.name())

            for hypernym in synset.hypernyms():
                for lemma in hypernym.lemmas():
                    change_of_state_verbs.add(lemma.name())

            for hyponym in synset.hyponyms():
                for lemma in hyponym.lemmas():
                    change_of_state_verbs.add(lemma.name())

    return change_of_state_verbs

def identify_change_of_state_verbs(text: str, change_of_state_verbs: set) -> dict:
    """
    Identify change-of-state verbs in the given text using spaCy and WordNet.
    Returns a dictionary with the count and list of change-of-state verbs.
    """
    doc = nlp(text)

    change_of_state_count = 0
    change_of_state_words = []

    for token in doc:
        if token.pos_ == "VERB" and token.lemma_.lower() in change_of_state_verbs:
            change_of_state_count += 1
            change_of_state_words.append(token.text)

    return {
        "change_of_state_count": change_of_state_count,
        "change_of_state_words": change_of_state_words
    }

def analyze_pos(text: str) -> dict:
    """
    Analyze the text and return POS tags.
    Returns a dictionary with the list of POS tags.
    """
    doc = nlp(text)
    pos_tags = [(token.text, token.pos_) for token in doc]

    return {
        "pos_tags": pos_tags
    }

def count_causal_connectives(text: str) -> dict:
    """
    Count the number of causal connectives in the given text.
    Returns a dictionary with the count and list of causal connectives.
    """
    doc = nlp(text)
    causal_count = 0
    causal_words = []

    for i in range(len(doc) - 1):
        if doc[i].text.lower() in CAUSAL_CONNECTIVES:
            causal_count += 1
            causal_words.append(doc[i].text)
        
        if i < len(doc) - 2:
            phrase = f"{doc[i].text} {doc[i + 1].text} {doc[i + 2].text}".lower()
            if phrase in CAUSAL_CONNECTIVES:
                causal_count += 1
                causal_words.append(phrase)

    return {
        "causal_count": causal_count,
        "causal_words": causal_words
    }

# Define causal connectives (including multi-word phrases)
CAUSAL_CONNECTIVES = ["although", "arise", "arises", "arising", "arose", "because", "cause", "caused", "causes", "causing", "condition", "conditions", "consequence", "consequences", "consequent", "consequently", "due to", "enable", "enabled", "enables", "enabling", "even then", "follow that", "follow the", "follow this", "followed that", "followed the", "followed this", "following that", "follows the", "follows this", "hence", "made", "make", "makes", "making", "nevertheless", "nonetheless", "only if", "provided that", "result", "results", "since", "so", "therefore", "though", "thus", "unless", "whenever"]