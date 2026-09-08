/**
 * ai-evaluate REST API Worker
 *
 * Deploy: wrangler deploy
 * Domain: eval.workers.do
 *
 * Endpoints:
 * - POST / - Execute code: an EvaluateOptions JSON body (script / module /
 *   tests, dependencies, limits, compatibilityFlags, isolation, jsx, facet +
 *   sandboxId, ...) - see `POST_OPTIONS` for what is forwarded
 * - GET /?script=... - Execute code via query params
 * - GET /health - Health check
 *
 * ai-evaluate 3.0: the host env carries exactly `loader` (worker_loaders);
 * fetch allowlists go through the exported OutboundGateway, facets through
 * the exported SandboxHost Durable Object, and every evaluation's trace
 * events reach the TailLogger tail worker bound as `env.TAIL`.
 */

import { WorkerEntrypoint } from 'cloudflare:workers'
import {
  evaluate,
  VERSION,
  type SandboxEnv,
  type EvaluateOptions,
  type EvaluateResult,
  type WorkerLoader,
} from 'ai-evaluate'

// The host worker's own entrypoints, which evaluate() reaches through
// ctx.exports: OutboundGateway serves fetch allowlists / outboundRpc as the
// sandbox's globalOutbound; SandboxHost is the Durable Object (declared in
// wrangler.jsonc) that owns the per-sandbox facets of { facet, sandboxId }.
export { OutboundGateway, SandboxHost } from 'ai-evaluate/worker'

/**
 * Tail worker for the sandboxes: bound to this worker as `env.TAIL`
 * (wrangler.jsonc `services`) and passed as `tails: [env.TAIL]`, so each
 * loaded worker's trace events - console output, exceptions, outcome - arrive
 * here after the request, where `wrangler tail` shows them.
 */
export class TailLogger extends WorkerEntrypoint {
  tail(events: TraceItem[]): void {
    for (const event of events) {
      console.log(
        JSON.stringify({
          tail: 'sandbox',
          outcome: event.outcome,
          logs: event.logs.map((log) => ({ level: log.level, message: log.message })),
          exceptions: event.exceptions.map((error) => ({
            name: error.name,
            message: error.message,
          })),
        })
      )
    }
  }
}

interface Env extends SandboxEnv {
  /** worker_loaders binding (`"binding": "loader"`) - required on this host */
  loader: WorkerLoader
  /** The TailLogger service binding; optional so `wrangler dev` without it still runs */
  TAIL?: unknown
}

/**
 * The EvaluateOptions a POST body may set. Everything else on EvaluateOptions
 * cannot cross JSON (`bindings` and `tails` are stubs, `outboundRpc` is a
 * function) or is not for callers to choose (`bundler`).
 */
const POST_OPTIONS = [
  'module',
  'tests',
  'script',
  'jsx',
  'timeout',
  'limits',
  'compatibilityFlags',
  'compatibilityDate',
  'env',
  'sdk',
  'fetch',
  'dependencies',
  'imports',
  'modules',
  'isolation',
  'facet',
  'sandboxId',
] as const satisfies readonly (keyof EvaluateOptions)[]

type PostOption = (typeof POST_OPTIONS)[number]

/** Pick the forwardable options out of a POST body (`code` is an alias of `script`) */
function optionsFromBody(body: Partial<EvaluateOptions> & { code?: string }): EvaluateOptions {
  const options: EvaluateOptions = {}
  for (const key of POST_OPTIONS) {
    if (body[key] !== undefined) {
      ;(options as Record<PostOption, unknown>)[key] = body[key]
    }
  }
  if (options.script === undefined && body.code !== undefined) options.script = body.code
  return options
}

/** Run one evaluation on this host, with the tail worker attached when bound */
function run(options: EvaluateOptions, env: Env): Promise<EvaluateResult> {
  return evaluate(env.TAIL ? { ...options, tails: [env.TAIL] } : options, env)
}

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

