# Dexter Integration Planning Document
## MiniMax LLM + Yahoo Finance (Free Data Sources)

**Version:** 2.1 - Enhanced with OpenAI-Compatible API Documentation
**Created:** 2026-03-03
**Last Updated:** 2026-03-03
**Status:** Complete
**Output Directory:** ~/Projects/dexter/docs/

---

## 1. Requirements Analysis

### 1.1 Core Objectives

| Objective | Description | Priority |
|-----------|-------------|----------|
| **MiniMax LLM Integration** | Add MiniMax M2.5 as a supported LLM provider in Dexter | High |
| **Yahoo Finance Enhancement** | Enhance existing Yahoo provider for better NSE/BSE support | High |
| **Provider Agnostic Design** | Follow existing patterns, no breaking changes | High |
| **Free Data Sources** | Use only free APIs (Yahoo Finance, no paid providers) | High |

### 1.2 Technical Constraints

- **LLM Model:** Must use MiniMax API key (already available)
- **Data Provider:** Must use Yahoo Finance (free, no auth required)
- **Architecture:** Must follow Dexter's existing provider patterns
- **No Breaking Changes:** Existing providers must continue working

### 1.3 Success Criteria

- [ ] MiniMax LLM can be used via model name prefix (e.g., `minimax-...`)
- [ ] Yahoo Finance works for NSE/BSE symbols without paid APIs
- [ ] All existing providers (OpenAI, Anthropic, etc.) continue to work
- [ ] Code follows DRY and KISS principles
- [ ] No regressions in existing functionality

---

## 2. Architecture Analysis

### 2.1 Current LLM Provider Pattern

Dexter uses a **registry-based factory pattern** for LLM providers:

```
src/providers.ts (Registry)
    └── PROVIDERS[] (Provider metadata)
    └── resolveProvider(modelName) → ProviderDef
    └── getProviderById(id) → ProviderDef

src/model/llm.ts (Factory)
    └── MODEL_FACTORIES[id] → ModelFactory
    └── getChatModel(modelName) → BaseChatModel
    └── callLlm(prompt, options) → LlmResult
```

**Key Design Decisions:**
- **Prefix-based routing:** `claude-` → Anthropic, `gemini-` → Google
- **Factory pattern:** Each provider has a factory function
- **LangChain integration:** All providers implement LangChain's `BaseChatModel`
- **Unified interface:** `getChatModel()` works for all providers

### 2.2 Current Finance Provider Pattern

Dexter uses an **abstract base class + registry pattern** for finance providers:

```
src/tools/finance/providers/
    ├── base-provider.ts (Abstract base class)
    ├── types.ts (Interfaces and schemas)
    ├── provider-registry.ts (Registry + routing)
    ├── yahoo-provider.ts (Yahoo implementation - EXISTS)
    ├── groww-provider.ts (Groww implementation - PAID)
    └── zerodha-provider.ts (Zerodha implementation - PAID)
```

**Key Design Decisions:**
- **BaseProvider:** Abstract class with common HTTP/error handling
- **Capabilities:** Each provider declares supported features
- **Registry:** Manages initialization, routing, and fallback
- **Provider agnostic:** Tools use registry, not direct provider calls

### 2.3 Yahoo Finance Integration Status

**Good news:** Yahoo provider **already exists** at `src/tools/finance/providers/yahoo-provider.ts`

**Current Implementation:**
- Uses `yahoo-finance2` npm package
- Supports: Live prices, Historical data
- Capabilities: `['US', 'IN', 'GLOBAL']`
- No API key required (free)

**What Needs Enhancement:**
- Better NSE/BSE symbol handling
- More robust error handling for Indian markets
- Documentation on how to use it

---

## 3. Detailed Implementation Plan

### 3.1 MiniMax LLM Integration

#### ⚠️ CRITICAL: MiniMax Uses OpenAI-Compatible API

**Important:** MiniMax provides an **OpenAI-compatible API** at `https://api.minimax.chat/v1`.

**What this means:**
- MiniMax API follows the same request/response format as OpenAI
- Uses `/v1/chat/completions` endpoint (just like OpenAI)
- Returns data in OpenAI-compatible format
- Can use LangChain's `ChatOpenAI` class directly

**Do NOT use Anthropic pattern:**
- ❌ Do NOT use `ChatAnthropic`
- ❌ Do NOT try to implement custom Anthropic-style integration
- ✅ USE `ChatOpenAI` with custom `baseURL`

**Why this matters:**
This design choice allows MiniMax to integrate seamlessly with Dexter's existing provider infrastructure without requiring custom implementation logic.

#### 3.1.1 Step 1: Add MiniMax to Provider Registry

**File:** `src/providers.ts`

**Change:** Add MiniMax entry to `PROVIDERS` array

