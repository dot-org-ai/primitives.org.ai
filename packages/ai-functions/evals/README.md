# AI Functions Eval Suite

Evaluations for ai-functions using both vitest-based tests and a custom eval runner.

## Quick Start

### Vitest-Based Evals (Recommended)

Tests the core AI primitives (`code`, `ai`, `list`, `is`, `defineFunction`, etc.) with real AI calls:

```bash
# Run all eval tests
pnpm test:evals

# Run primitives eval (code, ai, list, is, etc.)
pnpm test:evals:primitives

# Run defineFunction eval
pnpm test:evals:define

# Run with specific model
MODEL=sonnet pnpm test:evals

# Run with specific tiers
EVAL_TIERS=best,fast pnpm test:evals
```

### Custom Runner Evals

Math and classification evals with detailed scoring:

```bash
# Run all evals (math + classification)
pnpm eval

# Run specific eval
pnpm eval:math
pnpm eval:class

# Run all tiers (best, fast, cheap)
pnpm eval:all
```

## Eval Suites

### Vitest Evals (test/evals/)

| Test Suite | Functions Tested | Test Cases |
|------------|------------------|------------|
| `primitives.eval.test.ts` | `code()`, `ai()`, `list()`, `is()`, `summarize()`, `extract()`, `write()`, `lists()` | Code generation, text generation, classification, extraction |
| `define-function.eval.test.ts` | `defineFunction()`, `define.generative()`, `define.code()` | Generative functions, code functions, structured outputs |

### Custom Runner Evals (evals/)

| Eval | Tests | Scoring |
|------|-------|---------|
| `Math` | Arithmetic, word problems | Correct answer + shows work |
| `Classification` | Sentiment, support tickets | Accuracy + calibration |
| `Marketing` | Marketing copy generation | LLM-as-judge ELO ranking |

### Marketing Copy Eval (LLM-as-Judge)

```bash
# Run marketing eval (fast tier only)
pnpm eval:marketing

# Run with all tiers
pnpm eval:marketing:all

# Use different judge model
pnpm eval:marketing -- --judge=opus
```

Generates marketing copy (title, description, hero headline/subhead, CTAs) for different scenarios and uses pairwise LLM-as-judge comparisons to create ELO rankings.

## Latest Results (December 2025)

**Overall: 94.0%** | Cost: $0.06 | Time: 95s | 10 Models

### Performance Summary

| Model | Math | Class | Overall | Avg Latency | Notes |
|-------|------|-------|---------|-------------|-------|
| Claude Sonnet 4.5 | 100% | 100% | **100%** | ~380ms | Best overall |
| GPT-5 Mini | 100% | 91.7% | 95.9% | ~1850ms | Slower but accurate |
| Gemini 2.5 Flash | 100% | 91.7% | 95.9% | ~200ms | **Fastest** |
| DeepSeek Chat | 100% | 91.7% | 95.9% | ~210ms | Great value |
| Mistral Medium 3.1 | 96% | 100% | 98.0% | ~850ms | Strong classify |
| Grok 4.1 Fast | 100% | 91.7% | 95.9% | ~2300ms | 2M context |
| Grok 4 Fast | 92% | 100% | 96.0% | ~1800ms | Good balance |
| Qwen3 30B | 96% | 91.7% | 93.9% | ~8900ms | Slowest |
| Llama 3.3 70B | 90% | 91.7% | 90.9% | ~185ms | Fast open model |
| GPT-oss 20B | 72% | 83.3% | 77.7% | ~1200ms | Open source |

### Performance/$ Analysis (Fast Tier)

| Model | Score | Est $/1M tokens | Score/$ | Recommendation |
|-------|-------|-----------------|---------|----------------|
| DeepSeek Chat | 95.9% | $0.28 | **342** | Best value |
| Gemini 2.5 Flash | 95.9% | $0.30 | 320 | Fast + cheap |
| Llama 3.3 70B | 90.9% | $0.40 | 227 | Good OSS option |
| Claude Sonnet 4.5 | 100% | $3.00 | 33 | Best quality |
| Mistral Medium 3.1 | 98.0% | $2.50 | 39 | Strong balance |
| GPT-5 Mini | 95.9% | $1.00 | 96 | OpenAI ecosystem |
| Grok 4.1 Fast | 95.9% | $2.00 | 48 | 2M context |

### Math Eval (94.6%)

| Model | Score | Avg Latency |
|-------|-------|-------------|
| Claude Sonnet 4.5 | 100% | ~380ms |
| GPT-5 Mini | 100% | ~200ms |
| Gemini 2.5 Flash | 100% | ~170ms |
| DeepSeek Chat | 100% | ~220ms |
| Grok 4.1 Fast | 100% | ~2600ms |
| Mistral Medium 3.1 | 96% | ~1040ms |
| Qwen3 30B | 96% | ~13000ms |
| Grok 4 Fast | 92% | ~2000ms |
| Llama 3.3 70B | 90% | ~170ms |
| GPT-oss 20B | 72% | ~180ms |

