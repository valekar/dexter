import { afterEach, describe, expect, it } from 'bun:test';
import { getLmStudioModels, resolveLmStudioBaseUrl } from './lmstudio.js';

describe('LM Studio utilities', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.LMSTUDIO_API_KEY;
  });

  it('normalizes base URL to include /v1', () => {
    expect(resolveLmStudioBaseUrl('http://127.0.0.1:1234')).toBe('http://127.0.0.1:1234/v1');
    expect(resolveLmStudioBaseUrl('http://127.0.0.1:1234/v1')).toBe('http://127.0.0.1:1234/v1');
  });

  it('parses model IDs from OpenAI-compatible /models response', async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: [{ id: 'qwen2.5-coder-7b-instruct' }, { id: 'llama-3.1-8b-instruct' }],
        }),
        { status: 200 },
      )) as unknown as typeof fetch;

    const models = await getLmStudioModels();

    expect(models).toEqual(['qwen2.5-coder-7b-instruct', 'llama-3.1-8b-instruct']);
  });

  it('returns empty list when LM Studio endpoint is unavailable', async () => {
    globalThis.fetch = (async () => {
      throw new Error('connection refused');
    }) as unknown as typeof fetch;

    const models = await getLmStudioModels();
    expect(models).toEqual([]);
  });
});