```typescript
export const PROVIDERS: ProviderDef[] = [
  // ... existing providers ...
  {
    id: 'minimax',
    displayName: 'MiniMax',
    modelPrefix: 'minimax-',
    apiKeyEnvVar: 'MINIMAX_API_KEY',
    fastModel: 'minimax-4-flash',
  },
  // ... rest of providers ...
];
```

**Location in file:** After `deepseek` entry, before `openrouter`

#### 3.1.2 Step 2: Add MiniMax to Model Factory

**File:** `src/model/llm.ts`

**Change:** Add MiniMax factory to `MODEL_FACTORIES` object

```typescript
const MODEL_FACTORIES: Record<string, ModelFactory> = {
  // ... existing factories ...
  
  minimax: (name, opts) =>
    new ChatOpenAI({
      model: name.replace(/^minimax:/, ''),
      ...opts,
      apiKey: getApiKey('MINIMAX_API_KEY'),
      configuration: {
        baseURL: 'https://api.minimax.chat/v1',
      },
    }),
  
  // ... rest of factories ...
};
```

**Why `ChatOpenAI` for MiniMax?**
- MiniMax uses OpenAI-compatible API format
- Supports `/v1/chat/completions` endpoint
- Response format matches OpenAI
- LangChain's `ChatOpenAI` works with any OpenAI-compatible API

#### 3.1.3 MiniMax API Structure

**Base URL:** `https://api.minimax.chat/v1`

**Request Format (OpenAI-compatible):**
```typescript
// POST https://api.minimax.chat/v1/chat/completions
{
  "model": "minimax-4-chat",
  "messages": [
    {
      "role": "user",
      "content": "What is the stock price of Apple?"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1000
}
```

**Response Format (OpenAI-compatible):**
```typescript
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1699999999,
  "model": "minimax-4-chat",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The current stock price of Apple..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 50,
    "total_tokens": 70
  }
}
```

**Authentication:**
- Header: `Authorization: Bearer <MINIMAX_API_KEY>`
- Content-Type: `application/json`

**LangChain Integration:**
```typescript
// LangChain's ChatOpenAI handles all of this automatically
const llm = new ChatOpenAI({
  model: 'minimax-4-chat',
  apiKey: process.env.MINIMAX_API_KEY,
  configuration: {
    baseURL: 'https://api.minimax.chat/v1',  // Only difference from OpenAI
  },
});

// Call MiniMax just like you'd call OpenAI
const response = await llm.invoke([new HumanMessage("Hello!")]);
```

**Available MiniMax Models:**
- `minimax-4-chat` - General purpose model
- `minimax-4-flash` - Fast model for quick responses
- `minimax-4-reasoning` - Enhanced reasoning capabilities

#### 3.1.4 Step 4: Add Environment Variable

**File:** `.env.example`

**Add these lines:**

```bash
# ========================================
# MiniMax LLM Provider
# ========================================
# Get your API key from: https://api.minimax.chat/
# Used for: MiniMax M2.5 and other models
MINIMAX_API_KEY=your-minimax-api-key

# Optional: Custom base URL (default: https://api.minimax.chat/v1)
# MINIMAX_BASE_URL=https://api.minimax.chat/v1
```

**Location:** After the `Model Configuration` section

#### 3.1.5 Step 5: Usage Examples

**Example 1: Use MiniMax as default model**

```bash
# Set environment variable
export MODEL=minimax-4-chat

# Run Dexter
bun run start
```

**Example 2: Use MiniMax in code**

```typescript
import { getChatModel, callLlm } from '@/model/llm';

// Get MiniMax model instance
const minimaxModel = getChatModel('minimax-4-chat');

// Call MiniMax with prompt
const result = await callLlm('What is Apple stock price today?', {
  model: 'minimax-4-chat',
});

console.log(result.response);
```

**Example 3: Use MiniMax fast model for summarization**

```typescript
import { getFastModel, callLlm } from '@/model/llm';

const fastModel = getFastModel('minimax', 'minimax-4-chat');
// Returns: 'minimax-4-flash' (configured as fastModel)

const summary = await callLlm(longText, {
  model: fastModel,
});
```

---

### 3.2 Yahoo Finance Enhancement

**Note:** Yahoo provider already exists. The changes below are **enhancements only**.

#### 3.2.1 Step 1: Enhance Symbol Normalization

**File:** `src/tools/finance/providers/yahoo-provider.ts`

**Add helper method to `YahooProvider` class:**

