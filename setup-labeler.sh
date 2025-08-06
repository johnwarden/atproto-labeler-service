#!/bin/bash
set -e

echo "🔑 Checking signing key..."
if [ -z "${SIGNING_KEY}" ]; then
    echo "🔑 Generating new signing key for setup..."
    TEMP_SIGNING_KEY=$(openssl rand -hex 32)
    echo "🔑 Generated temporary signing key (will save to .env only if setup succeeds)"
else
    echo "🔑 Using existing signing key: ${SIGNING_KEY}"
    TEMP_SIGNING_KEY="${SIGNING_KEY}"
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
    --endpoint="https://${APP_NAME}.fly.dev" \
    --signing-key="$TEMP_SIGNING_KEY" \
    --labels-config="./labels.json" 2>&1 | tee "$TEMP_OUTPUT_FILE"; then
    
    echo "---"
    
    if grep -q "PLC_TOKEN=" "$TEMP_OUTPUT_FILE"; then
        # Extract PLC token (for verification only)
        PLC_TOKEN=$(grep "PLC_TOKEN=" "$TEMP_OUTPUT_FILE" | cut -d'=' -f2)
    
    # Save signing key to .env if it was newly generated
    if [ -z "${SIGNING_KEY}" ]; then
        if grep -q "^SIGNING_KEY=" .env 2>/dev/null; then
            sed -i.bak "s/^SIGNING_KEY=.*/SIGNING_KEY=$TEMP_SIGNING_KEY/" .env
        else
            echo "SIGNING_KEY=$TEMP_SIGNING_KEY" >> .env
        fi
        echo "🔑 Saved new signing key to .env"
    fi
    
        echo ""
        echo "✅ Setup complete! Signing key saved to .env file."
        echo "🔄 Run 'direnv reload' to use the new signing key in your environment."
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