# ai-functions

Call AI like a function. No prompts. No configuration. Just call it.

```typescript
import { ai, is, list, code } from 'ai-functions'

await ai`write a haiku about ${topic}`
await is`${email} a valid email?`
await list`blog post ideas about ${topic}`
await code`${task} in ${language}`
```

## Installation

```bash
pnpm add ai-functions
```

## Function Types

Every AI function is one of four types:

| Type | Description | Examples |
|------|-------------|----------|
| **Generative** | Generate content - text, JSON, images, etc. | `ai`, `generate`, `write`, `list`, `is`, `extract`, `summarize`, `image`, `video` |
| **Code** | Generate and execute code in sandbox | `code`, `evaluate` (via ai-sandbox) |
| **Agentic** | Multi-step with tools, loops until done | `do`, `research`, `browse` |
| **Human** | Requires human input or approval | `ask`, `approve`, `review` |

```typescript
// Generative - creates content, analyzes, extracts
const post = await write`blog post about ${topic}`
const isSpam = await is`${email} spam?`
const people = await extract`names from ${article}`

// Code - generates and can execute in sandbox
const fn = await code`email validator in TypeScript`
const result = await evaluate({ code: fn, tests: ['test@example.com'] })

// Agentic - uses tools, multiple steps
const analysis = await research`${company} competitive landscape`
const page = await browse`${url}`
await page.do`add to cart`

// Human - waits for human input
const decision = await ask`should we proceed with ${plan}?`
const approved = await approve`${expense} for ${amount}`
```

When you call `define()` or use the magic proxy `ai.*`, the function type is inferred from the **name + arguments** - a subjective judgment based on full context:

```typescript
// ai.fizzBuzz({ max: 100 })
// → "fizzBuzz" + algorithmic args → CodeFunction
// → defines, calls code(), returns executable
const fizzBuzz = await ai.fizzBuzz({ max: 100 })

// ai.storyBrand({ hero: 'developers', guide: 'ai-functions' })
// → "storyBrand" + marketing framework args → GenerativeFunction
// → defines schema { hero, guide, problem, plan, ... }
// → calls generate('json', prompt, { schema })
const brand = await ai.storyBrand({ hero: 'developers', guide: 'ai-functions' })

// ai.launchProductHunt({ product, description, images })
// → "launch" + external platform + assets → AgenticFunction
// → needs to browse, fill forms, upload images
const launch = await ai.launchProductHunt({ product, description, images })

// ai.processRefund({ order, amount: 12.99, reason })
// → small amount, routine task → GenerativeFunction (automated)
const refund = await ai.processRefund({ order, amount: 12.99, reason })

// ai.processRefund({ order, amount: 50000, reason })
// → large amount, same function name → HumanFunction (needs approval!)
const refund = await ai.processRefund({ order, amount: 50000, reason })

// ai.approveAdvertisingBudget({ campaign, amount })
// → "approve" + financial context → always HumanFunction
const approved = await ai.approveAdvertisingBudget({ campaign, amount })
```

The AI considers: function name, argument names, argument values, and context to decide the appropriate function type and behavior.

## API Reference

