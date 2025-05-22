const VALUECASE_CLIENT_ID = process.env.VALUECASE_CLIENT_ID;
const VALUECASE_CLIENT_SECRET = process.env.VALUECASE_CLIENT_SECRET;
const VALUECASE_API_URL = process.env.VALUECASE_API_URL || 'https://api.valuecase.com/v1';

if (!VALUECASE_CLIENT_ID || !VALUECASE_CLIENT_SECRET) {
  console.error('Error: VALUECASE_CLIENT_ID and VALUECASE_CLIENT_SECRET environment variables are required');
  process.exit(1);
}

// OAuth token cache
let valuecaseAccessToken: string | null = null;
let tokenExpiresAt: number | null = null;

// Function to fetch a new access token
async function fetchValueCaseAccessToken(): Promise<string> {
  const url = 'https://app.valuecase.com/dashboard/api/api-auth/token';
  const response = await axios.post(url, {
    client_id: VALUECASE_CLIENT_ID,
    client_secret: VALUECASE_CLIENT_SECRET,
  });
  valuecaseAccessToken = response.data.access_token;
  // expires_in is in seconds
  tokenExpiresAt = Date.now() + (response.data.expires_in - 60) * 1000; // refresh 1 min before expiry
  return valuecaseAccessToken;
}

// Function to get a valid access token (fetch if expired)
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
        const response = await apiClient.get('/spaces', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }], isError: false };
      }
      case 'valuecase_get_space': {
        if (!args || typeof args.spaceId !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid spaceId');
        }
        const response = await apiClient.get(`/spaces/${args.spaceId}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }], isError: false };
      }
      case 'valuecase_list_forms': {
        if (!args || typeof args.spaceId !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid spaceId');
        }
        const response = await apiClient.get(`/spaces/${args.spaceId}/forms`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }], isError: false };
      }
      case 'valuecase_get_form': {
        if (!args || typeof args.formId !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid formId');
        }
        const response = await apiClient.get(`/forms/${args.formId}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }], isError: false };
      }
      case 'valuecase_get_form_content': {
        if (!args || typeof args.formId !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid formId');
        }
        const response = await apiClient.get(`/forms/${args.formId}/content`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
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