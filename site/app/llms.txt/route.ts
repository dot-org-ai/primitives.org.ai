import { source } from '@/lib/source'

export const revalidate = false

export async function GET() {
  const baseUrl = process.env['NEXT_PUBLIC_BASE_URL'] || 'https://primitives.org.ai'

  const pages = source.getPages()
  const pageList = pages
    .map((page) => `- [${page.data.title}](${baseUrl}${page.url}): ${page.data.description || ''}`)
    .join('\n')

  const content = `# Primitives.org.ai

> The fundamental abstractions for building AI-native software.

Primitives.org.ai provides seven core primitives that compose together to build anything—from simple functions to entire businesses.

## Core Primitives

- **Function**: The atomic unit of computation with four types: Code, Generative, Agentic, and Human.
- **Database**: Persistent state for structured data and vector embeddings.
- **Workflow**: Orchestrate complex processes with durable execution or state machines.
- **Agent**: Truly autonomous entities with real identity and long-term memory.
- **Product**: Compose primitives into complete products with declarative interfaces.
- **Service**: Services-as-Software—AI delivering work traditionally done by humans.
- **Business**: Business-as-Code—traditional processes manifested as code.

## Documentation

${pageList}

## Full Documentation

For the complete documentation in a single file, see: ${baseUrl}/llms-full.txt
`

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
