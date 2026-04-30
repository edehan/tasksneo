#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TaskFlowClient } from "./client.js";
import { registerClassTools } from "./tools/classes.js";
import { registerFileTools } from "./tools/files.js";
import { registerSubmissionTools } from "./tools/submissions.js";
import { registerSyncTools } from "./tools/sync.js";
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
});

const instructions = `TaskFlow is a class task management system for educators. Teachers create classes, publish tasks, collect submissions, and grade them.

Common workflows:
- Browse: list_my_classes → list_class_tasks → get_task
- Review submissions: list_submissions (supports filters: all, submitted, unsubmitted, ungraded, graded, exemplary)
- Grade: get_submission → grade_submission (score + reviewNote). Optional: toggle_exemplary on a reference submission.
- Auto-grade workflow: first call list_submissions with filter='exemplary' to get the reference standard; if none exists, ask the user to mark one manually in the web UI. Then use filter='ungraded' and grade each using the exemplary as reference.
- Local sync workflow: call sync_taskflow_task with a taskId and outputDir to create or incrementally update a local task workspace. It writes task.md, task.json, task attachments, manifest.json, and submissions/<student>/ folders with content.md, submission.json, and attachments for every submitted student.

File access:
- Task and submission responses include an attachments[] array with fileKey values.
- Use sync_taskflow_task when the user wants files saved locally for review, grading, or batch analysis.
- Use download_attachments to get presigned download URLs — pass a taskId to fetch all task attachments, pass taskId+submissionId for a student's uploaded files, or pass specific fileKeys[]. URLs work without auth and expire in 5 minutes.
- For auto-grading with file attachments: call download_attachments with the submission's taskId+submissionId, then fetch each URL with your HTTP tools to read the student's work.

Permissions: only class OWNER and ADMIN roles can view submissions and grade. MEMBER access is for students who submit work.

Confirmation required: publish_task and delete_task are user-facing actions — always confirm details with the user before calling.`;

const server = new McpServer(
	{
		name: "taskflow-mcp",
		version: "0.1.0",
	},
	{
		instructions,
	},
);

registerClassTools(server, client);
registerTaskTools(server, client);
registerSubmissionTools(server, client);
registerFileTools(server, client);
registerSyncTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);

console.error("TaskFlow MCP server running via stdio");
