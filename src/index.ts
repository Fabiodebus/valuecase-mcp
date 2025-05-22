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

const VALUECASE_API_KEY = process.env.VALUECASE_API_KEY;
const VALUECASE_API_URL = process.env.VALUECASE_API_URL || 'https://api.valuecase.com/v1';

// Check if API key is provided
if (!VALUECASE_API_KEY) {
  console.error('Error: VALUECASE_API_KEY environment variable is required');
  process.exit(1);
}

// TODO: Integrate with Claude or OpenAI for enhanced functionality
// Example: Use Claude/OpenAI to process form content or generate responses

const apiClient: AxiosInstance = axios.create({
  baseURL: VALUECASE_API_URL,
  headers: {
    'Authorization': `Bearer ${VALUECASE_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [LIST_SPACES_TOOL, GET_SPACE_TOOL, LIST_FORMS_TOOL, GET_FORM_TOOL, GET_FORM_CONTENT_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case 'valuecase_list_spaces': {
        const response = await apiClient.get('/spaces');
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }], isError: false };
      }
      case 'valuecase_get_space': {
        if (!args || typeof args.spaceId !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid spaceId');
        }
        const response = await apiClient.get(`/spaces/${args.spaceId}`);
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }], isError: false };
      }
      case 'valuecase_list_forms': {
        if (!args || typeof args.spaceId !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid spaceId');
        }
        const response = await apiClient.get(`/spaces/${args.spaceId}/forms`);
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }], isError: false };
      }
      case 'valuecase_get_form': {
        if (!args || typeof args.formId !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid formId');
        }
        const response = await apiClient.get(`/forms/${args.formId}`);
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }], isError: false };
      }
      case 'valuecase_get_form_content': {
        if (!args || typeof args.formId !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid formId');
        }
        const response = await apiClient.get(`/forms/${args.formId}/content`);
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }], isError: false };
      }
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (error) {
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