### Classification Eval (93.3%)

| Model | Score | Avg Latency |
|-------|-------|-------------|
| Claude Sonnet 4.5 | 100% | ~205ms |
| Mistral Medium 3.1 | 100% | ~700ms |
| Grok 4 Fast | 100% | ~1670ms |
| GPT-5 Mini | 91.7% | ~3500ms |
| Gemini 2.5 Flash | 91.7% | ~235ms |
| Llama 3.3 70B | 91.7% | ~230ms |
| DeepSeek Chat | 91.7% | ~230ms |
| Qwen3 30B | 91.7% | ~3970ms |
| Grok 4.1 Fast | 91.7% | ~2170ms |
| GPT-oss 20B | 83.3% | ~2840ms |

### Marketing Copy Eval (ELO Rankings)

Uses LLM-as-judge (Claude Sonnet) for pairwise comparisons across 4 test scenarios.

| Rank | Model | ELO | W | L | D | Notes |
|------|-------|-----|---|---|---|-------|
| 1 | Claude Sonnet 4.5 | **1745** | 31 | 3 | 0 | Dominant winner |
| 2 | Grok 4.1 Fast | 1595 | 22 | 12 | 0 | Strong creative |
| 3 | GPT-5 Mini | 1593 | 26 | 8 | 0 | Consistent quality |
| 4 | Grok 4 Fast | 1558 | 17 | 17 | 0 | Good balance |
| 5 | Gemini 2.5 Flash | 1503 | 14 | 20 | 0 | Middle tier |
| 6 | Mistral Medium 3.1 | 1481 | 16 | 18 | 0 | Solid performer |
| 7 | GPT-oss 20B | 1471 | 19 | 15 | 0 | OSS option |
| 8 | DeepSeek Chat | 1449 | 10 | 16 | 0 | Value option |
| 9 | Qwen3 30B | 1371 | 6 | 20 | 0 | Below average |
| 10 | Llama 3.3 70B | 1231 | 1 | 33 | 0 | Struggled |

**Key Insights:**
- Claude Sonnet 4.5 won 31 of 34 comparisons (91%)
- Grok models performed unexpectedly well on creative tasks
- Llama 3.3 70B, despite being strong on classification, struggled with marketing copy

## Models

Uses model IDs from `language-models` package, routed via `ai-providers`:

### Model Tiers

| Tier | Description | Models |
|------|-------------|--------|
| `best` | Highest capability | opus, o3, gpt-5.1, gemini-pro, deepseek-v3.2, mistral-large-3, qwen3-coder, grok-4 |
| `fast` | Good balance | sonnet, gpt-5-mini, flash, llama-3.3-70b, mistral-medium-3.1, qwen3-30b, grok-4.1-fast |
| `cheap` | Cost-optimized | haiku, gpt-5-nano, ministral-14b |

### Full Model List (December 2025)

- **Anthropic**: `opus`, `sonnet`, `haiku`
- **OpenAI**: `openai/gpt-5.1`, `openai/gpt-5-mini`, `openai/gpt-5-nano`, `openai/o3`
- **OpenAI OSS**: `openai/gpt-oss-120b`, `openai/gpt-oss-20b` (open source models)
- **Google**: `gemini-pro`, `flash`
- **Meta**: `meta-llama/llama-4-maverick`, `meta-llama/llama-3.3-70b-instruct`
- **DeepSeek**: `deepseek/deepseek-v3.2`, `deepseek/deepseek-v3.2-speciale`, `deepseek/deepseek-chat`
- **Mistral**: `mistralai/mistral-large-2512` (Mistral Large 3), `mistralai/mistral-medium-3.1`, `mistralai/ministral-14b-2512`
- **Qwen**: `qwen/qwen3-coder`, `qwen/qwen3-30b-a3b`, `qwen/qwen3-next-80b-a3b-instruct`
- **xAI**: `x-ai/grok-4`, `x-ai/grok-4.1-fast`, `x-ai/grok-4-fast`

## Environment

```bash
# Use AI Gateway (recommended)
AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/...
AI_GATEWAY_TOKEN=...

# Or direct API keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

## Adding Evals

### Vitest-Based Evals

1. Create a new test file in `test/evals/`
2. Import functions and models:
   ```typescript
   import { code, ai, list } from '../../src/primitives.js'
   import { EVAL_MODELS, type EvalModel } from '../../src/eval/models.js'
   ```
3. Use `describe.skipIf(!hasAPI)` to skip when no API access
4. Loop over models with `for (const model of models)`

### Custom Runner Evals

1. Add test cases to `evals/run-evals.ts`
2. Use `runEval()` with `task` function and `scorers` array
3. Use `createModelVariants({ tiers: ['fast'] })` to filter models
