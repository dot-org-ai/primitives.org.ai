/**
 * Tests for ai-primitives package exports
 *
 * Verifies that all expected exports are present and correctly typed.
 * These are unit tests that don't require AI gateway access.
 */

import { describe, it, expect } from 'vitest'
import * as AIPrimitives from '../src/index.js'

// ============================================================================
// 1. Core AI Functions (from ai-functions)
// ============================================================================

describe('Core AI Functions exports', () => {
  describe('Schema exports', () => {
    it('exports schema function', () => {
      expect(AIPrimitives.schema).toBeDefined()
      expect(typeof AIPrimitives.schema).toBe('function')
    })
  })

  describe('Template exports', () => {
    it('exports parseTemplate function', () => {
      expect(AIPrimitives.parseTemplate).toBeDefined()
      expect(typeof AIPrimitives.parseTemplate).toBe('function')
    })

    it('exports createTemplateFunction', () => {
      expect(AIPrimitives.createTemplateFunction).toBeDefined()
      expect(typeof AIPrimitives.createTemplateFunction).toBe('function')
    })

    it('exports createChainablePromise', () => {
      expect(AIPrimitives.createChainablePromise).toBeDefined()
      expect(typeof AIPrimitives.createChainablePromise).toBe('function')
    })

    it('exports createStreamableList', () => {
      expect(AIPrimitives.createStreamableList).toBeDefined()
      expect(typeof AIPrimitives.createStreamableList).toBe('function')
    })

    it('exports withBatch', () => {
      expect(AIPrimitives.withBatch).toBeDefined()
      expect(typeof AIPrimitives.withBatch).toBe('function')
    })
  })

  describe('AIPromise exports', () => {
    it('exports AIPromise class', () => {
      expect(AIPrimitives.AIPromise).toBeDefined()
    })

    it('exports isAIPromise function', () => {
      expect(AIPrimitives.isAIPromise).toBeDefined()
      expect(typeof AIPrimitives.isAIPromise).toBe('function')
    })

    it('exports getRawPromise function', () => {
      expect(AIPrimitives.getRawPromise).toBeDefined()
      expect(typeof AIPrimitives.getRawPromise).toBe('function')
    })

    it('exports createTextPromise', () => {
      expect(AIPrimitives.createTextPromise).toBeDefined()
      expect(typeof AIPrimitives.createTextPromise).toBe('function')
    })

    it('exports createObjectPromise', () => {
      expect(AIPrimitives.createObjectPromise).toBeDefined()
      expect(typeof AIPrimitives.createObjectPromise).toBe('function')
    })

    it('exports createListPromise', () => {
      expect(AIPrimitives.createListPromise).toBeDefined()
      expect(typeof AIPrimitives.createListPromise).toBe('function')
    })

    it('exports createListsPromise', () => {
      expect(AIPrimitives.createListsPromise).toBeDefined()
      expect(typeof AIPrimitives.createListsPromise).toBe('function')
    })

    it('exports createBooleanPromise', () => {
      expect(AIPrimitives.createBooleanPromise).toBeDefined()
      expect(typeof AIPrimitives.createBooleanPromise).toBe('function')
    })

    it('exports createExtractPromise', () => {
      expect(AIPrimitives.createExtractPromise).toBeDefined()
      expect(typeof AIPrimitives.createExtractPromise).toBe('function')
    })

    it('exports createAITemplateFunction', () => {
      expect(AIPrimitives.createAITemplateFunction).toBeDefined()
      expect(typeof AIPrimitives.createAITemplateFunction).toBe('function')
    })

    it('exports parseTemplateWithDependencies', () => {
      expect(AIPrimitives.parseTemplateWithDependencies).toBeDefined()
      expect(typeof AIPrimitives.parseTemplateWithDependencies).toBe('function')
    })

    it('exports AI_PROMISE_SYMBOL', () => {
      expect(AIPrimitives.AI_PROMISE_SYMBOL).toBeDefined()
      expect(typeof AIPrimitives.AI_PROMISE_SYMBOL).toBe('symbol')
    })

    it('exports RAW_PROMISE_SYMBOL', () => {
      expect(AIPrimitives.RAW_PROMISE_SYMBOL).toBeDefined()
      expect(typeof AIPrimitives.RAW_PROMISE_SYMBOL).toBe('symbol')
    })
  })

  describe('Generation exports', () => {
    it('exports generateObject function', () => {
      expect(AIPrimitives.generateObject).toBeDefined()
      expect(typeof AIPrimitives.generateObject).toBe('function')
    })

    it('exports generateText function', () => {
      expect(AIPrimitives.generateText).toBeDefined()
      expect(typeof AIPrimitives.generateText).toBe('function')
    })

    it('exports streamObject function', () => {
      expect(AIPrimitives.streamObject).toBeDefined()
      expect(typeof AIPrimitives.streamObject).toBe('function')
    })

    it('exports streamText function', () => {
      expect(AIPrimitives.streamText).toBeDefined()
      expect(typeof AIPrimitives.streamText).toBe('function')
    })
  })

  describe('Primitives exports', () => {
    it('exports generate function', () => {
      expect(AIPrimitives.generate).toBeDefined()
      expect(typeof AIPrimitives.generate).toBe('function')
    })

    it('exports ai template function', () => {
      expect(AIPrimitives.ai).toBeDefined()
      expect(typeof AIPrimitives.ai).toBe('function')
    })

    it('exports write function', () => {
      expect(AIPrimitives.write).toBeDefined()
      expect(typeof AIPrimitives.write).toBe('function')
    })

    it('exports code function', () => {
      expect(AIPrimitives.code).toBeDefined()
      expect(typeof AIPrimitives.code).toBe('function')
    })

    it('exports list function', () => {
      expect(AIPrimitives.list).toBeDefined()
      expect(typeof AIPrimitives.list).toBe('function')
    })

    it('exports lists function', () => {
      expect(AIPrimitives.lists).toBeDefined()
      expect(typeof AIPrimitives.lists).toBe('function')
    })

    it('exports extract function', () => {
      expect(AIPrimitives.extract).toBeDefined()
      expect(typeof AIPrimitives.extract).toBe('function')
    })

    it('exports summarize function', () => {
      expect(AIPrimitives.summarize).toBeDefined()
      expect(typeof AIPrimitives.summarize).toBe('function')
    })

    it('exports is function', () => {
      expect(AIPrimitives.is).toBeDefined()
      expect(typeof AIPrimitives.is).toBe('function')
    })

    it('exports diagram function', () => {
      expect(AIPrimitives.diagram).toBeDefined()
      expect(typeof AIPrimitives.diagram).toBe('function')
    })

    it('exports slides function', () => {
      expect(AIPrimitives.slides).toBeDefined()
      expect(typeof AIPrimitives.slides).toBe('function')
    })

    it('exports image function', () => {
      expect(AIPrimitives.image).toBeDefined()
      expect(typeof AIPrimitives.image).toBe('function')
    })

    it('exports video function', () => {
      expect(AIPrimitives.video).toBeDefined()
      expect(typeof AIPrimitives.video).toBe('function')
    })

    it('exports research function', () => {
      expect(AIPrimitives.research).toBeDefined()
      expect(typeof AIPrimitives.research).toBe('function')
    })

    it('exports read function', () => {
      expect(AIPrimitives.read).toBeDefined()
      expect(typeof AIPrimitives.read).toBe('function')
    })

    it('exports browse function', () => {
      expect(AIPrimitives.browse).toBeDefined()
      expect(typeof AIPrimitives.browse).toBe('function')
    })

    it('exports decide function', () => {
      expect(AIPrimitives.decide).toBeDefined()
      expect(typeof AIPrimitives.decide).toBe('function')
    })

    it('exports ask function', () => {
      expect(AIPrimitives.ask).toBeDefined()
      expect(typeof AIPrimitives.ask).toBe('function')
    })

    it('exports approve function', () => {
      expect(AIPrimitives.approve).toBeDefined()
      expect(typeof AIPrimitives.approve).toBe('function')
    })

    it('exports review function', () => {
      expect(AIPrimitives.review).toBeDefined()
      expect(typeof AIPrimitives.review).toBe('function')
    })

    it('exports aiDo (renamed from do)', () => {
      expect(AIPrimitives.aiDo).toBeDefined()
      expect(typeof AIPrimitives.aiDo).toBe('function')
    })
  })

  describe('Context exports', () => {
    it('exports configure function', () => {
      expect(AIPrimitives.configure).toBeDefined()
      expect(typeof AIPrimitives.configure).toBe('function')
    })

    it('exports getContext function', () => {
      expect(AIPrimitives.getContext).toBeDefined()
      expect(typeof AIPrimitives.getContext).toBe('function')
    })

    it('exports withContext function', () => {
      expect(AIPrimitives.withContext).toBeDefined()
      expect(typeof AIPrimitives.withContext).toBe('function')
    })

    it('exports getGlobalContext function', () => {
      expect(AIPrimitives.getGlobalContext).toBeDefined()
      expect(typeof AIPrimitives.getGlobalContext).toBe('function')
    })

    it('exports resetContext function', () => {
      expect(AIPrimitives.resetContext).toBeDefined()
      expect(typeof AIPrimitives.resetContext).toBe('function')
    })

    it('exports getModel function', () => {
      expect(AIPrimitives.getModel).toBeDefined()
      expect(typeof AIPrimitives.getModel).toBe('function')
    })

    it('exports getProvider function', () => {
      expect(AIPrimitives.getProvider).toBeDefined()
      expect(typeof AIPrimitives.getProvider).toBe('function')
    })

    it('exports getBatchMode function', () => {
      expect(AIPrimitives.getBatchMode).toBeDefined()
      expect(typeof AIPrimitives.getBatchMode).toBe('function')
    })

    it('exports getBatchThreshold function', () => {
      expect(AIPrimitives.getBatchThreshold).toBeDefined()
      expect(typeof AIPrimitives.getBatchThreshold).toBe('function')
    })

    it('exports shouldUseBatchAPI function', () => {
      expect(AIPrimitives.shouldUseBatchAPI).toBeDefined()
      expect(typeof AIPrimitives.shouldUseBatchAPI).toBe('function')
    })

    it('exports getFlexThreshold function', () => {
      expect(AIPrimitives.getFlexThreshold).toBeDefined()
      expect(typeof AIPrimitives.getFlexThreshold).toBe('function')
    })

    it('exports getExecutionTier function', () => {
      expect(AIPrimitives.getExecutionTier).toBeDefined()
      expect(typeof AIPrimitives.getExecutionTier).toBe('function')
    })

    it('exports isFlexAvailable function', () => {
      expect(AIPrimitives.isFlexAvailable).toBeDefined()
      expect(typeof AIPrimitives.isFlexAvailable).toBe('function')
    })
  })

  describe('Type guards exports', () => {
    it('exports isZodSchema function', () => {
      expect(AIPrimitives.isZodSchema).toBeDefined()
      expect(typeof AIPrimitives.isZodSchema).toBe('function')
    })
  })

  describe('AI Proxy exports', () => {
    it('exports AI class', () => {
      expect(AIPrimitives.AI).toBeDefined()
    })

    it('exports aiProxy (AI proxy object)', () => {
      expect(AIPrimitives.aiProxy).toBeDefined()
      // aiProxy is the AI proxy object, not a function
      expect(typeof AIPrimitives.aiProxy).toBe('object')
    })

    it('exports define function', () => {
      expect(AIPrimitives.define).toBeDefined()
      expect(typeof AIPrimitives.define).toBe('function')
    })

    it('exports defineFunction function', () => {
      expect(AIPrimitives.defineFunction).toBeDefined()
      expect(typeof AIPrimitives.defineFunction).toBe('function')
    })

    it('exports functions object', () => {
      expect(AIPrimitives.functions).toBeDefined()
    })

    it('exports createFunctionRegistry function', () => {
      expect(AIPrimitives.createFunctionRegistry).toBeDefined()
      expect(typeof AIPrimitives.createFunctionRegistry).toBe('function')
    })

    it('exports resetGlobalRegistry function', () => {
      expect(AIPrimitives.resetGlobalRegistry).toBeDefined()
      expect(typeof AIPrimitives.resetGlobalRegistry).toBe('function')
    })

    it('exports withTemplate function', () => {
      expect(AIPrimitives.withTemplate).toBeDefined()
      expect(typeof AIPrimitives.withTemplate).toBe('function')
    })

    it('exports aiPrompt function', () => {
      expect(AIPrimitives.aiPrompt).toBeDefined()
      expect(typeof AIPrimitives.aiPrompt).toBe('function')
    })
  })

  describe('Embeddings exports', () => {
    it('exports embed function', () => {
      expect(AIPrimitives.embed).toBeDefined()
      expect(typeof AIPrimitives.embed).toBe('function')
    })

    it('exports embedMany function', () => {
      expect(AIPrimitives.embedMany).toBeDefined()
      expect(typeof AIPrimitives.embedMany).toBe('function')
    })

    it('exports cosineSimilarity function', () => {
      expect(AIPrimitives.cosineSimilarity).toBeDefined()
      expect(typeof AIPrimitives.cosineSimilarity).toBe('function')
    })

    it('exports cloudflare (provider object)', () => {
      expect(AIPrimitives.cloudflare).toBeDefined()
      // cloudflare is a provider object, not a function
      expect(typeof AIPrimitives.cloudflare).toBe('object')
    })

    it('exports cloudflareEmbedding function', () => {
      expect(AIPrimitives.cloudflareEmbedding).toBeDefined()
      expect(typeof AIPrimitives.cloudflareEmbedding).toBe('function')
    })

    it('exports DEFAULT_CF_EMBEDDING_MODEL constant', () => {
      expect(AIPrimitives.DEFAULT_CF_EMBEDDING_MODEL).toBeDefined()
      expect(typeof AIPrimitives.DEFAULT_CF_EMBEDDING_MODEL).toBe('string')
    })

    it('exports getDefaultEmbeddingModel function', () => {
      expect(AIPrimitives.getDefaultEmbeddingModel).toBeDefined()
      expect(typeof AIPrimitives.getDefaultEmbeddingModel).toBe('function')
    })

    it('exports embedText function', () => {
      expect(AIPrimitives.embedText).toBeDefined()
      expect(typeof AIPrimitives.embedText).toBe('function')
    })

    it('exports embedTexts function', () => {
      expect(AIPrimitives.embedTexts).toBeDefined()
      expect(typeof AIPrimitives.embedTexts).toBe('function')
    })

    it('exports findSimilar function', () => {
      expect(AIPrimitives.findSimilar).toBeDefined()
      expect(typeof AIPrimitives.findSimilar).toBe('function')
    })

    it('exports pairwiseSimilarity function', () => {
      expect(AIPrimitives.pairwiseSimilarity).toBeDefined()
      expect(typeof AIPrimitives.pairwiseSimilarity).toBe('function')
    })

    it('exports clusterBySimilarity function', () => {
      expect(AIPrimitives.clusterBySimilarity).toBeDefined()
      expect(typeof AIPrimitives.clusterBySimilarity).toBe('function')
    })

    it('exports averageEmbeddings function', () => {
      expect(AIPrimitives.averageEmbeddings).toBeDefined()
      expect(typeof AIPrimitives.averageEmbeddings).toBe('function')
    })

    it('exports normalizeEmbedding function', () => {
      expect(AIPrimitives.normalizeEmbedding).toBeDefined()
      expect(typeof AIPrimitives.normalizeEmbedding).toBe('function')
    })
  })

  describe('Batch processing exports', () => {
    it('exports BatchQueue class', () => {
      expect(AIPrimitives.BatchQueue).toBeDefined()
    })

    it('exports createBatch function', () => {
      expect(AIPrimitives.createBatch).toBeDefined()
      expect(typeof AIPrimitives.createBatch).toBe('function')
    })

    it('exports withBatchQueue function', () => {
      expect(AIPrimitives.withBatchQueue).toBeDefined()
      expect(typeof AIPrimitives.withBatchQueue).toBe('function')
    })

    it('exports registerBatchAdapter function', () => {
      expect(AIPrimitives.registerBatchAdapter).toBeDefined()
      expect(typeof AIPrimitives.registerBatchAdapter).toBe('function')
    })

    it('exports getBatchAdapter function', () => {
      expect(AIPrimitives.getBatchAdapter).toBeDefined()
      expect(typeof AIPrimitives.getBatchAdapter).toBe('function')
    })

    it('exports isBatchMode function', () => {
      expect(AIPrimitives.isBatchMode).toBeDefined()
      expect(typeof AIPrimitives.isBatchMode).toBe('function')
    })

    it('exports deferToBatch function', () => {
      expect(AIPrimitives.deferToBatch).toBeDefined()
      expect(typeof AIPrimitives.deferToBatch).toBe('function')
    })

    it('exports BATCH_MODE_SYMBOL', () => {
      expect(AIPrimitives.BATCH_MODE_SYMBOL).toBeDefined()
      expect(typeof AIPrimitives.BATCH_MODE_SYMBOL).toBe('symbol')
    })
  })

  describe('Batch map exports', () => {
    it('exports BatchMapPromise class', () => {
      expect(AIPrimitives.BatchMapPromise).toBeDefined()
    })

    it('exports createBatchMap function', () => {
      expect(AIPrimitives.createBatchMap).toBeDefined()
      expect(typeof AIPrimitives.createBatchMap).toBe('function')
    })

    it('exports isBatchMapPromise function', () => {
      expect(AIPrimitives.isBatchMapPromise).toBeDefined()
      expect(typeof AIPrimitives.isBatchMapPromise).toBe('function')
    })

    it('exports BATCH_MAP_SYMBOL', () => {
      expect(AIPrimitives.BATCH_MAP_SYMBOL).toBeDefined()
      expect(typeof AIPrimitives.BATCH_MAP_SYMBOL).toBe('symbol')
    })
  })

  describe('Budget tracking exports', () => {
    it('exports BudgetTracker class', () => {
      expect(AIPrimitives.BudgetTracker).toBeDefined()
    })

    it('exports TokenCounter class', () => {
      expect(AIPrimitives.TokenCounter).toBeDefined()
    })

    it('exports RequestContext class', () => {
      expect(AIPrimitives.RequestContext).toBeDefined()
    })

    it('exports BudgetExceededError class', () => {
      expect(AIPrimitives.BudgetExceededError).toBeDefined()
    })

    it('exports createRequestContext function', () => {
      expect(AIPrimitives.createRequestContext).toBeDefined()
      expect(typeof AIPrimitives.createRequestContext).toBe('function')
    })

    it('exports withBudget function', () => {
      expect(AIPrimitives.withBudget).toBeDefined()
      expect(typeof AIPrimitives.withBudget).toBe('function')
    })
  })

  describe('Agentic tool orchestration exports', () => {
    it('exports AgenticLoop class', () => {
      expect(AIPrimitives.AgenticLoop).toBeDefined()
    })

    it('exports ToolRouter class', () => {
      expect(AIPrimitives.ToolRouter).toBeDefined()
    })

    it('exports ToolValidator class', () => {
      expect(AIPrimitives.ToolValidator).toBeDefined()
    })

    it('exports createTool function', () => {
      expect(AIPrimitives.createTool).toBeDefined()
      expect(typeof AIPrimitives.createTool).toBe('function')
    })

    it('exports createToolset function', () => {
      expect(AIPrimitives.createToolset).toBeDefined()
      expect(typeof AIPrimitives.createToolset).toBe('function')
    })

    it('exports wrapTool function', () => {
      expect(AIPrimitives.wrapTool).toBeDefined()
      expect(typeof AIPrimitives.wrapTool).toBe('function')
    })

    it('exports cachedTool function', () => {
      expect(AIPrimitives.cachedTool).toBeDefined()
      expect(typeof AIPrimitives.cachedTool).toBe('function')
    })

    it('exports rateLimitedTool function', () => {
      expect(AIPrimitives.rateLimitedTool).toBeDefined()
      expect(typeof AIPrimitives.rateLimitedTool).toBe('function')
    })

    it('exports timeoutTool function', () => {
      expect(AIPrimitives.timeoutTool).toBeDefined()
      expect(typeof AIPrimitives.timeoutTool).toBe('function')
    })

    it('exports createAgenticLoop function', () => {
      expect(AIPrimitives.createAgenticLoop).toBeDefined()
      expect(typeof AIPrimitives.createAgenticLoop).toBe('function')
    })
  })

  describe('Caching exports', () => {
    it('exports MemoryCache class', () => {
      expect(AIPrimitives.MemoryCache).toBeDefined()
    })

    it('exports EmbeddingCache class', () => {
      expect(AIPrimitives.EmbeddingCache).toBeDefined()
    })

    it('exports GenerationCache class', () => {
      expect(AIPrimitives.GenerationCache).toBeDefined()
    })

    it('exports withCache function', () => {
      expect(AIPrimitives.withCache).toBeDefined()
      expect(typeof AIPrimitives.withCache).toBe('function')
    })

    it('exports hashKey function', () => {
      expect(AIPrimitives.hashKey).toBeDefined()
      expect(typeof AIPrimitives.hashKey).toBe('function')
    })

    it('exports createCacheKey function', () => {
      expect(AIPrimitives.createCacheKey).toBeDefined()
      expect(typeof AIPrimitives.createCacheKey).toBe('function')
    })
  })

  describe('Retry/fallback exports', () => {
    it('exports RetryableError class', () => {
      expect(AIPrimitives.RetryableError).toBeDefined()
    })

    it('exports NonRetryableError class', () => {
      expect(AIPrimitives.NonRetryableError).toBeDefined()
    })

    it('exports NetworkError class', () => {
      expect(AIPrimitives.NetworkError).toBeDefined()
    })

    it('exports RateLimitError class', () => {
      expect(AIPrimitives.RateLimitError).toBeDefined()
    })

    it('exports CircuitOpenError class', () => {
      expect(AIPrimitives.CircuitOpenError).toBeDefined()
    })

    it('exports ErrorCategory enum', () => {
      expect(AIPrimitives.ErrorCategory).toBeDefined()
    })

    it('exports classifyError function', () => {
      expect(AIPrimitives.classifyError).toBeDefined()
      expect(typeof AIPrimitives.classifyError).toBe('function')
    })

    it('exports calculateBackoff function', () => {
      expect(AIPrimitives.calculateBackoff).toBeDefined()
      expect(typeof AIPrimitives.calculateBackoff).toBe('function')
    })

    it('exports RetryPolicy class', () => {
      expect(AIPrimitives.RetryPolicy).toBeDefined()
    })

    it('exports CircuitBreaker class', () => {
      expect(AIPrimitives.CircuitBreaker).toBeDefined()
    })

    it('exports FallbackChain class', () => {
      expect(AIPrimitives.FallbackChain).toBeDefined()
    })

    it('exports withRetry function', () => {
      expect(AIPrimitives.withRetry).toBeDefined()
      expect(typeof AIPrimitives.withRetry).toBe('function')
    })
  })

  describe('Digital objects registry exports', () => {
    it('exports DigitalObjectsFunctionRegistry class', () => {
      expect(AIPrimitives.DigitalObjectsFunctionRegistry).toBeDefined()
    })

    it('exports createDigitalObjectsRegistry function', () => {
      expect(AIPrimitives.createDigitalObjectsRegistry).toBeDefined()
      expect(typeof AIPrimitives.createDigitalObjectsRegistry).toBe('function')
    })

    it('exports FUNCTION_NOUNS object', () => {
      expect(AIPrimitives.FUNCTION_NOUNS).toBeDefined()
      expect(typeof AIPrimitives.FUNCTION_NOUNS).toBe('object')
      // FUNCTION_NOUNS contains keys like CODE, GENERATIVE, AGENTIC, HUMAN
      expect(AIPrimitives.FUNCTION_NOUNS.CODE).toBe('CodeFunction')
    })

    it('exports FUNCTION_VERBS object', () => {
      expect(AIPrimitives.FUNCTION_VERBS).toBeDefined()
      expect(typeof AIPrimitives.FUNCTION_VERBS).toBe('object')
      // FUNCTION_VERBS contains keys like DEFINE, CALL, COMPLETE, FAIL
      expect(AIPrimitives.FUNCTION_VERBS.DEFINE).toBe('define')
    })
  })
})

