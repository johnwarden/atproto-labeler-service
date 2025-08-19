# Bluesky Labeler Management Commands
# Usage: just <command>

set dotenv-load := true


ENDPOINT := "https://$LABELER_DOMAIN"


# Default recipe - show available commands
default:
    @just --list

# One-command health check of everything
status: labeler-status health fly-status

# Check labeler service record and configuration  
labeler-status:
    @echo "🔍 Checking labeler service record..."
    curl -s "https://bsky.social/xrpc/com.atproto.repo.getRecord?repo=${LABELER_DID}&collection=app.bsky.labeler.service&rkey=self" | jq .

# Check environment variables
env:
    @echo "🔧 Environment variables status:"
    @echo "LABELER_DID: ${LABELER_DID:0:20}..."
    @echo "SIGNING_KEY: ${SIGNING_KEY:0:20}..."
    @echo "PORT: ${PORT:-'not set'}"

# Show current labeler info
info:
    @echo "ℹ️ Labeler Information:"
    @echo "DID: ${LABELER_DID}"
    @echo "Production URL: {{ENDPOINT}}"
    @echo "API URL: {{ENDPOINT}}:8081"
    @echo ""
    @echo "✅ Database: PERSISTENT (/mnt/labels.db on volume)"
    @echo "💾 Volume: labeler_data (1GB, encrypted)"

# Check service health endpoints
health:
    @echo "\n🏥 Checking API server health..."
    @curl -s "{{ENDPOINT}}:8081/health" | jq . || echo "API server: ❌ Not responding"

# Show recent application logs
logs:
    fly logs -a $APP_NAME

# Set up or update labeler configuration
# Only saves keys to .env if setup succeeds (atomic operation)
setup:
    @echo "🚀 Setting up labeler with CLI arguments..."
    @echo "Using DID: ${LABELER_DID}"
    @echo "Using endpoint: {{ENDPOINT}}"
    @echo "Using labels config: ./labels.json"
    @echo ""
    @echo "⚠️  You will need to enter the PLC token from your email when prompted."
    @echo "📧 The setup will pause to wait for your email confirmation code."
    @echo ""
    ./setup-labeler.sh

# Generate a new signing key and save to .env
generate-signing-key:
    @echo "🔑 Generating new signing key..."
    #!/bin/bash
    NEW_KEY=$(openssl rand -hex 32); \
    if grep -q "^SIGNING_KEY=" .env 2>/dev/null; then \
        sed -i.bak "s/^SIGNING_KEY=.*/SIGNING_KEY=$NEW_KEY/" .env; \
        echo "✅ Updated existing signing key in .env"; \
    else \
        echo "SIGNING_KEY=$NEW_KEY" >> .env; \
        echo "✅ Added new signing key to .env"; \
    fi
    @echo "🔄 Reload your shell or run 'direnv reload' to use the new key"

# Clears the labeler -- reset the labeler account to a regular account.
# Note: Still requires interactive PLC token confirmation
clear:
    npx johnwarden-labeler clear --did="${LABELER_DID}" --password="${LABELER_PASSWORD}"

# Recreate the labeler -- fully non-interactive
recreate:
    npx johnwarden-labeler recreate --did="${LABELER_DID}" --password="${LABELER_PASSWORD}"

# Add a new label definition
add-label-def:
    @echo "🏷️ Adding new label definition..."
    npx johnwarden-labeler label add


# === Labeling Operations ===

# Query labels from AT Protocol endpoint
query-labels:
    @echo "🏷️ Querying all labels from AT Protocol endpoint..."
    curl -s "{{ENDPOINT}}/xrpc/com.atproto.label.queryLabels" | jq .

# Add label to a post (optional second argument for label, defaults to first label in labels.json)
add-label URI LABEL="":
    @echo "🏷️ Adding label to: {{URI}}"
    curl -s "{{ENDPOINT}}:8081/label?uri={{URI}}&label={{LABEL}}" | jq .

# Query labels for a specific URI
query-uri URI:
    @echo "🔍 Querying labels for: {{URI}}"
    curl -s "{{ENDPOINT}}/xrpc/com.atproto.label.queryLabels?uris={{URI}}" | jq .

