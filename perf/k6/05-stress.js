import flow from "./03-business-flow.js";
import { relaxedThresholds } from "./lib/config.js";

export const options = {
	stages: [
		{ duration: "1m", target: 25 },
		{ duration: "2m", target: 25 },
		{ duration: "1m", target: 50 },
		{ duration: "2m", target: 50 },
		{ duration: "1m", target: 100 },
		{ duration: "2m", target: 100 },
		{ duration: "1m", target: 150 },
		{ duration: "2m", target: 150 },
		{ duration: "1m", target: 200 },
		{ duration: "2m", target: 200 },
		{ duration: "1m", target: 300 },
		{ duration: "2m", target: 300 },
		{ duration: "2m", target: 0 },
	],
	thresholds: relaxedThresholds,
};

export default function () {
	flow();
}
