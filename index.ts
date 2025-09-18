import { LabelerServer, type CreateLabelData, type SavedLabel } from '@skyware/labeler';
import { Client, simpleFetchHandler } from '@atcute/client';
import express, { Request, Response } from 'express';
import fs from 'fs';

// Type definitions
interface LabelDefinition {
    identifier: string;
    name: string;
    description: string;
    adultOnly: boolean;
    severity: 'alert' | 'inform' | 'none';
    blurs: 'content' | 'media' | 'none';
    defaultSetting: 'ignore' | 'warn' | 'hide';
}

// Using CreateLabelData from @skyware/labeler instead of custom Label interface

interface LabelResponse {
    success: boolean;
    message: string;
    label: {
        uri: string;
        value: string;
        negative: boolean;
        timestamp: string;
    };
}

interface ErrorResponse {
    error: string;
    message?: string;
    usage?: string;
    availableLabels?: string[];
}

interface HealthResponse {
    status: string;
    service: string;
}

// Environment variable validation with type assertions
function validateEnvironment(): void {
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

    if (!process.env.INTERNAL_API_PORT) {
        throw new Error('❌ Missing INTERNAL_API_PORT environment variable for internal API');
    }

    if (!process.env.PORT) {
        throw new Error('❌ Missing PORT environment variable');
    }
}

console.log('🚀 Starting Bluesky Labeler with HTTP API...');

// Validate environment variables
validateEnvironment();

console.log('✅ Environment variables found, creating labeler server...');

// Create labeler server with configuration
const server = new LabelerServer({
    did: process.env.LABELER_DID!,
    signingKey: process.env.SIGNING_KEY!,
    // Optional custom database path
    ...(process.env.DB_PATH && { dbPath: process.env.DB_PATH }),
});

const port: number = parseInt(process.env.PORT!);

console.log('🔧 Starting labeler server on port ' + port);

