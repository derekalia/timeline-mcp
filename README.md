# Timeline MCP Server

Timeline MCP provides natural language tools for managing scheduled events and automations in Posty.

> **Note**: This project uses Node.js v22+ native TypeScript support. No compilation step needed!

## Quick Start

```bash
# Install dependencies
npm install

# Run the server
npm start
```

## Implementation

Built with **FastMCP** framework for cleaner code and better TypeScript support. Uses PostgreSQL database storage via Drizzle ORM.

## Features

10 tools for complete timeline management:
- Add/list/update/remove scheduled events
- Add/list/update/toggle/remove automations
- List tracks

## Configuration

Already configured in your MCP settings:
```json
{
  "timeline": {
    "transport": "stdio",
    "command": "node",
    "args": [
      "--experimental-strip-types",
      "--experimental-transform-types",
      "/path/to/timeline-fastmcp.ts"
    ],
    "env": {
      "POSTY_WORKSPACE": "/path/to/workspace"
    }
  }
}
```

## Media Storage

Generated images are saved to:
```
workspace-state/media/{track_name}/{event_name}/
```

## Examples

See `examples.md` for detailed usage examples.