/**
 * Yahoo Finance Provider
 * 
 * Implementation using yahoo-finance2 package.
 * Supports: Global stocks, live prices, historical data.
 */

import yahooFinance from 'yahoo-finance2';
import { BaseProvider } from './base-provider.js';
import {
  ProviderCapabilities,
  ProviderRequestContext,
  StockPriceResponse,
  HistoricalDataResponse,
  HistoricalDataPoint,
} from './types.js';
import { ProviderErrorCode } from './types.js';

const CAPABILITIES: ProviderCapabilities = {
  livePrices: true,
  historicalData: true,
  incomeStatements: false,
  balanceSheets: false,
  cashFlowStatements: false,
  keyRatios: false,
  analystEstimates: false,
  filings: false,
  insiderTrades: false,
  companyNews: false,
  orderPlacement: false,
  positions: false,
  holdings: false,
  markets: ['US', 'IN', 'GLOBAL'],
};

const CONFIG = {
  id: 'yahoo' as const,
  displayName: 'Yahoo Finance',
  baseUrl: 'https://query1.finance.yahoo.com',
  capabilities: CAPABILITIES,
  rateLimits: {
    default: { perSecond: 10, perMinute: 2000 },
  },
  requiresAuth: false,
  enabled: process.env.ENABLE_YAHOO !== 'false',
};

export class YahooProvider extends BaseProvider {
  constructor() {
    super(CONFIG);
  }

  /**
   * Yahoo Finance doesn't require auth for basic queries
   */
  isAvailable(): boolean {
    return true; // Always available
  }

  /**
   * Build Yahoo symbol with exchange suffix when provided.
   */
  private buildYahooSymbol(context: ProviderRequestContext): string {
    const symbol = this.validateTicker(context.ticker);

    if (symbol.endsWith('.NS') || symbol.endsWith('.BO')) {
      return symbol;
    }

    if (context.exchange === 'NSE') {
      return `${symbol}.NS`;
    }

    if (context.exchange === 'BSE') {
      return `${symbol}.BO`;
    }

    return symbol;
  }

  private getFallbackYahooSymbol(primarySymbol: string, originalTicker: string): string | undefined {
    if (primarySymbol.endsWith('.NS') || primarySymbol.endsWith('.BO')) {
      return originalTicker;
    }

    return undefined;
  }

