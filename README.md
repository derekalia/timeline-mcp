# Timeline MCP Server

[![npm version](https://img.shields.io/npm/v/timeline-mcp.svg)](https://www.npmjs.com/package/timeline-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Model Context Protocol (MCP) server for managing scheduled social media posts and content automation.**

<a href="https://glama.ai/mcp/servers/@derekalia/timeline-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@derekalia/timeline-mcp/badge" alt="Timeline Server MCP server" />
</a>

Timeline MCP enables AI assistants like Claude to manage your content calendar through natural language. Schedule posts across multiple platforms (X/Twitter, Reddit, LinkedIn, Instagram, TikTok, YouTube), organize campaigns into tracks, and automate your content workflow.

## Quick Start

Add to your MCP settings (e.g., `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "timeline": {
      "command": "npx",
      "args": ["-y", "timeline-mcp"],
      "env": {
        "POSTY_WORKSPACE": "/path/to/your/workspace"
      }
    }
  }
}
```

**Environment Variables:**
- `POSTY_WORKSPACE` (required): Path to your Posty workspace directory containing the SQLite database

## What is MCP?

[Model Context Protocol](https://modelcontextprotocol.io/) is an open protocol that enables AI assistants to securely interact with local and remote tools. This server implements the MCP specification to provide timeline management capabilities.

## Development

For local development:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run locally
npm start
```

## Implementation

Built with **FastMCP** framework for cleaner code and better TypeScript support. Uses SQLite database storage via Drizzle ORM for reliable local data persistence.

## Features

### Track Management
- 📋 **List Tracks** - View all content tracks
- ➕ **Add Track** - Create new tracks for organizing campaigns
- 🗑️ **Remove Track** - Delete tracks and associated events

### Scheduled Events
- 📅 **Add Scheduled Event** - Schedule posts with prompts, timing, and platform
- 📊 **List Events** - Filter by track, status, platform, or date range
- ✏️ **Update Event** - Modify scheduled events before publishing
- ❌ **Remove Event** - Delete scheduled events

### Supported Platforms
- X (Twitter)
- Reddit (with subreddit targeting)
- LinkedIn
- Instagram
- TikTok
- YouTube

## Usage Example

Ask your AI assistant:

> "Schedule a product launch campaign for next week. Create 5 teaser posts on X leading up to the launch, with one post per day at 10 AM."

The AI will use Timeline MCP to:
1. Create or reuse a track for the campaign
2. Generate engaging prompts for each post
3. Schedule them at the specified times
4. Store everything in your local database

## Media Storage

Generated images and content are saved to:
```
{workspace}/tracks/{track_name}/{event_name}/
```

Each event folder contains an `info.json` with metadata about the event.

## Examples

See [examples.md](https://github.com/derekalia/timeline-mcp/blob/main/examples.md) for detailed usage examples including:
- Product launch campaigns
- Content series scheduling
- Event coverage
- Multi-platform posts

## Requirements

- Node.js 18+
- A Posty workspace with SQLite database
- MCP-compatible AI assistant (Claude Desktop, etc.)