// ============================================================================
// 2. Language Models (from language-models)
// ============================================================================

describe('Language Models exports', () => {
  it('exports models function (list)', () => {
    expect(AIPrimitives.models).toBeDefined()
    expect(typeof AIPrimitives.models).toBe('function')
  })

  it('exports resolveModel function', () => {
    expect(AIPrimitives.resolveModel).toBeDefined()
    expect(typeof AIPrimitives.resolveModel).toBe('function')
  })

  it('exports getModelInfo function', () => {
    expect(AIPrimitives.getModelInfo).toBeDefined()
    expect(typeof AIPrimitives.getModelInfo).toBe('function')
  })

  it('exports searchModels function', () => {
    expect(AIPrimitives.searchModels).toBeDefined()
    expect(typeof AIPrimitives.searchModels).toBe('function')
  })
})

// ============================================================================
// 3. AI Providers (from ai-providers)
// ============================================================================

describe('AI Providers exports', () => {
  it('exports createRegistry function', () => {
    expect(AIPrimitives.createRegistry).toBeDefined()
    expect(typeof AIPrimitives.createRegistry).toBe('function')
  })

  it('exports getRegistry function', () => {
    expect(AIPrimitives.getRegistry).toBeDefined()
    expect(typeof AIPrimitives.getRegistry).toBe('function')
  })

  it('exports configureRegistry function', () => {
    expect(AIPrimitives.configureRegistry).toBeDefined()
    expect(typeof AIPrimitives.configureRegistry).toBe('function')
  })

  it('exports model function', () => {
    expect(AIPrimitives.model).toBeDefined()
    expect(typeof AIPrimitives.model).toBe('function')
  })

  it('exports embeddingModel function', () => {
    expect(AIPrimitives.embeddingModel).toBeDefined()
    expect(typeof AIPrimitives.embeddingModel).toBe('function')
  })

  it('exports DIRECT_PROVIDERS constant', () => {
    expect(AIPrimitives.DIRECT_PROVIDERS).toBeDefined()
    expect(typeof AIPrimitives.DIRECT_PROVIDERS).toBe('object')
  })

  it('exports LLM class', () => {
    expect(AIPrimitives.LLM).toBeDefined()
  })

  it('exports getLLM function', () => {
    expect(AIPrimitives.getLLM).toBeDefined()
    expect(typeof AIPrimitives.getLLM).toBe('function')
  })

  it('exports createLLMFetch function', () => {
    expect(AIPrimitives.createLLMFetch).toBeDefined()
    expect(typeof AIPrimitives.createLLMFetch).toBe('function')
  })
})

