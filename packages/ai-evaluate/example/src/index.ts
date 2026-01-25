/**
 * ai-evaluate REST API Worker
 *
 * Deploy: wrangler deploy
 * Domain: eval.workers.do
 *
 * Endpoints:
 * - POST / - Execute code (accepts { script?, module?, tests?, imports? })
 * - GET /health - Health check
 */

import { evaluate, type SandboxEnv, type EvaluateOptions, type EvaluateResult } from 'ai-evaluate'

interface Env extends SandboxEnv {
  loader: unknown
}

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/healthz') {
      return Response.json(
        {
          status: 'ok',
          service: 'ai-evaluate',
          version: '2.1.6',
          timestamp: new Date().toISOString(),
        },
        { headers: corsHeaders }
      )
    }

    // Info endpoint
    if (request.method === 'GET' && url.pathname === '/') {
      return Response.json(
        {
          name: 'ai-evaluate',
          version: '2.1.6',
          description: 'Secure code execution in sandboxed Cloudflare Workers',
          endpoints: {
            'POST /': 'Execute code',
            'GET /health': 'Health check',
          },
          example: {
            simple: { script: 'return 1 + 1' },
            module: {
              module: 'export const add = (a, b) => a + b',
              script: 'return add(2, 3)',
            },
            withTests: {
              module: 'export const add = (a, b) => a + b',
              tests: `
                describe('add', () => {
                  it('adds two numbers', () => {
                    expect(add(1, 2)).toBe(3)
                  })
                })
              `,
              sdk: true,
            },
            withImports: {
              script: 'return _.chunk([1, 2, 3, 4, 5], 2)',
              imports: ['https://esm.sh/lodash@4.17.21'],
            },
          },
        },
        { headers: corsHeaders }
      )
    }

    // Execute code endpoint
    if (request.method === 'POST') {
      try {
        const body = (await request.json()) as Partial<EvaluateOptions> & { code?: string }

        // Support both simple { code } and full { module, tests, script }
        const options: EvaluateOptions = {
          module: body.module,
          tests: body.tests,
          script: body.script || body.code,
          timeout: body.timeout,
          imports: body.imports,
          sdk: body.sdk,
          fetch: body.fetch,
        }

        // Validate that at least one of script/module/tests is provided
        if (!options.script && !options.module && !options.tests) {
          return Response.json(
            {
              success: false,
              error: 'At least one of script, module, or tests is required',
              logs: [],
              duration: 0,
            } as EvaluateResult,
            { status: 400, headers: corsHeaders }
          )
        }

        const result = await evaluate(options, env)
        return Response.json(result, {
          status: result.success ? 200 : 400,
          headers: corsHeaders,
        })
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Invalid request',
            logs: [],
            duration: 0,
          } as EvaluateResult,
          { status: 400, headers: corsHeaders }
        )
      }
    }

    // 404 for unknown routes
    return Response.json(
      { error: 'Not found', path: url.pathname },
      { status: 404, headers: corsHeaders }
    )
  },
}
