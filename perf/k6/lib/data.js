import { authMode, cacheMode, fixtureFile } from "./config.js";

const fixture = JSON.parse(open(fixtureFile));

export const users = fixture.users || [];
export const publicClasses = fixture.publicClasses || [];
export const tasks = fixture.tasks || [];
export const submissions = fixture.submissions || [];
export const userAccess = fixture.userAccess || {};
export const classTasks = fixture.classTasks || {};
export const taskSubmissions = fixture.taskSubmissions || {};

function pick(items) {
	if (!items || items.length === 0) {
		throw new Error("Cannot pick from an empty fixture array");
	}
	return items[Math.floor(Math.random() * items.length)];
}

function stableIndex(offset = 0) {
	const vu = typeof __VU === "number" && __VU > 0 ? __VU : 1;
	return vu - 1 + offset;
}

function pickStable(items, offset = 0) {
	if (!items || items.length === 0) {
		throw new Error("Cannot pick from an empty fixture array");
	}
	return items[stableIndex(offset) % items.length];
}

function preferStableData() {
	return authMode === "session" || cacheMode === "warm";
}

export function randomUser() {
	return pick(users);
}

export function scenarioUser() {
	return preferStableData() ? pickStable(users) : randomUser();
}

export function randomPublicClass() {
	return pick(publicClasses);
}

export function randomTask() {
	return pick(tasks);
}

export function randomSubmission() {
	return pick(submissions);
}

export function pickAccessibleClass(user) {
	const classes = userAccess[user.id]?.classes || [];
	if (classes.length > 0) return pick(classes);
	return randomPublicClass();
}

export function pickScenarioClass(user) {
	const classes = userAccess[user.id]?.classes || [];
	if (classes.length > 0) {
		return preferStableData() ? pickStable(classes) : pick(classes);
	}
	return preferStableData() ? pickStable(publicClasses) : randomPublicClass();
}

export function pickTaskForClass(classId) {
	const items = classTasks[classId] || [];
	if (items.length > 0) return pick(items);
	return randomTask();
}

export function pickScenarioTaskForClass(classId) {
	const items = classTasks[classId] || [];
	if (items.length > 0) {
		return preferStableData() ? pickStable(items) : pick(items);
	}
	return preferStableData() ? pickStable(tasks) : randomTask();
}

export function pickSubmissionForTask(taskId) {
	const items = taskSubmissions[taskId] || [];
	if (items.length > 0) return pick(items);
	return submissions.length > 0 ? randomSubmission() : null;
}

export function pickOwnerClass() {
	const candidates = publicClasses.filter((item) => item.ownerEmail && item.ownerPassword);
	return candidates.length > 0 ? pick(candidates) : randomPublicClass();
}

export function pickScenarioOwnerClass() {
	const candidates = publicClasses.filter((item) => item.ownerEmail && item.ownerPassword);
	if (candidates.length > 0) {
		return preferStableData() ? pickStable(candidates) : pick(candidates);
	}
	return preferStableData() ? pickStable(publicClasses) : randomPublicClass();
}
