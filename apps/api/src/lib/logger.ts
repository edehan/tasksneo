import pino, { type Logger } from "pino";

function buildTransport() {
	const axiomToken = process.env.AXIOM_TOKEN;
	const axiomDataset = process.env.AXIOM_DATASET;

	if (axiomToken && axiomDataset) {
		return pino.transport({
			target: "@axiomhq/pino",
			options: {
				dataset: axiomDataset,
				token: axiomToken,
			},
		});
	}

	return pino.transport({
		target: "pino-pretty",
		options: {
			colorize: true,
			translateTime: "SYS:HH:MM:ss.l",
			ignore: "pid,hostname,service,env",
			singleLine: false,
		},
	});
}

export const rootLogger: Logger = pino(
	{
		level: process.env.LOG_LEVEL ?? "info",
		base: {
			service: "taskflow-api",
			env: process.env.NODE_ENV ?? "development",
		},
	},
	buildTransport(),
);
