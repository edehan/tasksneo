import { prisma } from "@taskflow/db";

import { AppError } from "../lib/errors.js";
import { parseResourceId } from "../lib/public-id.js";

async function resolveUniqueId(
	value: string,
	fieldName: "classId" | "taskId" | "submissionId",
	model: "class" | "task" | "submission",
	notFoundCode: string,
	notFoundMessage: string,
): Promise<string> {
	const kind = parseResourceId(value, fieldName);

	let row: { id: string } | null = null;

	if (model === "class") {
		row =
			kind === "uuid"
				? await prisma.class.findUnique({
						where: { id: value },
						select: { id: true },
					})
				: await prisma.class.findUnique({
						where: { publicId: value },
						select: { id: true },
					});
	} else if (model === "task") {
		row =
			kind === "uuid"
				? await prisma.task.findUnique({
						where: { id: value },
						select: { id: true },
					})
				: await prisma.task.findUnique({
						where: { publicId: value },
						select: { id: true },
					});
	} else {
		row =
			kind === "uuid"
				? await prisma.submission.findUnique({
						where: { id: value },
						select: { id: true },
					})
				: await prisma.submission.findUnique({
						where: { publicId: value },
						select: { id: true },
					});
	}

	if (!row) {
		throw new AppError(404, notFoundCode, notFoundMessage);
	}

	return row.id;
}

export async function resolveClassId(value: string): Promise<string> {
	return resolveUniqueId(
		value,
		"classId",
		"class",
		"CLASS_NOT_FOUND",
		"Class not found",
	);
}

export async function resolveTaskId(value: string): Promise<string> {
	return resolveUniqueId(
		value,
		"taskId",
		"task",
		"TASK_NOT_FOUND",
		"Task not found",
	);
}

export async function resolveSubmissionId(value: string): Promise<string> {
	return resolveUniqueId(
		value,
		"submissionId",
		"submission",
		"SUBMISSION_NOT_FOUND",
		"Submission not found",
	);
}
