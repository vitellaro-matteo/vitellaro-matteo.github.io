import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  freshPreview,
  isDeezerId,
  loadJsonp,
  previewFrom,
  trackUrl,
  type JsonpHost,
  type ScriptLike,
} from './deezer';

const PREVIEW =
  'https://cdnt-preview.dzcdn.net/api/1/1/7/e/7/0/7e7e.mp3?hdnea=exp=1790629705~acl=/api/1/1/7/e/7/0/7e7e.mp3*~hmac=374e';

/** A stand-in for the page: records the scripts added, and lets a test answer or fail them. */
function fakeHost() {
  const scripts: (ScriptLike & { removed: boolean })[] = [];
  const host: JsonpHost = {
    callbacks: {},
    createScript: () => {
      const script = {
        src: '',
        onerror: null,
        removed: false,
        remove() {
          script.removed = true;
        },
      };
      scripts.push(script);
      return script;
    },
    append: () => undefined,
  };
  const last = () => {
    const script = scripts.at(-1);
    if (!script) throw new Error('No script was added');
    return script;
  };
  const callbackOf = (script: ScriptLike) => new URL(script.src).searchParams.get('callback') ?? '';
  const answer = (data: unknown, script = last()) =>
    (host.callbacks[callbackOf(script)] as (data: unknown) => void)(data);
  const fail = (script = last()) => script.onerror?.(new Event('error'));
  return { host, scripts, callbackOf, answer, fail };
}

describe('isDeezerId', () => {
  it('accepts positive whole numbers only', () => {
    expect(isDeezerId(2113267347)).toBe(true);
    expect(isDeezerId(0)).toBe(false);
    expect(isDeezerId(-3)).toBe(false);
    expect(isDeezerId(1.5)).toBe(false);
    expect(isDeezerId('2113267347')).toBe(false);
    expect(isDeezerId(Number.NaN)).toBe(false);
  });
});

describe('trackUrl', () => {
  it('asks for the track as JSONP with the given callback', () => {
    expect(trackUrl(2113267347, '__deezer_x_1')).toBe(
      'https://api.deezer.com/track/2113267347?output=jsonp&callback=__deezer_x_1',
    );
  });

  it('refuses anything that could change the URL or the script', () => {
    expect(() => trackUrl(Number.NaN, 'cb')).toThrow('Not a Deezer track id');
    expect(() => trackUrl(1, 'cb&x=1')).toThrow('Not a callback name');
    expect(() => trackUrl(1, 'alert(1)//')).toThrow('Not a callback name');
  });
});

describe('previewFrom', () => {
  it('returns the signed preview of a track', () => {
    expect(previewFrom({ id: 1, preview: PREVIEW })).toBe(PREVIEW);
  });

  it('returns null for errors, missing previews and URLs off Deezer', () => {
    expect(previewFrom({ error: { type: 'DataException', message: 'no data', code: 800 } })).toBe(
      null,
    );
    expect(previewFrom({ id: 1, preview: '' })).toBeNull();
    expect(previewFrom({ id: 1, preview: 'http://cdnt-preview.dzcdn.net/a.mp3' })).toBeNull();
    expect(previewFrom({ id: 1, preview: 'https://evil.example/dzcdn.net/a.mp3' })).toBeNull();
    expect(previewFrom({ id: 1, preview: 'javascript:alert(1)' })).toBeNull();
    expect(previewFrom({ id: 1, preview: 'not a url' })).toBeNull();
    expect(previewFrom(null)).toBeNull();
    expect(previewFrom('oops')).toBeNull();
  });
});

describe('loadJsonp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the response and cleans up after itself', async () => {
    const { host, scripts, answer } = fakeHost();
    const loading = loadJsonp((cb) => trackUrl(7, cb), host, 1000);
    answer({ id: 7, preview: PREVIEW });

    await expect(loading).resolves.toEqual({ id: 7, preview: PREVIEW });
    expect(Object.keys(host.callbacks)).toEqual([]);
    expect(scripts[0]?.removed).toBe(true);
  });

  it('gives every call its own callback', () => {
    const { host, scripts, callbackOf } = fakeHost();
    void loadJsonp((cb) => trackUrl(1, cb), host);
    void loadJsonp((cb) => trackUrl(2, cb), host);
    const [first, second] = scripts.map(callbackOf);
    expect(first).not.toBe(second);
    expect(Object.keys(host.callbacks)).toEqual([first, second]);
  });

  it('rejects when the script fails to load', async () => {
    const { host, scripts, fail } = fakeHost();
    const loading = loadJsonp((cb) => trackUrl(7, cb), host, 1000);
    fail();

    await expect(loading).rejects.toThrow('could not be reached');
    expect(Object.keys(host.callbacks)).toEqual([]);
    expect(scripts[0]?.removed).toBe(true);
  });

  it('times out, and a late answer is ignored without an error', async () => {
    const { host, scripts, callbackOf, answer } = fakeHost();
    const loading = loadJsonp((cb) => trackUrl(7, cb), host, 1000);
    const [script] = scripts;
    if (!script) throw new Error('No script was added');
    const name = callbackOf(script);
    vi.advanceTimersByTime(1000);

    await expect(loading).rejects.toThrow('did not answer in time');
    expect(scripts[0]?.removed).toBe(true);
    expect(() => answer({ id: 7, preview: PREVIEW }, scripts[0])).not.toThrow();
    expect(name in host.callbacks).toBe(false);
  });

  it('does not time out once answered', async () => {
    const { host, answer } = fakeHost();
    const loading = loadJsonp((cb) => trackUrl(7, cb), host, 1000);
    answer({ id: 7 });
    vi.advanceTimersByTime(5000);
    await expect(loading).resolves.toEqual({ id: 7 });
  });

  it('rejects without adding a script when the URL is invalid', async () => {
    const { host, scripts } = fakeHost();
    await expect(loadJsonp((cb) => trackUrl(-1, cb), host)).rejects.toThrow('Not a Deezer');
    expect(scripts[0]?.src).toBe('');
    expect(Object.keys(host.callbacks)).toEqual([]);
  });
});

describe('freshPreview', () => {
  it('returns the new preview URL', async () => {
    const { host, answer } = fakeHost();
    const loading = freshPreview(2113267347, host);
    answer({ id: 2113267347, preview: PREVIEW });
    await expect(loading).resolves.toBe(PREVIEW);
  });

  it('rejects when Deezer has no preview for the track', async () => {
    const { host, answer } = fakeHost();
    const loading = freshPreview(1, host);
    answer({ error: { type: 'DataException', message: 'no data', code: 800 } });
    await expect(loading).rejects.toThrow('No preview for Deezer track 1');
  });
});
