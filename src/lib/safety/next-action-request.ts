/**
 * Server-side guards for `POST /safety/next-action` (#119 review M2, M3): the same-origin check and
 * a body read that stops at a byte limit. Server only.
 */

/** Reads at most `limit` bytes; null when the body is longer or cannot be read. */
export async function readCapped(request: Request, limit: number): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && !(Number(declared) <= limit)) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Same site only. A browser marks its own request `Sec-Fetch-Site: same-origin`; one that does not
 * send that header must send an `Origin` whose host is the host the request was sent to. The
 * request's own URL is not compared: behind a proxy or in development it can name another host
 * (127.0.0.1 versus localhost) than the browser used.
 */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null) return site === "same-origin";
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host.split(",")[0].trim();
  } catch {
    return false;
  }
}
