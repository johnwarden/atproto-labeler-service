import 'dotenv/config';
import { LabelerServer } from '@skyware/labeler';

console.log('Starting Bluesky Labeler test...');

// Check if we have the required environment variables
if (!process.env.LABELER_DID) {
    console.error('Missing LABELER_DID environment variable');
    console.log('Copy env.template to .env and fill in your values');
    process.exit(1);
}

if (!process.env.SIGNING_KEY) {
    console.error('Missing SIGNING_KEY environment variable');
    console.log('Copy env.template to .env and fill in your values');
    process.exit(1);
}

console.log('Environment variables found, creating labeler server...');

// Create labeler server with configuration
const server = new LabelerServer({
    did: process.env.LABELER_DID,
    signingKey: process.env.SIGNING_KEY,
    // Add custom PDS host if provided
    ...(process.env.PDS_HOST && { pdsHost: process.env.PDS_HOST }),
    // Add custom database path if provided
    ...(process.env.DB_PATH && { dbPath: process.env.DB_PATH }),
});

const port = process.env.PORT || 14831;

server.start(port, (error) => {
    if (error) {
        console.error('Failed to start labeler server:', error);
        process.exit(1);
    } else {
        console.log(`✅ Labeler server running on port ${port}`);
        console.log(`📊 Database: ${process.env.DB_PATH || './labels.db'}`);
        console.log(`🌐 PDS Host: ${process.env.PDS_HOST || 'https://bsky.social'}`);
        console.log(`🆔 DID: ${process.env.LABELER_DID}`);
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down labeler server...');
    process.exit(0);
});