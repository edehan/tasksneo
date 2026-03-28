#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TaskFlowClient } from "./client.js";
import { registerAuthTools } from "./tools/auth.js";
import { registerClassTools } from "./tools/classes.js";
import { registerSubmissionTools } from "./tools/submissions.js";
import { registerTaskTools } from "./tools/tasks.js";

const apiUrl = process.env.TASKFLOW_API_URL;
if (!apiUrl) {
	console.error(
		"ERROR: TASKFLOW_API_URL environment variable is required.\n" +
			"Example: TASKFLOW_API_URL=http://localhost:3001",
	);
	process.exit(1);
}

const client = new TaskFlowClient({
	apiUrl,
	mcpKey: process.env.TASKFLOW_MCP_KEY,
	email: process.env.TASKFLOW_EMAIL,
	password: process.env.TASKFLOW_PASSWORD,
	token: process.env.TASKFLOW_TOKEN,
});

const server = new McpServer({
	name: "taskflow-mcp",
	version: "0.0.1",
});

registerAuthTools(server, client);
registerClassTools(server, client);
registerTaskTools(server, client);
registerSubmissionTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);

console.error("TaskFlow MCP server running via stdio");