// ============================================================================
// 4. Database (from ai-database)
// ============================================================================

describe('Database exports', () => {
  it('exports DB class', () => {
    expect(AIPrimitives.DB).toBeDefined()
  })
})

// ============================================================================
// 5. Workflows (from ai-workflows)
// ============================================================================

describe('Workflows exports', () => {
  it('exports Workflow class', () => {
    expect(AIPrimitives.Workflow).toBeDefined()
  })

  it('exports on (event handler object)', () => {
    expect(AIPrimitives.on).toBeDefined()
    // on can be an object or function depending on implementation
    expect(['function', 'object']).toContain(typeof AIPrimitives.on)
  })

  it('exports every function', () => {
    expect(AIPrimitives.every).toBeDefined()
    expect(typeof AIPrimitives.every).toBe('function')
  })

  it('exports send function', () => {
    expect(AIPrimitives.send).toBeDefined()
    expect(typeof AIPrimitives.send).toBe('function')
  })
})

// ============================================================================
// 6. Agents (from autonomous-agents)
// ============================================================================

describe('Agents exports', () => {
  it('exports Agent class', () => {
    expect(AIPrimitives.Agent).toBeDefined()
  })

  it('exports Role class', () => {
    expect(AIPrimitives.Role).toBeDefined()
  })

  it('exports Team class', () => {
    expect(AIPrimitives.Team).toBeDefined()
  })

  it('exports Goals class', () => {
    expect(AIPrimitives.Goals).toBeDefined()
  })
})

