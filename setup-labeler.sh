#!/bin/bash
set -e

echo "🔑 Checking signing key..."
if [ -z "${SIGNING_KEY}" ]; then
    echo "❌ SIGNING_KEY environment variable is required but not set"
    echo "💡 Generate a signing key first: just generate-signing-key"
    echo "💡 Then add it to your environment and run setup again"
    exit 1
else
    echo "🔑 Using signing key: ${SIGNING_KEY:0:20}..."
fi

echo ""
echo "🚀 Running setup command..."

# Run the setup command interactively, but capture PLC token from stdout
echo "🔗 Running interactive setup..."
TEMP_OUTPUT_FILE=$(mktemp)

# Run setup command and tee output to both screen and file
if npx johnwarden-labeler setup \
    --did="${LABELER_DID}" \
    --password="${LABELER_PASSWORD}" \
    --endpoint="${ENDPOINT}" \
    --signing-key="${SIGNING_KEY}" \
    --labels-config="./labels.json" 2>&1 | tee "$TEMP_OUTPUT_FILE"; then
    
    echo "---"
    
    if grep -q "PLC_TOKEN=" "$TEMP_OUTPUT_FILE"; then
        # Extract PLC token (for verification only)
        PLC_TOKEN=$(grep "PLC_TOKEN=" "$TEMP_OUTPUT_FILE" | cut -d'=' -f2)
    
        echo ""
        echo "✅ Setup complete!"
    else
        echo "⚠️  No PLC_TOKEN found in output - setup may have failed."
        rm -f "$TEMP_OUTPUT_FILE"
        exit 1
    fi
    
    # Cleanup temp file
    rm -f "$TEMP_OUTPUT_FILE"
    
else
    echo "⚠️  Setup command failed - no changes made to .env file."
    if [ -f "$TEMP_OUTPUT_FILE" ]; then
        echo "Error output:"
        cat "$TEMP_OUTPUT_FILE"
    fi
    rm -f "$TEMP_OUTPUT_FILE"
    exit 1
fi