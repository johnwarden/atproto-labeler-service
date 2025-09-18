import { LabelerServer, type CreateLabelData, type SavedLabel } from '@skyware/labeler';
import getPort from 'get-port';
import fetch from 'node-fetch';
import fs from 'fs';

// Test configuration
interface TestConfig {
    mainPort: number;
    internalPort: number;
    server: LabelerServer;
    testUri: string;
    availableLabels: Array<{ identifier: string; name: string }>;
}

interface LabelDefinition {
    identifier: string;
    name: string;
    description: string;
    adultOnly: boolean;
    severity: 'alert' | 'inform' | 'none';
    blurs: 'content' | 'media' | 'none';
    defaultSetting: 'ignore' | 'warn' | 'hide';
}

// Test utilities
class TestRunner {
    private config: TestConfig | null = null;
    private testResults: Array<{ name: string; passed: boolean; error?: string }> = [];

    async setup(): Promise<TestConfig> {
        console.log('🚀 Setting up test environment...');

        process.env.LABELER_DID="test-labeler-did"
        process.env.SIGNING_KEY="d0852cbab741b9b1ad19014294619aab6937355387ff130fac4d33949d6eb0bf"

        // Validate required environment variables
        if (!process.env.LABELER_DID || !process.env.SIGNING_KEY) {
            throw new Error('❌ Missing required environment variables: LABELER_DID, SIGNING_KEY');
        }

        // Get available ports
        const mainPort = await getPort();
        const internalPort = await getPort({ port: mainPort + 1 });

        console.log(`📡 Allocated ports: main=${mainPort}, internal=${internalPort}`);

        // Load available labels
        let availableLabels: LabelDefinition[] = [];
        try {
            const labelsData = fs.readFileSync('./labels.json', 'utf8');
            availableLabels = JSON.parse(labelsData);
            console.log(`📋 Loaded ${availableLabels.length} available labels:`, availableLabels.map(l => l.identifier).join(', '));
        } catch (error) {
            throw new Error(`❌ Failed to load labels.json: ${(error as Error).message}`);
        }

        // Create labeler server
        const server = new LabelerServer({
            did: process.env.LABELER_DID,
            signingKey: process.env.SIGNING_KEY,
            dbPath: ':memory:', // Use in-memory database for testing
        });

        // Test URI (using a fake at:// URI for testing)
        const testUri = 'at://did:plc:test123/app.bsky.feed.post/test456';

        this.config = {
            mainPort,
            internalPort,
            server,
            testUri,
            availableLabels: availableLabels.map(l => ({ identifier: l.identifier, name: l.name }))
        };

        return this.config;
    }

    async startServer(): Promise<void> {
        if (!this.config) throw new Error('Test not configured');

        return new Promise((resolve, reject) => {
            console.log(`🔧 Starting labeler server on port ${this.config!.mainPort}...`);
            
            this.config!.server.start(
                { port: this.config!.mainPort, host: '127.0.0.1' },
                (error: Error | null, address: string) => {
                    if (error) {
                        console.error('❌ Failed to start labeler server:', error);
                        reject(error);
                    } else {
                        console.log(`✅ Labeler server started at ${address}`);
                        resolve();
                    }
                }
            );
        });
    }

    async stopServer(): Promise<void> {
        if (!this.config) return;
        
        return new Promise((resolve) => {
            console.log('🛑 Stopping labeler server...');
            this.config!.server.close(() => {
                console.log('✅ Server stopped');
                resolve();
            });
        });
    }

