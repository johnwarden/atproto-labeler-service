import 'dotenv/config';
import { LabelerServer } from '@skyware/labeler';
import { Client, simpleFetchHandler } from '@atcute/client';
import express from 'express';
import fs from 'fs';

console.log('🚀 Starting Bluesky Labeler with HTTP API...');

// Check if we have the required environment variables
if (!process.env.LABELER_DID) {
    console.error('❌ Missing LABELER_DID environment variable');
    console.log('💡 Run: npx @skyware/labeler setup');
    console.log('💡 Then copy the generated values to your .env file');
    process.exit(1);
}

if (!process.env.SIGNING_KEY) {
    console.error('❌ Missing SIGNING_KEY environment variable');
    console.log('💡 Run: npx @skyware/labeler setup');
    console.log('💡 Then copy the generated values to your .env file');
    process.exit(1);
}

if ( !process.env.INTERNAL_API_PORT ) {
    throw new Error('❌ Missing INTERNAL_API_PORT environment variable for internal API');
}


if ( !process.env.PORT ) {
    throw new Error('❌ Missing PORT environment variable');
}

console.log('✅ Environment variables found, creating labeler server...');

// Create labeler server with configuration
const server = new LabelerServer({
    did: process.env.LABELER_DID,
    signingKey: process.env.SIGNING_KEY,
    // Optional custom database path
    ...(process.env.DB_PATH && { dbPath: process.env.DB_PATH }),
});

const port = process.env.PORT;

console.log('🔧 Starting labeler server on port ' + port);


// Start the labeler server
server.start({ port: port, host: '0.0.0.0' }, async (error) => {
    if (error) {
        console.error('❌ Failed to start labeler server:', error);
        process.exit(1);
    } else {
        console.log('✅ Labeler server started successfully!');
        console.log(`🌐 Server running on 0.0.0.0:${port}`);
        console.log(`🏷️  Labeler DID: ${process.env.LABELER_DID}`);
        console.log(`📊 Database: ${process.env.DB_PATH || './labels.db'}`);
        console.log('🎯 Ready to receive labeling requests!');
        
        // Start the HTTP API server for manual labeling
        await startHttpApiServer(server);
    }
});

