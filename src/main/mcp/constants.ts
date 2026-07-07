/** Fixed port for MCP server (Import API uses 47896; Eagle MCP uses 41596). */
export const ARC_MCP_PORT = 47897;

export const ARC_MCP_HOST = '127.0.0.1';

export const ARC_MCP_PATH = '/mcp';

export const ARC_MCP_URL = `http://${ARC_MCP_HOST}:${ARC_MCP_PORT}${ARC_MCP_PATH}`;

export const MAX_MCP_BODY_BYTES = 4 * 1024 * 1024;
