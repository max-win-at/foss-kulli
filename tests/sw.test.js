import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Service Worker tests.
 *
 * The SW runs in a `self` (ServiceWorkerGlobalScope) context, not `window`.
 * We test the extractable logic by replicating the key function (fetchAndCache)
 * and verifying the event-handler routing logic.
 */

// ─── Replicated fetchAndCache from sw.js ─────────────────────

const DYNAMIC_CACHE = 'foss-kulli-dynamic-v1';
const STATIC_CACHE = 'foss-kulli-static-v1';

async function fetchAndCache(request, fetchFn, cacheStorage) {
  try {
    const networkResponse = await fetchFn(request);

    if (networkResponse.ok) {
      const cache = await cacheStorage.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const cachedResponse = await cacheStorage.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// ─── Cache cleanup logic from activate handler ───────────────

function filterOldCaches(cacheNames) {
  return cacheNames.filter((name) => {
    return (
      name.startsWith('foss-kulli-') &&
      name !== STATIC_CACHE &&
      name !== DYNAMIC_CACHE
    );
  });
}

// ─── Fetch routing logic ─────────────────────────────────────

function classifyRequest(url, method) {
  if (method !== 'GET') return 'skip';
  if (!url.protocol.startsWith('http')) return 'skip';
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    return 'google-fonts';
  }
  if (url.hostname.includes('cdn.tailwindcss.com')) return 'tailwind-cdn';
  return 'local';
}

// ────────────────────────────────────────────────────────────────

describe('Service Worker - fetchAndCache', () => {
  it('returns the network response on success', async () => {
    const mockResponse = { ok: true, clone: () => mockResponse };
    const fetchFn = vi.fn().mockResolvedValue(mockResponse);
    const cachePut = vi.fn();
    const cacheStorage = {
      open: vi.fn().mockResolvedValue({ put: cachePut }),
      match: vi.fn(),
    };

    const result = await fetchAndCache('request', fetchFn, cacheStorage);

    expect(result).toBe(mockResponse);
    expect(fetchFn).toHaveBeenCalledWith('request');
  });

  it('caches successful responses', async () => {
    const mockResponse = { ok: true, clone: () => 'cloned' };
    const fetchFn = vi.fn().mockResolvedValue(mockResponse);
    const cachePut = vi.fn();
    const cacheStorage = {
      open: vi.fn().mockResolvedValue({ put: cachePut }),
      match: vi.fn(),
    };

    await fetchAndCache('request', fetchFn, cacheStorage);

    expect(cacheStorage.open).toHaveBeenCalledWith(DYNAMIC_CACHE);
    expect(cachePut).toHaveBeenCalledWith('request', 'cloned');
  });

  it('does not cache non-ok responses', async () => {
    const mockResponse = { ok: false, clone: () => 'cloned' };
    const fetchFn = vi.fn().mockResolvedValue(mockResponse);
    const cacheStorage = {
      open: vi.fn().mockResolvedValue({ put: vi.fn() }),
      match: vi.fn(),
    };

    const result = await fetchAndCache('request', fetchFn, cacheStorage);

    expect(result).toBe(mockResponse);
    expect(cacheStorage.open).not.toHaveBeenCalled();
  });

  it('falls back to cache when network fails', async () => {
    const cachedResponse = { status: 200 };
    const fetchFn = vi.fn().mockRejectedValue(new Error('Offline'));
    const cacheStorage = {
      open: vi.fn(),
      match: vi.fn().mockResolvedValue(cachedResponse),
    };

    const result = await fetchAndCache('request', fetchFn, cacheStorage);

    expect(result).toBe(cachedResponse);
  });

  it('throws when both network and cache fail', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('Offline'));
    const cacheStorage = {
      open: vi.fn(),
      match: vi.fn().mockResolvedValue(null),
    };

    await expect(fetchAndCache('request', fetchFn, cacheStorage)).rejects.toThrow('Offline');
  });
});

describe('Service Worker - cache cleanup (filterOldCaches)', () => {
  it('identifies old foss-kulli caches for deletion', () => {
    const cacheNames = [
      'foss-kulli-static-v1',
      'foss-kulli-dynamic-v1',
      'foss-kulli-old-v0',
      'foss-kulli-static-v0',
      'other-app-cache',
    ];

    const toDelete = filterOldCaches(cacheNames);

    expect(toDelete).toEqual(['foss-kulli-old-v0', 'foss-kulli-static-v0']);
  });

  it('returns empty array when only current caches exist', () => {
    const cacheNames = ['foss-kulli-static-v1', 'foss-kulli-dynamic-v1'];

    expect(filterOldCaches(cacheNames)).toEqual([]);
  });

  it('ignores caches from other apps', () => {
    const cacheNames = ['other-cache', 'another-cache'];

    expect(filterOldCaches(cacheNames)).toEqual([]);
  });

  it('handles empty cache list', () => {
    expect(filterOldCaches([])).toEqual([]);
  });
});

describe('Service Worker - request classification', () => {
  it('skips non-GET requests', () => {
    expect(classifyRequest(new URL('https://example.com'), 'POST')).toBe('skip');
  });

  it('skips non-http protocols', () => {
    expect(classifyRequest(new URL('chrome-extension://abc/page'), 'GET')).toBe('skip');
  });

  it('classifies Google Fonts requests', () => {
    expect(
      classifyRequest(new URL('https://fonts.googleapis.com/css2'), 'GET'),
    ).toBe('google-fonts');
    expect(
      classifyRequest(new URL('https://fonts.gstatic.com/font.woff2'), 'GET'),
    ).toBe('google-fonts');
  });

  it('classifies Tailwind CDN requests', () => {
    expect(
      classifyRequest(new URL('https://cdn.tailwindcss.com/3.4.0'), 'GET'),
    ).toBe('tailwind-cdn');
  });

  it('classifies local asset requests', () => {
    expect(
      classifyRequest(new URL('https://myapp.com/js/app.js'), 'GET'),
    ).toBe('local');
  });
});

describe('Service Worker - constants', () => {
  it('uses versioned cache names', () => {
    expect(STATIC_CACHE).toMatch(/^foss-kulli-static-v\d+$/);
    expect(DYNAMIC_CACHE).toMatch(/^foss-kulli-dynamic-v\d+$/);
  });
});