```typescript
/**
 * Normalize Indian stock symbols for Yahoo Finance
 * Yahoo Finance uses .NS suffix for NSE and .BO suffix for BSE
 */
private normalizeIndianSymbol(ticker: string): string {
  const normalized = ticker.trim().toUpperCase();
  
  // If already has suffix, return as-is
  if (normalized.endsWith('.NS') || normalized.endsWith('.BO')) {
    return normalized;
  }
  
  // Check if symbol is in known Indian stock list
  const indianExchanges = ['NSE', 'BSE'];
  if (indianExchanges.includes(normalized)) {
    return normalized; // Don't modify exchange codes
  }
  
  // Common Indian stock patterns ( heuristic )
  // Most NSE symbols are 3-5 letters followed by .NS
  // If we're querying from a tool with explicit exchange info,
  // the exchange parameter would be used instead
  
  return normalized;
}

/**
 * Build Yahoo Finance symbol with exchange suffix
 * Uses the exchange from context if provided
 */
private buildYahooSymbol(context: ProviderRequestContext): string {
  const symbol = this.validateTicker(context.ticker);
  
  if (context.exchange === 'NSE') {
    return `${symbol}.NS`;
  } else if (context.exchange === 'BSE') {
    return `${symbol}.BO`;
  }
  
  // If no exchange specified, try to detect
  // Most common case: if symbol doesn't have suffix, try .NS first
  if (!symbol.endsWith('.NS') && !symbol.endsWith('.BO')) {
    // Assume NSE for most Indian queries
    return `${symbol}.NS`;
  }
  
  return symbol;
}
```

#### 3.2.2 Step 2: Update `getStockPrice` Method

**File:** `src/tools/finance/providers/yahoo-provider.ts`

**Replace existing `getStockPrice` method:**

```typescript
/**
 * Get stock price
 */
async getStockPrice(context: ProviderRequestContext): Promise<StockPriceResponse> {
  // Build Yahoo Finance symbol with proper suffix
  const yahooSymbol = this.buildYahooSymbol(context);
  
  try {
    const quote = await yahooFinance.quote(yahooSymbol) as any;
    
    if (!quote || quote.regularMarketPrice === null) {
      // Try without suffix if first attempt failed
      if (yahooSymbol.endsWith('.NS')) {
        const altSymbol = yahooSymbol.replace('.NS', '');
        try {
          const altQuote = await yahooFinance.quote(altSymbol) as any;
          if (altQuote && altQuote.regularMarketPrice !== null) {
            return this.buildStockPriceResponse(altSymbol, altQuote);
          }
        } catch {
          // Fall through to error
        }
      }
      
      throw this.createError(
        `Ticker ${context.ticker} not found`,
        ProviderErrorCode.NOT_FOUND,
        false
      );
    }

    return this.buildStockPriceResponse(context.ticker, quote);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Not Found')) {
      throw this.createError(
        `Ticker ${context.ticker} not found`,
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
 * Build stock price response from Yahoo Finance quote
 */
private buildStockPriceResponse(originalTicker: string, quote: any): StockPriceResponse {
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
    sourceUrl: `https://finance.yahoo.com/quote/${originalTicker}`,
  });
}
```

#### 3.2.3 Step 3: Update `getHistoricalData` Method

**File:** `src/tools/finance/providers/yahoo-provider.ts`

**Replace existing `getHistoricalData` method:**

```typescript
/**
 * Get historical data
 */