// Start the labeler server
server.start({ port: port, host: '0.0.0.0' }, async (error: Error | null, address: string) => {
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

async function startHttpApiServer(labelerServer: LabelerServer): Promise<void> {
    console.log('🌐 Starting HTTP API server for manual labeling...');
    
    // Internal API configuration for /label endpoint
    const internalApiPort: string = process.env.INTERNAL_API_PORT!;
    
    console.log(`🔧 Internal API will run on private network port ${internalApiPort}`);

    // Load available labels from labels.json
    let availableLabels: LabelDefinition[] = [];
    try {
        const labelsData: string = fs.readFileSync('./labels.json', 'utf8');
        availableLabels = JSON.parse(labelsData) as LabelDefinition[];
        console.log(`📋 Loaded ${availableLabels.length} available labels:`, availableLabels.map(l => l.identifier).join(', '));
    } catch (error) {
        console.error('❌ Failed to load labels.json:', (error as Error).message);
        process.exit(1);
    }

    const handler = simpleFetchHandler({ service: 'https://public.api.bsky.app' });
    const client = new Client({ handler });

    // Create XRPC client for handle resolution (no authentication needed for public endpoints)
    // const client = new XRPC({ handler: { handle: 'https://bsky.social' } });
    
    // Utility function to convert bsky.app URLs to at:// URIs
    async function convertToAtUri(uri: string): Promise<string> {
        // If it's already an at:// URI, return it as-is
        if (uri.startsWith('at://')) {
            return uri;
        }
        
        // Parse bsky.app URL
        // Format: https://bsky.app/profile/{handle}/post/{postId}
        const bskyUrlMatch = uri.match(/https:\/\/bsky\.app\/profile\/([^\/]+)\/post\/([^\/\?]+)/);
        if (bskyUrlMatch) {
            const handle: string = bskyUrlMatch[1]!;
            const postId: string = bskyUrlMatch[2]!;
            
            try {
                // Resolve handle to DID using XRPC client
                const response = await (client as any).get('app.bsky.actor.getProfile', {
                    params: { actor: handle }
                });
                const did: string = response.data.did;
                
                // Convert to at:// URI
                return `at://${did}/app.bsky.feed.post/${postId}`;
            } catch (error) {
                console.error(`❌ Failed to resolve handle ${handle}:`, (error as Error).message);
                throw new Error(`Could not resolve handle: ${handle}`);
            }
        }
        
        throw new Error(`Unsupported URI format: ${uri}`);
    }
    
    // Create internal API app for /label endpoint
    const internalApp = express();
    
    // Endpoint to manually label posts (internal IPv6 only)
    internalApp.get('/label', async (req: Request, res: Response<LabelResponse | ErrorResponse>): Promise<void> => {
        try {
            const { uri, val: labelVal, neg } = req.query;
            
            // Type guard for query parameters
            const uriParam = typeof uri === 'string' ? uri : undefined;
            const labelValParam = typeof labelVal === 'string' ? labelVal : undefined;
            const negParam = typeof neg === 'string' ? neg : undefined;
            
            if (!uriParam) {
                res.status(400).json({
                    error: 'Missing uri parameter',
                    usage: 'GET /label?uri=<at_uri_or_bsky_url>&val=<label_identifier>&neg=<true|false>',
                    availableLabels: availableLabels.map(l => l.identifier)
                });
                return;
            }
            
            if (!labelValParam || labelValParam.trim() === '') {
                res.status(400).json({
                    error: 'Missing val parameter',
                    message: 'The val parameter is required and must specify a valid label identifier',
                    usage: 'GET /label?uri=<at_uri_or_bsky_url>&val=<label_identifier>&neg=<true|false>',
                    availableLabels: availableLabels.map(l => l.identifier)
                });
                return;
            }
            
            // Parse and validate the neg parameter
            let isNegative: boolean = false;
            if (negParam !== undefined) {
                if (negParam === 'true' || negParam === '1') {
                    isNegative = true;
                } else if (negParam === 'false' || negParam === '0' || negParam === '') {
                    isNegative = false;
                } else {
                    res.status(400).json({
                        error: 'Invalid neg parameter',
                        message: 'neg parameter must be "true", "false", "1", "0", or omitted',
                        usage: 'GET /label?uri=<at_uri_or_bsky_url>&val=<label_identifier>&neg=<true|false>'
                    });
                    return;
                }
            }
            
            // Validate that the requested label exists
            const labelExists: boolean = availableLabels.some(l => l.identifier === labelValParam);
            if (!labelExists) {
                res.status(400).json({
                    error: 'Invalid label',
                    message: `Label '${labelValParam}' not found`,
                    availableLabels: availableLabels.map(l => l.identifier)
                });
                return;
            }
            
            console.log(`🏷️ Labeling request: ${uriParam} with label: ${labelValParam}${isNegative ? ' (NEGATIVE)' : ''}`);
            
            // Convert to at:// URI if needed
            const atUri: string = await convertToAtUri(uriParam);
            console.log(`🔗 Resolved to: ${atUri}`);
            
            // Create the label
            const labelData: CreateLabelData = {
                uri: atUri,
                val: labelValParam,
                cts: new Date().toISOString(),
                ...(isNegative && { neg: true })
            };
            
            // Save the label using the public API
            const savedLabel: SavedLabel = await labelerServer.createLabel(labelData);
            
            console.log(`✅ Successfully applied "${labelValParam}"${isNegative ? ' (NEGATIVE)' : ''} label to: ${atUri}`);
            
            // Return success response
            res.json({
                success: true,
                message: `${isNegative ? 'Negative label' : 'Label'} applied successfully`,
                label: {
                    uri: atUri,
                    value: labelValParam,
                    negative: isNegative,
                    timestamp: savedLabel.cts
                }
            });
            
        } catch (error) {
            console.error('❌ Error in manual labeling:', error);
            res.status(500).json({
                error: 'Failed to apply label',
                message: (error as Error).message
            });
        }
    });
    
    // Health check endpoint (internal API only)
    internalApp.get('/health', (req: Request, res: Response<HealthResponse>) => {
        res.json({ status: 'ok', service: 'labeler-internal-api' });
    });
  
    console.log('🔧 Starting internal labeler API server...');

    // Start the internal API server (for /label endpoint)
    // Bind to all interfaces (::) so it's accessible on the private network
    internalApp.listen(parseInt(internalApiPort), '::', () => {
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
