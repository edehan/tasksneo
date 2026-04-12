import { serve } from "@hono/node-server";

import { app } from "./app.js";
import { instrumentPrisma } from "./lib/db-instrument.js";
import { loadEnv } from "./lib/env.js";
import { rootLogger } from "./lib/logger.js";

const env = loadEnv();

instrumentPrisma(rootLogger);

serve(
	{
		fetch: app.fetch,
		hostname: env.listenHost,
		port: env.listenPort,
	},
	(info) => {
		rootLogger.info(
			{ address: info.address, port: info.port },
			"api_listening",
		);
	},
);
