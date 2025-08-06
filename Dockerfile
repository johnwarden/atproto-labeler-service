# Use the official Node.js 20 image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create a non-root user
RUN groupadd -r labeler && useradd -r -g labeler labeler
RUN chown -R labeler:labeler /app
USER labeler

# Expose port (fly.io will set PORT environment variable)
EXPOSE 8080

# Start the application
CMD ["node", "index.js"]