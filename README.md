# Test Labeler

Testing Bluesky labeler functionality with @skyware/labeler.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create environment file:
   ```bash
   cp env.template .env
   ```

3. Fill in your labeler credentials in `.env`:
   - `LABELER_DID`: Your labeler account's DID
   - `LABELER_PASSWORD`: Your labeler account password
   - `SIGNING_KEY`: The signing key from labeler setup

## Usage

Start the labeler server:
```bash
npm start
```

Or with auto-restart during development:
```bash
npm run dev
```

## Configuration

### Local PDS Testing
To test with a local PDS, set in your `.env`:
```
PDS_HOST=http://localhost:2583
```

### Custom Database
To use a custom database path:
```
DB_PATH=./my-labels.db
```

## Key Findings 🔍

After examining the source code, we found that **@skyware packages DO support local PDS**:

### @skyware/bot
- `BotOptions.service` can be set to custom PDS URL
- Example: `new Bot({ service: "http://localhost:2583" })`

### @skyware/labeler  
- Setup process accepts `LoginCredentials.pds` option
- During `npx @skyware/labeler setup`, you can specify local PDS URL
- The labeler server itself uses DID resolution (no direct PDS config)

## Testing with Local PDS

1. **Install goat CLI:**
   ```bash
   go install github.com/bluesky-social/indigo/cmd/goat@latest
   ```

2. **Create test accounts:**
   ```bash
   # Bot account
   goat account create --pds-host http://localhost:2583 --handle testbot.test --password testpass123 --email your+bot@email.com
   
   # Labeler account
   goat account create --pds-host http://localhost:2583 --handle testlabeler.test --password labelerpass123 --email your+labeler@email.com
   ```

3. **Set up labeler:**
   ```bash
   npx @skyware/labeler setup
   # When prompted for PDS URL, enter: http://localhost:2583
   ```

4. **Test connectivity:**
   ```bash
   npm run test-local
   ```

## Next Steps

1. ✅ Install packages and examine source code
2. ✅ Understand PDS configuration options  
3. 🔄 Test with local PDS vs production Bluesky
4. 📋 Implement automated labeling features