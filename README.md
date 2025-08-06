# Bluesky Test Labeler - Production Setup Guide

A complete guide to setting up and deploying a Bluesky labeler using the AT Protocol and Skyware libraries.

## Overview

This repository contains a simple Bluesky labeler that applies contextual labels to posts via HTTP API. The labeler was built using [@skyware/labeler](https://skyware.js.org/guides/labeler/) and deployed to Fly.io with persistent storage.

**Live Example**: [`testlabeler1.bsky.social`](https://bsky.app/profile/testlabeler1.bsky.social)

## Architecture

- **HTTP API Endpoint**: `/label?uri={{URI}}` for manual post labeling
- **Single Label**: `needs-context`
- **Platform**: Node.js with Express.js
- **Storage**: SQLite with persistent volumes on Fly.io
- **Deployment**: Docker container on Fly.io

## Complete Setup Process

### Create Bluesky Account Labeler Account

### Enter labeler did and password in .env

Create .env

  cp env.template .env

Then enter the labeler account DID and password

### Setup Labeler Configuration

```bash
just setup-labeler
```

### Copy Signing Key to .env

Allow the setup to generate a signing key and update the environment variable in .env 

### Fly.io Deployment

#### Initialize Fly.io app:
```bash
fly apps create testlabeler1
```

#### Configure secrets:
```bash
fly secrets set LABELER_DID="$LABELER_DID"
fly secrets set LABELER_PASSWORD="$LABELER_PASSWORD" 
fly secrets set SIGNING_KEY="$SIGNING_KEY"
```

#### Setup persistent storage:
```bash
# Create volume for SQLite database
fly volumes create labeler_data --region sjc --size 1
```

#### Deploy:
```bash
fly deploy
```

### 6. Verify Deployment

```bash
# Check health
curl -s "https://testlabeler1.fly.dev:8082/health" | jq .

# Test labeling
curl -s "https://testlabeler1.fly.dev:8082/label?uri=https://bsky.app/profile/user.bsky.social/post/abc123" | jq .
```

## Key Learnings

### Labeler Setup Process

1. **Clear vs Recreate**: 
   - `npx @skyware/labeler setup` = Complete reset with new signing key
   - `npx @skyware/labeler recreate` = Refresh existing configuration

2. **HTTPS Requirement**: Labeler setup command requires HTTPS URLs, not HTTP

3. **Docker Configuration**:
   - Non-root user required for security
   - Bind to `0.0.0.0` not `127.0.0.1`

### Label Visibility

1. **User Subscription Required**: Users must subscribe to labeler in Bluesky settings
2. **AppView Synchronization**: Database wipes can cause labels to be ignored until reset

## API Usage

### Manual Labeling

```bash
# Add needs-context label to a post
curl "https://testlabeler1.fly.dev:8082/label?uri=https://bsky.app/profile/user.bsky.social/post/abc123"

# Supports both bsky.app URLs and at:// URIs  
curl "https://testlabeler1.fly.dev:8082/label?uri=at://did:plc:xyz/app.bsky.feed.post/abc123"
```

### Query Labels

```bash
# Query all labels from labeler
curl "https://testlabeler1.fly.dev/xrpc/com.atproto.label.queryLabels"

# Check labeler service record
curl "https://bsky.social/xrpc/com.atproto.repo.getRecord?repo=did:plc:mzu4yf7auecpifkyv6r2jb2v&collection=app.bsky.labeler.service&rkey=self"
```

## Management Commands (Justfile)

Install [`just`](https://github.com/casey/just):
```bash
# macOS
brew install just

# Other platforms: https://github.com/casey/just#installation
```

### Daily Operations

```bash
# Check system status
just status

# Add label to post
just add-label "https://bsky.app/profile/user.bsky.social/post/abc123"

# View logs
just logs

# Deploy changes
just deploy

# Health check
just health
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
| `API_PORT` | Main server port | `8080` |

### Fly.io Configuration

```toml
# fly.toml key sections
[env]
  NODE_ENV = 'production'
  PORT = '8080'
  DB_PATH = '/mnt/labels.db'

[[services]]
  internal_port = 8080  # Main labeler
  
[[services]]  
  internal_port = 8081  # HTTP API

[[mounts]]
  source = "labeler_data"
  destination = "/mnt"
```

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

**Problem**: Database wiped on restart

**Solution**: Use persistent volumes:
```bash
fly volumes create labeler_data --region sjc --size 1
# Add [[mounts]] section to fly.toml
```

## Production Considerations

1. **Security**: Use strong passwords and secure signing keys
2. **Monitoring**: Set up log monitoring and alerting
3. **Scaling**: Consider horizontal scaling for high traffic
4. **Backup**: Regular database backups from persistent volume
5. **Rate Limiting**: Implement rate limiting for API endpoints

## Resources

- [Skyware Labeler Documentation](https://skyware.js.org/guides/labeler/)
- [AT Protocol Labeler Specification](https://atproto.com/specs/label)
- [Bluesky Moderation Guide](https://blueskyweb.xyz/blog/03-12-2024-moderation)
- [Fly.io Documentation](https://fly.io/docs/)

## License

MIT