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

    // GET with query params - execute code
    // e.g., GET /?script=return+1+%2B+1
    // e.g., GET /?script=return+_.chunk([1,2,3],2)&imports=https://esm.sh/lodash
    if (request.method === 'GET' && url.pathname === '/') {
      const script = url.searchParams.get('script') || url.searchParams.get('code')
      const module = url.searchParams.get('module')
      const importsParam = url.searchParams.get('imports')

      // If script or module provided, execute code
      if (script || module) {
        try {
          // Parse imports - can be comma-separated or multiple params
          let imports: string[] | undefined
          if (importsParam) {
            imports = importsParam.includes(',')
              ? importsParam.split(',').map((s) => s.trim())
              : [importsParam]
          }

          const options: EvaluateOptions = {
            script: script || undefined,
            module: module || undefined,
            imports,
          }

          const result = await evaluate(options, env)
          return Response.json(
            {
              $id: request.url,
              $context: url.origin,
              input: {
                script: script || undefined,
                module: module || undefined,
                imports: imports || undefined,
              },
              ...result,
            },
            {
              status: result.success ? 200 : 400,
              headers: corsHeaders,
            }
          )
        } catch (error) {
          return Response.json(
            {
              $id: request.url,
              $context: url.origin,
              success: false,
              error: error instanceof Error ? error.message : 'Invalid request',
              logs: [],
              duration: 0,
            },
            { status: 400, headers: corsHeaders }
          )
        }
      }

      // No script - return API info with clickable examples
      const baseUrl = url.origin
      return Response.json(
        {
          name: 'ai-evaluate',
          version: '2.1.6',
          description: 'Secure code execution in sandboxed Cloudflare Workers',
          endpoints: {
            'GET /?script=...': 'Execute code via query params',
            'POST /': 'Execute code via JSON body',
            'GET /health': 'Health check',
          },
          tryIt: {
            // Basic JavaScript
            math: `${baseUrl}/?script=return+1+%2B+1`,
            variables: `${baseUrl}/?script=const+x+%3D+10%3B+const+y+%3D+20%3B+return+x+*+y`,
            arrays: `${baseUrl}/?script=return+[1,2,3,4,5].map(n+%3D%3E+n+*+2)`,
            objects: `${baseUrl}/?script=return+%7B+name%3A+'eval'%2C+version%3A+'2.1.6'+%7D`,
            functions: `${baseUrl}/?script=const+add+%3D+(a%2Cb)+%3D%3E+a%2Bb%3B+return+add(5%2C3)`,
            async: `${baseUrl}/?script=return+await+Promise.resolve(42)`,
            console: `${baseUrl}/?script=console.log('Hello')%3B+return+'check+logs'`,
            json: `${baseUrl}/?script=return+JSON.parse('%7B%22a%22%3A1%7D')`,
            date: `${baseUrl}/?script=return+new+Date().toISOString()`,
            // npm packages (bare names auto-resolve via esm.sh)
            lodash: `${baseUrl}/?script=return+_.chunk([1,2,3,4,5,6],2)&imports=lodash`,
            lodashMap: `${baseUrl}/?script=return+_.map([1,2,3],n%3D%3En*10)&imports=lodash`,
            dayjs: `${baseUrl}/?script=return+dayjs().format('YYYY-MM-DD')&imports=dayjs`,
            uuid: `${baseUrl}/?script=return+uuid.v4()&imports=uuid`,
            // Versioned packages
            lodashVersioned: `${baseUrl}/?script=return+_.VERSION&imports=lodash@4.17.21`,
            chalk: `${baseUrl}/?script=return+chalk.blue('Hello')&imports=chalk@5`,
            zod: `${baseUrl}/?script=const+schema+%3D+z.string()%3B+return+schema.parse('hello')&imports=zod`,
          },
          curl: {
            get: `curl '${baseUrl}/?script=return+1+%2B+1'`,
            post: `curl -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"script":"return 1 + 1"}'`,
            withImports: `curl -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"script":"return _.chunk([1,2,3,4,5,6],2)","imports":["lodash"]}'`,
            multipleImports: `curl -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"script":"return { chunks: _.chunk([1,2,3,4],2), date: dayjs().format() }","imports":["lodash","dayjs"]}'`,
          },
        },
        { headers: corsHeaders }
      )
    }

    // Execute code endpoint (POST)
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
              $id: request.url,
              $context: url.origin,
              success: false,
              error: 'At least one of script, module, or tests is required',
              logs: [],
              duration: 0,
            },
            { status: 400, headers: corsHeaders }
          )
        }

        const result = await evaluate(options, env)
        return Response.json(
          {
            $id: request.url,
            $context: url.origin,
            input: {
              script: options.script || undefined,
              module: options.module || undefined,
              tests: options.tests || undefined,
              imports: options.imports || undefined,
              timeout: options.timeout || undefined,
              sdk: options.sdk || undefined,
            },
            ...result,
          },
          {
            status: result.success ? 200 : 400,
            headers: corsHeaders,
          }
        )
      } catch (error) {
        return Response.json(
          {
            $id: request.url,
            $context: url.origin,
            success: false,
            error: error instanceof Error ? error.message : 'Invalid request',
            logs: [],
            duration: 0,
          },
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
