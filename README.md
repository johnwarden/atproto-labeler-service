# Bluesky Labeler Starter Kit

A starter kit for setting up and deploying an AT Protocol labeler using [@skyware/labeler](https://skyware.js.org/guides/labeler/introduction/getting-started/) labeler and fly.io.

This automates some of the steps in the [Skyware Labeler Getting Started guide](https://skyware.js.org/guides/labeler/introduction/getting-started/). 

Also, instead of the "earth/wind/fire/water" labeler from that guide, it creates a simple labeler API where you can add a label to a post given a bluesky URL:

    curl "https://your-app.fly.dev:8081/label?uri=https://bsky.app/profile/thecraigmancometh.bsky.social/post/3lvl3tdft7c2s&label=needs-context"

You can also create negative labels (which remove/negate previous labels) by adding `neg=true`:

    curl "https://your-app.fly.dev:8081/label?uri=https://bsky.app/profile/thecraigmancometh.bsky.social/post/3lvl3tdft7c2s&label=needs-context&neg=true"


## Architecture

- **HTTP API Endpoint**: `/label?uri={{URI}}&label={{LABEL}}&neg={{true|false}}` for manual post labeling (label and neg parameters are optional)
- **Platform**: Node.js with Express.js
- **Storage**: SQLite with persistent volumes on Fly.io
- **Deployment**: Docker container on Fly.io

## Development Environment Setup

- Node.js (v18 or later)
- npm
- [just](https://github.com/casey/just) command runner

### Using Devbox (Optional)

This project includes a `devbox.json` configuration for easy development environment setup using [Devbox](https://www.jetify.com/devbox/).

#### Install devbox if you haven't already
curl -fsSL https://get.jetify.com/devbox | bash

#### Option 1: Use devbox shell (temporary environment)
```bash
# Enter the development shell
devbox shell
```

#### Option 2: Use devbox with direnv (automatic environment)
```bash
# Generate .envrc for direnv integration
 devbox generate direnv --env-file .env

# Allow direnv to load the environment
direnv allow
```

This will automatically install Node.js, npm, and just when you enter the project directory.


## Labeler Setup

This registers your labeler account as a labeler in atproto

### Create Bluesky Account Labeler Account

### Enter labeler did and password in .env

Create .env

    cp env.example .env

Then enter the labeler account DID and password, as well as the domain where you will host the labeler.

### Run Setup Script

```bash
just setup
```

### Fly.io Deployment

```bash
# Deploy everything (creates app, sets secrets, creates volume, deploys)
just fly-setup
```

Creates, configures, and deploys a fly app. Uses LABELER_DID, LABELER_PASSWORD, and SIGNING_KEY from .env. 

### Custom Domain DNS and SSL Cert Setup

I have had trouble getting labelers working when using https://$APP_NAME.fly.dev as the endpoint. I've also had trouble using ngrok. But using custom domains things seem to work better.

To setup a custom domain, make sure you have the right $LABELER_DOMAIN in .env, and then, after running the fly setup, run:

   just setup-cert

Then, setup your DNS entries as instructed. 

## Confirm Everything Is Working

### Verify Deployment

```bash
# Check health
just health
```

### Check Labeler Status

```bash
just labeler-status
```

### Subscribe to Label

Go to you labeler account profile at https://bsky.app/profile/YOUR_LABELER_HANDLE. You should see a "subscribe" button to subscribe to the labeler.

### Add a Label to a Post

```bash
just test-api
```

This should add a label to:

  https://bsky.app/profile/thecraigmancometh.bsky.social/post/3lvl3tdft7c2s 

If you have subscribed to your label, you should see your label on this post.


## Key Learnings

### Labeler Setup Process

1. **Clear vs Recreate**: 
   - `clear + setup` = Complete reset with updated configuration
   - `recreate` = Refresh existing configuration

2. **HTTPS Requirement**: Labeler setup command requires HTTPS URLs, not HTTP

3. **Docker Configuration**:
   - Non-root user required for security
   - Bind to `0.0.0.0` not `127.0.0.1`

### Label Visibility

1. **User Subscription Required**: Users must subscribe to labeler in Bluesky settings
2. **AppView Synchronization**: Database wipes can cause labels to be ignored until reset

## API Usage

### Manual Labeling

The API supports applying labels to posts with optional label and neg parameters:

- **Without label parameter**: Uses the first label defined in `labels.json` (default behavior)
- **With label parameter**: Uses the specified label if it exists in `labels.json`
- **With neg=true**: Creates a negative label that removes/negates a previous instance of the same label
- **Invalid label**: Returns error with list of available labels

```bash
# Add default label to a post using justfile (recommended)
just add-label "https://bsky.app/profile/thecraigmancometh.bsky.social/post/3lvl3tdft7c2s"

# Add specific label to a post using justfile
just add-label "https://bsky.app/profile/thecraigmancometh.bsky.social/post/3lvl3tdft7c2s" "needs-context"

# Add negative label to remove/negate a previous label using justfile
just add-negative-label "https://bsky.app/profile/thecraigmancometh.bsky.social/post/3lvl3tdft7c2s" "needs-context"

# Or use curl directly (default label)
curl "https://your-app.fly.dev:8081/label?uri=https://bsky.app/profile/thecraigmancometh.bsky.social/post/3lvl3tdft7c2s"

# Or use curl directly (specific label)
curl "https://your-app.fly.dev:8081/label?uri=https://bsky.app/profile/thecraigmancometh.bsky.social/post/3lvl3tdft7c2s&label=needs-context"

# Or use curl directly (negative label to remove previous label)
curl "https://your-app.fly.dev:8081/label?uri=https://bsky.app/profile/thecraigmancometh.bsky.social/post/3lvl3tdft7c2s&label=needs-context&neg=true"

```

### Query Labels

```bash
# Query all labels using justfile (recommended)
just query-labels

# Or use curl directly
curl "https://your-app.fly.dev/xrpc/com.atproto.label.queryLabels"
```

### Daily Operations

```bash
# Check system status
just status

# Add default label to post
just add-label "https://bsky.app/profile/thecraigmancometh.bsky.social/post/3lvl3tdft7c2s"

# Add specific label to post
just add-label "https://bsky.app/profile/thecraigmancometh.bsky.social/post/3lvl3tdft7c2s" "needs-context"

# Add negative label to remove/negate a previous label
just add-negative-label "https://bsky.app/profile/thecraigmancometh.bsky.social/post/3lvl3tdft7c2s" "needs-context"

# Query all labels
just query-labels

# View logs
just logs

# Deploy changes
just deploy

# Health check
just health

# Test API
just test-api

# Restart application
just restart

# Clear database (careful!)
just clear-db
```


## Configuration Reference

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `LABELER_DID` | Labeler account DID | `did:plc:mzu4yf7auecpifkyv6r2jb2v` |
| `LABELER_PASSWORD` | Account password | `password` |
| `SIGNING_KEY` | Label signing key | `c364841c99116f...` |
| `DB_PATH` | Database path | `/mnt/labels.db` |
| `PORT` | Main server port | `8080` |
| `API_PORT` | API server port | `8081` |
| `NODE_ENV` | Environment mode | `development` or `productiont` |


## Common Issues & Solutions

### Labels Not Appearing

**Problem**: Labels applied successfully but don't show in Bluesky app

**Solutions**:
1. **User subscription**: Users must subscribe to labeler in Bluesky settings
2. **Database reset**: After database wipe, run full reset:
   ```bash
   npx @skyware/labeler clear
   npx @skyware/labeler setup
   # Re-add label definitions
   ```
3. **Wait for propagation**: 5-10 minutes for AppView synchronization

### Deployment Issues

**Problem**: "App is not listening on expected address"

**Solution**: Ensure server binds to `0.0.0.0`, not `127.0.0.1`:
```javascript
server.start({ port: port, host: '0.0.0.0' }, callback);
```

## Resources

- [Skyware Labeler Documentation](https://skyware.js.org/guides/labeler/introduction/getting-started/)
- [AT Protocol Labeler Specification](https://atproto.com/specs/label)
- [Bluesky Moderation Guide](https://blueskyweb.xyz/blog/03-12-2024-moderation)
- [Fly.io Documentation](https://fly.io/docs/)

## License

MIT