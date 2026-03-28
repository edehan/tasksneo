import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TaskFlowApiError, type TaskFlowClient } from "../client.js";

export function registerAuthTools(
	server: McpServer,
	client: TaskFlowClient,
): void {
	server.registerTool("login", {
		description:
			"Authenticate with TaskFlow using email and password. Not needed if TASKFLOW_MCP_KEY is configured.",
		inputSchema: {
			email: z.string().email().describe("Your TaskFlow email address"),
			password: z.string().min(1).describe("Your password"),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	}, async ({ email, password }) => {
		try {
			const result = await client.loginWithCredentials(email, password);
			return {
				content: [{
					type: "text" as const,
					text: JSON.stringify({
						message: "Login successful",
						user: result.user,
					}, null, 2),
				}],
			};
		} catch (err) {
			const message = err instanceof TaskFlowApiError
				? `Error: ${err.code} — ${err.message}`
				: `Error: ${err instanceof Error ? err.message : String(err)}`;
			return { content: [{ type: "text" as const, text: message }], isError: true };
		}
	});
}
