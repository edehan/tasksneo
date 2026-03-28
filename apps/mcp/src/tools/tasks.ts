import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TaskFlowApiError, type TaskFlowClient } from "../client.js";

function formatError(err: unknown): string {
	if (err instanceof TaskFlowApiError) return `Error: ${err.code} — ${err.message}`;
	return `Error: ${err instanceof Error ? err.message : String(err)}`;
}

function errorResult(err: unknown) {
	return { content: [{ type: "text" as const, text: formatError(err) }], isError: true };
}

function jsonResult(data: unknown) {
	return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerTaskTools(
	server: McpServer,
	client: TaskFlowClient,
): void {
	server.registerTool("list_class_tasks", {
		description:
			"List all tasks in a specific class. Returns task summaries with submission statistics.",
		inputSchema: {
			classId: z.string().uuid().describe("Class ID to list tasks from"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	}, async ({ classId }) => {
		try {
			const tasks = await client.request("GET", `/classes/${classId}/tasks`);
			return jsonResult(tasks);
		} catch (err) {
			return errorResult(err);
		}
	});

	server.registerTool("get_task", {
		description:
			"Get full details of a task including description, attachments metadata, and submission statistics.",
		inputSchema: {
			taskId: z.string().uuid().describe("Task ID"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	}, async ({ taskId }) => {
		try {
			const task = await client.request("GET", `/tasks/${taskId}`);
			return jsonResult(task);
		} catch (err) {
			return errorResult(err);
		}
	});

	server.registerTool("create_task", {
		description:
			"Create a new draft task in a class. The task starts unpublished. Use publish_task to make it visible to students.",
		inputSchema: {
			classId: z.string().uuid().describe("Class ID to create the task in"),
			title: z.string().optional().describe("Task title (defaults to 'Untitled Draft')"),
			description: z.string().optional().describe("Task description (Markdown supported)"),
			dueAt: z.string().optional().describe("Due date in ISO 8601 format"),
			startAt: z.string().optional().describe("Start date in ISO 8601 format"),
			allowLateSubmission: z.boolean().optional().describe("Whether to allow late submissions (default: true)"),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: false,
		},
	}, async ({ classId, ...body }) => {
		try {
			const task = await client.request("POST", `/classes/${classId}/tasks/drafts`, body);
			return jsonResult(task);
		} catch (err) {
			return errorResult(err);
		}
	});

	server.registerTool("update_task", {
		description:
			"Update fields on an existing task (draft or published). Only provided fields are changed.",
		inputSchema: {
			taskId: z.string().uuid().describe("Task ID"),
			title: z.string().optional().describe("New title"),
			description: z.string().nullable().optional().describe("New description (Markdown). Set null to clear."),
			dueAt: z.string().nullable().optional().describe("New due date in ISO 8601 format. Set null to clear."),
			startAt: z.string().nullable().optional().describe("New start date in ISO 8601. Set null to clear."),
			allowLateSubmission: z.boolean().optional().describe("Whether to allow late submissions"),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	}, async ({ taskId, ...body }) => {
		try {
			const task = await client.request("PATCH", `/tasks/${taskId}`, body);
			return jsonResult(task);
		} catch (err) {
			return errorResult(err);
		}
	});

	server.registerTool("publish_task", {
		description:
			"Publish a draft task, making it visible to all class members. Students will be notified.",
		inputSchema: {
			taskId: z.string().uuid().describe("Task ID of the draft to publish"),
			title: z.string().optional().describe("Override title at publish time"),
			description: z.string().nullable().optional().describe("Override description"),
			dueAt: z.string().nullable().optional().describe("Set due date"),
			startAt: z.string().nullable().optional().describe("Set start date"),
			allowLateSubmission: z.boolean().optional().describe("Whether to allow late submissions"),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	}, async ({ taskId, ...body }) => {
		try {
			const task = await client.request("POST", `/tasks/${taskId}/publish`, body);
			return jsonResult(task);
		} catch (err) {
			return errorResult(err);
		}
	});

	server.registerTool("delete_task", {
		description:
			"Delete a task. Tasks with submissions are soft-deleted (hidden); tasks without submissions are permanently removed.",
		inputSchema: {
			taskId: z.string().uuid().describe("Task ID to delete"),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: true,
			openWorldHint: false,
		},
	}, async ({ taskId }) => {
		try {
			await client.request("DELETE", `/tasks/${taskId}`);
			return jsonResult({ success: true });
		} catch (err) {
			return errorResult(err);
		}
	});
}
