# ValueCase MCP Server

A Model Context Protocol (MCP) server implementation for ValueCase, built with Node.js and TypeScript.

## Features

- Integration with ValueCase API
- TypeScript support
- Railway deployment configuration
- Environment variable management
- Error handling for missing configurations

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- ValueCase API key

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/valuecase-mcp.git
cd valuecase-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your ValueCase API key:
```
VALUECASE_API_KEY=your_api_key_here
```

## Development

To start the development server:

```bash
npm run dev
```

## Building

To build the project:

```bash
npm run build
```

## Deployment

This project is configured for deployment on Railway. The deployment process is automated through the `railway.json` configuration file.

## License

MIT 