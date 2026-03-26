import { serve } from "@hono/node-server";

import { app } from "./app.js";
import { loadEnv } from "./lib/env.js";

const env = loadEnv();

serve(
	{
		fetch: app.fetch,
		hostname: env.listenHost,
		port: env.listenPort,
	},
	(info) => {
		console.log(
			`TaskFlow API listening on http://${info.address}:${info.port}`,
		);
	},
);
