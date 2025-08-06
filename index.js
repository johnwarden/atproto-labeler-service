import 'dotenv/config';
import { LabelerServer } from '@skyware/labeler';
import { Bot } from '@skyware/bot';
import express from 'express';

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

console.log('✅ Environment variables found, creating labeler server...');

// Create labeler server with configuration
const server = new LabelerServer({
    did: process.env.LABELER_DID,
    signingKey: process.env.SIGNING_KEY,
    // Optional custom database path
    ...(process.env.DB_PATH && { dbPath: process.env.DB_PATH }),
});

const port = process.env.PORT || 8080;

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
    
    const app = express();
    const apiPort = process.env.API_PORT || 8081;

    
    // Create a bot instance for handle resolution
    const apiBot = new Bot();
    await apiBot.login({
        identifier: process.env.LABELER_DID,
        password: process.env.LABELER_PASSWORD || 'password',
    });
    
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
                // Resolve handle to DID
                const profile = await apiBot.getProfile(handle);
                const did = profile.did;
                
                // Convert to at:// URI
                return `at://${did}/app.bsky.feed.post/${postId}`;
            } catch (error) {
                console.error(`❌ Failed to resolve handle ${handle}:`, error.message);
                throw new Error(`Could not resolve handle: ${handle}`);
            }
        }
        
        throw new Error(`Unsupported URI format: ${uri}`);
    }
    
    // Endpoint to manually label posts
    app.get('/label', async (req, res) => {
        try {
            const { uri } = req.query;
            
            if (!uri) {
                return res.status(400).json({
                    error: 'Missing uri parameter',
                    usage: 'GET /label?uri=<at_uri_or_bsky_url>'
                });
            }
            
            console.log(`🏷️ Manual labeling request: ${uri}`);
            
            // Convert to at:// URI if needed
            const atUri = await convertToAtUri(uri);
            console.log(`🔗 Resolved to: ${atUri}`);
            
            // Create the label
            const label = {
                src: process.env.LABELER_DID,
                uri: atUri,
                val: 'needs-context',
                cts: new Date().toISOString(),
            };
            
            // Save the label
            await labelerServer.saveLabel(label);
            
            console.log(`✅ Successfully applied "needs-context" label to: ${atUri}`);
            console.log(`📊 Label details: ${JSON.stringify(label, null, 2)}`);
            
            // Return success response
            res.json({
                success: true,
                message: 'Label applied successfully',
                label: {
                    uri: atUri,
                    value: 'needs-context',
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
    
    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', service: 'labeler-api' });
    });
  
    console.log('🔧 Starting labeler API server on port ' + apiPort);

    // Start the API server
    app.listen(apiPort, '0.0.0.0', () => {
        console.log(`✅ HTTP API server started on 0.0.0.0:${apiPort}`);
        console.log(`🔗 Manual labeling endpoint: http://0.0.0.0:${apiPort}/label?uri=<uri>`);
        console.log(`💡 Example: curl "http://0.0.0.0:${apiPort}/label?uri=https://bsky.app/profile/user.bsky.social/post/abc123"`);
    });
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down labeler server...');
    process.exit(0);
});