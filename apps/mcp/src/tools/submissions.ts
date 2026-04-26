import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TaskFlowApiError, type TaskFlowClient } from "../client.js";

function formatError(err: unknown): string {
	if (err instanceof TaskFlowApiError)
		return `Error: ${err.code} — ${err.message}`;
	return `Error: ${err instanceof Error ? err.message : String(err)}`;
}

function errorResult(err: unknown) {
	return {
		content: [{ type: "text" as const, text: formatError(err) }],
		isError: true,
	};
}

function jsonResult(data: unknown) {
	return {
		content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
	};
}

interface SubmissionListRow {
	userId: string;
	nickname: string | null;
	email: string;
	schoolName: string | null;
	studentId: string | null;
	role: string;
	submitted: boolean;
	submission: {
		id: string;
		score: string | null;
		reviewNote: string | null;
		isExemplary: boolean;
		firstSubmittedAt: string;
		lastUpdatedAt: string;
		content: string | null;
	} | null;
	attachments: unknown[];
}

type SubmissionFilter =
	| "all"
	| "submitted"
	| "unsubmitted"
	| "ungraded"
	| "graded"
	| "exemplary";

function applyFilter(
	rows: SubmissionListRow[],
	filter: SubmissionFilter,
): SubmissionListRow[] {
	switch (filter) {
		case "all":
			return rows;
		case "submitted":
			return rows.filter((r) => r.submitted);
		case "unsubmitted":
			return rows.filter((r) => !r.submitted);
		case "ungraded":
			return rows.filter((r) => r.submitted && r.submission?.score == null);
		case "graded":
			return rows.filter((r) => r.submission?.score != null);
		case "exemplary":
			return rows.filter((r) => r.submission?.isExemplary === true);
	}
}

export function registerSubmissionTools(
	server: McpServer,
	client: TaskFlowClient,
): void {
	server.registerTool(
		"list_submissions",
		{
			description:
				"List all student submissions for a task. Supports filtering by status. Returns student info alongside submission data. The list response does not preload attachment metadata; use get_submission for attachment details or pass taskId + submissionId to download_attachments to download all files for a student's submission.\n\nFor auto-grading: first call with filter='exemplary' to get the reference submission (score + reviewNote). If no exemplary submission exists, the user must set one manually in the web UI before batch grading can proceed. Then call with filter='ungraded' to get submissions needing grades.",
			inputSchema: {
				taskId: z.string().uuid().describe("Task ID"),
				filter: z
					.enum([
						"all",
						"submitted",
						"unsubmitted",
						"ungraded",
						"graded",
						"exemplary",
					])
					.default("all")
					.describe(
						"Filter: all, submitted, unsubmitted, ungraded, graded, or exemplary",
					),
			},
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false,
			},
		},
		async ({ taskId, filter }) => {
			try {
				const rows = await client.request<SubmissionListRow[]>(
					"GET",
					`/tasks/${taskId}/submissions`,
				);
				const filtered = applyFilter(rows, filter);
				// Strip content from list view to keep response concise
				const summary = filtered.map((r) => ({
					...r,
					submission: r.submission
						? {
								id: r.submission.id,
								score: r.submission.score,
								reviewNote: r.submission.reviewNote,
								isExemplary: r.submission.isExemplary,
								firstSubmittedAt: r.submission.firstSubmittedAt,
								lastUpdatedAt: r.submission.lastUpdatedAt,
							}
						: null,
				}));
				return jsonResult(summary);
			} catch (err) {
				return errorResult(err);
			}
		},
	);

	server.registerTool(
		"get_submission",
		{
			description:
				"Get full details of a specific submission including content text and attachment metadata.\n\nAttachments include a fileKey for each file. To read student-uploaded files (for grading), call download_attachments with this submissionId + taskId — it returns presigned URLs for all files, which you can fetch with your HTTP download tools.",
			inputSchema: {
				taskId: z.string().uuid().describe("Task ID"),
				submissionId: z.string().uuid().describe("Submission ID"),
			},
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false,
			},
		},
		async ({ taskId, submissionId }) => {
			try {
				const submission = await client.request(
					"GET",
					`/tasks/${taskId}/submissions/${submissionId}`,
				);
				return jsonResult(submission);
			} catch (err) {
				return errorResult(err);
			}
		},
	);

	server.registerTool(
		"grade_submission",
		{
			description:
				"Set a score and/or review note on a student submission. Both fields are optional so you can set them independently.\n\nAuto-grading workflow: Before batch-grading, at least one exemplary submission must exist for this task. Use list_submissions with filter='exemplary' to check. If none exist, tell the user to visit the submission list in the web UI and manually grade + mark one submission as exemplary first. Then use the exemplary submission's score and reviewNote as the reference standard for grading the rest.",
			inputSchema: {
				taskId: z.string().uuid().describe("Task ID"),
				submissionId: z.string().uuid().describe("Submission ID"),
				score: z
					.string()
					.nullable()
					.optional()
					.describe(
						"Score as a string (e.g. '85', '92.5'). Set null to clear.",
					),
				reviewNote: z
					.string()
					.nullable()
					.optional()
					.describe("Written feedback for the student. Set null to clear."),
			},
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false,
			},
		},
		async ({ taskId, submissionId, score, reviewNote }) => {
			try {
				const submission = await client.request(
					"PATCH",
					`/tasks/${taskId}/submissions/${submissionId}/grade`,
					{ score, reviewNote },
				);
				return jsonResult(submission);
			} catch (err) {
				return errorResult(err);
			}
		},
	);

	server.registerTool(
		"toggle_exemplary",
		{
			description:
				"Toggle the exemplary status of a submission. Requirements: submission must have a score and a review note of at least 30 characters before marking as exemplary.",
			inputSchema: {
				taskId: z.string().uuid().describe("Task ID"),
				submissionId: z.string().uuid().describe("Submission ID"),
			},
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: false,
				openWorldHint: false,
			},
		},
		async ({ taskId, submissionId }) => {
			try {
				const submission = await client.request(
					"PATCH",
					`/tasks/${taskId}/submissions/${submissionId}/exemplary`,
				);
				return jsonResult(submission);
			} catch (err) {
				return errorResult(err);
			}
		},
	);
}
