import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TaskFlowApiError, type TaskFlowClient } from "../client.js";

interface ClassSummary {
	id: string;
	name: string;
	description: string | null;
	color: string;
	isPersonal: boolean;
	ownerId: string;
	schoolId: string | null;
	inviteCode: string | null;
	myRole: "OWNER" | "ADMIN" | "MEMBER";
	memberCount: number;
	createdAt: string;
}

export function registerClassTools(
	server: McpServer,
	client: TaskFlowClient,
): void {
	server.registerTool("list_my_classes", {
		description:
			"List classes where you are OWNER or ADMIN (teacher-managed classes). Personal classes are excluded.",
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	}, async () => {
		try {
			const classes = await client.request<ClassSummary[]>("GET", "/classes");
			const managed = classes.filter(
				(c) => c.myRole !== "MEMBER" && !c.isPersonal,
			);
			return {
				content: [{ type: "text" as const, text: JSON.stringify(managed, null, 2) }],
			};
		} catch (err) {
			const message = err instanceof TaskFlowApiError
				? `Error: ${err.code} — ${err.message}`
				: `Error: ${err instanceof Error ? err.message : String(err)}`;
			return { content: [{ type: "text" as const, text: message }], isError: true };
		}
	});
}
