#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  Tool,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';

// Load environment variables
dotenv.config();

// Tool definitions
const LIST_SPACES_TOOL: Tool = {
  name: 'valuecase_list_spaces',
  description: 'List all spaces available to the user.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
};

const GET_SPACE_TOOL: Tool = {
  name: 'valuecase_get_space',
  description: 'Get details of a specific space by ID.',
  inputSchema: {
    type: 'object',
    properties: {
      spaceId: { type: 'string', description: 'ID of the space' },
    },
    required: ['spaceId'],
  },
};

const LIST_FORMS_TOOL: Tool = {
  name: 'valuecase_list_forms',
  description: 'List all forms in a specific space.',
  inputSchema: {
    type: 'object',
    properties: {
      spaceId: { type: 'string', description: 'ID of the space' },
    },
    required: ['spaceId'],
  },
};

const GET_FORM_TOOL: Tool = {
  name: 'valuecase_get_form',
  description: 'Get details of a specific form by ID.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'ID of the form' },
    },
    required: ['formId'],
  },
};

const GET_FORM_CONTENT_TOOL: Tool = {
  name: 'valuecase_get_form_content',
  description: 'Get all content from a specific form by ID.',
  inputSchema: {
    type: 'object',
    properties: {
      formId: { type: 'string', description: 'ID of the form' },
    },
    required: ['formId'],
  },
};

const server = new Server(
  {
    name: 'valuecase-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      logging: {},
    },
  }
);

// --- OAuth2 Client Credentials Flow for ValueCase API ---
const VALUECASE_CLIENT_ID = process.env.VALUECASE_CLIENT_ID;
const VALUECASE_CLIENT_SECRET = process.env.VALUECASE_CLIENT_SECRET;
const VALUECASE_API_URL = process.env.VALUECASE_API_URL || 'https://api.valuecase.com/v1';

if (!VALUECASE_CLIENT_ID || !VALUECASE_CLIENT_SECRET) {
  console.error('Error: VALUECASE_CLIENT_ID and VALUECASE_CLIENT_SECRET environment variables are required');
  process.exit(1);
}

let valuecaseAccessToken: string = '';
let tokenExpiresAt: number | null = null;

async function fetchValueCaseAccessToken(): Promise<string> {
  const url = 'https://app.valuecase.com/dashboard/api/api-auth/token';
  const response = await axios.post(url, {
    client_id: VALUECASE_CLIENT_ID,
    client_secret: VALUECASE_CLIENT_SECRET,
  });
  valuecaseAccessToken = response.data.access_token;
  tokenExpiresAt = Date.now() + (response.data.expires_in - 60) * 1000; // refresh 1 min before expiry
  return valuecaseAccessToken;
}

async function getValueCaseAccessToken(): Promise<string> {
  if (!valuecaseAccessToken || !tokenExpiresAt || Date.now() > tokenExpiresAt) {
    return await fetchValueCaseAccessToken();
  }
  return valuecaseAccessToken;
}

// Axios instance for ValueCase API (no default Authorization header)
const apiClient: AxiosInstance = axios.create({
  baseURL: VALUECASE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Structured logging function
function safeLog(
  level: 'error' | 'debug' | 'info' | 'notice' | 'warning' | 'critical' | 'alert' | 'emergency',
  data: any
): void {
  // For now, just log to console. You can enhance this to log to a file or external service.
  const msg = `[${level}] ${typeof data === 'object' ? JSON.stringify(data) : data}`;
  if (level === 'error' || level === 'critical') {
    console.error(msg);
  } else {
    console.log(msg);
  }
}

// Utility function for delay
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retry logic with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  attempt = 1,
  maxAttempts = 3,
  initialDelay = 1000,
  maxDelay = 10000,
  backoffFactor = 2
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const isRateLimit =
      error instanceof Error &&
      (error.message.includes('rate limit') || error.message.includes('429'));

    if (isRateLimit && attempt < maxAttempts) {
      const delayMs = Math.min(initialDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);
      safeLog('warning', `Rate limit hit for ${context}. Attempt ${attempt}/${maxAttempts}. Retrying in ${delayMs}ms`);
      await delay(delayMs);
      return withRetry(operation, context, attempt + 1, maxAttempts, initialDelay, maxDelay, backoffFactor);
    }
    safeLog('error', { message: `Request failed in ${context}: ${error instanceof Error ? error.message : String(error)}`, context, attempt });
    throw error;
  }
}

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [LIST_SPACES_TOOL, GET_SPACE_TOOL, LIST_FORMS_TOOL, GET_FORM_TOOL, GET_FORM_CONTENT_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const accessToken = await getValueCaseAccessToken();
    switch (name) {
      case 'valuecase_list_spaces': {
        const response = await withRetry(
          () => apiClient.get('/spaces', { headers: { Authorization: `Bearer ${accessToken}` } }),
          'list spaces'
        );
        safeLog('info', 'Fetched spaces');
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }], isError: false };
      }
      case 'valuecase_get_space': {
        if (!args || typeof args.spaceId !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid spaceId');
        }
        const response = await withRetry(
          () => apiClient.get(`/spaces/${args.spaceId}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
          'get space'
        );
        safeLog('info', `Fetched space ${args.spaceId}`);
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }], isError: false };
      }
      case 'valuecase_list_forms': {
        if (!args || typeof args.spaceId !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid spaceId');
        }
        const response = await withRetry(
          () => apiClient.get(`/spaces/${args.spaceId}/forms`, { headers: { Authorization: `Bearer ${accessToken}` } }),
          'list forms'
        );
        safeLog('info', `Fetched forms for space ${args.spaceId}`);
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }], isError: false };
      }
      case 'valuecase_get_form': {
        if (!args || typeof args.formId !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid formId');
        }
        const response = await withRetry(
          () => apiClient.get(`/forms/${args.formId}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
          'get form'
        );
        safeLog('info', `Fetched form ${args.formId}`);
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }], isError: false };
      }
      case 'valuecase_get_form_content': {
        if (!args || typeof args.formId !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid formId');
        }
        const response = await withRetry(
          () => apiClient.get(`/forms/${args.formId}/content`, { headers: { Authorization: `Bearer ${accessToken}` } }),
          'get form content'
        );
        safeLog('info', `Fetched form content for form ${args.formId}`);
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }], isError: false };
      }
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (error) {
    safeLog('error', error);
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
});

async function runServer() {
  try {
    console.error('Initializing ValueCase MCP Server...');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('ValueCase MCP Server running on stdio');
  } catch (error) {
    console.error('Fatal error running server:', error);
    process.exit(1);
  }
}

runServer().catch((error: any) => {
  console.error('Fatal error running server:', error);
  process.exit(1);
});

// Express HTTP server for /sse endpoint with Bearer token authentication
const app = express();
const httpPort = process.env.PORT || 3000;
const EXPECTED_BEARER = process.env.VALUECASE_MCP_BEARER;

app.use(express.json());

app.post('/sse', (req: Request, res: Response) => {
  validateSseRequest(req, res).catch(() => {
    res.status(500).json({ error: 'Internal server error' });
  });
});

async function validateSseRequest(req: Request, res: Response) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];

  try {
    await axios.get(`${VALUECASE_API_URL}/spaces`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.status(200).json({ message: 'Authenticated and received!' });
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

app.get('/', (req: Request, res: Response) => {
  res.send('ValueCase MCP server is running.');
});

app.listen(httpPort, () => {
  console.log(`HTTP server listening on port ${httpPort}`);
});
