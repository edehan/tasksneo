import { sleep } from "k6";
import flow from "./03-business-flow.js";
import { relaxedThresholds } from "./lib/config.js";

export const options = {
	stages: [
		{ duration: __ENV.RAMP_UP || "2m", target: Number(__ENV.VUS || 50) },
		{ duration: __ENV.DURATION || "30m", target: Number(__ENV.VUS || 50) },
		{ duration: __ENV.RAMP_DOWN || "2m", target: 0 },
	],
	thresholds: relaxedThresholds,
};

export default function () {
	flow();
	sleep(1);
}
