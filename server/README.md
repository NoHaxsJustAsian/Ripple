# Ripple Server

A Flask-based backend for the Ripple writing assistant application.

## Structure

The server uses a monolithic file structure with all functionality in app.py:

- Text analysis (paragraph, section, document)
- Theme consistency checking
- Context-aware analysis
- Chat functionality
- NLP features for connectives analysis

## Setup

1. Clone the repository
2. Set up environment variables in `.env`:
   ```
   HOSTNAME=http://localhost:3000
   OPENAI_API_KEY=your_openai_key
   ```
3. Install dependencies:
   ```
   pip install -r requirements.txt
   python -m spacy download en_core_web_sm
   ```

## Running the Server

```bash
# Using the provided script
./run.sh

# Or manually
python app.py
```

The server will run on http://127.0.0.1:5000 by default.

## API Endpoints

- `GET /api/health` - Health check endpoint
- `POST /api/analyze` - Analyze text content
- `POST /api/analyze-context` - Analyze text with document context
- `POST /api/chat` - Chat with the AI assistant

## Dependencies

- Flask - Web framework
- OpenAI - GPT model access
- spaCy - NLP processing
- NLTK - Natural language toolkit 