| Function | Returns | Syntax |
|----------|---------|--------|
| [`ai`](#ai) | `string` | ``ai`prompt` `` / `ai(prompt)` |
| [`summarize`](#summarize) | `string` | ``summarize`${text}` `` / `summarize(text, { length })` |
| [`do`](#do) | `unknown` | ``do`task` `` - single-pass task with tools |
| [`is`](#is) | `boolean` | ``is`question?` `` / `is(classification, input)` |
| [`list`](#list) | `string[]` / `AsyncIterable` | ``list`items` `` / `for await (x of list`...`)` |
| [`lists`](#lists) | `Record<string, string[]>` | ``lists`named lists` `` |
| [`extract`](#extract) | `T[]` / `AsyncIterable` | ``extract`items from ${text}` `` |
| [`write`](#write) | `string` | ``write`content type` `` / `write(type, context)` |
| [`generate`](#generate) | `T` | ``generate`prompt` `` / `generate(type, prompt, opts?)` |
| [`decide`](#decide) | `T` | ``decide`criteria`(optionA, optionB)`` |
| [`code`](#code) | `string` | ``code`description` `` / `code(desc, { language })` |
| [`diagram`](#diagram) | `string` | ``diagram`description` `` / `diagram(desc, { format })` |
| [`slides`](#slides) | `string` | ``slides`topic` `` / `slides(topic, { format })` |
| [`image`](#image) | `Buffer` | ``image`description` `` / `image(desc, { size })` |
| [`video`](#video) | `Buffer` | ``video`description` `` / `video(desc, { duration })` |
| [`research`](#research) | `Research` | ``research`topic` `` / `research(topic, { depth })` |
| [`read`](#read) | `string` | ``read`${url}` `` / `read(url)` |
| [`browse`](#browse) | `Page` | ``browse`${url}` `` / `page.extract`, `page.do` |
| [`ai.*`](#magic-proxy) | `unknown` | `ai.anyFunctionName(args)` |
| [`define`](#define) | `AIFunction` | `define('functionName', args)` |
| [`AI()`](#ai-factory) | typed `ai` | `AI({ schema })` |

### How It All Fits Together

Let's use StoryBrand as our example - it's a framework, and we're building it with ai-functions:

```typescript
import { ai, AI, define, code, write } from 'ai-functions'

// 1. Magic proxy - just call it, it figures out the rest
const brand = await ai.storyBrand({
  hero: 'busy developers',
  guide: 'ai-functions',
})

// 2. Under the hood, that called define()
const storyBrand = define('storyBrand', {
  hero: 'Who is the customer?',
  guide: 'Who/what helps them?',
  problem: {
    external: 'What external challenge?',
    internal: 'What internal struggle?',
    philosophical: 'Why is this wrong?',
  },
  plan: ['Steps to success'],
  callToAction: 'What should they do?',
  success: 'What does winning look like?',
  failure: 'What are they avoiding?',
})

// 3. Or use AI() for typed, reusable schemas
const ai = AI({
  storyBrand: {
    hero: 'Who is the customer?',
    guide: 'Who/what helps them?',
    problem: {
      external: 'What external challenge?',
      internal: 'What internal struggle?',
    },
    plan: ['Steps to success'],
    callToAction: 'What should they do?',
  },
})

const brand = await ai.storyBrand('ai-functions library')
// TypeScript knows the full shape of brand

// 4. Pass complex objects to other functions - auto-converts to YAML
const landingPage = await code`marketing site for ${{ brand }}`
const emailSequence = await write`onboarding emails for ${{ brand }}`
const tagline = await write`compelling tagline for ${{ brand }}`
```

### Async Iterators

Functions that return lists can be streamed with `for await`:

```typescript
// Process items as they're generated
for await (const market of list`10 market segments for ${idea}`) {
  const research = await research`${market} market size and trends`

  for await (const icp of list`ideal customer profiles for ${{ idea, market }}`) {
    const brand = await ai.storyBrand({ idea, market, icp })
    const page = await code`landing page for ${{ brand }}`

    // Extract structured data from text
    for await (const competitor of extract`company names from ${research}`) {
      const comparison = await research`${idea} vs ${competitor}`
    }
  }
}
```

This pattern is powerful for:
- Processing results as they stream in
- Early termination (just `break`)
- Memory efficiency with large result sets
- Building complex pipelines

### Options Parameter

Every function accepts an optional last parameter for model and generation settings:

```typescript
// Specify model
await is`${claim} factually accurate?`({ model: 'claude-opus-4-5' })

// Control thinking depth for complex reasoning
await decide`which architecture is better for scale`(optionA, optionB, {
  model: 'claude-opus-4-5',
  thinking: 'high',  // 'low' | 'medium' | 'high' | number (token budget)
})

// Other options
await generate('json', 'analysis', {
  model: 'gpt-5-1',
  temperature: 0.7,
  maxTokens: 4000,
})
```

### Batch & Background Processing

For high-volume or long-running tasks, use batch or background mode:

```typescript
// Generate blog post titles
const brand = await ai.storyBrand({ hero: 'developers', guide: 'ai-functions' })
const titles = await list`25 blog post titles for ${{ brand }}`

// Submit all posts to background processing
const jobs = await Promise.all(
  titles.map(title =>
    write`blog post starting with "# ${title}" for ${{ brand }}`({
      mode: 'background',  // returns job ID immediately
    })
  )
)
// jobs = [{ id: 'job_abc', status: 'pending' }, ...]

// Check status later
const results = await Promise.all(jobs.map(job => job.result()))

// Or use batch mode for better pricing (50% off on OpenAI)
const posts = await write.batch(
  titles.map(title => ({ title, brand, tone: 'technical', audience: 'developers' }))
)
// Processes all at once, returns when complete

// Stream batch results as they complete
for await (const post of write.batch.stream(
  titles.map(title => ({ title, brand, tone: 'technical', audience: 'developers' }))
)) {
  await db.posts.create({ title: post.title, content: post.content })
}
```

---

## Example: Content Creation Workflow

A complete example showing how the functions work together:

```typescript
import { ai, summarize, is, list, lists, extract, write, generate, decide, code, diagram, slides, image, video, research, read, browse, define } from 'ai-functions'

// Start with a topic idea
const topic = 'Building AI-powered applications'

// Validate it's appropriate for our audience
const isRelevant = await is`${topic} relevant for software developers?`
if (!isRelevant) throw new Error('Topic not relevant')

// Research the topic first
const topicResearch = await research`${topic} trends and best practices`

// Brainstorm content angles informed by research
const angles = await list`blog post angles for ${{ topic, topicResearch }}`
// ['Getting started with LLMs', 'Best practices for prompt engineering', ...]

// Analyze the competitive landscape
const { strengths, weaknesses, opportunities } = await lists`
  content gap analysis for ${{ topic, competitors: ['OpenAI blog', 'Anthropic blog'] }}
`

// Pick the best angle (LLM as judge)
const chosenAngle = await decide`
  which angle best addresses the content gaps?
  ${{ opportunities }}
`(...angles, { model: 'claude-opus-4-5', thinking: 'high' })

// Generate structured metadata for the post
const metadata = await generate('blog post metadata', {
  schema: {
    title: 'SEO-optimized title',
    description: 'Meta description (150 chars)',
    keywords: ['SEO keywords'],
    readingTime: 'Estimated minutes (number)',
  },
})

// Write the actual blog post (use a fast model for drafting)
const article = await write`
  technical blog post about ${chosenAngle}
  ${{ tone: 'friendly but authoritative', length: '1500 words' }}
`({ model: 'gemini-3-flash' })

// Generate a hero image
const heroImage = await image`
  minimalist illustration for: ${metadata.title}
  ${{ style: 'modern tech blog', colors: 'blue and purple gradients' }}
`

// Create a short video teaser for social media
const teaser = await video`
  15 second teaser for: ${metadata.title}
  ${{ style: 'motion graphics', aspect: '9:16' }}
`

// Create a system architecture diagram mentioned in the post
const architectureDiagram = await diagram`
  AI application architecture with: LLM API, vector database, caching layer
`

// Generate a code example for the post
const codeExample = await code`
  TypeScript function that calls an LLM API with retry logic
`

// Use the magic proxy for a custom one-off task
const socialPosts = await ai.generateSocialMedia({
  article,
  platforms: ['twitter', 'linkedin'],
  tone: 'engaging',
})

// Define a reusable function for future content
const analyzePerformance = define('analyzePerformance', {
  args: {
    content: 'The content to analyze',
    metrics: ['List of performance metrics'],
  },
  returns: {
    score: 'Overall score 0-100 (number)',
    suggestions: ['Improvement suggestions'],
    predictedEngagement: 'high | medium | low',
  },
})

const performance = await analyzePerformance({
  content: article,
  metrics: ['readability', 'seo', 'engagement'],
})
```

---

## `define`

The foundation of ai-functions. Every function is built on `define`.

```typescript
import { define } from 'ai-functions'

// Basic: just a name and input schema
const planTrip = define('planTrip', {
  destination: 'Travel destination',
  budget: 'Budget in USD (number)',
})

await planTrip({ destination: 'Tokyo', budget: 5000 })
```

### With Output Schema

```typescript
const planTrip = define('planTrip', {
  args: {
    destination: 'Travel destination',
    budget: 'Budget in USD (number)',
  },
  returns: {
    itinerary: [{
      day: 'Day number (number)',
      activities: ['List of activities'],
      estimatedCost: 'Cost for the day (number)',
    }],
    totalCost: 'Total trip cost (number)',
    tips: ['Travel tips'],
  },
})
```

### With Options

```typescript
const analyze = define('analyzeCompetitors', {
  args: { company: 'Company name', market: 'Market segment' },
  returns: { strengths: ['...'], weaknesses: ['...'] },
  model: 'claude-opus-4-5',
  temperature: 0.7,
  system: 'You are a business analyst.',
})
```

The built-in functions (`is`, `list`, `code`, etc.) are all created with `define`:

```typescript
// is = define('is', { returns: 'boolean' })
// list = define('list', { returns: ['items'] })
// code = define('code', { returns: 'code string' })
```

---

## `ai`

The simplest way to call AI. Pass a string, get a string back.

```typescript
import { ai } from 'ai-functions'

// Tagged template
const explanation = await ai`Explain ${topic} to a 5 year old`

// Direct call
const text = await ai('Explain quantum computing in one sentence')
```

---

## `do`

Single-pass task execution. Can use other ai-functions as tools, but doesn't loop like an agent.

```typescript
import { do as act } from 'ai-functions' // 'do' is reserved word

// Simple task - might just call ai() internally
const translation = await act`translate ${text} to Spanish`

// Complex task - might call summarize() + extract() + list()
const analysis = await act`
  analyze this article and give me a summary,
  key people mentioned, and action items
  ${article}
`
// Returns structured result based on what was asked

// With context
const report = await act`
  create a competitive analysis
  ${{ competitors, ourProduct, market }}
`

// The difference from agents:
// - do: single pass, picks tools, executes once, returns
// - agent: loops until goal achieved, plans, re-evaluates
```

Think of `do` as one step of what an agent would do - it can use tools (other ai-functions) but doesn't loop or plan multiple steps.

---

## `summarize`

Condense text to key points.

```typescript
import { summarize } from 'ai-functions'

// Quick summary
const summary = await summarize`${longArticle}`

// With length control
const brief = await summarize`${document}`({ length: 'short' })   // 1-2 sentences
const detailed = await summarize`${document}`({ length: 'long' }) // multiple paragraphs

// Summarize research results
const research = await research`AI market trends 2025`
const keyPoints = await summarize`${research}`

// Summarize for specific audience
const execSummary = await summarize`${technicalReport}${{
  audience: 'executives',
  focus: 'business impact',
}}`
```

---

## `is`

Boolean classification. Returns `true` or `false`.

```typescript
import { is } from 'ai-functions'

// Tagged template - natural question format
const isSpam = await is`${emailContent} spam?`
const isUrgent = await is`${message} urgent?`
const isValid = await is`${code} valid TypeScript?`

// With context object
const isPositive = await is('positive sentiment', { review: 'Great product!' })
```

---

## `list`

Generate a list of items. Supports streaming with async iteration.

```typescript
import { list } from 'ai-functions'

// Get all at once
const ideas = await list`startup ideas for ${industry}`
const tags = await list`tags for: ${articleContent}`

// With count
const topTen = await list`10 blog post titles for ${topic}`

// Stream items as they're generated
for await (const idea of list`startup ideas for ${industry}`) {
  const validation = await research`market size for ${idea}`
  if (validation.marketSize > 1000000000) {
    console.log('Found billion dollar idea:', idea)
    break // early termination
  }
}
```

---

## `lists`

Generate multiple named lists at once.

```typescript
import { lists } from 'ai-functions'

// Tagged template
const { pros, cons } = await lists`pros and cons of ${topic}`

// With context
const { strengths, weaknesses, opportunities, threats } = await lists`
  SWOT analysis for ${{ company, market, competitors }}
`
```

---

## `extract`

Extract structured data from unstructured text. Supports streaming.

```typescript
import { extract } from 'ai-functions'

// Extract as array
const names = await extract`person names from ${article}`
// ['John Smith', 'Jane Doe', 'Bob Wilson']

// Extract with schema
const companies = await extract`companies from ${text}${{
  schema: {
    name: 'Company name',
    role: 'mentioned as: competitor | partner | customer',
  },
}}`

// Stream extraction for processing one at a time
for await (const email of extract`email addresses from ${document}`) {
  await sendNotification(email)
}

// Extract from research results
const marketResearch = await research`competitors in ${market}`
for await (const competitor of extract`company names from ${marketResearch}`) {
  const analysis = await research`${competitor} vs ${ourProduct}`
}
```

---

## `write`

Generate text content with optional formatting.

```typescript
import { write } from 'ai-functions'

// Tagged template
const email = await write`professional email to ${recipient} about ${subject}`
const bio = await write`twitter bio for ${{ name, profession, interests }}`

// With options
const post = await write('blog post', {
  topic: 'TypeScript Best Practices',
  length: 'medium',
  tone: 'casual',
})
```

---

## `generate`

The core primitive. All other functions call `generate` under the hood.

```typescript
import { generate } from 'ai-functions'

// generate(type, prompt, options?)

// JSON (default type)
const analysis = await generate('json', `competitive analysis of ${company}`)
const user = await generate('json', 'fake user profile', {
  schema: {
    name: 'Full name',
    email: 'Email address',
    age: 'Age in years (number)',
  },
})

// Code
const config = await generate('code', 'webpack config for React TypeScript', { language: 'javascript' })
const styles = await generate('code', 'CSS for a pricing table', { language: 'css' })

// Markdown
const readme = await generate('markdown', `README for ${{ project, features }}`)
const docs = await generate('markdown', `API docs for ${{ endpoints }}`)

// Other formats
const deployment = await generate('yaml', `kubernetes deployment for ${app}`)
const feed = await generate('rss', `feed for ${{ posts }}`)

// All convenience functions use generate:
// write(prompt)      → generate('text', prompt)
// code(prompt)       → generate('code', prompt)
// list(prompt)       → generate('list', prompt)
// extract(prompt)    → generate('extract', prompt)
// summarize(prompt)  → generate('summary', prompt)
// diagram(prompt)    → generate('diagram', prompt)
// slides(prompt)     → generate('slides', prompt)
```

### Schema Syntax

| Syntax | Type | Example |
|--------|------|---------|
| `'description'` | string | `name: 'User name'` |
| `'desc (number)'` | number | `age: 'Age (number)'` |
| `'desc (boolean)'` | boolean | `active: 'Active? (boolean)'` |
| `'opt1 \| opt2'` | enum | `status: 'pending \| done'` |
| `['description']` | array | `tags: ['List of tags']` |
| `{ nested }` | object | `address: { city: '...' }` |

---

## `decide`

LLM as judge. Pick the best option based on criteria.

```typescript
import { decide } from 'ai-functions'

// Compare two options
const better = await decide`which is more compelling?`(copyA, copyB)

// Compare multiple options
const best = await decide`which headline will get more clicks?`(
  'AI is Here',
  'The Future of AI',
  'Why AI Matters Now',
)

// With context in the criteria
const winner = await decide`
  which design better fits ${{ brand, audience }}?
`(designA, designB, designC)

// Returns the winning option (same type as inputs)
const bestProduct = await decide`which has better value?`(productA, productB)
// bestProduct === productA or bestProduct === productB
```

---

## `code`

Generate code in any language.

```typescript
import { code } from 'ai-functions'

// Tagged template - concise for simple requests
const validator = await code`email validation function`
const query = await code`SQL: top 10 customers by revenue`

// With complex requirements
const website = await code`marketing website${{
  requirements: {
    pages: ['home', 'about', 'pricing'],
    features: ['dark mode', 'animations'],
    stack: 'Next.js + Tailwind',
  },
}}`

// With explicit options
const component = await code('data table component', {
  language: 'tsx',
  framework: 'React',
  features: ['sorting', 'filtering', 'pagination'],
})
```

---

## `diagram`

Generate diagrams in various formats.

```typescript
import { diagram } from 'ai-functions'

// Tagged template
const flow = await diagram`user authentication flow`
const erd = await diagram`e-commerce database schema`

// With options
const architecture = await diagram('microservices architecture', {
  format: 'mermaid',
  type: 'flowchart',
  services: ['auth', 'users', 'orders', 'payments'],
})
```

---

## `slides`

Generate markdown-based presentations (Slidev, Marp, reveal.js).

```typescript
import { slides } from 'ai-functions'

// Quick presentation
const deck = await slides`${topic}`

// With structure
const pitch = await slides`investor pitch for ${{ brand, market, traction }}`

// Specify format and style
const presentation = await slides('quarterly business review', {
  format: 'slidev',
  slides: 12,
  style: 'minimal',
})

// From research and analysis
const research = await research`AI market trends 2025`
const analysis = await lists`key insights and recommendations from ${research}`
const deck = await slides`executive presentation${{
  research,
  analysis,
  audience: 'board of directors',
}}`

// Generate with speaker notes
const workshop = await slides`TypeScript workshop${{
  format: 'marp',
  includeNotes: true,
  duration: '2 hours',
}}`
```

---

## `image`

Generate images from text descriptions.

```typescript
import { image } from 'ai-functions'

// Tagged template
const logo = await image`minimalist logo for ${companyName}`
const hero = await image`hero image for ${{ brand, mood, style }}`

// With options
const illustration = await image('robot reading a book', {
  style: 'cartoon',
  size: '1024x1024',
})
```

---

## `video`

Generate videos from text descriptions.

```typescript
import { video } from 'ai-functions'

// Tagged template
const teaser = await video`product demo for ${productName}`
const explainer = await video`explain ${concept} with animations`

// With options
const ad = await video('promotional video for SaaS product', {
  duration: 30,
  aspect: '16:9',
  style: 'motion graphics',
})

// With detailed requirements
const tutorial = await video`coding tutorial${{
  topic: 'Building REST APIs',
  duration: 60,
  style: 'screen recording with voiceover',
  chapters: ['Setup', 'Routes', 'Testing'],
}}`
```

---

## `research`

Agentic research that searches, reads, and synthesizes information.

```typescript
import { research } from 'ai-functions'

// Quick research
const findings = await research`${topic}`

// With depth control
const deep = await research`market size for AI developer tools`({ depth: 'thorough' })

// Returns structured findings
const report = await research`competitor analysis for ${{ company, market }}`
// {
//   summary: 'Key findings...',
//   sources: [{ url, title, relevance }],
//   findings: ['Finding 1', 'Finding 2', ...],
//   confidence: 0.85,
// }

// Chain with other functions
const brand = await ai.storyBrand({ hero: 'developers', guide: 'our product' })
const marketResearch = await research`market validation for ${{ brand }}`
const pitch = await write`investor pitch based on ${{ brand, marketResearch }}`
```

---

## `read`

Fetch and convert a URL to markdown. Powered by Firecrawl.

```typescript
import { read } from 'ai-functions'

// Get markdown from URL
const article = await read`https://example.com/blog/post`

// Read and process
const content = await read`${url}`
const summary = await summarize`${content}`
const keyPoints = await list`main takeaways from ${content}`

// Read multiple pages
const docs = await Promise.all([
  read`https://docs.example.com/intro`,
  read`https://docs.example.com/api`,
  read`https://docs.example.com/examples`,
])
const overview = await write`documentation overview based on ${docs}`
```

---

## `browse`

Browser automation with AI. Navigate, extract, and act. Powered by Stagehand/Browserbase.

```typescript
import { browse } from 'ai-functions'

// Open a page
const page = await browse`https://store.example.com`

// Extract data from the page
const price = await page.extract`price of the first item`
const products = await page.extract`all product names and prices${{
  schema: { name: 'Product name', price: 'Price (number)' }
}}`

// Perform actions
await page.do`click on the first product`
await page.do`add to cart`
await page.do`proceed to checkout`

// Chain browsing with other functions
const page = await browse`https://competitor.com/pricing`
const pricing = await page.extract`all plan names, prices, and features`
const analysis = await generate('competitive analysis', {
  schema: {
    comparison: [{ plan: '...', ourAdvantage: '...', theirAdvantage: '...' }],
    recommendation: '...',
  },
  context: { pricing, ourPricing },
})

// Navigate through multiple pages
const page = await browse`https://news.ycombinator.com`
for await (const title of page.extract`top 10 post titles`) {
  await page.do`click on "${title}"`
  const content = await page.extract`the main content`
  const summary = await summarize`${content}`
  await page.do`go back`
}
```

---

## Magic Proxy

Call any function by name. The AI figures out what you want.

```typescript
import { ai } from 'ai-functions'

// These functions don't exist - they're auto-defined on first call
const trip = await ai.planTrip({
  destination: 'Tokyo',
  dates: { start: '2024-03-01', end: '2024-03-10' },
  travelers: 2,
})

const summary = await ai.summarizeArticle({ text: 'Long article...' })

const competitors = await ai.analyzeCompetitors({ company: 'Acme Corp' })
```

### How It Works

When you call `ai.functionName(args)`:

1. **Analyzes** the function name and arguments
2. **Infers** the expected output structure
3. **Generates** an optimized prompt
4. **Caches** the definition for future calls
5. **Returns** structured, typed results

```typescript
// First call - defines the function
const trip1 = await ai.planTrip({ destination: 'Tokyo', travelers: 2 })

// Second call - uses cached definition (faster)
const trip2 = await ai.planTrip({ destination: 'Paris', travelers: 4 })
```

---

## `AI()` Factory

Create a typed AI instance with predefined schemas.

```typescript
import { AI } from 'ai-functions'

const ai = AI({
  recipe: {
    name: 'Recipe name',
    type: 'food | drink | dessert',
    servings: 'Number of servings (number)',
    ingredients: ['List of ingredients'],
    steps: ['Cooking steps'],
  },
  blogPost: {
    title: 'Post title',
    summary: 'Brief summary',
    sections: [{
      heading: 'Section heading',
      content: 'Section content',
    }],
  },
})

// Fully typed!
const recipe = await ai.recipe('Italian pasta for 4')
// TypeScript knows: { name: string, type: 'food'|'drink'|'dessert', ... }

const post = await ai.blogPost('TypeScript tips')
// TypeScript knows: { title: string, summary: string, sections: [...] }
```

---

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `AI_GATEWAY_URL` | AI Gateway URL |
| `AI_GATEWAY_TOKEN` | Gateway auth token |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |

### Custom Model

```typescript
import { ai } from 'ai-functions'

// Set default model
ai.config({ model: 'gpt-5-1' })

// Or per-call
const result = await ai.summarize({ text: '...' }, { model: 'gemini-3-pro' })
```

---

## Type Architecture

Every AI function is both callable and a tagged template literal. This is powered by a shared type system:

```typescript
// The core callable + taggable type
type AIFunction<TArgs, TReturn> = {
  // Standard call signatures
  (prompt: string): Promise<TReturn>
  (prompt: string, args: TArgs): Promise<TReturn>

  // Tagged template literal
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<TReturn>
}

// Example: is returns boolean
type IsFunction = AIFunction<{ [key: string]: unknown }, boolean>

// Example: list returns string[]
type ListFunction = AIFunction<{ count?: number }, string[]>
```

### Template Value Handling

Interpolated values are processed based on type:

```typescript
// Primitives → toString()
ai`Write about ${topic}`           // "Write about TypeScript"

// Objects → YAML
ai`Analyze ${{ company, market }}` // "Analyze\ncompany: Acme\nmarket: SaaS"

// Arrays → YAML list
ai`Compare ${['React', 'Vue']}`    // "Compare\n- React\n- Vue"
```

### Function Signatures

Each function supports multiple call patterns:

```typescript
// list as example
list`ideas for ${topic}`                    // tagged template
list('startup ideas')                       // string only
list('startup ideas', { count: 10 })        // string + options
list({ prompt: 'ideas', count: 10 })        // options object
```

---

## Related Packages

- [`ai-database`](../ai-database) - AI-powered database operations
- [`ai-providers`](../ai-providers) - Model provider abstraction
- [`language-models`](../language-models) - Model definitions and capabilities