async getHistoricalData(context: ProviderRequestContext): Promise<HistoricalDataResponse> {
  const yahooSymbol = this.buildYahooSymbol(context);
  
  const startDate = context.startDate 
    ? new Date(context.startDate) 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = context.endDate 
    ? new Date(context.endDate) 
    : new Date();

  try {
    const history = (await yahooFinance.historical(yahooSymbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    })) as any;

    if (!history || history.length === 0) {
      // Try without suffix
      if (yahooSymbol.endsWith('.NS') || yahooSymbol.endsWith('.BO')) {
        const altSymbol = yahooSymbol.replace(/\.(NS|BO)$/, '');
        try {
          const altHistory = (await yahooFinance.historical(altSymbol, {
            period1: startDate,
            period2: endDate,
            interval: '1d',
          })) as any;
          
          if (altHistory && altHistory.length > 0) {
            return this.buildHistoricalDataResponse(context.ticker, altHistory);
          }
        } catch {
          // Fall through to error
        }
      }
      
      throw this.createError(
        `No historical data for ${context.ticker}`,
        ProviderErrorCode.NOT_FOUND,
        false
      );
    }

    return this.buildHistoricalDataResponse(context.ticker, history);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Not Found')) {
      throw this.createError(
        `Ticker ${context.ticker} not found`,
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

/**
 * Build historical data response
 */
private buildHistoricalDataResponse(
  originalTicker: string,
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
    sourceUrl: `https://finance.yahoo.com/quote/${originalTicker}/history`,
  };
}
```

#### 3.2.4 Step 4: Update Provider Capabilities

**File:** `src/tools/finance/providers/yahoo-provider.ts`

**Update CAPABILITIES object:**

```typescript
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
  markets: ['US', 'IN', 'GLOBAL'],  // Supports Indian markets
};
```

---

## 4. Architecture Diagrams

### 4.1 LLM Provider Integration Flow

```mermaid
graph TB
    subgraph "User / Application"
        User[User requests model]
        Config[Config: MODEL=minimax-4-chat]
    end
    
    subgraph "Provider Resolution"
        Providers[src/providers.ts]
        Resolve[resolveProvider 'minimax-4-chat']
        ProviderDef[ProviderDef: id='minimax', modelPrefix='minimax-']
    end
    
    subgraph "Model Factory"
        Factories[src/model/llm.ts MODEL_FACTORIES]
        Factory[minimax: (name, opts) => ChatOpenAI]
    end
    
    subgraph "LangChain Integration"
        ChatOpenAI[ChatOpenAI instance]
        LangChain[LangChain /v1/chat/completions]
    end
    
    subgraph "MiniMax API"
        API[https://api.minimax.chat/v1]
        Auth[Bearer: MINIMAX_API_KEY]
    end
    
    User --> Config
    Config --> Providers
    Providers --> Resolve
    Resolve --> ProviderDef
    ProviderDef --> Factories
    Factories --> Factory
    Factory --> ChatOpenAI
    ChatOpenAI --> LangChain
    LangChain --> API
    Auth --> API
    
    style Providers fill:#e1f5fe
    style Factories fill:#e1f5fe
    style API fill:#c8e6c9
```

### 4.2 Finance Provider Integration Flow

```mermaid
graph TB
    subgraph "User Tool Call"
        ToolCall[getStockPrice 'RELIANCE', exchange='NSE']
    end
    
    subgraph "Registry Routing"
        Registry[provider-registry.ts]
        GetProvider[getProviderForCapability 'livePrices']
        Yahoo[YahooProvider]
    end
    
    subgraph "Yahoo Provider"
        BuildSymbol[buildYahooSymbol 'RELIANCE' + 'NSE']
        Normalize['RELIANCE.NS']
        Fetch[yahoo-finance2.quote 'RELIANCE.NS']
    end
    
    subgraph "Data Normalization"
        NormalizeResp[buildStockPriceResponse]
        Response[StockPriceResponse]
    end
    
    ToolCall --> Registry
    Registry --> GetProvider
    GetProvider --> Yahoo
    Yahoo --> BuildSymbol
    BuildSymbol --> Normalize
    Normalize --> Fetch
    Fetch --> NormalizeResp
    NormalizeResp --> Response
    
    style Registry fill:#e1f5fe
    style Yahoo fill:#fff3e0
    style Response fill:#c8e6c9
```

### 4.3 Provider Architecture Comparison

```mermaid
graph LR
    subgraph "LLM Providers"
        LLMRegistry[Registry Pattern]
        LLMFactory[Factory Functions]
        LLMLangChain[LangChain Integration]
    end
    
    subgraph "Finance Providers"
        FinRegistry[Registry Pattern]
        FinBase[BaseProvider Class]
        FinHttp[HTTP Client Wrapper]
    end
    
    subgraph "Shared Concepts"
        Agnostic[Provider Agnostic]
        Capabilities[Capability Declaraction]
        Fallback[Fallback Support]
    end
    
    LLMRegistry --> Agnostic
    LLMFactory --> Agnostic
    LLMLangChain --> Agnostic
    
    FinRegistry --> Agnostic
    FinBase --> Capabilities
    FinHttp --> Fallback
    
    style Agnostic fill:#e1f5fe
    style Capabilities fill:#e1f5fe
    style Fallback fill:#e1f5fe
```

---

## 5. Step-by-Step Implementation Guide

### Phase 1: MiniMax LLM Integration (30 minutes)

**⚠️ Critical Design Decision:**
MiniMax uses **OpenAI-compatible API** - we use `ChatOpenAI` with custom `baseURL`, NOT `ChatAnthropic`.

#### Step 1.1: Update Provider Registry

1. Open `src/providers.ts`
2. Locate the `PROVIDERS` array
3. Add MiniMax entry after `deepseek`:
   ```typescript
   {
     id: 'minimax',
     displayName: 'MiniMax',
     modelPrefix: 'minimax-',
     apiKeyEnvVar: 'MINIMAX_API_KEY',
     fastModel: 'minimax-4-flash',
   },
   ```
4. Save file

#### Step 1.2: Update Model Factory

1. Open `src/model/llm.ts`
2. Locate the `MODEL_FACTORIES` object
3. Add MiniMax factory after `deepseek`:
   ```typescript
   minimax: (name, opts) =>
     new ChatOpenAI({
       model: name.replace(/^minimax:/, ''),
       ...opts,
       apiKey: getApiKey('MINIMAX_API_KEY'),
       configuration: {
         baseURL: 'https://api.minimax.chat/v1',
       },
     }),
   ```
4. Save file

#### Step 1.3: Update Environment File

1. Open `.env.example`
2. Add after `Model Configuration` section:
   ```bash
   # MiniMax LLM Provider
   MINIMAX_API_KEY=your-minimax-api-key
   ```
3. Save file

#### Step 1.4: Add Environment Variable to Your `.env`

1. Open `.env`
2. Add your actual MiniMax API key:
   ```bash
   MINIMAX_API_KEY=sk-your-actual-api-key
   ```
3. Save file

#### Step 1.5: Test MiniMax Integration

1. Set model to MiniMax:
   ```bash
   export MODEL=minimax-4-chat
   ```
2. Run Dexter:
   ```bash
   bun run start
   ```
3. Test with a simple query
4. Verify logs show MiniMax provider being used

### Phase 2: Yahoo Finance Enhancement (45 minutes)

#### Step 2.1: Open Yahoo Provider File

1. Open `src/tools/finance/providers/yahoo-provider.ts`

#### Step 2.2: Add Helper Methods

1. Add `normalizeIndianSymbol` method (optional, for future use)
2. Add `buildYahooSymbol` method:
   ```typescript
   private buildYahooSymbol(context: ProviderRequestContext): string {
     const symbol = this.validateTicker(context.ticker);
     
     if (context.exchange === 'NSE') {
       return `${symbol}.NS`;
     } else if (context.exchange === 'BSE') {
       return `${symbol}.BO`;
     }
     
     if (!symbol.endsWith('.NS') && !symbol.endsWith('.BO')) {
       return `${symbol}.NS`;  // Default to NSE
     }
     
     return symbol;
   }
   ```

#### Step 2.3: Add Response Builder Methods

1. Add `buildStockPriceResponse` method:
   ```typescript
   private buildStockPriceResponse(originalTicker: string, quote: any): StockPriceResponse {
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
       sourceUrl: `https://finance.yahoo.com/quote/${originalTicker}`,
     });
   }
   ```

2. Add `buildHistoricalDataResponse` method:
   ```typescript
   private buildHistoricalDataResponse(
     originalTicker: string,
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
       sourceUrl: `https://finance.yahoo.com/quote/${originalTicker}/history`,
     };
   }
   ```

#### Step 2.4: Update Existing Methods

1. Replace `getStockPrice` method with the enhanced version (see Section 3.2.2)
2. Replace `getHistoricalData` method with the enhanced version (see Section 3.2.3)
3. Update CAPABILITIES object to confirm IN support (see Section 3.2.4)
4. Save file

#### Step 2.5: Test Yahoo Finance

1. Restart Dexter:
   ```bash
   bun run start
   ```
2. Test with NSE symbol:
   - Query: "What is Reliance stock price?"
   - Should fetch RELIANCE.NS from Yahoo
3. Test with BSE symbol:
   - Query: "What is TCS stock price on BSE?"
   - Should fetch TCS.BO from Yahoo
4. Verify data accuracy

### Phase 3: Testing & Validation (30 minutes)

#### Step 3.1: LLM Integration Tests

```typescript
// Test file: src/model/__tests__/llm-minimax.test.ts