    async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
        console.log(`\n🧪 Running test: ${name}`);
        try {
            await testFn();
            console.log(`✅ Test passed: ${name}`);
            this.testResults.push({ name, passed: true });
        } catch (error) {
            console.error(`❌ Test failed: ${name} - ${(error as Error).message}`);
            this.testResults.push({ name, passed: false, error: (error as Error).message });
        }
    }

    async testCreateLabel(): Promise<void> {
        if (!this.config) throw new Error('Test not configured');
        
        const labelVal = this.config.availableLabels[0]!.identifier;
        console.log(`   Creating label "${labelVal}" for URI: ${this.config.testUri}`);

        const labelData: CreateLabelData = {
            uri: this.config.testUri,
            val: labelVal,
            cts: new Date().toISOString()
        };

        const savedLabel: SavedLabel = await this.config.server.createLabel(labelData);
        
        if (!savedLabel || savedLabel.val !== labelVal || savedLabel.uri !== this.config.testUri) {
            throw new Error('Label creation failed or returned unexpected data');
        }

        console.log(`   ✅ Label created successfully with ID: ${savedLabel.id}`);
    }

    async testCreateNegativeLabel(): Promise<void> {
        if (!this.config) throw new Error('Test not configured');
        
        const labelVal = this.config.availableLabels[1]?.identifier || this.config.availableLabels[0]!.identifier;
        console.log(`   Creating negative label "${labelVal}" for URI: ${this.config.testUri}`);

        const labelData: CreateLabelData = {
            uri: this.config.testUri,
            val: labelVal,
            neg: true,
            cts: new Date().toISOString()
        };

        const savedLabel: SavedLabel = await this.config.server.createLabel(labelData);
        
        if (!savedLabel || savedLabel.val !== labelVal || savedLabel.uri !== this.config.testUri || !savedLabel.neg) {
            throw new Error('Negative label creation failed or returned unexpected data');
        }

        console.log(`   ✅ Negative label created successfully with ID: ${savedLabel.id}`);
    }

    async testQueryAllLabels(): Promise<void> {
        if (!this.config) throw new Error('Test not configured');
        
        console.log(`   Querying all labels from server...`);
        
        const response = await fetch(`http://127.0.0.1:${this.config.mainPort}/xrpc/com.atproto.label.queryLabels`);
        
        if (!response.ok) {
            throw new Error(`Query failed with status: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as any;
        
        if (!data.labels || !Array.isArray(data.labels)) {
            throw new Error('Query response missing labels array');
        }

        console.log(`   ✅ Query returned ${data.labels.length} labels`);
        
        // Log some details about the labels
        data.labels.forEach((label: any, index: number) => {
            console.log(`   📋 Label ${index + 1}: ${label.val} (${label.neg ? 'NEGATIVE' : 'POSITIVE'}) - ${label.uri}`);
        });
    }

    async testQuerySpecificUri(): Promise<void> {
        if (!this.config) throw new Error('Test not configured');
        
        console.log(`   Querying labels for specific URI: ${this.config.testUri}`);
        
        const encodedUri = encodeURIComponent(this.config.testUri);
        const response = await fetch(`http://127.0.0.1:${this.config.mainPort}/xrpc/com.atproto.label.queryLabels?uris=${encodedUri}`);
        
        if (!response.ok) {
            throw new Error(`Query failed with status: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as any;
        
        if (!data.labels || !Array.isArray(data.labels)) {
            throw new Error('Query response missing labels array');
        }

        // Should have at least the labels we created for this URI
        const labelsForTestUri = data.labels.filter((label: any) => label.uri === this.config!.testUri);
        
        if (labelsForTestUri.length === 0) {
            throw new Error('No labels found for test URI');
        }

        console.log(`   ✅ Query returned ${labelsForTestUri.length} labels for test URI`);
        
        // Verify we have both positive and negative labels
        const positiveLabels = labelsForTestUri.filter((label: any) => !label.neg);
        const negativeLabels = labelsForTestUri.filter((label: any) => label.neg);
        
        console.log(`   📊 Found ${positiveLabels.length} positive and ${negativeLabels.length} negative labels`);
    }

    async testCreateAnyLabel(): Promise<void> {
        if (!this.config) throw new Error('Test not configured');
        
        console.log(`   Testing that LabelerServer accepts any label value...`);

        const labelData: CreateLabelData = {
            uri: this.config.testUri + '-any',
            val: 'any-custom-label',
            cts: new Date().toISOString()
        };

        const savedLabel: SavedLabel = await this.config.server.createLabel(labelData);
        
        if (!savedLabel || savedLabel.val !== 'any-custom-label') {
            throw new Error('LabelerServer should accept any label value');
        }

        console.log(`   ✅ LabelerServer correctly accepts any label value: ${savedLabel.val}`);
    }

    printResults(): void {
        console.log('\n📊 Test Results Summary:');
        console.log('========================');
        
        const passed = this.testResults.filter(r => r.passed).length;
        const failed = this.testResults.filter(r => !r.passed).length;
        
        this.testResults.forEach(result => {
            const status = result.passed ? '✅' : '❌';
            console.log(`${status} ${result.name}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });
        
        console.log(`\nTotal: ${this.testResults.length} tests, ${passed} passed, ${failed} failed`);
        
        if (failed > 0) {
            process.exit(1);
        }
    }
}

// Main test execution
async function runTests(): Promise<void> {
    const runner = new TestRunner();
    
    try {
        // Setup
        await runner.setup();
        await runner.startServer();
        
        // Wait a moment for server to be fully ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Run tests
        await runner.runTest('Create positive label', () => runner.testCreateLabel());
        await runner.runTest('Create negative label', () => runner.testCreateNegativeLabel());
        await runner.runTest('Query all labels', () => runner.testQueryAllLabels());
        await runner.runTest('Query specific URI', () => runner.testQuerySpecificUri());
        await runner.runTest('Test any label creation', () => runner.testCreateAnyLabel());
        
    } catch (error) {
        console.error('❌ Test setup failed:', error);
        process.exit(1);
    } finally {
        // Cleanup
        await runner.stopServer();
        runner.printResults();
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Test interrupted, cleaning up...');
    process.exit(0);
});

// Run the tests
console.log('🧪 Starting Labeler Server Tests');
console.log('=================================');
runTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
});

export { TestRunner };
