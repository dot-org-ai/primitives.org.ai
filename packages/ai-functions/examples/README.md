# ai-functions Examples

This directory contains runnable examples demonstrating various use cases for the `ai-functions` library.

## Running Examples

Make sure you have an API key configured:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# or
export OPENAI_API_KEY=sk-...
```

Then run any example with:

```bash
npx tsx examples/<example-name>.ts
```

## Examples Overview

### 1. RAG Chatbot (`01-rag-chatbot.ts`)
Build a Retrieval-Augmented Generation chatbot that:
- Generates embeddings for documents
- Performs semantic search
- Generates context-aware responses

### 2. Multi-Agent Research Workflow (`02-multi-agent-research.ts`)
Coordinate multiple specialized agents:
- Planner agent creates research plans
- Fact finder agent gathers information
- Analyst agent critiques findings
- Synthesizer agent creates final reports

### 3. Email Classification & Routing (`03-email-classification.ts`)
Intelligent email processing:
- Classify emails by category, priority, sentiment
- Extract key information and action items
- Route to appropriate handlers
- Generate auto-responses

### 4. Content Moderation Pipeline (`04-content-moderation.ts`)
Multi-stage moderation system:
- Quick safety checks
- Detailed category analysis
- Severity assessment
- Routing decisions

### 5. Document Data Extraction (`05-document-extraction.ts`)
Extract structured data from:
- Invoices (line items, totals, dates)
- Resumes (experience, skills, education)
- Contracts (parties, terms, financials)
- General entity extraction

### 6. Streaming Chat UI (`06-streaming-chat-nextjs.ts`)
Build streaming interfaces:
- Real-time text streaming
- Partial object streaming
- React/Next.js integration patterns
- Conversation state management

### 7. Cloudflare Worker Deployment (`07-cloudflare-worker.ts`)
Edge function patterns:
- Worker request handling
- Rate limiting
- Response caching
- Streaming responses

### 8. Batch Processing (1000+ items) (`08-batch-processing.ts`)
Process large volumes efficiently:
- Concurrent processing with limits
- Provider batch API (50% cost savings)
- Progress tracking
- Error recovery

### 9. Budget-Constrained Generation (`09-budget-constrained.ts`)
Control costs and usage:
- Budget limits and alerts
- Cost tracking by model
- Per-user/tenant budgets
- Optimization strategies

### 10. Tool Orchestration (`10-tool-orchestration.ts`)
Build agentic applications:
- Define tools with Zod schemas
- AgenticLoop for multi-turn conversations
- Tool composition patterns
- Streaming events

### 11. Retry and Resilience Patterns (`11-retry-resilience.ts`)
Build fault-tolerant applications:
- Retry with exponential backoff
- Circuit breaker pattern
- Fallback chains
- Error classification

### 12. Caching Strategies (`12-caching-strategies.ts`)
Optimize costs with intelligent caching:
- MemoryCache for general use
- GenerationCache for AI responses
- EmbeddingCache for vectors
- Function wrappers

### Quickstart (`00-quickstart.ts`)
Get started quickly with:
- Basic primitives overview
- Simple examples of each feature
- Configuration patterns

### Batch Blog Posts (`batch-blog-posts.ts`)
Original example showing implicit batching:
- Global configuration
- Automatic batch detection
- list.map() patterns

## Quick Reference

| Example | Key Features | Use Case |
|---------|--------------|----------|
| RAG Chatbot | Embeddings, search, context | Knowledge bases, support bots |
| Multi-Agent | Agent coordination, synthesis | Research, analysis |
| Email Classification | Classification, extraction, routing | Email automation |
| Content Moderation | Policy checks, severity scoring | UGC platforms |
| Document Extraction | Schema inference, validation | Data entry automation |
| Streaming Chat | Real-time updates, partial objects | Chat applications |
| Cloudflare Worker | Edge runtime, caching | API endpoints |
| Batch Processing | Concurrency, progress tracking | Bulk operations |
| Budget Constrained | Cost control, alerts | Production systems |
| Tool Orchestration | Agentic loops, tool calling | AI assistants |
| Retry Resilience | Retries, circuit breakers, fallbacks | Production systems |
| Caching Strategies | Cache generation, embeddings | Cost optimization |

## Prerequisites

- Node.js 18+
- TypeScript 5+
- API key for Anthropic or OpenAI

## Getting Help

- See the main [README.md](../README.md) for API documentation
- Check [test/](../test/) for more usage patterns
- File issues at the repository
