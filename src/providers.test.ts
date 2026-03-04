import { describe, it, expect } from 'bun:test';
import { getProviderById, resolveProvider } from './providers.js';

describe('providers registry', () => {
  it('resolves MiniMax provider from minimax model prefix (case-insensitive)', () => {
    const provider = resolveProvider('MiniMax-M2');

    expect(provider.id).toBe('minimax');
    expect(provider.apiKeyEnvVar).toBe('MINIMAX_API_KEY');
  });

  it('resolves LM Studio provider from lmstudio: model prefix', () => {
    const provider = resolveProvider('lmstudio:qwen2.5-coder-7b-instruct');

    expect(provider.id).toBe('lmstudio');
    expect(provider.modelPrefix).toBe('lmstudio:');
  });

  it('exposes MiniMax provider metadata', () => {
    const provider = getProviderById('minimax');

    expect(provider).toBeDefined();
    expect(provider?.modelPrefix).toBe('minimax');
    expect(provider?.fastModel).toBe('MiniMax-M2-Stable');
  });

  it('exposes LM Studio provider metadata', () => {
    const provider = getProviderById('lmstudio');

    expect(provider).toBeDefined();
    expect(provider?.displayName).toBe('LM Studio');
  });
});
