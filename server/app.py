from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from openai import OpenAI
import requests
import io
from PIL import Image
from dotenv import load_dotenv
import os
import base64
import json
import time
from datetime import datetime

load_dotenv()

HOSTNAME = os.getenv('HOSTNAME')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

# Validate environment variables
missing_vars = []
if not OPENAI_API_KEY:
    missing_vars.append('OPENAI_API_KEY')

if missing_vars:
    raise ValueError(f"Missing environment variables: {', '.join(missing_vars)}")

app = Flask(__name__)

CORS(app, supports_credentials=True, origins=[HOSTNAME])

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
)

def process_image(image):
    """
    Processes the uploaded schedule image using OpenAI's GPT model to extract schedule details.
    """
    try:
        image_bytes = image.read()
        img = Image.open(io.BytesIO(image_bytes))
        img_type = img.format.lower()
        # Convert to grayscale
        img_gray = img.convert('L')
        buffer = io.BytesIO()
        img_gray.save(buffer, format=img_type)
        image_bytes = buffer.getvalue()

        encoded_image = base64.b64encode(image_bytes).decode('utf-8')
        prompt = f"""
       You are a manual interpretation assistant that reads and cleans schedule data from descriptions of calendar images.
        Only respond with the interpreted events in JSON format with the following fields:

        eventName (or empty string if not found)
        description (or empty string if not found)
        location (or empty string if not found)
        startTime (time the event starts in HH
        format, or empty string if not found)
        endTime (time the event ends in HH
        format, or empty string if not found)
        rrule (optional, for recurrence rules. Use the format FREQ=WEEKLY;BYDAY=MO,WE,FR, or empty string if not found)
        Instructions:
        Manual Interpretation: Assume you are manually reading a described or visually presented schedule. Do not rely on OCR or other automated extraction methods.
        Weekly Recurrence: Assume all events repeat weekly unless explicitly specified otherwise.
        Group Recurring Events: If an event occurs on multiple days within the same week, group them into a single calendar event.
        Set the rrule field to include all relevant days using the BYDAY parameter.
        For example, if an event occurs on Monday, Wednesday, and Friday, set rrule to "FREQ=WEEKLY;BYDAY=MO,WE,FR".
        Group by Name: Ensure that events with the same exact name are grouped together.
        Focus on Structure: Provide all interpreted events as a JSON array. Each event should be a JSON object with the fields listed above.
        """

        response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/{img_type};base64,{encoded_image}"},
                            },
                        ],
                    }
                ],
            max_tokens=2000,
        )

        ocr_result = response.choices[0].message.content.strip()

        try:
            # Attempt to parse JSON from the response
            if ocr_result.startswith("```") and ocr_result.endswith("```"):
                    ocr_result = ocr_result[3:-3].strip()
            if ocr_result.startswith("json"):
                ocr_result = ocr_result[4:].strip()
            events_json = json.loads(ocr_result)
            return events_json
        except json.JSONDecodeError as jde:
            print(f"JSON decoding error: {jde}")
            print(f"OCR Result: {ocr_result}")
            return {"error": "Failed to parse OCR result into JSON."}

    except Exception as e:
        print(f"Error during OCR processing: {e}")
        return {"error": "OCR processing failed."}

@app.route("/process_schedule", methods=["POST"])
def process_schedule():
    """
    Endpoint to process uploaded schedule images and return structured event data.
    """
    # Check if an image file was uploaded
    if 'schedule_image' not in request.files:
        return jsonify({"error": "No schedule image uploaded"}), 400

    image = request.files['schedule_image']

    # Process the image to extract schedule details
    schedule_data = process_image(image)

    if "error" in schedule_data:
        return "error", 500

    return schedule_data

@app.route('/status', methods=['GET'])
def status():
    """
    Endpoint to check if the backend is running.
    """
    return jsonify({"message": "Backend is running"}), 200

if __name__ == "__main__":
    app.run(host='127.0.0.1', port=5000, debug=True)