  private isNotFoundError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return error.message.toLowerCase().includes('not found');
  }

  private async quoteSymbol(symbol: string): Promise<any | null> {
    try {
      const quote = await yahooFinance.quote(symbol) as any;
      if (!quote || quote.regularMarketPrice === null) {
        return null;
      }
      return quote;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  private async historicalSymbol(symbol: string, startDate: Date, endDate: Date): Promise<any[] | null> {
    try {
      const history = (await yahooFinance.historical(symbol, {
        period1: startDate,
        period2: endDate,
        interval: '1d',
      })) as any[];

      if (!history || history.length === 0) {
        return null;
      }

      return history;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get stock price
   */
  async getStockPrice(context: ProviderRequestContext): Promise<StockPriceResponse> {
    const originalTicker = this.validateTicker(context.ticker);
    const primarySymbol = this.buildYahooSymbol({ ...context, ticker: originalTicker });
    const fallbackSymbol = this.getFallbackYahooSymbol(primarySymbol, originalTicker);

    try {
      let resolvedSymbol = primarySymbol;
      let quote = await this.quoteSymbol(primarySymbol);

      if (!quote && fallbackSymbol) {
        quote = await this.quoteSymbol(fallbackSymbol);
        if (quote) {
          resolvedSymbol = fallbackSymbol;
        }
      }

      if (!quote) {
        throw this.createError(
          `Ticker ${originalTicker} not found`,
          ProviderErrorCode.NOT_FOUND,
          false
        );
      }

      return this.buildStockPriceResponse(originalTicker, resolvedSymbol, quote);
    } catch (error) {
      if (error instanceof Error && (error as { code?: ProviderErrorCode }).code === ProviderErrorCode.NOT_FOUND) {
        throw error;
      }

      if (this.isNotFoundError(error)) {
        throw this.createError(
          `Ticker ${originalTicker} not found`,
          ProviderErrorCode.NOT_FOUND,
          false,
          undefined,
          error
        );
      }
      throw this.createError(
        error instanceof Error ? error.message : 'Failed to get quote',
        ProviderErrorCode.NETWORK_ERROR,
        true,
        undefined,
        error
      );
    }
  }

  /**
   * Get historical data
   */
  async getHistoricalData(context: ProviderRequestContext): Promise<HistoricalDataResponse> {
    const originalTicker = this.validateTicker(context.ticker);
    const primarySymbol = this.buildYahooSymbol({ ...context, ticker: originalTicker });
    const fallbackSymbol = this.getFallbackYahooSymbol(primarySymbol, originalTicker);

    const startDate = context.startDate 
      ? new Date(context.startDate) 
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = context.endDate 
      ? new Date(context.endDate) 
      : new Date();

    try {
      let resolvedSymbol = primarySymbol;
      let history = await this.historicalSymbol(primarySymbol, startDate, endDate);

      if (!history && fallbackSymbol) {
        history = await this.historicalSymbol(fallbackSymbol, startDate, endDate);
        if (history) {
          resolvedSymbol = fallbackSymbol;
        }
      }

      if (!history) {
        throw this.createError(
          `No historical data for ${originalTicker}`,
          ProviderErrorCode.NOT_FOUND,
          false
        );
      }

      return this.buildHistoricalDataResponse(originalTicker, resolvedSymbol, history);
    } catch (error) {
      if (error instanceof Error && (error as { code?: ProviderErrorCode }).code === ProviderErrorCode.NOT_FOUND) {
        throw error;
      }

      if (this.isNotFoundError(error)) {
        throw this.createError(
          `Ticker ${originalTicker} not found`,
          ProviderErrorCode.NOT_FOUND,
          false,
          undefined,
          error
        );
      }
      throw this.createError(
        error instanceof Error ? error.message : 'Failed to get historical data',
        ProviderErrorCode.NETWORK_ERROR,
        true,
        undefined,
        error
      );
    }
  }

  private buildStockPriceResponse(
    originalTicker: string,
    resolvedSymbol: string,
    quote: any
  ): StockPriceResponse {
    const currency = this.getCurrencyFromCurrencyCode(quote.currency);
    const marketState = this.getMarketState(quote.marketState);

    return this.normalizeStockPrice(originalTicker, 'yahoo', {
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      currency,
      marketState,
      volume: quote.regularMarketVolume,
      marketCap: quote.marketCap,
      sharesOutstanding: quote.sharesOutstanding,
      sourceUrl: `https://finance.yahoo.com/quote/${resolvedSymbol}`,
    });
  }

  private buildHistoricalDataResponse(
    originalTicker: string,
    resolvedSymbol: string,
    history: any[]
  ): HistoricalDataResponse {
    const dataPoints: HistoricalDataPoint[] = history.map((item: any) => ({
      date: item.date.toISOString().split('T')[0],
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }));

    return {
      ticker: originalTicker,
      provider: 'yahoo',
      data: dataPoints,
      sourceUrl: `https://finance.yahoo.com/quote/${resolvedSymbol}/history`,
    };
  }

  /**
   * Convert Yahoo currency code to our format
   */
  private getCurrencyFromCurrencyCode(currency?: string): 'USD' | 'INR' {
    if (currency === 'INR') return 'INR';
    return 'USD'; // Default to USD
  }

  /**
   * Convert Yahoo market state to our format
   */
  private getMarketState(marketState?: string): StockPriceResponse['marketState'] {
    switch (marketState?.toUpperCase()) {
      case 'PRE':
        return 'pre';
      case 'POST':
      case 'POSTMARKET':
        return 'post';
      case 'CLOSED':
        return 'closed';
      case 'OPEN':
      default:
        return 'open';
    }
  }
}

// Export singleton
export const yahooProvider = new YahooProvider();
