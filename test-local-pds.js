import 'dotenv/config';
import { Bot } from '@skyware/bot';
import { LabelerServer } from '@skyware/labeler';

console.log('🧪 Testing local PDS connectivity with @skyware packages');

/**
 * FINDINGS FROM SOURCE CODE EXPLORATION:
 * 
 * 1. @skyware/bot BotOptions interface:
 *    - Has `service` option that defaults to "https://bsky.social"
 *    - Can be customized: new Bot({ service: "http://localhost:2583" })
 * 
 * 2. @skyware/labeler LoginCredentials interface:
 *    - Has `pds` option that defaults to "https://bsky.social"  
 *    - Used during setup: { pds: "http://localhost:2583", identifier: "...", password: "..." }
 *    - The LabelerServer itself doesn't have PDS config - it uses DID resolution
 * 
 * 3. How it should work:
 *    - Use goat to create accounts on local PDS: goat account create --pds-host http://localhost:2583
 *    - Configure bot with custom service: new Bot({ service: "http://localhost:2583" })
 *    - Setup labeler with custom PDS in credentials during npx @skyware/labeler setup
 *    - Once set up, labeler should work via DID resolution
 */

async function testBotWithLocalPDS() {
    console.log('\n📡 Testing Bot with local PDS...');
    
    if (!process.env.LOCAL_PDS_URL) {
        console.log('⚠️  LOCAL_PDS_URL not set, skipping local PDS bot test');
        return;
    }
    
    const bot = new Bot({
        service: process.env.LOCAL_PDS_URL, // e.g., "http://localhost:2583"
    });
    
    if (process.env.LOCAL_BOT_IDENTIFIER && process.env.LOCAL_BOT_PASSWORD) {
        try {
            await bot.login({
                identifier: process.env.LOCAL_BOT_IDENTIFIER,
                password: process.env.LOCAL_BOT_PASSWORD,
            });
            console.log('✅ Successfully logged into local PDS with bot!');
            
            // Test posting
            const post = await bot.post({ text: `Test post from local PDS at ${new Date().toISOString()}` });
            console.log('✅ Successfully posted to local PDS:', post.uri);
            
        } catch (error) {
            console.error('❌ Failed to connect to local PDS:', error.message);
        }
    } else {
        console.log('⚠️  Local bot credentials not provided, skipping login test');
    }
}

async function testLabelerWithLocalAccounts() {
    console.log('\n🏷️  Testing Labeler setup...');
    
    if (!process.env.LABELER_DID || !process.env.SIGNING_KEY) {
        console.log('⚠️  Labeler credentials not set, skipping labeler test');
        console.log('💡 To test labeler:');
        console.log('   1. Create labeler account: goat account create --pds-host http://localhost:2583 --handle labeler.test --password ... --email ...');
        console.log('   2. Setup labeler: npx @skyware/labeler setup (provide local PDS URL when prompted)');
        console.log('   3. Add credentials to .env file');
        return;
    }
    
    try {
        const server = new LabelerServer({
            did: process.env.LABELER_DID,
            signingKey: process.env.SIGNING_KEY,
        });
        
        console.log('✅ Labeler server created successfully');
        console.log(`🆔 Labeler DID: ${process.env.LABELER_DID}`);
        
        // Don't actually start the server in this test, just verify it can be created
        
    } catch (error) {
        console.error('❌ Failed to create labeler server:', error.message);
    }
}

async function main() {
    await testBotWithLocalPDS();
    await testLabelerWithLocalAccounts();
    
    console.log('\n📝 Next steps:');
    console.log('1. Set up a local PDS (if not already running)');
    console.log('2. Install goat: go install github.com/bluesky-social/indigo/cmd/goat@latest');
    console.log('3. Create test accounts with goat');
    console.log('4. Update .env with local credentials');
    console.log('5. Test the full labeler workflow');
}

main().catch(console.error);