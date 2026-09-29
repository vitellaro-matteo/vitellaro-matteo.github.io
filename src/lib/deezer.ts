// Deezer's preview URLs are signed and expire 15 minutes after the API issues
// them, so the feed stores only the track id and the player asks Deezer for a
// fresh URL when a preview is pressed. Deezer's API sends no CORS headers,
// which rules out fetch(); its JSONP output works from any page.

const API = 'https://api.deezer.com';
/** How long to wait for Deezer before giving up on a preview. */
export const DEEZER_TIMEOUT_MS = 8000;

/** A Deezer track id: a positive whole number, as the fetcher stores it. */
export function isDeezerId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** The JSONP URL of a track's details, which include a freshly signed preview. */
export function trackUrl(id: number, callback: string): string {
  if (!isDeezerId(id)) throw new Error(`Not a Deezer track id: ${id}`);
  if (!/^[A-Za-z_$][\w$]*$/.test(callback)) throw new Error(`Not a callback name: ${callback}`);
  return `${API}/track/${id}?output=jsonp&callback=${callback}`;
}

/**
 * The preview URL in a track response, or null for an error response, a track
 * without a preview, or a URL that isn't an HTTPS link to Deezer's CDN.
 */
export function previewFrom(response: unknown): string | null {
  if (typeof response !== 'object' || response === null || !('preview' in response)) return null;
  const { preview } = response;
  if (typeof preview !== 'string' || preview === '') return null;
  try {
    const url = new URL(preview);
    const onDeezer = url.hostname === 'dzcdn.net' || url.hostname.endsWith('.dzcdn.net');
    return url.protocol === 'https:' && onDeezer ? url.href : null;
  } catch {
    return null;
  }
}

/** The part of a <script> element the loader uses. */
export interface ScriptLike {
  src: string;
  onerror: ((event: Event | string) => unknown) | null;
  remove(): void;
}

/** Where the loader adds its script and callback; the page's document and window in the browser. */
export interface JsonpHost {
  callbacks: Record<string, unknown>;
  createScript(): ScriptLike;
  append(script: ScriptLike): void;
}

export const browserHost = (): JsonpHost => ({
  callbacks: window as unknown as Record<string, unknown>,
  createScript: () => document.createElement('script'),
  append: (script) => document.head.append(script as HTMLScriptElement),
});

let calls = 0;

/**
 * Loads a JSONP response. Each call gets its own callback name, so parallel
 * calls never collide, and its script and callback are removed when it settles.
 * A timed-out call leaves a no-op callback behind, so a late response doesn't
 * throw; the no-op removes itself if the response ever arrives.
 */
export function loadJsonp(
  url: (callback: string) => string,
  host: JsonpHost,
  timeoutMs = DEEZER_TIMEOUT_MS,
): Promise<unknown> {
  calls += 1;
  const name = `__deezer_${Date.now().toString(36)}_${calls}`;
  const script = host.createScript();

  const forget = () => Reflect.deleteProperty(host.callbacks, name);

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      script.onerror = null;
      script.remove();
    };
    const fail = (error: Error) => {
      cleanup();
      forget();
      reject(error);
    };
    const timer = setTimeout(() => {
      cleanup();
      host.callbacks[name] = forget;
      reject(new Error('Deezer did not answer in time'));
    }, timeoutMs);

    host.callbacks[name] = (data: unknown) => {
      cleanup();
      forget();
      resolve(data);
    };
    script.onerror = () => fail(new Error('Deezer could not be reached'));
    try {
      script.src = url(name);
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    host.append(script);
  });
}

/** A freshly signed preview URL for a Deezer track; rejects when there is none. */
export async function freshPreview(
  id: number,
  host: JsonpHost = browserHost(),
  timeoutMs = DEEZER_TIMEOUT_MS,
): Promise<string> {
  const preview = previewFrom(
    await loadJsonp((callback) => trackUrl(id, callback), host, timeoutMs),
  );
  if (!preview) throw new Error(`No preview for Deezer track ${id}`);
  return preview;
}
