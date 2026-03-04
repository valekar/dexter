import { describe, it, expect } from 'bun:test';
import { getChatModel, getFastModel } from './llm.js';

describe('MiniMax LLM integration', () => {
  it('creates a MiniMax chat model via OpenAI-compatible factory', () => {
    const previousKey = process.env.MINIMAX_API_KEY;
    process.env.MINIMAX_API_KEY = 'test-minimax-key';

    try {
      const model = getChatModel('MiniMax-M2');
      expect(model).toBeDefined();
    } finally {
      if (previousKey === undefined) {
        delete process.env.MINIMAX_API_KEY;
      } else {
        process.env.MINIMAX_API_KEY = previousKey;
      }
    }
  });

  it('keeps legacy MiniMax model IDs backward-compatible', () => {
    const previousKey = process.env.MINIMAX_API_KEY;
    process.env.MINIMAX_API_KEY = 'test-minimax-key';

    try {
      const model = getChatModel('minimax-m2.5');
      expect(model).toBeDefined();
    } finally {
      if (previousKey === undefined) {
        delete process.env.MINIMAX_API_KEY;
      } else {
        process.env.MINIMAX_API_KEY = previousKey;
      }
    }
  });

  it('returns configured MiniMax fast model', () => {
    const fastModel = getFastModel('minimax', 'MiniMax-M2');
    expect(fastModel).toBe('MiniMax-M2-Stable');
  });
});