// ============================================================================
// 7. Digital Workers (from digital-workers)
// ============================================================================

describe('Digital Workers exports', () => {
  it('exports workers namespace', () => {
    expect(AIPrimitives.workers).toBeDefined()
    expect(typeof AIPrimitives.workers).toBe('object')
  })
})

// ============================================================================
// 8. Human-in-the-Loop (from human-in-the-loop)
// ============================================================================

describe('Human-in-the-Loop exports', () => {
  it('exports Human class', () => {
    expect(AIPrimitives.Human).toBeDefined()
  })

  it('exports HumanManager class', () => {
    expect(AIPrimitives.HumanManager).toBeDefined()
  })
})

// ============================================================================
// 9. Experiments (from ai-experiments)
// ============================================================================

describe('Experiments exports', () => {
  it('exports Experiment class', () => {
    expect(AIPrimitives.Experiment).toBeDefined()
  })
})

// ============================================================================
// 10. Tasks (from digital-tasks)
// ============================================================================

describe('Tasks exports', () => {
  it('exports createTask function', () => {
    expect(AIPrimitives.createTask).toBeDefined()
    expect(typeof AIPrimitives.createTask).toBe('function')
  })

  it('exports task function', () => {
    expect(AIPrimitives.task).toBeDefined()
    expect(typeof AIPrimitives.task).toBe('function')
  })

  it('exports parallel function', () => {
    expect(AIPrimitives.parallel).toBeDefined()
    expect(typeof AIPrimitives.parallel).toBe('function')
  })

  it('exports sequential function', () => {
    expect(AIPrimitives.sequential).toBeDefined()
    expect(typeof AIPrimitives.sequential).toBe('function')
  })
})

