/**
 * ai-evaluate Example Worker
 *
 * Deploy: npx wrangler deploy
 * Test: curl -X POST https://your-worker.workers.dev -d '{"code":"1+1"}'
 */

import { evaluate, createEvaluator } from 'ai-evaluate'

interface Env {
  loader: unknown
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers })
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'POST required' }), {
        status: 405,
        headers,
      })
    }

    try {
      const body = (await request.json()) as {
        code?: string
        module?: string
        tests?: string
        script?: string
      }

      // Support both simple { code } and full { module, tests, script }
      const result = await evaluate(
        {
          module: body.module,
          tests: body.tests,
          script: body.script || body.code,
        },
        env
      )

      return new Response(JSON.stringify(result, null, 2), { headers })
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Invalid request',
        }),
        {
          status: 400,
          headers,
        }
      )
    }
  },
}
