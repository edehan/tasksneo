import { prisma } from "@taskflow/db";

import { AppError } from "../lib/errors.js";

export async function listSchools() {
	return prisma.school.findMany({ orderBy: { name: "asc" } });
}

export async function createSchool(name: string) {
	return prisma.school.create({ data: { name } });
}

export async function deleteSchool(schoolId: string) {
	const school = await prisma.school.findUnique({ where: { id: schoolId } });

	if (!school) {
		throw new AppError(404, "SCHOOL_NOT_FOUND", "School not found");
	}

	await prisma.school.delete({ where: { id: schoolId } });
}