// ============================================================================
// 11. Tools (from digital-tools)
// ============================================================================

describe('Tools exports', () => {
  it('exports defineTool function', () => {
    expect(AIPrimitives.defineTool).toBeDefined()
    expect(typeof AIPrimitives.defineTool).toBe('function')
  })
})

// ============================================================================
// 12. Products (from digital-products)
// ============================================================================

describe('Products exports', () => {
  it('exports Product class', () => {
    expect(AIPrimitives.Product).toBeDefined()
  })

  it('exports App class', () => {
    expect(AIPrimitives.App).toBeDefined()
  })

  it('exports API class', () => {
    expect(AIPrimitives.API).toBeDefined()
  })

  it('exports Site class', () => {
    expect(AIPrimitives.Site).toBeDefined()
  })

  it('exports SDK class', () => {
    expect(AIPrimitives.SDK).toBeDefined()
  })

  it('exports MCP class', () => {
    expect(AIPrimitives.MCP).toBeDefined()
  })
})

// ============================================================================
// 13. Services (from services-as-software)
// ============================================================================

describe('Services exports', () => {
  it('exports Service class', () => {
    expect(AIPrimitives.Service).toBeDefined()
  })

  it('exports Endpoint class', () => {
    expect(AIPrimitives.Endpoint).toBeDefined()
  })

  it('exports Client class', () => {
    expect(AIPrimitives.Client).toBeDefined()
  })

  it('exports ServiceProvider class', () => {
    expect(AIPrimitives.ServiceProvider).toBeDefined()
  })
})