async function startHttpApiServer(labelerServer) {
    console.log('🌐 Starting HTTP API server for manual labeling...');
    
    // Internal API configuration for /label endpoint
    const internalApiPort = process.env.INTERNAL_API_PORT;
    
    console.log(`🔧 Internal API will run on private network port ${internalApiPort}`);

    // Load available labels from labels.json
    let availableLabels = [];
    try {
        const labelsData = fs.readFileSync('./labels.json', 'utf8');
        availableLabels = JSON.parse(labelsData);
        console.log(`📋 Loaded ${availableLabels.length} available labels:`, availableLabels.map(l => l.identifier).join(', '));
    } catch (error) {
        console.error('❌ Failed to load labels.json:', error.message);
        process.exit(1);
    }

    const handler = simpleFetchHandler({ service: 'https://public.api.bsky.app' });
    const client = new Client({ handler });

    // Create XRPC client for handle resolution (no authentication needed for public endpoints)
    // const client = new XRPC({ handler: { handle: 'https://bsky.social' } });
    
    // Utility function to convert bsky.app URLs to at:// URIs
    async function convertToAtUri(uri) {
        // If it's already an at:// URI, return it as-is
        if (uri.startsWith('at://')) {
            return uri;
        }
        
        // Parse bsky.app URL
        // Format: https://bsky.app/profile/{handle}/post/{postId}
        const bskyUrlMatch = uri.match(/https:\/\/bsky\.app\/profile\/([^\/]+)\/post\/([^\/\?]+)/);
        if (bskyUrlMatch) {
            const handle = bskyUrlMatch[1];
            const postId = bskyUrlMatch[2];
            
            try {
                // Resolve handle to DID using XRPC client
                const response = await client.get('app.bsky.actor.getProfile', {
                    params: { actor: handle }
                });
                const did = response.data.did;
                
                // Convert to at:// URI
                return `at://${did}/app.bsky.feed.post/${postId}`;
            } catch (error) {
                console.error(`❌ Failed to resolve handle ${handle}:`, error.message);
                throw new Error(`Could not resolve handle: ${handle}`);
            }
        }
        
        throw new Error(`Unsupported URI format: ${uri}`);
    }
    
    // Create internal API app for /label endpoint
    const internalApp = express();
    
    // Endpoint to manually label posts (internal IPv6 only)
    internalApp.get('/label', async (req, res) => {
        try {
            const { uri, label: requestedLabel, neg } = req.query;
            
            if (!uri) {
                return res.status(400).json({
                    error: 'Missing uri parameter',
                    usage: 'GET /label?uri=<at_uri_or_bsky_url>&label=<label_identifier>&neg=<true|false>',
                    availableLabels: availableLabels.map(l => l.identifier)
                });
            }
            
            // Parse and validate the neg parameter
            let isNegative = false;
            if (neg !== undefined) {
                if (neg === 'true' || neg === '1') {
                    isNegative = true;
                } else if (neg === 'false' || neg === '0' || neg === '') {
                    isNegative = false;
                } else {
                    return res.status(400).json({
                        error: 'Invalid neg parameter',
                        message: 'neg parameter must be "true", "false", "1", "0", or omitted',
                        usage: 'GET /label?uri=<at_uri_or_bsky_url>&label=<label_identifier>&neg=<true|false>'
                    });
                }
            }
            
            // Determine which label to use
            let labelVal = requestedLabel;
            if (!labelVal || labelVal.trim() === '') {
                // Use the first label as default
                labelVal = availableLabels[0]?.identifier;
                if (!labelVal) {
                    return res.status(500).json({
                        error: 'No labels available',
                        message: 'No labels found in labels.json'
                    });
                }
                console.log(`🏷️ No label specified, using default: ${labelVal}`);
            } else {
                // Validate that the requested label exists
                const labelExists = availableLabels.some(l => l.identifier === labelVal);
                if (!labelExists) {
                    return res.status(400).json({
                        error: 'Invalid label',
                        message: `Label '${labelVal}' not found`,
                        availableLabels: availableLabels.map(l => l.identifier)
                    });
                }
                console.log(`🏷️ Using requested label: ${labelVal}`);
            }
            
            console.log(`🏷️ Manual labeling request: ${uri} with label: ${labelVal}${isNegative ? ' (NEGATIVE)' : ''}`);
            
            // Convert to at:// URI if needed
            const atUri = await convertToAtUri(uri);
            console.log(`🔗 Resolved to: ${atUri}`);
            
            // Create the label
            const label = {
                src: process.env.LABELER_DID,
                uri: atUri,
                val: labelVal,
                cts: new Date().toISOString(),
                ...(isNegative && { neg: true })
            };
            
            // Save the label
            await labelerServer.saveLabel(label);
            
            console.log(`✅ Successfully applied "${labelVal}"${isNegative ? ' (NEGATIVE)' : ''} label to: ${atUri}`);
            console.log(`📊 Label details: ${JSON.stringify(label, null, 2)}`);
            
            // Return success response
            res.json({
                success: true,
                message: `${isNegative ? 'Negative label' : 'Label'} applied successfully`,
                label: {
                    uri: atUri,
                    value: labelVal,
                    negative: isNegative,
                    timestamp: label.cts
                }
            });
            
        } catch (error) {
            console.error('❌ Error in manual labeling:', error);
            res.status(500).json({
                error: 'Failed to apply label',
                message: error.message
            });
        }
    });
    
    // Health check endpoint (internal API only)
    internalApp.get('/health', (req, res) => {
        res.json({ status: 'ok', service: 'labeler-internal-api' });
    });
  
    console.log('🔧 Starting internal labeler API server...');

    // Start the internal API server (for /label endpoint)
    // Bind to all interfaces (::) so it's accessible on the private network
    internalApp.listen(internalApiPort, '::', () => {
        console.log(`✅ Internal API server started on [::]:${internalApiPort}`);
        console.log(`🔗 Manual labeling endpoint accessible via private network on port ${internalApiPort}`);
        console.log(`💚 Internal health check: http://[::]:${internalApiPort}/health`);
    });
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down labeler server...');
    process.exit(0);
});