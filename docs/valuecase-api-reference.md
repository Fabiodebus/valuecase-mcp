# ValueCase API Reference

## Overview
This document provides reference information for the ValueCase API endpoints and their integration with the Model Context Protocol (MCP).

## Base URL
```
https://api.valuecase.com/v1
```

## Authentication
[Authentication details to be added]

## Endpoints

### Campaigns
[Campaign-related endpoints to be documented]

### Contacts
[Contact-related endpoints to be documented]

### Templates
[Template-related endpoints to be documented]

### Get Form Content (GET)
Retrieves all content from a specific form.

**Endpoint:** `GET /forms/{formId}/content`

**Path Parameters:**
- `formId` (string, required): ID of the form to retrieve content from.

**Response:**
```json
{
  "content": [
    {
      "id": "string",
      "type": "string",
      "data": {}
    }
  ]
}
```

## Rate Limits
[Rate limit information to be added]

## Error Codes
[Error code documentation to be added]

## Examples
[API usage examples to be added]