// ============================================================================
// 14. Business (from business-as-code)
// ============================================================================

describe('Business exports', () => {
  it('exports Business class', () => {
    expect(AIPrimitives.Business).toBeDefined()
  })

  it('exports kpis function', () => {
    expect(AIPrimitives.kpis).toBeDefined()
    expect(typeof AIPrimitives.kpis).toBe('function')
  })

  it('exports okrs function', () => {
    expect(AIPrimitives.okrs).toBeDefined()
    expect(typeof AIPrimitives.okrs).toBe('function')
  })

  it('exports financials function', () => {
    expect(AIPrimitives.financials).toBeDefined()
    expect(typeof AIPrimitives.financials).toBe('function')
  })
})

// ============================================================================
// 15. Props (from ai-props)
// ============================================================================

describe('Props exports', () => {
  it('exports createAIComponent function', () => {
    expect(AIPrimitives.createAIComponent).toBeDefined()
    expect(typeof AIPrimitives.createAIComponent).toBe('function')
  })

  it('exports generateProps function', () => {
    expect(AIPrimitives.generateProps).toBeDefined()
    expect(typeof AIPrimitives.generateProps).toBe('function')
  })
})

// ============================================================================
// 16. Evaluate (from ai-evaluate)
// ============================================================================

describe('Evaluate exports', () => {
  it('exports evaluate function', () => {
    expect(AIPrimitives.evaluate).toBeDefined()
    expect(typeof AIPrimitives.evaluate).toBe('function')
  })

  it('exports createEvaluator function', () => {
    expect(AIPrimitives.createEvaluator).toBeDefined()
    expect(typeof AIPrimitives.createEvaluator).toBe('function')
  })
})

