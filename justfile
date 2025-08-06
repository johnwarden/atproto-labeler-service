# Bluesky Labeler Management Commands
# Usage: just <command>

set dotenv-load := true

# Default recipe - show available commands
default:
    @just --list

# Check labeler service record and configuration  
labeler-status:
    @echo "🔍 Checking labeler service record..."
    curl -s "https://bsky.social/xrpc/com.atproto.repo.getRecord?repo=${LABELER_DID}&collection=app.bsky.labeler.service&rkey=self" | jq .

# Check service health endpoints
health:
    @echo "\n🏥 Checking API server health..."
    @curl -s "https://$APP_NAME.fly.dev:8082/health" | jq . || echo "API server: ❌ Not responding"

# Show recent application logs
logs:
    fly logs

# Set up or update labeler configuration
setup-labeler:
    @echo "⚠️  MANUAL SETUP REQUIRED ⚠️"
    @echo "The labeler setup command is interactive and cannot be automated."
    @echo ""
    @echo ""
    @echo "Use these values when prompted:"
    @echo "DID: ${LABELER_DID}"
    @echo "Password: ${LABELER_PASSWORD}"
    @echo "PDS URL: https://bsky.social"
    @echo "Labeler URL: https://$APP_NAME.fly.dev"
    @echo ""
    @echo "Label Configuration:"
    @echo "- Identifier: needs-context"
    @echo "- Name: Readers Added Context"
    @echo "- Description: The Community Notes algorithm has rated a note on this post as \"helpful\""
    @echo "- Adult content: no"
    @echo "- Severity: Alert"
    @echo "- Hide content: None"
    @echo "- Default setting: Warn"
    @echo ""
    npx @skyware/labeler setup

# Clears the labeler -- reset the labeler account to a regular account.
clear-labeler:
    npx @skyware/labeler clear

# Recreate the labeler --
recreate-labeler:
    npx @skyware/labeler recreate
    just clear-db
    just restart

# Add a new label definition
add-label-def:
    @echo "🏷️ Adding new label definition..."
    npx @skyware/labeler label add

# Query labels from AT Protocol endpoint
query-labels:
    @echo "🏷️ Querying all labels from AT Protocol endpoint..."
    curl -s "https://$APP_NAME.fly.dev/xrpc/com.atproto.label.queryLabels" | jq .


# === Labeling Operations ===

# Add needs-context label to a post
add-label URI:
    @echo "🏷️ Adding 'needs-context' label to: {{URI}}"
    curl -s "https://$APP_NAME.fly.dev:8082/label?uri={{URI}}" | jq .
    @echo "\n✅ Label request completed. Check logs with: just logs"

# Query labels for a specific URI
query-uri URI:
    @echo "🔍 Querying labels for: {{URI}}"
    curl -s "https://$APP_NAME.fly.dev/xrpc/com.atproto.label.queryLabels?uris={{URI}}" | jq .

# Test API endpoint with example URL
test-api:
    @echo "🧪 Testing API endpoint with example URL..."
    curl -s "https://$APP_NAME.fly.dev:8082/health" | jq .
    @echo "\n🧪 Testing label endpoint..."
    curl -s "https://$APP_NAME.fly.dev:8082/label?uri=https://bsky.app/profile/thecraigmancometh.bsky.social/post/3lvl3tdft7c2s" | jq .

# === Deployment & Management ===

# Set up persistent storage volume (required for database persistence)
setup-volume:
    @echo "💾 Setting up persistent storage volume..."
    @echo "1️⃣ Creating volume for SQLite database..."
    fly volumes create labeler_data --region sjc --size 1 --app testlabeler1
    @echo "2️⃣ Volume created successfully!"
    @echo "3️⃣ Next steps:"
    @echo "   • Update fly.toml to mount the volume"
    @echo "   • Set DB_PATH=/mnt/labels.db in environment"
    @echo "   • Run: just setup-persistence"

clear-db:
    fly ssh console -C "rm /mnt/labels.db" -C "rm /mnt/labels.db-shm" -C "rm /mnt/labels.db-wal"

# === Deployment & Management ===

# Deploy to Fly.io
deploy:
    fly deploy

# Restart the Fly.io application
restart:
    fly app restart

# Check Fly.io app status
fly-status:
    fly status
    
# Open Fly.io dashboard
fly-dashboard:
    fly dashboard
    
# === Development ===

# Run locally for development
dev:
    @echo "🔧 Starting local development server..."
    npm run dev

# One-command health check of everything
status: labeler-status health fly-status

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
    @echo "Production URL: https://$APP_NAME.fly.dev"
    @echo "API URL: https://$APP_NAME.fly.dev:8082"
    @echo ""
    @echo "✅ Database: PERSISTENT (/mnt/labels.db on volume)"
    @echo "💾 Volume: labeler_data (1GB, encrypted)"