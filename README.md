# Timeline MCP Server

Timeline MCP provides natural language tools for managing scheduled events and automations in Posty.

## Installation

Install directly from npm using npx (no setup required):

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
- `POSTY_WORKSPACE` (required): Path to your Posty workspace directory

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

Complete timeline management with 6 core tools:
- **Tracks**: `timeline_list_tracks`, `timeline_add_track`, `timeline_remove_track`
- **Events**: `timeline_add_scheduled_event`, `timeline_list_scheduled_events`, `timeline_update_scheduled_event`, `timeline_remove_scheduled_event`

## Media Storage

Generated images and content are saved to:
```
{workspace}/tracks/{track_name}/{event_name}/
```

Each event folder contains an `info.json` with metadata about the event.

## Examples

See `examples.md` for detailed usage examples.