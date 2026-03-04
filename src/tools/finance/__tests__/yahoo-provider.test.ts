import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import yahooFinance from 'yahoo-finance2';
import { YahooProvider } from '../providers/yahoo-provider.js';

let provider: YahooProvider;
const originalQuote = yahooFinance.quote;
const originalHistorical = yahooFinance.historical;

describe('YahooProvider Indian market enhancements', () => {
  beforeEach(() => {
    provider = new YahooProvider();
  });

  afterEach(() => {
    yahooFinance.quote = originalQuote;
    yahooFinance.historical = originalHistorical;
  });

  it('builds NSE suffix when exchange is NSE', () => {
    const symbol = (provider as any).buildYahooSymbol({ ticker: 'RELIANCE', exchange: 'NSE' });
    expect(symbol).toBe('RELIANCE.NS');
  });

  it('builds BSE suffix when exchange is BSE', () => {
    const symbol = (provider as any).buildYahooSymbol({ ticker: 'TCS', exchange: 'BSE' });
    expect(symbol).toBe('TCS.BO');
  });

  it('keeps existing suffix when ticker already contains one', () => {
    const symbol = (provider as any).buildYahooSymbol({ ticker: 'INFY.NS' });
    expect(symbol).toBe('INFY.NS');
  });

  it('falls back to unsuffixed ticker when NSE quote is missing', async () => {
    const calledSymbols: string[] = [];

    yahooFinance.quote = (async (symbol: string) => {
      calledSymbols.push(symbol);
      if (symbol === 'RELIANCE.NS') {
        return null as any;
      }
      if (symbol === 'RELIANCE') {
        return {
          regularMarketPrice: 2500,
          regularMarketChange: 10,
          regularMarketChangePercent: 0.4,
          currency: 'INR',
          marketState: 'OPEN',
          regularMarketVolume: 1000,
          marketCap: 100000,
          sharesOutstanding: 10,
        };
      }
      return null as any;
    }) as typeof yahooFinance.quote;

    const result = await provider.getStockPrice({ ticker: 'RELIANCE', exchange: 'NSE' });

    expect(calledSymbols).toEqual(['RELIANCE.NS', 'RELIANCE']);
    expect(result.ticker).toBe('RELIANCE');
    expect(result.currency).toBe('INR');
  });

  it('falls back to unsuffixed ticker when BSE historical data is empty', async () => {
    const calledSymbols: string[] = [];

    yahooFinance.historical = (async (symbol: string) => {
      calledSymbols.push(symbol);
      if (symbol === 'TCS.BO') {
        return [] as any;
      }
      if (symbol === 'TCS') {
        return [
          {
            date: new Date('2026-01-01T00:00:00.000Z'),
            open: 100,
            high: 110,
            low: 95,
            close: 105,
            volume: 100000,
          },
        ] as any;
      }
      return [] as any;
    }) as typeof yahooFinance.historical;

    const result = await provider.getHistoricalData({
      ticker: 'TCS',
      exchange: 'BSE',
      startDate: '2026-01-01',
      endDate: '2026-01-02',
    });

    expect(calledSymbols).toEqual(['TCS.BO', 'TCS']);
    expect(result.ticker).toBe('TCS');
    expect(result.data.length).toBe(1);
  });
});