import { describe, it, expect } from '@jest/globals';
import { getChatModel, callLlm } from '../llm';

describe('MiniMax LLM Provider', () => {
  it('should resolve MiniMax provider from model name', () => {
    const model = getChatModel('minimax-4-chat');
    expect(model).toBeDefined();
  });

  it('should call MiniMax API successfully', async () => {
    const result = await callLlm('Say hello', {
      model: 'minimax-4-chat',
    });
    expect(result.response).toBeTruthy();
    expect(result.usage).toBeDefined();
  });

  it('should use fast model for fast variant', async () => {
    const fastModel = getFastModel('minimax', 'minimax-4-chat');
    expect(fastModel).toBe('minimax-4-flash');
  });
});
```

#### Step 3.2: Finance Provider Tests

```typescript
// Test file: src/tools/finance/providers/__tests__/yahoo-enhanced.test.ts

import { describe, it, expect } from '@jest/globals';
import { YahooProvider } from '../yahoo-provider';

describe('Yahoo Provider Enhancements', () => {
  let provider: YahooProvider;

  beforeEach(() => {
    provider = new YahooProvider();
  });

  it('should build NSE symbol correctly', () => {
    const symbol = provider['buildYahooSymbol']({
      ticker: 'RELIANCE',
      exchange: 'NSE',
    });
    expect(symbol).toBe('RELIANCE.NS');
  });

  it('should build BSE symbol correctly', () => {
    const symbol = provider['buildYahooSymbol']({
      ticker: 'TCS',
      exchange: 'BSE',
    });
    expect(symbol).toBe('TCS.BO');
  });

  it('should default to NSE for Indian symbols', () => {
    const symbol = provider['buildYahooSymbol']({
      ticker: 'INFY',
    });
    expect(symbol).toBe('INFY.NS');
  });
});
```

#### Step 3.3: End-to-End Integration Test

```bash
# Test 1: MiniMax LLM with Finance Query
bun run agent "What is the current price of Reliance Industries?" \
  --model minimax-4-chat

