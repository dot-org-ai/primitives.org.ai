# ai-functions Tests

Integration tests for ai-functions using real AI models via Cloudflare AI Gateway.

## Prerequisites

Set environment variables in `.env` at the project root:

```bash
AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}
AI_GATEWAY_TOKEN=your-gateway-token
```

The AI Gateway should have secrets configured for:
- `anthropic` - Anthropic API key
- `openai` - OpenAI API key
- `openrouter` - OpenRouter API key

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
npx vitest run test/generate.test.ts

# Watch mode
npx vitest

# With verbose output
npx vitest run --reporter=verbose
```

## Test Files

| File | Description |
|------|-------------|
| `schema.test.ts` | Pure unit tests for schema conversion (no AI calls) |
| `embeddings.test.ts` | Embedding utility tests (mostly pure, 2 skipped API tests) |
| `generate.test.ts` | generateObject/generateText with real AI calls |
| `ai-proxy.test.ts` | AI() proxy and schema functions |
| `define.test.ts` | Function registry and defineFunction |

## Test Configuration

Tests use:
- **vitest** for test runner
- **dotenv** for loading env vars from parent directories
- **Sequential execution** to avoid rate limiting (`singleFork: true`)
- **60s timeout** for AI calls

## How It Works

### No Mocking

Tests call real AI models through Cloudflare AI Gateway. This ensures:
- Actual API compatibility
- Real response validation
- Gateway caching for efficiency

### Gateway Caching

Cloudflare AI Gateway caches responses, so:
- First run may be slower
- Subsequent runs use cached responses
- Tests are idempotent with same inputs

### Model Routing

All models route through OpenRouter:
- `'sonnet'` → `openrouter:anthropic/claude-sonnet-4.5`
- `'gpt-4o'` → `openrouter:openai/gpt-4o`
- OpenRouter handles model ID translation

## Writing Tests

```typescript
import { describe, it, expect } from 'vitest'
import { generateObject } from '../src/generate.js'

const hasGateway = !!process.env.AI_GATEWAY_URL

describe.skipIf(!hasGateway)('my tests', () => {
  it('generates output', async () => {
    const { object } = await generateObject({
      model: 'sonnet',
      schema: { message: 'A greeting' },
      prompt: 'Say hello',
    })

    expect(object.message).toBeDefined()
  })
})
```

## Debugging

```bash
# Check env loading
node -e "require('dotenv').config({ path: '../../../.env' }); console.log(process.env.AI_GATEWAY_URL)"

# Run single test with logs
npx vitest run test/generate.test.ts -t "generates simple"
```
