# Dockerfile (place this in your repository ROOT)
FROM --platform=linux/amd64 python:3.12-slim

# Set working directory
WORKDIR /app

# First copy ONLY requirements.txt for efficient layer caching
COPY server/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --upgrade openai

# Copy the rest of the server files
COPY server/ .

# Environment variables
ENV FLASK_APP=app.py \
    FLASK_ENV=production

# Expose and run
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--timeout", "120", "app:app"]