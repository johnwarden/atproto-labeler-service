# Test Script Documentation

## Overview

The `test.ts` script provides comprehensive testing for the ATProto Labeler Service, including label creation, negation, and querying functionality.

## Features

✅ **Dynamic Port Allocation**: Uses `get-port` to automatically find available ports  
✅ **In-Memory Database**: Tests run with `:memory:` database for isolation  
✅ **Comprehensive Coverage**: Tests all major labeler functionality  
✅ **TypeScript**: Fully typed test suite with proper error handling  
✅ **Clean Shutdown**: Graceful server cleanup after tests  

## Test Cases

1. **Create Positive Label**: Tests creating labels from `labels.json`
2. **Create Negative Label**: Tests label negation functionality  
3. **Query All Labels**: Tests the `/xrpc/com.atproto.label.queryLabels` endpoint
4. **Query Specific URI**: Tests querying labels for a specific URI
5. **Test Any Label Creation**: Verifies LabelerServer accepts any label value

## Usage


### Run Tests (Compiled JavaScript)
```bash
npm run test
```

### With Custom Environment Variables
```bash
LABELER_DID="your-did" SIGNING_KEY="your-key" npm run test:ts
```

## Test Environment

The test script automatically:
- Allocates dynamic ports to avoid conflicts
- Creates a LabelerServer instance with in-memory database
- Loads labels from `labels.json`
- Runs all tests sequentially
- Provides detailed output and summary

## Example Output

```
🧪 Starting Labeler Server Tests
=================================
🚀 Setting up test environment...
📡 Allocated ports: main=52321, internal=52322
📋 Loaded 2 available labels: note, proposed-label-note
🔧 Starting labeler server on port 52321...
✅ Labeler server started at http://127.0.0.1:52321

🧪 Running test: Create positive label
   Creating label "note" for URI: at://did:plc:test123/app.bsky.feed.post/test456
   ✅ Label created successfully with ID: 1
✅ Test passed: Create positive label

📊 Test Results Summary:
========================
✅ Create positive label
✅ Create negative label
✅ Query all labels
✅ Query specific URI
✅ Test any label creation

Total: 5 tests, 5 passed, 0 failed
```

## Dependencies

- `get-port`: Dynamic port allocation
- `node-fetch`: HTTP requests for API testing
- `@skyware/labeler`: Core labeler functionality
- `tsx`: TypeScript execution for development

## Notes

- Tests use fake `at://` URIs for testing purposes
- The LabelerServer accepts any label value (validation happens at HTTP API level)
- Tests run in isolation with in-memory database
- All tests must pass for the script to exit with code 0
