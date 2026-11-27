// #476 fix round 1: the Run route is a route handler, so it has no server-action origin check.
// These checks refuse a request from another site (cross-site request forgery) and a body that is
// not JSON or too large, before the body is read. A browser always sends `Sec-Fetch-Site` or
// `Origin` on a POST; a request with neither is not from a browser and cannot carry a person's
// cookies by surprise.

/** Larger than any valid body (a pasted prompt is at most 20 000 characters). */
export const RUN_BODY_MAX_BYTES = 128 * 1024;

export type RequestProblem = "cross-origin" | "not-json" | "too-large";

export function runRequestProblem(headers: Headers, requestUrl: string): RequestProblem | null {
  const site = headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") return "cross-origin";
  const origin = headers.get("origin");
  if (origin !== null) {
    const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? new URL(requestUrl).host;
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return "cross-origin";
    }
    if (originHost !== host) return "cross-origin";
  }
  const type = headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(type.trim())) return "not-json";
  const length = Number(headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > RUN_BODY_MAX_BYTES) return "too-large";
  return null;
}
