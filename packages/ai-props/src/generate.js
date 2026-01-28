/**
 * Props generation for ai-props
 *
 * Core functionality for generating component props using AI.
 *
 * @packageDocumentation
 */
import { generateObject } from 'ai-functions';
import { createCacheKey, getDefaultCache } from './cache.js';
/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
    model: 'anthropic/claude-sonnet-4.5',
    cache: true,
    cacheTTL: 5 * 60 * 1000, // 5 minutes
};
/**
 * Global configuration
 */
let globalConfig = { ...DEFAULT_CONFIG };
/**
 * Configure global AI props settings
 */
export function configureAIProps(config) {
    globalConfig = { ...globalConfig, ...config };
}
/**
 * Get current configuration
 */
export function getConfig() {
    return { ...globalConfig };
}
/**
 * Reset configuration to defaults
 */
export function resetConfig() {
    globalConfig = { ...DEFAULT_CONFIG };
}
/**
 * Resolve a prop schema to a SimpleSchema
 *
 * If the schema is a string, it's treated as a named type
 * that generates a single property or description.
 */
function resolveSchema(schema) {
    if (typeof schema === 'string') {
        // Named type or description string
        return { value: schema };
    }
    return schema;
}
/**
 * Build a prompt from context and schema
 */
function buildPrompt(schema, context, additionalPrompt) {
    const parts = [];
    // Add context information
    if (context && Object.keys(context).length > 0) {
        parts.push('Given the following context:');
        parts.push(JSON.stringify(context, null, 2));
        parts.push('');
    }
    // Add schema information
    if (typeof schema === 'string') {
        parts.push(`Generate a value for: ${schema}`);
    }
    else {
        parts.push('Generate props matching the schema.');
    }
    // Add additional prompt
    if (additionalPrompt) {
        parts.push('');
        parts.push(additionalPrompt);
    }
    return parts.join('\n');
}
/**
 * Generate props using AI
 *
 * @example
 * ```ts
 * const result = await generateProps({
 *   schema: {
 *     title: 'A compelling page title',
 *     description: 'A brief description',
 *     keywords: ['Relevant SEO keywords'],
 *   },
 *   context: { topic: 'AI-powered applications' },
 * })
 *
 * console.log(result.props)
 * // { title: '...', description: '...', keywords: [...] }
 * ```
 */
export async function generateProps(options) {
    const { schema, context, prompt, model, system } = options;
    const config = getConfig();
    const startTime = Date.now();
    // Check cache
    if (config.cache) {
        const cache = getDefaultCache();
        const cacheKey = createCacheKey(schema, context);
        const cached = cache.get(cacheKey);
        if (cached) {
            return {
                props: cached.props,
                cached: true,
                metadata: {
                    model: config.model || 'cached',
                },
            };
        }
    }
    // Resolve schema
    const resolvedSchema = resolveSchema(schema);
    // Build prompt
    const fullPrompt = buildPrompt(schema, context, prompt);
    // Use custom generator if provided
    if (config.generate) {
        const props = await config.generate(resolvedSchema, context || {});
        return {
            props,
            cached: false,
            metadata: {
                model: 'custom',
                duration: Date.now() - startTime,
            },
        };
    }
    // Generate using AI
    const result = await generateObject({
        model: model || config.model,
        schema: resolvedSchema,
        prompt: fullPrompt,
        system: system || config.system,
    });
    const props = result.object;
    // Cache result
    if (config.cache) {
        const cache = getDefaultCache();
        const cacheKey = createCacheKey(schema, context);
        cache.set(cacheKey, props);
    }
    return {
        props,
        cached: false,
        metadata: {
            model: model || config.model,
            duration: Date.now() - startTime,
        },
    };
}
/**
 * Generate props synchronously from cache or throw
 *
 * Useful for SSR scenarios where async isn't available.
 * Throws if props aren't in cache.
 */
export function getPropsSync(schema, context) {
    const cache = getDefaultCache();
    const cacheKey = createCacheKey(schema, context);
    const cached = cache.get(cacheKey);
    if (!cached) {
        throw new Error('Props not in cache. Use generateProps() first or ensure caching is enabled.');
    }
    return cached.props;
}
/**
 * Pre-generate props for warming the cache
 *
 * @example
 * ```ts
 * await prefetchProps([
 *   { schema: userProfileSchema, context: { userId: '123' } },
 *   { schema: productSchema, context: { category: 'electronics' } },
 * ])
 * ```
 */
export async function prefetchProps(requests) {
    await Promise.all(requests.map(generateProps));
}
/**
 * Generate multiple prop sets in parallel
 */
export async function generatePropsMany(requests) {
    return Promise.all(requests.map(req => generateProps(req)));
}
/**
 * Merge partial props with generated props
 *
 * Generates only the missing props, keeping provided ones.
 */
export async function mergeWithGenerated(schema, partialProps, options) {
    // Get list of missing keys
    const schemaObj = typeof schema === 'string' ? { value: schema } : schema;
    const schemaKeys = Object.keys(schemaObj);
    const providedKeys = Object.keys(partialProps);
    const missingKeys = schemaKeys.filter(k => !providedKeys.includes(k));
    // If all props are provided, return as-is
    if (missingKeys.length === 0) {
        return partialProps;
    }
    // Build partial schema for missing props only
    const partialSchema = {};
    for (const key of missingKeys) {
        partialSchema[key] = schemaObj[key];
    }
    // Generate missing props
    const result = await generateProps({
        schema: partialSchema,
        context: partialProps,
        ...options,
    });
    // Merge
    return {
        ...result.props,
        ...partialProps,
    };
}
