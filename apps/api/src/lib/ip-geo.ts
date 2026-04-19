import geoip from "geoip-country";

const UNKNOWN_COUNTRIES = new Set(["", "XX"]);

/**
 * Lookup the country name for an IP address using the bundled geoip-country
 * database (offline, no auto-update).
 *
 * Returns `null` if the IP is invalid, private, or not found in the database.
 */
export function lookupCountry(ip: string | null | undefined): string | null {
	if (!ip) return null;

	try {
		const result = geoip.lookup(ip);
		if (!result) return null;
		const country = result.name ?? result.country;
		if (!country || UNKNOWN_COUNTRIES.has(country)) return null;
		return country;
	} catch {
		return null;
	}
}