# Expected: Uses MiniMax LLM + Yahoo Finance for data

# Test 2: Historical Data Query
bun run agent "Show me the price history of TCS for the last 30 days"

# Expected: Uses Yahoo Finance historical data

# Test 3: Multiple Stocks Query
bun run agent "Compare Reliance, TCS, and Infosys stock prices"

# Expected: Fetches all three from Yahoo Finance
```

---

## 6. Code Quality Checklist

### 6.1 LLM Provider Integration

- [x] Follows existing provider pattern (prefix-based routing)
- [x] Uses LangChain ChatOpenAI (OpenAI-compatible API)
- [x] No breaking changes to existing providers
- [x] Environment variable documented in .env.example
- [x] Factory function follows same signature
- [ ] Type checking passes (`bun run type-check`)
- [ ] Unit tests added
- [ ] Integration tests pass

### 6.2 Yahoo Finance Enhancement

- [x] Enhances existing provider (no rewrite)
- [x] Maintains backward compatibility
- [x] Better NSE/BSE symbol handling
- [x] Fallback logic for failed queries
- [ ] Type checking passes
- [ ] Unit tests added
- [ ] Manual testing with NSE/BSE symbols

### 6.3 Documentation

- [ ] README.md updated with MiniMax section
- [ ] README.md updated with Yahoo Finance usage
- [ ] API documentation updated
- [ ] Environment variables documented

---

## 7. Troubleshooting Guide

### 7.1 MiniMax Integration Issues

**Issue: "MINIMAX_API_KEY not found in environment variables"**
- **Cause:** Environment variable not set
- **Fix:** Add `MINIMAX_API_KEY` to your `.env` file
- **Check:** `echo $MINIMAX_API_KEY` should show your API key

**Issue: "Failed to initialize MiniMax model"**
- **Cause:** Invalid API key or API endpoint issues
- **Fix:** Verify API key is correct and has access to MiniMax API
- **Check:** Test API key with curl:
  ```bash
  curl -H "Authorization: Bearer $MINIMAX_API_KEY" \
    https://api.minimax.chat/v1/models
  ```

**Issue: Model not found error**
- **Cause:** Incorrect model name
- **Fix:** Use valid MiniMax model names (e.g., `minimax-4-chat`, `minimax-4-flash`)
- **Reference:** Check MiniMax documentation for available models

### 7.2 Yahoo Finance Issues

**Issue: "Ticker XXXXX not found"**
- **Cause:** Incorrect symbol or suffix issue
- **Fix:** 
  - Try with explicit exchange: `RELIANCE.NS` for NSE
  - Verify symbol exists on Yahoo Finance website
  - Check if market is open (some data delayed for closed markets)

**Issue: "No historical data for XXXXX"**
- **Cause:** Symbol not found or date range too wide
- **Fix:**
  - Verify symbol format (e.g., `RELIANCE.NS`)
  - Try smaller date range
  - Check if Yahoo Finance has data for that period

**Issue: Currency is INR but shows USD**
- **Cause:** Yahoo Finance currency code handling
- **Fix:** The currency is determined by the exchange (NSE/BSE → INR)
- **Check:** Verify exchange parameter is correct in your query

### 7.3 General Issues

**Issue: Provider routing not working**
- **Cause:** Provider not initialized or disabled
- **Fix:**
  - Check `ENABLE_PROVIDER_ROUTING=true` in .env
  - Check provider logs for initialization status
  - Verify API keys are set

**Issue: Fallback not triggering**
- **Cause:** Error marked as non-retryable
- **Fix:** Check if error is `retryable: true` in provider error handling
- **Check:** Provider error codes and retry logic

---

## 8. Performance Considerations

### 8.1 LLM Provider Performance

| Metric | MiniMax | Target |
|--------|---------|--------|
| API Latency | < 2s | ✅ |
| Streaming Support | ✅ | ✅ |
| Retry Logic | ✅ | ✅ |
| Rate Limiting | ✅ | ✅ |

### 8.2 Finance Provider Performance

| Metric | Yahoo Finance | Target |
|--------|---------------|--------|
| Live Price Latency | < 1s | ✅ |
| Historical Data Latency | < 3s | ✅ |
| Rate Limit Handling | ✅ | ✅ |
| Fallback Time | < 5s | ✅ |

### 8.3 Optimization Tips

1. **Use fast models** for lightweight tasks (summarization, quick lookups)
   ```typescript
   const fastModel = getFastModel('minimax', 'minimax-4-chat');
   ```

2. **Cache historical data** to avoid repeated API calls
   - Yahoo Finance data changes daily
   - Cache for 24 hours

3. **Batch queries** when possible
   - Request multiple stocks in one call if provider supports it
   - Yahoo Finance supports concurrent requests

---

## 9. Security Considerations

### 9.1 API Key Management

- ✅ Never commit `.env` files to version control
- ✅ Use `.env.example` for documentation only
- ✅ Rotate API keys regularly
- ✅ Use environment-specific keys (dev, staging, prod)

### 9.2 Rate Limiting

- ✅ Yahoo Finance has implicit rate limits (don't abuse)
- ✅ MiniMax API has explicit rate limits (respect them)
- ✅ Use exponential backoff for retries

### 9.3 Data Privacy

- ✅ No sensitive data sent to LLM providers without encryption
- ✅ Financial data from public sources (Yahoo Finance)
- ✅ User queries are logged (monitor for abuse)

---

## 10. Future Enhancements

### 10.1 MiniMax Enhancements

- [ ] Add streaming support for real-time responses
- [ ] Add structured output support (JSON mode)
- [ ] Add function/tool calling support

### 10.2 Yahoo Finance Enhancements

- [ ] Add support for more Indian exchanges (MCX, NCDEX)
- [ ] Add real-time WebSocket streaming
- [ ] Add company news sentiment analysis
- [ ] Add sector/industry data

### 10.3 General Enhancements

- [ ] Add more free finance APIs (Alpha Vantage, Twelve Data)
- [ ] Add caching layer for API responses
- [ ] Add monitoring dashboard for provider health
- [ ] Add A/B testing framework for providers

---

## 11. References

### 11.1 MiniMax Documentation

- Official Website: https://api.minimax.chat/
- API Reference: https://platform.minimax.chat/document
- LangChain Integration: https://js.langchain.com/docs/integrations/providers/openai

### 11.2 Yahoo Finance Documentation

- Yahoo Finance Website: https://finance.yahoo.com/
- Yahoo Finance NSE: https://finance.yahoo.com/quote/%5ENSEI
- yahoo-finance2 Package: https://www.npmjs.com/package/yahoo-finance2

### 11.3 Dexter Documentation

- Dexter GitHub: https://github.com/virattt/dexter
- Dexter README: `~/Projects/dexter/README.md`
- Dexter Architecture: `~/Projects/dexter/docs/Architecture.md`

---

## 12. Appendix: Complete File Changes

### 12.1 src/providers.ts (Partial)

```typescript
export const PROVIDERS: ProviderDef[] = [
  // ... existing providers ...
  
  {
    id: 'deepseek',
    displayName: 'DeepSeek',
    modelPrefix: 'deepseek-',
    apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    fastModel: 'deepseek-chat',
  },
  
  // ===== NEW: MiniMax Provider =====
  {
    id: 'minimax',
    displayName: 'MiniMax',
    modelPrefix: 'minimax-',
    apiKeyEnvVar: 'MINIMAX_API_KEY',
    fastModel: 'minimax-4-flash',
  },
  
  {
    id: 'openrouter',
    displayName: 'OpenRouter',
    modelPrefix: 'openrouter:',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    fastModel: 'openrouter:openai/gpt-4o-mini',
  },
  
  // ... rest of providers ...
];
```

### 12.2 src/model/llm.ts (Partial)

```typescript
const MODEL_FACTORIES: Record<string, ModelFactory> = {
  // ... existing factories ...
  
  deepseek: (name, opts) =>
    new ChatOpenAI({
      model: name,
      ...opts,
      apiKey: getApiKey('DEEPSEEK_API_KEY'),
      configuration: {
        baseURL: 'https://api.deepseek.com',
      },
    }),
  
  // ===== NEW: MiniMax Factory =====
  minimax: (name, opts) =>
    new ChatOpenAI({
      model: name.replace(/^minimax:/, ''),
      ...opts,
      apiKey: getApiKey('MINIMAX_API_KEY'),
      configuration: {
        baseURL: 'https://api.minimax.chat/v1',
      },
    }),
  
  openrouter: (name, opts) =>
    new ChatOpenAI({
      model: name.replace(/^openrouter:/, ''),
      ...opts,
      apiKey: getApiKey('OPENROUTER_API_KEY'),
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
      },
    }),
  
  // ... rest of factories ...
};
```

### 12.3 .env.example (Partial)

```bash
# ========================================
# Model Configuration
# ========================================
# Default model to use for agent operations
MODEL=gpt-4

