import { describe, expect, it } from 'bun:test';
import { getModelDisplayName, getModelsForProvider } from './model.js';

describe('model catalog', () => {
  it('includes MiniMax models in provider model list', () => {
    const models = getModelsForProvider('minimax');

    expect(models.some((m) => m.id === 'MiniMax-M2')).toBe(true);
    expect(models.some((m) => m.id === 'MiniMax-M2-Stable')).toBe(true);
  });

  it('normalizes lmstudio model IDs for display', () => {
    expect(getModelDisplayName('lmstudio:qwen2.5-coder-7b-instruct')).toBe(
      'qwen2.5-coder-7b-instruct',
    );
  });
});
