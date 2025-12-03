# services-as-software

Primitives for building AI-powered services that operate as software. Services are a superset of digital-workers with a payment/business overlay, capable of crossing company/business boundaries.

## Installation

```bash
pnpm add services-as-software
```

## Quick Start

```typescript
import { Service, POST, GET } from 'services-as-software'

// Define a service
const translationService = Service({
  name: 'translation-service',
  version: '1.0.0',
  description: 'AI-powered translation service',

  // Pricing configuration
  pricing: {
    model: 'per-use',
    pricePerUnit: 0.01,
    currency: 'USD',
  },

  // Service endpoints
  endpoints: [
    POST({
      name: 'translate',
      path: '/translate',
      handler: async (input) => {
        return {
          translatedText: `Translated: ${input.text}`,
          confidence: 0.95,
        }
      },
    }),
  ],
})

// Use the service
const result = await translationService.call('translate', {
  text: 'Hello, world!',
  to: 'es',
})
```

## Core Primitives

### Service Creation

- **`Service(definition)`** - Define a service with endpoints, pricing, and business logic
- **`Endpoint(config)`** - Create a service endpoint
- **`POST()`, `GET()`, `PUT()`, `DELETE()`, `PATCH()`** - HTTP method helpers

### Client & Providers

- **`Client(config)`** - Connect to a remote service
- **`Provider(config)`** - Manage multiple services
- **`providers.aws()`, `providers.gcp()`, `providers.azure()`** - Pre-configured cloud providers

### Service Operations

- **`ask()`** - Ask a question helper
- **`deliver()`** - Deliver results helper
- **`do()`** - Execute a task helper
- **`every()`** - Scheduled recurring tasks helper
- **`generate()`** - Generate content helper
- **`is()`** - Type checking/validation helper
- **`notify()`** - Send notifications helper
- **`on()`** - Event handlers helper
- **`order()`** - Place an order helper
- **`queue()`** - Queue management helper
- **`quote()`** - Request a quote helper
- **`subscribe()`** - Subscription management helper

### Business Metrics

- **`entitlements()`** - Access entitlements helper
- **`kpis()`** - Key performance indicators helper
- **`okrs()`** - Objectives and key results helper
- **`Plan()`** - Create subscription plans
- **`KPI()`** - Define KPIs
- **`OKR()`** - Define OKRs

## Examples

### Creating a Service

```typescript
import { Service, Endpoint, POST } from 'services-as-software'

const service = Service({
  name: 'my-service',
  version: '1.0.0',

  // Pricing
  pricing: {
    model: 'subscription',
    basePrice: 49.99,
    currency: 'USD',
    interval: 'monthly',
  },

  // Endpoints
  endpoints: [
    POST({
      name: 'process',
      handler: async (input, context) => {
        // Your logic here
        return { processed: true }
      },
    }),
  ],

  // Subscription plans
  plans: [
    {
      id: 'pro',
      name: 'Pro Plan',
      pricing: { model: 'subscription', basePrice: 49.99, currency: 'USD', interval: 'monthly' },
      entitlements: ['api-access', 'priority-support'],
      features: ['Unlimited API calls', '24/7 support'],
    },
  ],

  // KPIs
  kpis: [
    {
      id: 'daily-requests',
      name: 'Daily Requests',
      calculate: async () => 1000,
      target: 1500,
    },
  ],
})
```

### Using a Client

```typescript
import { Client } from 'services-as-software'

const client = Client({
  url: 'https://api.example.com/service',
  auth: {
    type: 'api-key',
    credentials: { apiKey: 'your-key' },
  },
})

const result = await client.do('translate', { text: 'Hello', to: 'es' })
```

### Using Providers

```typescript
import { providers } from 'services-as-software'

const aws = providers.aws({
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  region: 'us-east-1',
})

const translate = aws.service('translate')
const result = await translate.do('translate', { text: 'Hello', to: 'es' })
```

## Features

- **Type-safe** - Full TypeScript support with comprehensive types
- **Pricing Models** - Support for free, fixed, per-use, subscription, tiered, and custom pricing
- **Authentication** - Built-in support for API keys, OAuth, JWT, and Basic auth
- **Rate Limiting** - Endpoint-level rate limiting configuration
- **Usage Tracking** - Track service usage for billing and analytics
- **Subscription Management** - Built-in subscription and entitlement support
- **Business Metrics** - KPIs and OKRs for monitoring service health
- **Event System** - Register event handlers for service events
- **Scheduled Tasks** - Cron-based recurring task support
- **Multi-Provider** - Connect to AWS, GCP, Azure, and custom providers

## Architecture

Services-as-software provides a complete framework for building and consuming services:

```
Service Definition → Service Instance → Client Access
     ↓                    ↓                  ↓
  Endpoints          Event Handlers      HTTP/RPC
  Pricing            Scheduled Tasks     Authentication
  Plans              KPIs/OKRs           Rate Limiting
```

## License

MIT