// ============================================================================
// Functional tests for re-exported utilities
// ============================================================================

describe('Functional tests for utilities', () => {
  describe('parseTemplate', () => {
    it('handles simple string interpolation', () => {
      const topic = 'TypeScript'
      const result = AIPrimitives.parseTemplate`Write about ${topic}`
      expect(result).toBe('Write about TypeScript')
    })

    it('handles multiple interpolations', () => {
      const topic = 'React'
      const audience = 'beginners'
      const result = AIPrimitives.parseTemplate`Write about ${topic} for ${audience}`
      expect(result).toBe('Write about React for beginners')
    })

    it('handles object interpolation (converts to YAML)', () => {
      const context = { name: 'Test' }
      const result = AIPrimitives.parseTemplate`Context: ${{ context }}`
      expect(result).toContain('context:')
      expect(result).toContain('name: Test')
    })
  })

  describe('schema', () => {
    it('creates a Zod schema from object', () => {
      const result = AIPrimitives.schema({
        name: 'Person name',
        age: 'Age in years (number)',
      })
      expect(result).toBeDefined()
      // schema() returns a ZodTypeAny which has parse and safeParse methods
      expect(typeof result.parse).toBe('function')
      expect(typeof result.safeParse).toBe('function')
      // Verify it validates correctly
      expect(result.safeParse({ name: 'John', age: 30 }).success).toBe(true)
    })
  })

  describe('cosineSimilarity', () => {
    it('calculates similarity between identical vectors', () => {
      const embedding = [1, 0, 0]
      const similarity = AIPrimitives.cosineSimilarity(embedding, embedding)
      expect(similarity).toBeCloseTo(1, 5)
    })

    it('calculates similarity between orthogonal vectors', () => {
      const a = [1, 0, 0]
      const b = [0, 1, 0]
      const similarity = AIPrimitives.cosineSimilarity(a, b)
      expect(similarity).toBeCloseTo(0, 5)
    })

    it('calculates similarity between opposite vectors', () => {
      const a = [1, 0, 0]
      const b = [-1, 0, 0]
      const similarity = AIPrimitives.cosineSimilarity(a, b)
      expect(similarity).toBeCloseTo(-1, 5)
    })
  })

  describe('normalizeEmbedding', () => {
    it('normalizes a vector to unit length', () => {
      const embedding = [3, 4]
      const normalized = AIPrimitives.normalizeEmbedding(embedding)
      const magnitude = Math.sqrt(normalized.reduce((sum, val) => sum + val * val, 0))
      expect(magnitude).toBeCloseTo(1, 5)
    })
  })

  describe('calculateBackoff', () => {
    it('calculates exponential backoff', () => {
      // calculateBackoff(attempt, options) - attempt is first param
      const backoff1 = AIPrimitives.calculateBackoff(1, { baseDelay: 1000, jitter: 0 })
      const backoff2 = AIPrimitives.calculateBackoff(2, { baseDelay: 1000, jitter: 0 })
      const backoff3 = AIPrimitives.calculateBackoff(3, { baseDelay: 1000, jitter: 0 })

      // With jitter disabled, should be exponential
      expect(backoff2).toBeGreaterThan(backoff1)
      expect(backoff3).toBeGreaterThan(backoff2)
    })
  })

  describe('hashKey', () => {
    it('generates consistent hash for same input', () => {
      const hash1 = AIPrimitives.hashKey('test-key')
      const hash2 = AIPrimitives.hashKey('test-key')
      expect(hash1).toBe(hash2)
    })

    it('generates different hash for different input', () => {
      const hash1 = AIPrimitives.hashKey('test-key-1')
      const hash2 = AIPrimitives.hashKey('test-key-2')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('MemoryCache', () => {
    it('can store and retrieve values', async () => {
      const cache = new AIPrimitives.MemoryCache()
      await cache.set('key1', 'value1')
      const value = await cache.get('key1')
      expect(value).toBe('value1')
    })

    it('returns undefined for missing keys', async () => {
      const cache = new AIPrimitives.MemoryCache()
      const value = await cache.get('nonexistent')
      expect(value).toBeUndefined()
    })
  })

  describe('BudgetTracker', () => {
    it('tracks token usage', () => {
      const tracker = new AIPrimitives.BudgetTracker({
        maxTokens: 1000,
      })
      tracker.recordUsage({ inputTokens: 100, outputTokens: 50, model: 'test' })
      // BudgetTracker uses export() method, not getSnapshot()
      const snapshot = tracker.export()
      expect(snapshot.totalInputTokens + snapshot.totalOutputTokens).toBe(150)
    })
  })

  describe('TokenCounter', () => {
    it('estimates token count for text', () => {
      const counter = new AIPrimitives.TokenCounter()
      // TokenCounter uses estimateTokens() method, not estimate()
      const count = counter.estimateTokens('Hello, world!')
      expect(count).toBeGreaterThan(0)
    })
  })

  describe('resolveModel', () => {
    it('resolves model alias to full model id', () => {
      const resolved = AIPrimitives.resolveModel('haiku')
      expect(resolved).toBeDefined()
      expect(typeof resolved).toBe('string')
    })

    it('returns original if not an alias', () => {
      const resolved = AIPrimitives.resolveModel('claude-3-5-haiku-20241022')
      expect(resolved).toBe('claude-3-5-haiku-20241022')
    })
  })

  describe('models (list)', () => {
    it('returns array of available models', () => {
      const modelList = AIPrimitives.models()
      expect(Array.isArray(modelList)).toBe(true)
      expect(modelList.length).toBeGreaterThan(0)
    })
  })
})
