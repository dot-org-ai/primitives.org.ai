# ai-functions TODO

Changes from README that need implementation in tests/code.

## Function Types System

- [ ] Implement 4 function types: `Generative`, `Code`, `Agentic`, `Human`
- [ ] Type inference from function name + argument names + argument values
- [ ] Subjective judgment (e.g., `processRefund({ amount: 12.99 })` vs `amount: 50000`)

## Core Architecture

- [ ] `generate(type, prompt, opts?)` as the core primitive
  - [ ] Types: `json`, `text`, `code`, `list`, `extract`, `summary`, `diagram`, `slides`, `markdown`, `yaml`, `xml`
  - [ ] Schema support for `json` type
  - [ ] All other functions call `generate` under the hood
- [ ] `define(name, schema)` - foundation function
  - [ ] Infers function type from name + args
  - [ ] Creates appropriate function (Generative, Code, Agentic, Human)
  - [ ] Caches definition for subsequent calls
- [ ] `AI({ schemas })` factory for typed instances

## Tagged Template Support

- [ ] Every function supports tagged template syntax
- [ ] Objects/arrays in templates auto-stringify to YAML
- [ ] Template + options chaining: ``fn`prompt`({ model: '...' })``

## Standalone Exports

All functions exported directly (not just on `ai` object):

- [ ] `ai` - text generation
- [ ] `summarize` - condense text
- [ ] `do` - single-pass task executor with tools (not agentic loop)
- [ ] `is` - boolean classification
- [ ] `list` - generate list
- [ ] `lists` - multiple named lists
- [ ] `extract` - extract from text
- [ ] `write` - generate content
- [ ] `generate` - core primitive
- [ ] `decide` - LLM as judge, picks from options
- [ ] `code` - generate code
- [ ] `diagram` - generate diagrams (mermaid, etc.)
- [ ] `slides` - generate presentations (slidev, marp, reveal.js)
- [ ] `image` - generate images
- [ ] `video` - generate videos
- [ ] `research` - agentic research
- [ ] `read` - URL to markdown (Firecrawl)
- [ ] `browse` - browser automation (Stagehand/Browserbase)
  - [ ] `page.extract` - extract data from page
  - [ ] `page.do` - perform action on page

## Magic Proxy (`ai.*`)

- [ ] `ai.anyFunctionName(args)` auto-defines on first call
- [ ] Infers function type from name + args
- [ ] Examples:
  - [ ] `ai.fizzBuzz()` → CodeFunction
  - [ ] `ai.storyBrand()` → GenerativeFunction with schema
  - [ ] `ai.launchProductHunt()` → AgenticFunction
  - [ ] `ai.approveExpense()` → HumanFunction

## Human Functions

- [ ] `ask` - ask human a question
- [ ] `approve` - request human approval
- [ ] `review` - request human review
- [ ] Integration with `human-in-the-loop`, `digital-workers`, `autonomous-agents` packages

## Async Iterators

- [ ] `list` returns `AsyncIterable` for streaming
- [ ] `extract` returns `AsyncIterable` for streaming
- [ ] `for await (const item of list`...`)` pattern
- [ ] Early termination with `break`

## `decide` - LLM as Judge

- [ ] Syntax: ``decide`criteria`(optionA, optionB, ...)``
- [ ] Returns the winning option (same type as inputs)
- [ ] Type-safe: passing `Product` objects returns `Product`

## Options Parameter

Every function accepts options as last parameter:

- [ ] `model` - model selection
- [ ] `thinking` - `'low' | 'medium' | 'high' | number` (token budget)
- [ ] `temperature`
- [ ] `maxTokens`

## Batch & Background Processing

- [ ] Background mode: `{ mode: 'background' }` returns job immediately
  - [ ] `job.result()` to get result later
  - [ ] `job.status` for status
- [ ] Batch mode: `fn.batch([contexts])`
  - [ ] Better pricing (50% off on OpenAI)
  - [ ] Processes all at once
- [ ] Batch streaming: `fn.batch.stream([contexts])`
  - [ ] `for await` as results complete

## Integration with Other Packages

- [ ] `ai-sandbox` - `evaluate({ code, tests, module, script })` for CodeFunctions
- [ ] `ai-database` - `embed` moved there, used by `db.search()`
- [ ] `ai-providers` / `language-models` - model resolution
- [ ] `human-in-the-loop` - Human function implementation
- [ ] `autonomous-agents` - Agent loop (vs single-pass `do`)

## Type System

- [ ] `AIFunction<TArgs, TReturn>` - callable + tagged template
- [ ] Schema syntax parsing:
  - [ ] `'description'` → string
  - [ ] `'desc (number)'` → number
  - [ ] `'desc (boolean)'` → boolean
  - [ ] `'opt1 | opt2'` → enum
  - [ ] `['description']` → array
  - [ ] `{ nested }` → object
- [ ] Type inference for `AI()` factory schemas

## Tests to Write

- [ ] Tagged template parsing and YAML conversion
- [ ] Each function type (Generative, Code, Agentic, Human)
- [ ] Function type inference from name + args
- [ ] `generate` with all type options
- [ ] `define` creating correct function types
- [ ] Magic proxy auto-definition
- [ ] Async iterators on `list` and `extract`
- [ ] `decide` returning correct option
- [ ] Batch and background modes
- [ ] Options parameter (model, thinking, etc.)
- [ ] `browse` with `page.extract` and `page.do`
- [ ] `read` URL fetching
- [ ] `research` agentic flow