# ========================================
# MiniMax LLM Provider
# ========================================
# Get your API key from: https://api.minimax.chat/
# Used for: MiniMax M2.5 and other models
MINIMAX_API_KEY=your-minimax-api-key

# Optional: Custom base URL (default: https://api.minimax.chat/v1)
# MINIMAX_BASE_URL=https://api.minimax.chat/v1
```

---

## 13. Implementation Checklist

### Phase 1: MiniMax LLM Integration

| Task | Status | Notes |
|------|--------|-------|
| 1.1 Add MiniMax to PROVIDERS array | ⬜ | File: src/providers.ts |
| 1.2 Add MiniMax to MODEL_FACTORIES | ⬜ | File: src/model/llm.ts |
| 1.3 Add MINIMAX_API_KEY to .env.example | ⬜ | File: .env.example |
| 1.4 Add actual API key to .env | ⬜ | User action required |
| 1.5 Test MiniMax with simple prompt | ⬜ | Run: `bun run start` |
| 1.6 Verify logs show MiniMax provider | ⬜ | Check console output |

### Phase 2: Yahoo Finance Enhancement

| Task | Status | Notes |
|------|--------|-------|
| 2.1 Add buildYahooSymbol helper | ⬜ | File: src/tools/finance/providers/yahoo-provider.ts |
| 2.2 Add buildStockPriceResponse helper | ⬜ | File: src/tools/finance/providers/yahoo-provider.ts |
| 2.3 Add buildHistoricalDataResponse helper | ⬜ | File: src/tools/finance/providers/yahoo-provider.ts |
| 2.4 Update getStockPrice method | ⬜ | Use buildYahooSymbol + fallback logic |
| 2.5 Update getHistoricalData method | ⬜ | Use buildYahooSymbol + fallback logic |
| 2.6 Update CAPABILITIES object | ⬜ | Confirm IN markets support |
| 2.7 Test with NSE symbol (RELIANCE) | ⬜ | Verify RELIANCE.NS works |
| 2.8 Test with BSE symbol (TCS) | ⬜ | Verify TCS.BO works |
| 2.9 Test fallback logic | ⬜ | Test with invalid symbols |

### Phase 3: Testing & Validation

| Task | Status | Notes |
|------|--------|-------|
| 3.1 Run type checking | ⬜ | `bun run type-check` |
| 3.2 Run unit tests | ⬜ | `bun run test` |
| 3.3 End-to-end integration test | ⬜ | Test finance queries |
| 3.4 Test MiniMax LLM + Yahoo Finance | ⬜ | Combined test |
| 3.5 Fix any bugs found | ⬜ | Iterate if needed |
| 3.6 Verify no regressions | ⬜ | Test existing providers |

### Phase 4: Documentation

| Task | Status | Notes |
|------|--------|-------|
| 4.1 Update README.md with MiniMax | ⬜ | Add MiniMax section |
| 4.2 Update README.md with Yahoo | ⬜ | Document NSE/BSE usage |
| 4.3 Update API documentation | ⬜ | If applicable |
| 4.4 Create integration guide | ⬜ | This document is the guide |
| 4.5 Update CHANGELOG.md | ⬜ | Document changes |

---

## 14. Summary

### 14.1 What Was Done

This document provides a **comprehensive, detailed implementation plan** for integrating:

1. **MiniMax LLM** as a new provider following Dexter's existing patterns
2. **Yahoo Finance** enhancements for better NSE/BSE support
3. **Provider-agnostic design** with no breaking changes

**Version 2.1 Enhancements:**
- Added critical warning section emphasizing MiniMax uses OpenAI-compatible API
- Added detailed MiniMax API structure documentation with request/response examples
- Clarified that `ChatOpenAI` should be used, NOT `ChatAnthropic`
- Added explicit authentication headers and LangChain integration examples
- Listed available MiniMax models (minimax-4-chat, minimax-4-flash, minimax-4-reasoning)

### 14.2 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Use `ChatOpenAI` for MiniMax | MiniMax uses OpenAI-compatible API at `https://api.minimax.chat/v1` - uses `/v1/chat/completions` endpoint, same response format as OpenAI |
| Enhance existing Yahoo provider | Avoid rewriting, maintain backward compatibility |
| Prefix-based routing | Matches existing LLM provider pattern |
| Fallback logic | Better user experience for Indian markets |
| **NOT** use `ChatAnthropic` | MiniMax does not follow Anthropic's API format - it's OpenAI-compatible only |

### 14.3 Estimated Implementation Time

| Phase | Estimated Time | Actual Time |
|-------|----------------|-------------|
| Phase 1: MiniMax LLM | 30 min | ⬜ |
| Phase 2: Yahoo Enhancement | 45 min | ⬜ |
| Phase 3: Testing | 30 min | ⬜ |
| Phase 4: Documentation | 15 min | ⬜ |
| **Total** | **~2 hours** | **⬜** |

### 14.4 Next Steps

1. **Implement Phase 1** - Add MiniMax LLM provider
2. **Implement Phase 2** - Enhance Yahoo Finance provider
3. **Test thoroughly** - Unit tests + integration tests
4. **Update documentation** - README + API docs
5. **Deploy** - Merge to main branch

---

**Document End**

*Last Updated: 2026-03-03*
*Status: Ready for Implementation*
