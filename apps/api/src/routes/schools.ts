import { Hono } from "hono";

import { listSchools } from "../services/school.service.js";

export const schoolsRouter = new Hono();

schoolsRouter.get("/", async (c) => {
	const schools = await listSchools();
	return c.json(schools, 200);
});