# Test API endpoint with example URL
test-api:
    @echo "🧪 Testing API endpoint with example URL..."
    curl -s "{{ENDPOINT}}:8081/health" | jq .
    @echo "\n🧪 Testing label endpoint (default label)..."
    curl -s "{{ENDPOINT}}:8081/label?uri=https://bsky.app/profile/thecraigmancometh.bsky.social/post/3lvl3tdft7c2s" | jq .

# === Development Commands (Local Server) ===

# Run locally for development
dev:
    @echo "🔧 Starting local development server..."
    node --watch index.js

# Add label to a post (local development server)
add-label-dev URI LABEL="":
    @echo "🏷️ Adding label to: {{URI}} (local dev)"
    curl -s "http://localhost:8081/label?uri={{URI}}&label={{LABEL}}" | jq .
    @echo ""
    @echo "✅ Dev label request completed."

# Query labels from local development server
query-labels-dev:
    @echo "🏷️ Querying all labels from local AT Protocol endpoint..."
    curl -s "http://localhost:8080/xrpc/com.atproto.label.queryLabels" | jq .

# Query labels for a specific URI (local development server)
query-uri-dev URI:
    @echo "🔍 Querying labels for: {{URI}} (local dev)"
    curl -s "http://localhost:8080/xrpc/com.atproto.label.queryLabels?uris={{URI}}" | jq .

# Test local development API endpoints
test-api-dev:
    @echo "🧪 Testing local development API endpoints..."
    @echo "🔍 Health check:"
    curl -s "http://localhost:8081/health"
    @echo "\n🧪 Testing label endpoint with example URL (default label):"
    curl -s "http://localhost:8081/label?uri=https://bsky.app/profile/thecraigmancometh.bsky.social/post/3lvl3tdft7c2s" | jq .

# === Deployment & Management ===

# Set up persistent storage volume (required for database persistence)
setup-volume:
    @echo "💾 Setting up persistent storage volume..."
    @echo "1️⃣ Creating volume for SQLite database..."
    fly volumes create labeler_data --region sjc --size 1  --app $APP_NAME
    @echo "2️⃣ Volume created successfully!"

setup-cert:
    fly certs add $LABELER_DOMAIN --app $APP_NAME


# Deploy to Fly.io
deploy:
    # Todo: pass labeler DID here, not as secret
    fly deploy --app $APP_NAME

# Complete Fly.io deployment setup (creates app, sets secrets, creates volume, deploys)
fly-setup:
    @echo "🚀 Complete Fly.io deployment setup for $APP_NAME..."
    @echo "1️⃣ Creating Fly.io app..."
    fly apps create $APP_NAME
    @echo "2️⃣ Setting secrets from environment..."
    fly secrets set LABELER_DID="${LABELER_DID}" --app $APP_NAME
    fly secrets set LABELER_PASSWORD="${LABELER_PASSWORD}" --app $APP_NAME
    fly secrets set SIGNING_KEY="${SIGNING_KEY}" --app $APP_NAME
    @echo "3️⃣ Creating persistent storage volume..."
    just setup-volume
    @echo "4️⃣ Deploying application..."
    just deploy
    @echo "✅ Deployment complete!"
    @echo "🔗 Your labeler is available at: {{ENDPOINT}}"
    @echo "💡 Next: Run 'just setup' to configure your labeler"

# Restart the Fly.io application
restart:
    fly app restart

# Check Fly.io app status
fly-status:
    fly status --app $APP_NAME
    
# Open Fly.io dashboard
fly-dashboard:
    fly dashboard --app $APP_NAME
    
# === Development ===


# Build the forked labeler (now linked)
build-labeler-package:
    @echo "🔄 Building linked labeler..."
    cd ../johnwarden-labeler && just build
    @echo "✅ Forked labeler built! Changes are automatically available via npm link."

# Setup npm link between projects (run once)
setup-link:
    @echo "🔗 Setting up npm link between projects..."
    cd ../johnwarden-labeler && npm link
    npm link @johnwarden/labeler
    @echo "✅ Projects are now linked! Use 'just update-labeler' to rebuild."

# Remove npm link and go back to packaged install
unlink-labeler:
    @echo "🔗 Removing npm link..."
    npm unlink @johnwarden/labeler
    cd ../johnwarden-labeler && npm unlink
    @echo "Installing from package..."
    npm install ../johnwarden-labeler/johnwarden-labeler-0.2.1.tgz
    @echo "✅ Back to packaged installation."