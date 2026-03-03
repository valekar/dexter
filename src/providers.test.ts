import { describe, it, expect } from 'bun:test';
import { getProviderById, resolveProvider } from './providers.js';

describe('providers registry', () => {
  it('resolves MiniMax provider from minimax- model prefix', () => {
    const provider = resolveProvider('minimax-4-chat');

    expect(provider.id).toBe('minimax');
    expect(provider.apiKeyEnvVar).toBe('MINIMAX_API_KEY');
  });

  it('exposes MiniMax provider metadata', () => {
    const provider = getProviderById('minimax');

    expect(provider).toBeDefined();
    expect(provider?.modelPrefix).toBe('minimax-');
    expect(provider?.fastModel).toBe('minimax-4-flash');
  });
});