function errorResponse(request: Request, url: URL, error: unknown, status = 400): Response {
  return Response.json(
    {
      $id: request.url,
      $context: url.origin,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      logs: [],
      duration: 0,
    },
    { status, headers: corsHeaders }
  )
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
          version: VERSION,
          timestamp: new Date().toISOString(),
        },
        { headers: corsHeaders }
      )
    }

    // GET with query params - execute code
    // e.g., GET /?script=return+1+%2B+1
    // e.g., GET /?script=return+_.chunk([1,2,3],2)&imports=lodash
    if (request.method === 'GET' && url.pathname === '/') {
      const script = url.searchParams.get('script') || url.searchParams.get('code')
      const module = url.searchParams.get('module')
      const importsParam = url.searchParams.get('imports')

      // If script or module provided, execute code
      if (script || module) {
        try {
          // `imports` (deprecated in 3.0, kept for GET convenience): packages
          // as globals, comma-separated. POST bodies should use `dependencies`
          // with real import syntax instead.
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

          const result = await run(options, env)
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
          return errorResponse(request, url, error)
        }
      }

      // No script - return API info with clickable examples
      const baseUrl = url.origin
      return Response.json(
        {
          name: 'ai-evaluate',
          version: VERSION,
          description: 'Secure code execution in sandboxed Cloudflare Workers',
          endpoints: {
            'GET /?script=...': 'Execute code via query params',
            'POST /': 'Execute code via JSON body (EvaluateOptions)',
            'GET /health': 'Health check',
          },
          tryIt: {
            // Basic JavaScript
            math: `${baseUrl}/?script=return+1+%2B+1`,
            variables: `${baseUrl}/?script=const+x+%3D+10%3B+const+y+%3D+20%3B+return+x+*+y`,
            arrays: `${baseUrl}/?script=return+[1,2,3,4,5].map(n+%3D%3E+n+*+2)`,
            objects: `${baseUrl}/?script=return+%7B+name%3A+'eval'%2C+version%3A+'${VERSION}'+%7D`,
            functions: `${baseUrl}/?script=const+add+%3D+(a%2Cb)+%3D%3E+a%2Bb%3B+return+add(5%2C3)`,
            async: `${baseUrl}/?script=return+await+Promise.resolve(42)`,
            console: `${baseUrl}/?script=console.log('Hello')%3B+return+'check+logs'`,
            json: `${baseUrl}/?script=return+JSON.parse('%7B%22a%22%3A1%7D')`,
            date: `${baseUrl}/?script=return+new+Date().toISOString()`,
            // npm packages as globals (`imports`, deprecated: prefer POST with `dependencies`)
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
            dependencies: `curl -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"script":"import { chunk } from \\"lodash\\"; return chunk([1,2,3,4,5,6],2)","dependencies":{"lodash":"4.17.21"}}'`,
            moduleAndScript: `curl -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"module":"import dayjs from \\"dayjs\\"; export const today = () => dayjs().format(\\"YYYY-MM-DD\\")","script":"return today()","dependencies":{"dayjs":"1.11.10"}}'`,
            limits: `curl -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"script":"return Buffer.from(\\"hi\\").toString(\\"base64\\")","compatibilityFlags":["nodejs_compat"],"limits":{"cpuMs":50,"subrequests":2}}'`,
            allowlist: `curl -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"script":"return (await fetch(\\"https://example.com\\")).status","fetch":["example.com"]}'`,
            jsx: `curl -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"script":"const h = (t, p, ...c) => ({ t, p, c }); return <div id=\\"x\\">hi</div>"}'`,
            facet: `curl -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"module":"export class State { constructor(ctx) { this.sql = ctx.storage.sql; this.sql.exec(\\"CREATE TABLE IF NOT EXISTS c (n INTEGER)\\") } incr() { const n = (this.sql.exec(\\"SELECT n FROM c\\").toArray()[0]?.n ?? 0) + 1; this.sql.exec(\\"DELETE FROM c\\"); this.sql.exec(\\"INSERT INTO c (n) VALUES (?)\\", n); return n } }","script":"return await env.STATE.incr()","facet":{"class":"State"},"sandboxId":"demo"}'`,
            cached: `curl -X POST ${baseUrl} -H 'Content-Type: application/json' -d '{"module":"let n = 0; export const inc = () => ++n","script":"return inc()","isolation":"cached"}'`,
          },
        },
        { headers: corsHeaders }
      )
    }

    // Execute code endpoint (POST)
    if (request.method === 'POST') {
      try {
        const body = (await request.json()) as Partial<EvaluateOptions> & { code?: string }
        const options = optionsFromBody(body)

        // Validate that at least one of script/module/tests is provided
        if (!options.script && !options.module && !options.tests) {
          return errorResponse(request, url, 'At least one of script, module, or tests is required')
        }

        const result = await run(options, env)
        return Response.json(
          {
            $id: request.url,
            $context: url.origin,
            input: options,
            ...result,
          },
          {
            status: result.success ? 200 : 400,
            headers: corsHeaders,
          }
        )
      } catch (error) {
        return errorResponse(request, url, error)
      }
    }

    // 404 for unknown routes
    return Response.json(
      { error: 'Not found', path: url.pathname },
      { status: 404, headers: corsHeaders }
    )
  },
}
