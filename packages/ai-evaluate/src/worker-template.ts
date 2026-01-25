/**
 * Worker template for sandbox execution
 *
 * This code is stringified and sent to the worker loader.
 * It uses the TEST service binding (ai-tests) for assertions and test running.
 *
 * The user's code (module, tests, script) is embedded directly into
 * the worker source - no eval() or new Function() needed. The security
 * comes from running in an isolated V8 context via worker_loaders.
 *
 * Routes:
 * - POST /execute - Run tests and scripts, return results
 * - POST /rpc or WebSocket upgrade - capnweb RPC to module exports
 * - GET / - Return info about available exports
 */

import type { SDKConfig } from './types.js'

/**
 * Generate SDK code for injection into sandbox
 *
 * Supports two modes:
 * - local: In-memory implementations (for testing without network)
 * - remote: RPC-based implementations (for production/integration tests)
 */
function generateSDKCode(config: SDKConfig = {}): string {
  // Use local mode by default for sandboxed execution
  if (config.context === 'remote') {
    return generateRemoteSDKCode(config)
  }
  return generateLocalSDKCode(config)
}

/**
 * Generate local SDK code with in-memory implementations
 *
 * Implements APIs that align with ai-database (MemoryDB) and ai-workflows:
 * - MongoDB-style query operators ($gt, $gte, $lt, $in, $regex, etc.)
 * - URL resolution and identifier parsing
 * - upsert, generate, forEach methods
 * - Typed collection accessors (db.Users.find(), etc.)
 * - Workflow event/schedule patterns
 */
function generateLocalSDKCode(config: SDKConfig = {}): string {
  const ns = config.ns || 'default'
  const aiGatewayUrl = config.aiGatewayUrl || ''
  const aiGatewayToken = config.aiGatewayToken || ''

  return `
// ============================================================
// Local SDK - In-memory implementation (aligned with ai-database/ai-workflows)
// ============================================================

const __SDK_CONFIG__ = {
  ns: '${ns}',
  aiGatewayUrl: '${aiGatewayUrl}',
  aiGatewayToken: '${aiGatewayToken}'
};

// In-memory database storage (mirrors MemoryDB structure)
const __db_things__ = new Map();
const __db_relationships__ = new Map();
// Indexes for efficient lookups
const __db_byUrl__ = new Map();
const __db_byNsType__ = new Map();
const __db_relFrom__ = new Map();
const __db_relTo__ = new Map();

// ID generator (crypto.randomUUID not available in all environments)
const __generateId__ = () => {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
};

// URL resolution (mirrors ai-database resolveUrl)
const __resolveUrl__ = (entity) => {
  if (entity.url) return entity.url;
  return 'https://' + entity.ns + '/' + entity.type + '/' + entity.id;
};

// Parse identifier (mirrors ai-database parseIdentifier)
const __parseIdentifier__ = (identifier, defaults = {}) => {
  if (identifier.includes('://')) {
    try {
      const parsed = new URL(identifier);
      const parts = parsed.pathname.split('/').filter(Boolean);
      return {
        ns: parsed.host,
        type: parts[0] || '',
        id: parts.slice(1).join('/') || '',
        url: identifier
      };
    } catch { return { ns: defaults.ns, id: identifier }; }
  }
  if (identifier.includes('/')) {
    const parts = identifier.split('/');
    return { ns: defaults.ns, type: parts[0], id: parts.slice(1).join('/') };
  }
  return { ns: defaults.ns, type: defaults.type, id: identifier };
};

// Extract mdxld metadata from data object
const __extractType__ = (data) => data && (data.$type || data['@type']);
const __extractId__ = (data) => data && (data.$id || data['@id']);
const __extractContext__ = (data) => data && (data.$context || data['@context']);

// Index management
const __indexThing__ = (thing) => {
  const url = __resolveUrl__(thing);
  __db_byUrl__.set(url, thing);
  const nsTypeKey = thing.ns + '/' + thing.type;
  if (!__db_byNsType__.has(nsTypeKey)) __db_byNsType__.set(nsTypeKey, new Set());
  __db_byNsType__.get(nsTypeKey).add(url);
};
const __unindexThing__ = (thing) => {
  const url = __resolveUrl__(thing);
  __db_byUrl__.delete(url);
  const nsTypeKey = thing.ns + '/' + thing.type;
  const set = __db_byNsType__.get(nsTypeKey);
  if (set) set.delete(url);
};
const __indexRelationship__ = (rel) => {
  if (!__db_relFrom__.has(rel.from)) __db_relFrom__.set(rel.from, new Set());
  __db_relFrom__.get(rel.from).add(rel.id);
  if (!__db_relTo__.has(rel.to)) __db_relTo__.set(rel.to, new Set());
  __db_relTo__.get(rel.to).add(rel.id);
};
const __unindexRelationship__ = (rel) => {
  const fromSet = __db_relFrom__.get(rel.from);
  if (fromSet) fromSet.delete(rel.id);
  const toSet = __db_relTo__.get(rel.to);
  if (toSet) toSet.delete(rel.id);
};

// MongoDB-style query matching (mirrors MemoryDB.matchesQuery)
const __matchesQuery__ = (thing, options) => {
  if (options.ns && thing.ns !== options.ns) return false;
  if (options.type && thing.type !== options.type) return false;
  if (options.where) {
    for (const [key, value] of Object.entries(options.where)) {
      const thingValue = thing.data[key];
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        for (const [op, opVal] of Object.entries(value)) {
          switch (op) {
            case '$gt': if (!(thingValue > opVal)) return false; break;
            case '$gte': if (!(thingValue >= opVal)) return false; break;
            case '$lt': if (!(thingValue < opVal)) return false; break;
            case '$lte': if (!(thingValue <= opVal)) return false; break;
            case '$ne': if (thingValue === opVal) return false; break;
            case '$in': if (!Array.isArray(opVal) || !opVal.includes(thingValue)) return false; break;
            case '$nin': if (Array.isArray(opVal) && opVal.includes(thingValue)) return false; break;
            case '$exists': if (opVal && thingValue === undefined) return false; if (!opVal && thingValue !== undefined) return false; break;
            case '$regex': if (typeof thingValue !== 'string') return false; const regex = typeof opVal === 'string' ? new RegExp(opVal) : opVal; if (!regex.test(thingValue)) return false; break;
            default: if (thingValue !== value) return false;
          }
        }
      } else if (thingValue !== value) return false;
    }
  }
  return true;
};

// Apply query options (sort, limit, offset)
const __applyQueryOptions__ = (items, options) => {
  let result = [...items];
  if (options.orderBy) {
    const field = options.orderBy;
    const dir = options.order === 'desc' ? -1 : 1;
    result.sort((a, b) => {
      const aVal = a[field] ?? a.data?.[field];
      const bVal = b[field] ?? b.data?.[field];
      if (aVal === undefined && bVal === undefined) return 0;
      if (aVal === undefined) return dir;
      if (bVal === undefined) return -dir;
      if (aVal < bVal) return -dir;
      if (aVal > bVal) return dir;
      return 0;
    });
  }
  if (options.offset) result = result.slice(options.offset);
  if (options.limit) result = result.slice(0, options.limit);
  return result;
};

// Cosine similarity helper for semantic search
const __cosineSimilarity__ = (a, b) => {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
};

// Embedding cache for semantic search (stores URL -> embedding)
const __embeddings__ = new Map();

// AI embed helper for semantic search - defined early so __db_core__.search can use it
// Uses Gemini embedding model (768 dimensions) through AI Gateway
const __aiEmbed__ = async (text) => {
  if (!__SDK_CONFIG__.aiGatewayUrl) return [];
  try {
    const url = __SDK_CONFIG__.aiGatewayUrl + '/google-ai-studio/v1beta/models/gemini-embedding-001:embedContent';
    const headers = { 'Content-Type': 'application/json' };
    if (__SDK_CONFIG__.aiGatewayToken) {
      headers['cf-aig-authorization'] = 'Bearer ' + __SDK_CONFIG__.aiGatewayToken;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: 768
      })
    });
    if (!response.ok) return [];
    const result = await response.json();
    return result.embedding?.values || [];
  } catch (err) {
    console.warn('Embedding failed:', err.message);
    return [];
  }
};

// Local DB implementation (aligned with ai-database DBClient interface)
const __db_core__ = {
  ns: __SDK_CONFIG__.ns,

  async list(options = {}) {
    const results = [];
    for (const thing of __db_things__.values()) {
      if (__matchesQuery__(thing, options)) results.push(thing);
    }
    return __applyQueryOptions__(results, options);
  },

  async find(options = {}) {
    return this.list(options);
  },

  async search(options = {}) {
    const query = (options.query || '').toLowerCase();
    const fields = options.fields || ['data'];
    const minScore = options.minScore || 0;
    const results = [];

    // Semantic search using embeddings
    if (options.semantic && typeof __aiEmbed__ === 'function') {
      const queryEmbedding = await __aiEmbed__(options.query || '');
      if (!queryEmbedding || queryEmbedding.length === 0) {
        // Embedding failed - return text-based results sorted by relevance
        // This handles cases where AI Gateway auth isn't configured
        console.warn('Semantic search: embeddings unavailable, using fuzzy text matching');
        const queryTerms = (options.query || '').toLowerCase().split(/\\s+/);
        const textResults = [];
        for (const thing of __db_things__.values()) {
          if (!__matchesQuery__(thing, options)) continue;
          const content = JSON.stringify(thing.data).toLowerCase();
          // Score based on how many query terms appear in the content
          let score = 0;
          for (const term of queryTerms) {
            if (content.includes(term)) score += 1;
            // Bonus for partial matches
            for (const word of content.split(/[\\s\\W]+/)) {
              if (word.includes(term) || term.includes(word)) score += 0.1;
            }
          }
          if (score > 0) textResults.push({ thing, score });
        }
        textResults.sort((a, b) => b.score - a.score);
        return __applyQueryOptions__(textResults.map(r => r.thing), options);
      }

      for (const thing of __db_things__.values()) {
        if (!__matchesQuery__(thing, options)) continue;

        // Get or compute embedding for this thing
        const thingUrl = thing.url || thing.id;
        let thingEmbedding = __embeddings__.get(thingUrl);

        if (!thingEmbedding) {
          const textContent = JSON.stringify(thing.data);
          thingEmbedding = await __aiEmbed__(textContent);
          if (thingEmbedding && thingEmbedding.length > 0) {
            __embeddings__.set(thingUrl, thingEmbedding);
          }
        }

        if (thingEmbedding && thingEmbedding.length > 0) {
          const score = __cosineSimilarity__(queryEmbedding, thingEmbedding);
          if (score >= minScore) results.push({ thing, score });
        }
      }

      results.sort((a, b) => b.score - a.score);
      return __applyQueryOptions__(results.map(r => r.thing), options);
    }

    // Text-based search
    for (const thing of __db_things__.values()) {
      if (!__matchesQuery__(thing, options)) continue;
      const searchIn = fields.includes('data')
        ? JSON.stringify(thing.data).toLowerCase()
        : fields.map(f => String(thing[f] || '')).join(' ').toLowerCase();
      if (searchIn.includes(query)) {
        const index = searchIn.indexOf(query);
        const score = 1 - (index / searchIn.length);
        if (score >= minScore) results.push({ thing, score });
      }
    }
    results.sort((a, b) => b.score - a.score);
    return __applyQueryOptions__(results.map(r => r.thing), options);
  },

  async get(identifier, options = {}) {
    let url;
    try {
      const parsed = __parseIdentifier__(identifier, { ns: __SDK_CONFIG__.ns });
      if (parsed.url) url = parsed.url;
      else if (parsed.ns && parsed.type && parsed.id) url = 'https://' + parsed.ns + '/' + parsed.type + '/' + parsed.id;
      else if (parsed.ns && parsed.id) {
        for (const [thingUrl, thing] of __db_byUrl__) {
          if (thing.ns === parsed.ns && thing.id === parsed.id) return thing;
        }
      }
    } catch { }
    if (url) {
      const thing = __db_byUrl__.get(url);
      if (thing) return thing;
    }
    // Try by ID across all things
    for (const thing of __db_things__.values()) {
      if (thing.id === identifier || thing.url === identifier) return thing;
    }
    // Handle create/generate options
    if (options.create || options.generate) {
      const parsed = __parseIdentifier__(identifier, { ns: __SDK_CONFIG__.ns });
      if (options.generate) return this.generate(identifier, typeof options.generate === 'object' ? options.generate : {});
      const data = typeof options.create === 'object' ? options.create : {};
      // Prioritize $type from data over URL-derived type
      const type = __extractType__(data) || parsed.type || 'Thing';
      const id = parsed.id || __extractId__(data) || __generateId__();
      return this.create({ ns: parsed.ns || __SDK_CONFIG__.ns, type, id, data });
    }
    return null;
  },

  async set(url, data) {
    const existing = __db_byUrl__.get(url);
    if (existing) {
      existing.data = data;
      existing.updatedAt = new Date();
      return existing;
    }
    const parsed = __parseIdentifier__(url, { ns: __SDK_CONFIG__.ns });
    const thing = {
      ns: parsed.ns || __SDK_CONFIG__.ns,
      type: parsed.type || '',
      id: parsed.id || __generateId__(),
      url,
      createdAt: new Date(),
      updatedAt: new Date(),
      data
    };
    __db_things__.set(url, thing);
    __indexThing__(thing);
    return thing;
  },

  async create(urlOrOptions, dataArg) {
    // URL-first syntax: create('https://...', { $type: 'Post', ... })
    if (typeof urlOrOptions === 'string') {
      const url = urlOrOptions;
      const data = dataArg || {};
      const parsed = __parseIdentifier__(url, { ns: __SDK_CONFIG__.ns });
      // Prioritize $type from data over URL-derived type
      const type = __extractType__(data) || parsed.type || 'Thing';
      const id = parsed.id || __extractId__(data) || __generateId__();
      const context = __extractContext__(data);
      const ns = parsed.ns || __SDK_CONFIG__.ns;
      const cleanData = { ...data };
      delete cleanData.$type; delete cleanData.$id; delete cleanData.$context;
      delete cleanData['@type']; delete cleanData['@id']; delete cleanData['@context'];
      const thingUrl = parsed.url || 'https://' + ns + '/' + type + '/' + id;
      if (__db_byUrl__.has(thingUrl)) throw new Error('Thing already exists: ' + thingUrl);
      const thing = { ns, type, id, url: thingUrl, createdAt: new Date(), updatedAt: new Date(), data: cleanData };
      if (context) thing['@context'] = context;
      __db_things__.set(thingUrl, thing);
      __indexThing__(thing);
      return thing;
    }

    const options = urlOrOptions;

    // Data-first syntax with $type: create({ $type: 'User', name: 'Alice', ... })
    // Detect by presence of $type or @type and absence of 'data' property
    if ((__extractType__(options) && !('data' in options)) || ('$type' in options) || ('@type' in options)) {
      const type = __extractType__(options) || 'Thing';
      const id = __extractId__(options) || __generateId__();
      const context = __extractContext__(options);
      const ns = __SDK_CONFIG__.ns;
      const cleanData = { ...options };
      delete cleanData.$type; delete cleanData.$id; delete cleanData.$context;
      delete cleanData['@type']; delete cleanData['@id']; delete cleanData['@context'];
      const thingUrl = 'https://' + ns + '/' + type + '/' + id;
      if (__db_byUrl__.has(thingUrl)) throw new Error('Thing already exists: ' + thingUrl);
      const thing = { ns, type, id, url: thingUrl, createdAt: new Date(), updatedAt: new Date(), data: cleanData };
      if (context) thing['@context'] = context;
      __db_things__.set(thingUrl, thing);
      __indexThing__(thing);
      return thing;
    }

    // Options syntax: create({ ns, type, data })
    const id = options.id || __generateId__();
    const thingUrl = options.url || 'https://' + options.ns + '/' + options.type + '/' + id;
    if (__db_byUrl__.has(thingUrl)) throw new Error('Thing already exists: ' + thingUrl);
    const thing = { ns: options.ns, type: options.type, id, url: thingUrl, createdAt: new Date(), updatedAt: new Date(), data: options.data };
    if (options['@context']) thing['@context'] = options['@context'];
    __db_things__.set(thingUrl, thing);
    __indexThing__(thing);
    return thing;
  },

  async update(url, options) {
    const parsed = __parseIdentifier__(url, { ns: __SDK_CONFIG__.ns });
    const resolvedUrl = parsed.url || 'https://' + parsed.ns + '/' + parsed.type + '/' + parsed.id;
    const existing = __db_byUrl__.get(resolvedUrl);
    if (!existing) throw new Error('Thing not found: ' + resolvedUrl);
    existing.data = { ...existing.data, ...options.data };
    existing.updatedAt = new Date();
    return existing;
  },

  async upsert(urlOrOptions, dataArg) {
    if (typeof urlOrOptions === 'string') {
      const parsed = __parseIdentifier__(urlOrOptions, { ns: __SDK_CONFIG__.ns });
      const resolvedUrl = parsed.url || (parsed.ns && parsed.type && parsed.id ? 'https://' + parsed.ns + '/' + parsed.type + '/' + parsed.id : null);
      if (resolvedUrl && __db_byUrl__.has(resolvedUrl)) {
        return this.update(resolvedUrl, { data: dataArg || {} });
      }
      return this.create(urlOrOptions, dataArg);
    }
    const options = urlOrOptions;
    const url = options.url || 'https://' + options.ns + '/' + options.type + '/' + (options.id || __generateId__());
    if (__db_byUrl__.has(url)) return this.update(url, { data: options.data });
    return this.create({ ...options, url });
  },

  async delete(url) {
    const parsed = __parseIdentifier__(url, { ns: __SDK_CONFIG__.ns });
    let resolvedUrl = parsed.url;
    if (!resolvedUrl && parsed.ns && parsed.type && parsed.id) {
      resolvedUrl = 'https://' + parsed.ns + '/' + parsed.type + '/' + parsed.id;
    }
    if (!resolvedUrl) return false;
    const thing = __db_byUrl__.get(resolvedUrl);
    if (!thing) return false;
    __unindexThing__(thing);
    __db_things__.delete(resolvedUrl);
    // Delete related relationships
    const relIds = new Set([...(__db_relFrom__.get(resolvedUrl) || []), ...(__db_relTo__.get(resolvedUrl) || [])]);
    for (const relId of relIds) {
      const rel = __db_relationships__.get(relId);
      if (rel) { __unindexRelationship__(rel); __db_relationships__.delete(relId); }
    }
    return true;
  },

  async generate(identifier, options = {}) {
    const parsed = __parseIdentifier__(identifier, { ns: __SDK_CONFIG__.ns });
    const type = parsed.type || 'Thing';
    const id = parsed.id || __generateId__();
    const thing = {
      ns: parsed.ns || __SDK_CONFIG__.ns, type, id,
      url: parsed.url || 'https://' + (parsed.ns || __SDK_CONFIG__.ns) + '/' + type + '/' + id,
      createdAt: new Date(), updatedAt: new Date(),
      data: { _generated: true, _prompt: options.prompt, _model: options.model }
    };
    __db_things__.set(thing.url, thing);
    __indexThing__(thing);
    return thing;
  },

  async forEach(options, callback) {
    const things = await this.list(options);
    for (const thing of things) await callback(thing);
  },

  async relate(options) {
    const id = __generateId__();
    const rel = { id, type: options.type, from: options.from, to: options.to, createdAt: new Date(), data: options.data };
    __db_relationships__.set(id, rel);
    __indexRelationship__(rel);
    return rel;
  },

  async unrelate(from, type, to) {
    for (const [id, rel] of __db_relationships__) {
      if (rel.from === from && rel.type === type && rel.to === to) {
        __unindexRelationship__(rel);
        __db_relationships__.delete(id);
        return true;
      }
    }
    return false;
  },

  async related(url, relationshipType, direction = 'both') {
    const parsed = __parseIdentifier__(url, { ns: __SDK_CONFIG__.ns });
    const resolvedUrl = parsed.url || 'https://' + parsed.ns + '/' + parsed.type + '/' + parsed.id;
    const relatedUrls = new Set();
    if (direction === 'from' || direction === 'both') {
      const fromRels = __db_relFrom__.get(resolvedUrl);
      if (fromRels) {
        for (const relId of fromRels) {
          const rel = __db_relationships__.get(relId);
          if (rel && (!relationshipType || rel.type === relationshipType)) relatedUrls.add(rel.to);
        }
      }
    }
    if (direction === 'to' || direction === 'both') {
      const toRels = __db_relTo__.get(resolvedUrl);
      if (toRels) {
        for (const relId of toRels) {
          const rel = __db_relationships__.get(relId);
          if (rel && (!relationshipType || rel.type === relationshipType)) relatedUrls.add(rel.from);
        }
      }
    }
    const results = [];
    for (const relatedUrl of relatedUrls) {
      const thing = __db_byUrl__.get(relatedUrl);
      if (thing) results.push(thing);
    }
    return results;
  },

  async relationships(url, type, direction = 'both') {
    const parsed = __parseIdentifier__(url, { ns: __SDK_CONFIG__.ns });
    const resolvedUrl = parsed.url || 'https://' + parsed.ns + '/' + parsed.type + '/' + parsed.id;
    const results = [];
    if (direction === 'from' || direction === 'both') {
      const fromRels = __db_relFrom__.get(resolvedUrl);
      if (fromRels) {
        for (const relId of fromRels) {
          const rel = __db_relationships__.get(relId);
          if (rel && (!type || rel.type === type)) results.push(rel);
        }
      }
    }
    if (direction === 'to' || direction === 'both') {
      const toRels = __db_relTo__.get(resolvedUrl);
      if (toRels) {
        for (const relId of toRels) {
          const rel = __db_relationships__.get(relId);
          if (rel && (!type || rel.type === type)) results.push(rel);
        }
      }
    }
    return results;
  },

  clear() {
    __db_things__.clear(); __db_relationships__.clear();
    __db_byUrl__.clear(); __db_byNsType__.clear();
    __db_relFrom__.clear(); __db_relTo__.clear();
  },

  stats() {
    return { things: __db_things__.size, relationships: __db_relationships__.size };
  }
};

// Typed collection accessor (db.Users, db.Posts, etc.) - mirrors ai-database TypedDBOperations
const db = new Proxy(__db_core__, {
  get: (target, prop) => {
    if (prop in target) return target[prop];
    if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
    // Return a collection accessor for the type
    const type = String(prop);
    const collectionNs = __SDK_CONFIG__.ns;
    const makeUrl = (id) => 'https://' + collectionNs + '/' + type + '/' + id;
    return {
      async list(options = {}) {
        return __db_core__.list({ ...options, type, ns: collectionNs });
      },
      async find(options = {}) {
        return __db_core__.find({ ...options, type, ns: collectionNs });
      },
      async search(options) {
        return __db_core__.search({ ...options, type, ns: collectionNs });
      },
      async get(id, options = {}) {
        return __db_core__.get(makeUrl(id), options);
      },
      async create(idOrData, data) {
        if (typeof idOrData === 'string') {
          return __db_core__.create({ ns: collectionNs, type, id: idOrData, data: data || {} });
        }
        const extractedId = __extractId__(idOrData);
        return __db_core__.create({ ns: collectionNs, type, id: extractedId || __generateId__(), data: idOrData });
      },
      async update(id, data) {
        return __db_core__.update(makeUrl(id), { data });
      },
      async upsert(idOrData, data) {
        if (typeof idOrData === 'string') {
          return __db_core__.upsert({ ns: collectionNs, type, id: idOrData, data: data || {} });
        }
        const extractedId = __extractId__(idOrData);
        return __db_core__.upsert({ ns: collectionNs, type, id: extractedId || __generateId__(), data: idOrData });
      },
      async delete(id) {
        return __db_core__.delete(makeUrl(id));
      },
      async forEach(optionsOrCallback, callback) {
        if (typeof optionsOrCallback === 'function') {
          return __db_core__.forEach({ type, ns: collectionNs }, optionsOrCallback);
        }
        return __db_core__.forEach({ ...optionsOrCallback, type, ns: collectionNs }, callback);
      }
    };
  }
});

// AI Gateway client - makes real API calls through Cloudflare AI Gateway
// When not configured, returns mock data for testing
const __aiGateway__ = {
  async fetch(provider, endpoint, body, extraHeaders = {}) {
    // Mock mode when AI Gateway not configured (for testing)
    if (!__SDK_CONFIG__.aiGatewayUrl) {
      // Extract prompt from various request formats
      let prompt = '';
      if (body?.messages?.[0]?.content?.[0]?.text) {
        prompt = body.messages[0].content[0].text;
      } else if (body?.content?.parts?.[0]?.text) {
        prompt = body.content.parts[0].text;
      }

      // Return mock responses based on endpoint type
      if (endpoint.includes('converse')) {
        // Mock text generation response
        return {
          output: {
            message: {
              content: [{ text: 'Mock AI response to: ' + prompt.slice(0, 50) }]
            }
          },
          usage: { inputTokens: 10, outputTokens: 20 }
        };
      }
      if (endpoint.includes('embed')) {
        // Mock embedding response
        return {
          embedding: {
            values: new Array(body.outputDimensionality || 768).fill(0).map(() => Math.random())
          }
        };
      }
      // Default mock response
      return { mock: true, prompt };
    }

    const url = __SDK_CONFIG__.aiGatewayUrl + '/' + provider + endpoint;
    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders
    };
    if (__SDK_CONFIG__.aiGatewayToken) {
      // Use cf-aig-authorization header for AI Gateway with stored credentials
      headers['cf-aig-authorization'] = 'Bearer ' + __SDK_CONFIG__.aiGatewayToken;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error('AI Gateway error: ' + response.status + ' ' + error);
    }
    return response.json();
  }
};

// AI implementation - callable as function or via methods
// Supports: ai('prompt'), ai\`template\`, ai.generate(), ai.embed(), etc.
const __aiMethods__ = {
  async generate(prompt, options = {}) {
    // Default to Claude 4.5 Opus via AWS Bedrock
    const model = options.model || 'anthropic.claude-opus-4-5-20251101-v1:0';
    const result = await __aiGateway__.fetch('aws-bedrock', '/model/' + model + '/converse', {
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: options.maxTokens || 1024 }
    });
    const text = result.output?.message?.content?.[0]?.text || '';
    return { text, model, usage: result.usage };
  },
  async embed(text, options = {}) {
    // Use Gemini embedding model (768 dimensions) via AI Gateway
    const dimensions = options.dimensions || 768;
    const result = await __aiGateway__.fetch('google-ai-studio', '/v1beta/models/gemini-embedding-001:embedContent', {
      content: { parts: [{ text }] },
      outputDimensionality: dimensions
    });
    return result.embedding?.values || [];
  },
  async embedMany(texts, options = {}) {
    const dimensions = options.dimensions || 768;
    const embeddings = [];
    for (const text of texts) {
      const result = await __aiGateway__.fetch('google-ai-studio', '/v1beta/models/gemini-embedding-001:embedContent', {
        content: { parts: [{ text }] },
        outputDimensionality: dimensions
      });
      embeddings.push(result.embedding?.values || []);
    }
    return embeddings;
  },
  async chat(messages, options = {}) {
    // Default to Claude 4.5 Opus via AWS Bedrock
    const model = options.model || 'anthropic.claude-opus-4-5-20251101-v1:0';
    const result = await __aiGateway__.fetch('aws-bedrock', '/model/' + model + '/converse', {
      messages: messages.map(m => ({ role: m.role, content: [{ text: m.content }] })),
      inferenceConfig: { maxTokens: options.maxTokens || 1024 }
    });
    const content = result.output?.message?.content?.[0]?.text || '';
    return { role: 'assistant', content, usage: result.usage };
  },
  async complete(prompt, options = {}) {
    const result = await ai.generate(prompt, options);
    return result.text;
  },
  async classify(text, labels, options = {}) {
    const prompt = 'Classify the following text into one of these categories: ' + labels.join(', ') + '\\n\\nText: ' + text + '\\n\\nRespond with just the category name.';
    const result = await ai.generate(prompt, { ...options, maxTokens: 50 });
    const label = labels.find(l => result.text.toLowerCase().includes(l.toLowerCase())) || labels[0];
    return { label, confidence: 0.9 };
  },
  async extract(text, schema, options = {}) {
    const prompt = 'Extract the following information from the text and return as JSON:\\n\\nSchema: ' + JSON.stringify(schema) + '\\n\\nText: ' + text + '\\n\\nRespond with valid JSON only.';
    const result = await ai.generate(prompt, options);
    try {
      return JSON.parse(result.text);
    } catch {
      return { _extracted: true, raw: result.text };
    }
  },
  async summarize(text, options = {}) {
    const prompt = 'Summarize the following text concisely:\\n\\n' + text;
    const result = await ai.generate(prompt, { ...options, maxTokens: options.maxTokens || 256 });
    return result.text;
  },
  // Create database-aware AI tools (returns array for Claude SDK compatibility)
  createDatabaseTools(database) {
    const dbInstance = database || __db_core__;

    // Helper for success response in Claude SDK format
    const success = (data) => ({
      content: [{ type: 'text', text: JSON.stringify(data) }]
    });

    // Helper for error response
    const error = (message) => ({
      content: [{ type: 'text', text: message }],
      isError: true
    });

    return [
      {
        name: 'mdxdb_list',
        description: 'List documents from the database by type. Returns an array of documents.',
        handler: async (args) => {
          try {
            const { type, prefix, limit = 100 } = args || {};
            const result = await dbInstance.list({ type, prefix, limit });
            return success(result);
          } catch (err) {
            return error('Failed to list documents: ' + (err.message || String(err)));
          }
        }
      },
      {
        name: 'mdxdb_search',
        description: 'Search for documents by query. Supports semantic search when enabled.',
        handler: async (args) => {
          try {
            const { query, type, limit = 10, semantic = false } = args || {};
            const result = await dbInstance.search({ query, type, limit, semantic });
            return success(result);
          } catch (err) {
            return error('Failed to search documents: ' + (err.message || String(err)));
          }
        }
      },
      {
        name: 'mdxdb_get',
        description: 'Get a specific document by ID. Returns the document or null if not found.',
        handler: async (args) => {
          try {
            const { id, url } = args || {};
            const identifier = url || id;
            if (!identifier) {
              return error('Either id or url is required');
            }
            const doc = await dbInstance.get(identifier);
            if (!doc) {
              return error('Document not found: ' + identifier);
            }
            return success(doc);
          } catch (err) {
            return error('Failed to get document: ' + (err.message || String(err)));
          }
        }
      },
      {
        name: 'mdxdb_set',
        description: 'Create or update a document. Returns success status.',
        handler: async (args) => {
          try {
            const { id, url, data, content, type } = args || {};
            const identifier = url || id;
            if (!identifier) {
              return error('Either id or url is required');
            }
            // Set data directly - the db.set wraps it in a thing.data property
            // Also include type metadata if provided
            const docData = { ...(data || {}), ...(type ? { $type: type } : {}) };
            await dbInstance.set(identifier, docData);
            return success({ success: true, id: identifier });
          } catch (err) {
            return error('Failed to set document: ' + (err.message || String(err)));
          }
        }
      },
      {
        name: 'mdxdb_delete',
        description: 'Delete a document by ID. Returns deletion status.',
        handler: async (args) => {
          try {
            const { id, url } = args || {};
            const identifier = url || id;
            if (!identifier) {
              return error('Either id or url is required');
            }
            const result = await dbInstance.delete(identifier);
            return success({ deleted: result.deleted !== false });
          } catch (err) {
            return error('Failed to delete document: ' + (err.message || String(err)));
          }
        }
      }
    ];
  }
};

// Create callable ai function that also has methods as properties
// Supports: ai('prompt'), ai\`template\`, ai.generate(), ai.embed(), etc.
const ai = Object.assign(
  async function ai(promptOrStrings, ...values) {
    // Handle template literal: ai\`Hello \${name}\`
    if (Array.isArray(promptOrStrings) && 'raw' in promptOrStrings) {
      const prompt = promptOrStrings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '');
      const result = await __aiMethods__.generate(prompt);
      return result.text || result;
    }
    // Handle direct call: ai('prompt') or ai('prompt', options)
    const prompt = promptOrStrings;
    const options = values[0] || {};
    const result = await __aiMethods__.generate(prompt, options);
    return result.text || result;
  },
  __aiMethods__
);

// Add references method to db_core
__db_core__.references = async function(url, direction = 'both') {
  const rels = await this.relationships(url, undefined, direction);
  const refs = [];
  for (const rel of rels) {
    const targetUrl = direction === 'from' ? rel.to : direction === 'to' ? rel.from : (rel.from === url ? rel.to : rel.from);
    const target = await this.get(targetUrl);
    if (target) refs.push({ ...target, relationship: rel });
  }
  return refs;
};

// ============================================================
// Hono-compatible HTTP App (for testing)
// ============================================================

// Cache for client component detection to avoid recursion
const __clientComponentCache__ = new WeakMap();

// Check if a function is a client component
const __isClientComponent__ = (fn) => {
  if (typeof fn !== 'function') return false;
  // Check cache first
  if (__clientComponentCache__.has(fn)) {
    return __clientComponentCache__.get(fn);
  }
  // Mark as processing to prevent recursion
  __clientComponentCache__.set(fn, false);

  const source = fn.toString();
  let result = false;

  // Check for 'use client' directive
  if (source.includes("'use client'") || source.includes('"use client"')) {
    result = true;
  }
  // Check for 'use server' directive (explicitly server)
  else if (source.includes("'use server'") || source.includes('"use server"')) {
    result = false;
  }
  // Auto-detect: functions using useState are client components
  else if (source.includes('useState(') || source.includes('useEffect(') || source.includes('useRef(')) {
    result = true;
  }

  __clientComponentCache__.set(fn, result);
  return result;
};

// Simple JSX renderer for Hono JSX components
const __renderJsx__ = (element) => {
  if (element === null || element === undefined) return '';
  if (typeof element === 'string' || typeof element === 'number') return String(element);
  if (Array.isArray(element)) return element.map(__renderJsx__).join('');
  if (typeof element !== 'object') return String(element);

  const { type, props } = element;
  if (!type) return '';

  // Handle function components
  if (typeof type === 'function') {
    const isClient = __isClientComponent__(type);
    try {
      const result = type(props || {});
      const rendered = __renderJsx__(result);
      // Wrap client components with hydration marker
      if (isClient) {
        const componentName = type.name || 'Component';
        return '<div data-hono-hydrate="' + componentName + '">' + rendered + '</div><script>/* hydrate: ' + componentName + ' */</script>';
      }
      return rendered;
    } catch (e) {
      return '<!-- Error: ' + e.message + ' -->';
    }
  }

  // Handle HTML elements
  const tag = String(type);
  const attrs = Object.entries(props || {})
    .filter(([k, v]) => k !== 'children' && v !== undefined && v !== null && v !== false)
    .map(([k, v]) => {
      if (v === true) return k;
      const attrName = k === 'className' ? 'class' : k.replace(/([A-Z])/g, '-$1').toLowerCase();
      return attrName + '="' + String(v).replace(/"/g, '&quot;') + '"';
    })
    .join(' ');

  const children = props?.children;
  const childContent = Array.isArray(children)
    ? children.map(__renderJsx__).join('')
    : children !== undefined
      ? __renderJsx__(children)
      : '';

  const voidElements = new Set(['br', 'hr', 'img', 'input', 'link', 'meta', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr']);
  if (voidElements.has(tag.toLowerCase())) {
    return '<' + tag + (attrs ? ' ' + attrs : '') + ' />';
  }
  return '<' + tag + (attrs ? ' ' + attrs : '') + '>' + childContent + '</' + tag + '>';
};

const __createHonoApp__ = () => {
  const routes = [];
  const middleware = [];
  let notFoundHandler = null;
  let errorHandler = null;

  // Parse path pattern into regex and param names
  const parsePattern = (pattern) => {
    const params = [];
    // Normalize: remove trailing slash for consistent matching
    let normalizedPattern = pattern.replace(/\\/+$/, '') || '/';
    let regexStr = normalizedPattern
      .replace(/\\*$/, '(?<wildcard>.*)') // Wildcard at end
      .replace(/\\/:([^/]+)\\?/g, (_, name) => { params.push(name); return '(?:/(?<' + name + '>[^/]*))?'; }) // Optional param (makes /segment optional)
      .replace(/:([^/]+)/g, (_, name) => { params.push(name); return '(?<' + name + '>[^/]+)'; }); // Required param
    // Handle trailing slash optionally
    if (!regexStr.endsWith('.*') && !regexStr.endsWith(')?')) {
      regexStr = regexStr + '/?';
    }
    return { regex: new RegExp('^' + regexStr + '(?:\\\\?.*)?$'), params };
  };

  // Create context object
  const createContext = (req, pathParams, store) => {
    const url = new URL(req.url, 'http://localhost');
    return {
      req: {
        raw: req,
        url: req.url,
        method: req.method,
        path: url.pathname,
        param: (name) => name === '*' ? pathParams.wildcard : pathParams[name],
        query: (name) => url.searchParams.get(name),
        queries: () => {
          const result = {};
          for (const [key, value] of url.searchParams) {
            if (result[key]) {
              if (Array.isArray(result[key])) result[key].push(value);
              else result[key] = [result[key], value];
            } else {
              result[key] = value;
            }
          }
          return result;
        },
        header: (name) => req.headers.get(name),
        json: () => req.json(),
        text: () => req.text(),
        arrayBuffer: () => req.arrayBuffer(),
        parseBody: async () => {
          const contentType = req.headers.get('Content-Type') || '';
          if (contentType.includes('application/json')) {
            return req.json();
          }
          if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await req.formData();
            const result = {};
            for (const [key, value] of formData.entries()) {
              result[key] = value;
            }
            return result;
          }
          return req.text();
        },
      },
      // Response methods - text supports optional headers as 3rd param
      text: (body, status = 200, headers = {}) => {
        const h = { 'Content-Type': 'text/plain', ...headers };
        return new Response(body, { status, headers: h });
      },
      json: (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }),
      html: (body, status = 200) => {
        const rendered = typeof body === 'object' ? __renderJsx__(body) : body;
        return new Response(rendered, { status, headers: { 'Content-Type': 'text/html' } });
      },
      body: (data, status = 200) => new Response(data, { status }),
      redirect: (url, status = 302) => new Response(null, { status, headers: { 'Location': url } }),
      notFound: () => new Response('Not Found', { status: 404 }),
      // Streaming helper - returns Response immediately, callback runs async
      stream: (callback) => {
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const streamApi = {
          write: async (chunk) => {
            const data = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
            await writer.write(data);
          },
          close: async () => await writer.close(),
          pipe: async (rs) => {
            const reader = rs.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              await writer.write(value);
            }
            await writer.close();
          }
        };
        // Run callback async, close stream when done
        Promise.resolve(callback(streamApi)).then(() => writer.close()).catch(() => writer.close());
        return new Response(readable, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      },
      // Status helper
      status: (code) => {
        const ctx = createContext(req, pathParams, store);
        const originalJson = ctx.json;
        const originalText = ctx.text;
        const originalHtml = ctx.html;
        ctx.json = (data) => originalJson(data, code);
        ctx.text = (body) => originalText(body, code);
        ctx.html = (body) => originalHtml(body, code);
        return ctx;
      },
      // Header helper
      header: (name, value) => {
        store._headers = store._headers || {};
        store._headers[name] = value;
      },
      // Store for middleware
      set: (key, value) => { store[key] = value; },
      get: (key) => store[key],
    };
  };

  // Register routes
  const addRoute = (method, path, ...handlers) => {
    const { regex, params } = parsePattern(path);
    routes.push({ method: method.toUpperCase(), pattern: path, regex, params, handlers });
  };

  // Process request through middleware and routes
  const handleRequest = async (req) => {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    const method = req.method;
    const store = {};

    // Find matching route
    let matchedRoute = null;
    let routeParams = {};
    for (const route of routes) {
      if (route.method !== method && route.method !== 'ALL') continue;
      const match = path.match(route.regex);
      if (match) {
        matchedRoute = route;
        routeParams = match.groups || {};
        break;
      }
    }

    // Collect matching middleware
    const matchingMiddleware = middleware.filter(mw => {
      const prefix = mw.prefix.replace('/*', '').replace('*', '');
      return path.startsWith(prefix) || prefix === '';
    });

    // Track the response through the chain so middleware can modify headers after next()
    let chainResponse = null;

    // Create a proper execution chain: middleware -> route handlers
    const executeChain = async (index) => {
      // First, run through middleware
      if (index < matchingMiddleware.length) {
        const mw = matchingMiddleware[index];
        const ctx = createContext(req, routeParams, store);
        const next = async () => {
          const downstreamResult = await executeChain(index + 1);
          if (downstreamResult) chainResponse = downstreamResult;
          return downstreamResult;
        };
        const result = await mw.handler(ctx, next);
        // If middleware returns a response, use it; otherwise use chainResponse
        if (result) return result;
        return chainResponse;
      }

      // Then run the route handler(s)
      if (!matchedRoute) {
        // No route matched - use 404 handler
        if (notFoundHandler) {
          const ctx = createContext(req, {}, store);
          return notFoundHandler(ctx);
        }
        return new Response('Not Found', { status: 404 });
      }

      const ctx = createContext(req, routeParams, store);
      for (let i = 0; i < matchedRoute.handlers.length; i++) {
        const handler = matchedRoute.handlers[i];
        const isLast = i === matchedRoute.handlers.length - 1;
        let nextCalled = false;
        const next = async () => { nextCalled = true; };
        const result = await handler(ctx, next);
        if (result) return result;
        if (!isLast && !nextCalled) break;
      }
      return null;
    };

    // Helper to apply stored headers to response
    const applyHeaders = (response) => {
      if (store._headers && response instanceof Response) {
        for (const [name, value] of Object.entries(store._headers)) {
          response.headers.set(name, value);
        }
      }
      return response;
    };

    // Execute the chain with error handling
    try {
      const result = await executeChain(0);
      if (result) return applyHeaders(result);
      // If no result, return 404
      if (notFoundHandler) {
        const ctx = createContext(req, {}, store);
        return applyHeaders(notFoundHandler(ctx));
      }
      return new Response('Not Found', { status: 404 });
    } catch (err) {
      if (errorHandler) {
        const ctx = createContext(req, {}, store);
        return applyHeaders(errorHandler(err, ctx));
      }
      throw err;
    }
  };

  const appObj = {
    get: (path, ...handlers) => addRoute('GET', path, ...handlers),
    post: (path, ...handlers) => addRoute('POST', path, ...handlers),
    put: (path, ...handlers) => addRoute('PUT', path, ...handlers),
    delete: (path, ...handlers) => addRoute('DELETE', path, ...handlers),
    patch: (path, ...handlers) => addRoute('PATCH', path, ...handlers),
    all: (path, ...handlers) => addRoute('ALL', path, ...handlers),
    use: (pathOrHandler, handler) => {
      const path = typeof pathOrHandler === 'string' ? pathOrHandler : '/*';
      const h = typeof pathOrHandler === 'function' ? pathOrHandler : handler;
      const { regex, params } = parsePattern(path);
      middleware.push({ prefix: path, regex, handler: h });
    },
    route: (basePath, subApp) => {
      // Mount sub-app routes
      for (const route of subApp._routes || []) {
        addRoute(route.method, basePath + route.pattern, ...route.handlers);
      }
    },
    // Create a scoped sub-app with a base path
    basePath: (prefix) => {
      const subApp = {
        get: (path, ...handlers) => { addRoute('GET', prefix + path, ...handlers); return subApp; },
        post: (path, ...handlers) => { addRoute('POST', prefix + path, ...handlers); return subApp; },
        put: (path, ...handlers) => { addRoute('PUT', prefix + path, ...handlers); return subApp; },
        delete: (path, ...handlers) => { addRoute('DELETE', prefix + path, ...handlers); return subApp; },
        patch: (path, ...handlers) => { addRoute('PATCH', prefix + path, ...handlers); return subApp; },
        all: (path, ...handlers) => { addRoute('ALL', prefix + path, ...handlers); return subApp; },
        basePath: (subPrefix) => appObj.basePath(prefix + subPrefix),
        _routes: routes,
      };
      return subApp;
    },
    // Global 404 handler
    notFound: (handler) => { notFoundHandler = handler; },
    // Global error handler
    onError: (handler) => { errorHandler = handler; },
    request: async (path, options = {}) => {
      const url = path.startsWith('http') ? path : 'http://localhost' + path;
      const req = new Request(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body,
      });
      return handleRequest(req);
    },
    fetch: handleRequest,
    _routes: routes,
  };
  return appObj;
};

// Create global app instance
const app = __createHonoApp__();

// ============================================================
// MDX Rendering Utilities
// ============================================================

// Extract frontmatter from MDX content
const __extractFrontmatter__ = (content) => {
  const match = content.match(/^---\\n([\\s\\S]*?)\\n---\\n?([\\s\\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };
  try {
    const fm = {};
    match[1].split('\\n').forEach(line => {
      const [key, ...vals] = line.split(':');
      if (key && vals.length) fm[key.trim()] = vals.join(':').trim();
    });
    return { frontmatter: fm, body: match[2] };
  } catch {
    return { frontmatter: {}, body: content };
  }
};

// render object for MDX
const render = {
  // Render MDX to markdown (strip frontmatter by default)
  markdown: (content, options = {}) => {
    const { frontmatter, body } = __extractFrontmatter__(content);
    if (options.includeFrontmatter) {
      return content;
    }
    return body.trim();
  },
  // Extract table of contents from markdown headings
  toc: (content) => {
    const { body } = __extractFrontmatter__(content);
    const headings = [];
    const regex = /^(#{1,6})\\s+(.+)$/gm;
    let match;
    while ((match = regex.exec(body)) !== null) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        slug: match[2].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
      });
    }
    return headings;
  },
  // Render MDX to HTML (simplified)
  html: (content) => {
    const { body } = __extractFrontmatter__(content);
    // Basic markdown to HTML
    return body
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
      .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
      .replace(/\\[(.+?)\\]\\((.+?)\\)/g, '<a href="$2">$1</a>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\\/li>\\n?)+/g, '<ul>$&</ul>')
      .replace(/^\\n+|\\n+$/g, '');
  }
};

// React-like hooks stubs
let __hook_state__ = [];
let __hook_index__ = 0;

const useState = (initial) => {
  const idx = __hook_index__++;
  if (__hook_state__[idx] === undefined) {
    __hook_state__[idx] = initial;
  }
  const setState = (newVal) => {
    __hook_state__[idx] = typeof newVal === 'function' ? newVal(__hook_state__[idx]) : newVal;
  };
  return [__hook_state__[idx], setState];
};

const useEffect = (fn, deps) => { /* No-op in server context */ };
const useRef = (initial) => ({ current: initial });
const useMemo = (fn, deps) => fn();
const useCallback = (fn, deps) => fn;

// Suspense placeholder
const Suspense = ({ children, fallback }) => children;

// Streaming render function
const renderToStream = async (element, stream) => {
  const html = __renderJsx__(element);
  await stream.write(html);
};

// Serialization utilities for client props
const serialize = {
  clientProps: (props) => {
    const result = {};
    for (const [key, value] of Object.entries(props || {})) {
      if (typeof value === 'function') {
        result[key] = { __rpc: true, name: value.name || 'anonymous' };
      } else {
        result[key] = value;
      }
    }
    return result;
  },
  json: JSON.stringify,
  parse: JSON.parse
};

// Add .isClient getter to Function.prototype for component detection
Object.defineProperty(Function.prototype, 'isClient', {
  get: function() {
    return __isClientComponent__(this);
  },
  configurable: true,
  enumerable: false
});

// ============================================================
// Additional Parsing Functions
// ============================================================

// Parse URL into components
const parseUrl = (urlString) => {
  try {
    const url = new URL(urlString);
    const pathParts = url.pathname.split('/').filter(Boolean);
    return {
      protocol: url.protocol.replace(':', ''),
      host: url.host,
      pathname: url.pathname,
      path: pathParts,
      search: url.search,
      hash: url.hash,
      origin: url.origin
    };
  } catch {
    return { pathname: urlString, path: urlString.split('/').filter(Boolean) };
  }
};

// ============================================================
// Workflow/Event System (aligned with ai-workflows)
// ============================================================

// Event handler registry
const __event_handlers__ = new Map();
// Schedule handler registry
const __schedule_handlers__ = [];
// Workflow history for tracking
const __workflow_history__ = [];

// Known cron patterns for schedules
const __KNOWN_PATTERNS__ = {
  second: '* * * * * *', minute: '* * * * *', hour: '0 * * * *',
  day: '0 0 * * *', week: '0 0 * * 0', month: '0 0 1 * *', year: '0 0 1 1 *',
  Monday: '0 0 * * 1', Tuesday: '0 0 * * 2', Wednesday: '0 0 * * 3',
  Thursday: '0 0 * * 4', Friday: '0 0 * * 5', Saturday: '0 0 * * 6', Sunday: '0 0 * * 0',
  weekday: '0 0 * * 1-5', weekend: '0 0 * * 0,6', midnight: '0 0 * * *', noon: '0 12 * * *'
};

// Time patterns for schedule modifiers
const __TIME_PATTERNS__ = {
  at6am: { hour: 6, minute: 0 }, at7am: { hour: 7, minute: 0 }, at8am: { hour: 8, minute: 0 },
  at9am: { hour: 9, minute: 0 }, at10am: { hour: 10, minute: 0 }, at11am: { hour: 11, minute: 0 },
  at12pm: { hour: 12, minute: 0 }, atnoon: { hour: 12, minute: 0 }, at1pm: { hour: 13, minute: 0 },
  at2pm: { hour: 14, minute: 0 }, at3pm: { hour: 15, minute: 0 }, at4pm: { hour: 16, minute: 0 },
  at5pm: { hour: 17, minute: 0 }, at6pm: { hour: 18, minute: 0 }, at7pm: { hour: 19, minute: 0 },
  at8pm: { hour: 20, minute: 0 }, at9pm: { hour: 21, minute: 0 }, atmidnight: { hour: 0, minute: 0 }
};

// Parse event string (Noun.event)
const __parseEvent__ = (event) => {
  const parts = event.split('.');
  if (parts.length !== 2) return null;
  return { noun: parts[0], event: parts[1] };
};

// Register event handler
const __registerEventHandler__ = (noun, event, handler) => {
  const key = noun + '.' + event;
  if (!__event_handlers__.has(key)) __event_handlers__.set(key, []);
  __event_handlers__.get(key).push({ handler, source: handler.toString() });
};

// Register schedule handler
const __registerScheduleHandler__ = (interval, handler) => {
  __schedule_handlers__.push({ interval, handler, source: handler.toString() });
};

// Create $.on - supports both on('event', handler) and on.Entity.event(handler)
const on = new Proxy(function(event, filterOrHandler, handler) {
  // on('user.created', handler) or on('user.created', { where: ... }, handler)
  if (typeof event === 'string') {
    const actualHandler = typeof filterOrHandler === 'function' ? filterOrHandler : handler;
    const filter = typeof filterOrHandler === 'object' ? filterOrHandler : null;
    const parts = event.split('.');
    const key = event; // Use full event string as key
    if (!__event_handlers__.has(key)) __event_handlers__.set(key, []);
    __event_handlers__.get(key).push({ handler: actualHandler, filter, source: actualHandler.toString() });
    return {
      off: () => {
        const handlers = __event_handlers__.get(key);
        if (handlers) {
          const idx = handlers.findIndex(h => h.handler === actualHandler);
          if (idx > -1) handlers.splice(idx, 1);
        }
      }
    };
  }
}, {
  get: (target, prop) => {
    if (prop === 'once') {
      // on.once('event', handler) - one-time handler
      return (event, handler) => {
        const wrapper = async (data, $) => {
          const key = event;
          const handlers = __event_handlers__.get(key);
          if (handlers) {
            const idx = handlers.findIndex(h => h.handler === wrapper);
            if (idx > -1) handlers.splice(idx, 1);
          }
          return handler(data, $);
        };
        const key = event;
        if (!__event_handlers__.has(key)) __event_handlers__.set(key, []);
        __event_handlers__.get(key).push({ handler: wrapper, source: handler.toString() });
        return { off: () => {} };
      };
    }
    // on.Entity.event(handler) pattern
    const noun = String(prop);
    return new Proxy({}, {
      get: (_, eventName) => (handler) => {
        const key = noun + '.' + String(eventName);
        __registerEventHandler__(noun, String(eventName), handler);
        return {
          off: () => {
            const handlers = __event_handlers__.get(key);
            if (handlers) {
              const idx = handlers.findIndex(h => h.handler === handler);
              if (idx > -1) handlers.splice(idx, 1);
            }
          },
          unsubscribe: () => {
            const handlers = __event_handlers__.get(key);
            if (handlers) {
              const idx = handlers.findIndex(h => h.handler === handler);
              if (idx > -1) handlers.splice(idx, 1);
            }
          }
        };
      }
    });
  },
  apply: (target, thisArg, args) => target(...args)
});

// Parse duration string (100ms, 1s, 5m, etc.)
const __parseDuration__ = (str) => {
  if (!str || typeof str !== 'string') return null;
  const match = str.match(/^(\\d+)(ms|s|m|h|d|w)?$/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2] || 'ms';
  switch (unit) {
    case 'ms': return value;
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'w': return value * 7 * 24 * 60 * 60 * 1000;
    default: return value;
  }
};

// Check if string looks like a cron expression
const __isCronExpression__ = (str) => {
  if (!str || typeof str !== 'string') return false;
  const parts = str.trim().split(/\\s+/);
  return parts.length >= 5 && parts.length <= 6;
};

// Active schedule timers
const __schedule_timers__ = [];

// Create $.every - supports every('100ms', handler), every('name', '* * * *', handler), and every.Monday.at9am(handler)
const every = new Proxy(function(intervalOrName, handlerOrCronOrOptions, handlerArg) {
  // Determine format: every('100ms', handler) or every('name', '* * * *', handler) or every('name', opts, handler)
  let name = null;
  let interval = null;
  let handler = null;
  let options = {};

  if (typeof handlerOrCronOrOptions === 'function') {
    // every('100ms', handler) or every('* * * *', handler)
    interval = intervalOrName;
    handler = handlerOrCronOrOptions;
  } else if (typeof handlerArg === 'function') {
    // every('name', '* * * *', handler) or every('name', { immediate: true }, handler)
    name = intervalOrName;
    if (typeof handlerOrCronOrOptions === 'string') {
      interval = handlerOrCronOrOptions;
    } else {
      options = handlerOrCronOrOptions || {};
      interval = options.interval;
    }
    handler = handlerArg;
  }

  // Determine if it's a duration or cron
  const isCron = __isCronExpression__(interval);
  const durationMs = isCron ? null : __parseDuration__(interval);

  let stopped = false;
  let timer = null;
  let runCount = 0;

  const job = {
    name: name || interval,
    cron: isCron ? interval : null,
    stopped: false,
    stop: () => {
      stopped = true;
      job.stopped = true;
      if (timer) clearInterval(timer);
    },
    next: () => new Date(Date.now() + (durationMs || 60000))
  };

  if (durationMs) {
    // Duration-based schedule
    if (options.immediate) {
      Promise.resolve().then(() => handler());
    }

    timer = setInterval(async () => {
      if (stopped) return;
      if (options.until && options.until()) {
        job.stop();
        return;
      }
      runCount++;
      try {
        await handler();
      } catch (e) {
        console.error('[every] Handler error:', e);
      }
    }, durationMs);

    __schedule_timers__.push(timer);
  }

  __registerScheduleHandler__({
    type: isCron ? 'cron' : 'duration',
    expression: isCron ? interval : null,
    ms: durationMs,
    natural: name || interval
  }, handler);

  return job;
}, {
  get: (target, prop) => {
    const propStr = String(prop);
    const pattern = __KNOWN_PATTERNS__[propStr];
    if (pattern) {
      const result = (handler) => {
        __registerScheduleHandler__({ type: 'cron', expression: pattern, natural: propStr }, handler);
        return { stop: () => {}, cancel: () => {}, name: propStr, cron: pattern, stopped: false };
      };
      // Support time modifiers: every.Monday.at9am(handler)
      return new Proxy(result, {
        get: (_, timeKey) => {
          const time = __TIME_PATTERNS__[String(timeKey)];
          if (time) {
            const parts = pattern.split(' ');
            parts[0] = String(time.minute);
            parts[1] = String(time.hour);
            const cron = parts.join(' ');
            return (handler) => {
              __registerScheduleHandler__({ type: 'cron', expression: cron, natural: propStr + '.' + String(timeKey) }, handler);
              return { stop: () => {}, cancel: () => {}, name: propStr + '.' + String(timeKey), cron, stopped: false };
            };
          }
          return undefined;
        },
        apply: (_, __, args) => {
          __registerScheduleHandler__({ type: 'cron', expression: pattern, natural: propStr }, args[0]);
          return { stop: () => {}, cancel: () => {}, name: propStr, cron: pattern, stopped: false };
        }
      });
    }
    // Plural units: every.seconds(5), every.minutes(10), etc.
    const pluralUnits = { seconds: 'second', minutes: 'minute', hours: 'hour', days: 'day', weeks: 'week' };
    if (pluralUnits[propStr]) {
      return (value) => (handler) => {
        __registerScheduleHandler__({ type: pluralUnits[propStr], value, natural: value + ' ' + propStr }, handler);
        return { stop: () => {}, cancel: () => {}, name: value + ' ' + propStr, stopped: false };
      };
    }
    return undefined;
  },
  apply: (target, thisArg, args) => target(...args)
});

// Send event - returns event info, supports options (delay, correlationId, channel, wait)
const send = async (event, data, options = {}) => {
  const eventId = __generateId__();
  const timestamp = Date.now();
  const eventObj = {
    id: eventId,
    type: event,
    data,
    timestamp,
    correlationId: options.correlationId
  };

  __workflow_history__.push({ type: 'event', name: event, data, timestamp });

  // Handle delay
  if (options.delay) {
    const delayMs = typeof options.delay === 'string' ? __parseDuration__(options.delay) : options.delay;
    if (delayMs) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  // Find matching handlers (supports wildcard like 'user.*')
  const matchingHandlers = [];
  for (const [key, handlers] of __event_handlers__) {
    const keyPattern = key.replace(/\\.\\*/g, '\\\\.[^.]+');
    const regex = new RegExp('^' + keyPattern + '$');
    if (key === event || regex.test(event) || (key.endsWith('.*') && event.startsWith(key.slice(0, -1)))) {
      for (const h of handlers) {
        // Check channel filter
        if (h.filter?.channel && h.filter.channel !== options.channel) continue;
        // Check where filter
        if (h.filter?.where) {
          let match = true;
          for (const [k, v] of Object.entries(h.filter.where)) {
            if (data[k] !== v) { match = false; break; }
          }
          if (!match) continue;
        }
        matchingHandlers.push(h);
      }
    }
  }

  // If wait option, call first handler and return response
  if (options.wait && matchingHandlers.length > 0) {
    let response = null;
    const reply = (data) => { response = { data }; };
    await matchingHandlers[0].handler({ type: event, data, correlationId: options.correlationId }, reply);
    return response || eventObj;
  }

  // Fire all handlers
  await Promise.all(matchingHandlers.map(async ({ handler }) => {
    try {
      await handler({ type: event, data, correlationId: options.correlationId }, $);
    } catch (error) {
      console.error('Error in handler for ' + event + ':', error);
    }
  }));

  return eventObj;
};

// Add broadcast method to send
send.broadcast = async (event, data) => {
  return send(event, data);
};

// Delay helper
const delay = (ms) => {
  if (typeof ms === 'string') ms = __parseDuration__(ms) || 0;
  return new Promise(r => setTimeout(r, ms));
};

// Decide helper - pattern matching decision
const decide = (subject) => {
  const conditions = [];
  let defaultValue = null;

  const chain = {
    when: (conditionOrFn, result) => {
      conditions.push({ condition: conditionOrFn, result });
      return chain;
    },
    otherwise: (result) => {
      defaultValue = result;
      // Execute decision
      for (const { condition, result } of conditions) {
        let matches = false;
        if (typeof condition === 'function') {
          matches = condition(subject);
        } else if (typeof condition === 'object') {
          matches = true;
          for (const [key, value] of Object.entries(condition)) {
            const subjectValue = subject[key];
            if (typeof value === 'object' && value !== null) {
              for (const [op, opVal] of Object.entries(value)) {
                switch (op) {
                  case '$gte': if (!(subjectValue >= opVal)) matches = false; break;
                  case '$gt': if (!(subjectValue > opVal)) matches = false; break;
                  case '$lte': if (!(subjectValue <= opVal)) matches = false; break;
                  case '$lt': if (!(subjectValue < opVal)) matches = false; break;
                  case '$ne': if (subjectValue === opVal) matches = false; break;
                  default: if (subjectValue !== value) matches = false;
                }
              }
            } else if (subjectValue !== value) {
              matches = false;
            }
            if (!matches) break;
          }
        }
        if (matches) {
          return typeof result === 'function' ? result() : result;
        }
      }
      return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    }
  };

  return chain;
};

// Async decide
decide.async = (subject) => {
  const conditions = [];

  const chain = {
    when: (conditionFn, result) => {
      conditions.push({ condition: conditionFn, result });
      return chain;
    },
    otherwise: async (defaultResult) => {
      for (const { condition, result } of conditions) {
        const matches = await condition(subject);
        if (matches) return result;
      }
      return defaultResult;
    }
  };

  return chain;
};

// Track helper - analytics tracking
const __tracked_events__ = [];
const track = async (event, data, metadata = {}) => {
  const entry = { type: event, data, metadata, timestamp: Date.now(), userId: metadata.userId };
  __tracked_events__.push(entry);
  return entry;
};

track.user = async (userId, event, data) => {
  const entry = { type: event, data, userId, timestamp: Date.now() };
  __tracked_events__.push(entry);
  return entry;
};

track.query = async (options = {}) => {
  let results = [...__tracked_events__];
  if (options.type) results = results.filter(e => e.type === options.type);
  if (options.userId) results = results.filter(e => e.userId === options.userId);
  if (options['data.buttonId']) results = results.filter(e => e.data?.buttonId === options['data.buttonId']);
  if (options.orderBy) {
    results.sort((a, b) => {
      const aVal = a[options.orderBy];
      const bVal = b[options.orderBy];
      return options.order === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }
  if (options.limit) results = results.slice(0, options.limit);
  return results;
};

track.funnel = async (steps, options = {}) => {
  const events = await track.query(options);
  const completed = steps.every(step => events.some(e => e.type === step));
  return {
    steps: steps.map(step => ({ step, completed: events.some(e => e.type === step) })),
    completed,
    conversionRate: completed ? 1 : 0
  };
};

track.aggregate = async (event, options = {}) => {
  const events = __tracked_events__.filter(e => e.type === event);
  const groups = {};
  for (const e of events) {
    const key = options.groupBy ? e.data[options.groupBy] : '_all';
    if (!groups[key]) groups[key] = { sum: 0, count: 0, values: [] };
    groups[key].count++;
    if (options.sum) groups[key].sum += e.data[options.sum] || 0;
    groups[key].values.push(e);
  }
  return groups;
};

track.timeseries = async (event, options = {}) => {
  const events = __tracked_events__.filter(e => e.type === event);
  return events.map(e => ({
    timestamp: e.timestamp,
    value: options.field ? e.data[options.field] : 1
  }));
};

// Experiment helper - A/B testing
const experiment = (name) => {
  const variants = [];
  let eligibilityFn = null;
  const overrides = new Map();
  let rolloutConfig = null;

  const exp = {
    variant: (variantName, config, options = {}) => {
      variants.push({ name: variantName, config, weight: options.weight || 1 });
      return exp;
    },
    eligible: (fn) => {
      eligibilityFn = fn;
      return exp;
    },
    override: (userId, variantName) => {
      overrides.set(userId, variantName);
      return exp;
    },
    rollout: (variantName, percentage) => {
      rolloutConfig = { variant: variantName, percentage };
      return exp;
    },
    assign: (userId) => {
      // Check override
      if (overrides.has(userId)) {
        const overrideVariant = variants.find(v => v.name === overrides.get(userId));
        if (overrideVariant) return { name: overrideVariant.name, ...overrideVariant.config };
      }
      // Check eligibility
      if (eligibilityFn && typeof userId === 'object' && !eligibilityFn(userId)) {
        return variants[0] ? { name: variants[0].name, ...variants[0].config } : {};
      }
      // Consistent assignment based on userId hash
      const userIdStr = typeof userId === 'object' ? userId.id || JSON.stringify(userId) : String(userId);
      let hash = 0;
      for (let i = 0; i < userIdStr.length; i++) {
        hash = ((hash << 5) - hash) + userIdStr.charCodeAt(i);
        hash = hash & hash;
      }
      const normalized = Math.abs(hash % 100) / 100;

      // Check rollout
      if (rolloutConfig && normalized < rolloutConfig.percentage) {
        const rolloutVariant = variants.find(v => v.name === rolloutConfig.variant);
        if (rolloutVariant) return { name: rolloutVariant.name, ...rolloutVariant.config };
      }

      // Weight-based selection
      const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
      let cumulative = 0;
      for (const v of variants) {
        cumulative += v.weight / totalWeight;
        if (normalized < cumulative) return { name: v.name, ...v.config };
      }
      return variants[0] ? { name: variants[0].name, ...variants[0].config } : {};
    },
    track: {
      exposure: async (userId) => {
        await track('experiment.exposure', { experiment: name, userId });
      },
      conversion: async (userId, data = {}) => {
        await track('experiment.conversion', { experiment: name, userId, ...data });
      }
    },
    results: async () => {
      const exposures = __tracked_events__.filter(e => e.type === 'experiment.exposure' && e.data.experiment === name);
      const conversions = __tracked_events__.filter(e => e.type === 'experiment.conversion' && e.data.experiment === name);
      const result = {};
      for (const v of variants) {
        result[v.name] = { exposures: 0, conversions: 0 };
      }
      for (const e of exposures) {
        const variantName = exp.assign(e.data.userId).name;
        if (result[variantName]) result[variantName].exposures++;
      }
      for (const e of conversions) {
        const variantName = exp.assign(e.data.userId).name;
        if (result[variantName]) result[variantName].conversions++;
      }
      return result;
    }
  };

  return exp;
};

// Execute event and wait for result ($.do) - mirrors ai-workflows do
const __doEvent__ = async (event, data) => {
  __workflow_history__.push({ type: 'action', name: 'do:' + event, data, timestamp: Date.now() });

  const parsed = __parseEvent__(event);
  if (!parsed) throw new Error('Invalid event format: ' + event + '. Expected Noun.event');

  const key = parsed.noun + '.' + parsed.event;
  const handlers = __event_handlers__.get(key) || [];
  if (handlers.length === 0) throw new Error('No handler registered for ' + event);

  return await handlers[0].handler(data, $);
};

// Try event (non-durable) - mirrors ai-workflows try
const __tryEvent__ = async (event, data) => {
  __workflow_history__.push({ type: 'action', name: 'try:' + event, data, timestamp: Date.now() });

  const parsed = __parseEvent__(event);
  if (!parsed) throw new Error('Invalid event format: ' + event + '. Expected Noun.event');

  const key = parsed.noun + '.' + parsed.event;
  const handlers = __event_handlers__.get(key) || [];
  if (handlers.length === 0) throw new Error('No handler registered for ' + event);

  return await handlers[0].handler(data, $);
};

// Queue implementation
const __queues__ = new Map();
const __queue_stats__ = new Map();
const queue = (name) => {
  if (!__queues__.has(name)) {
    __queues__.set(name, []);
    __queue_stats__.set(name, { added: 0, processed: 0, failed: 0, retried: 0 });
  }
  const q = __queues__.get(name);
  const stats = __queue_stats__.get(name);
  return {
    add: async (item, options = {}) => {
      const job = { id: __generateId__(), item, options, addedAt: new Date(), priority: options.priority || 'normal', attempts: 0 };
      q.push(job);
      stats.added++;
      return job;
    },
    process: async (handler) => {
      while (q.length) {
        const job = q.shift();
        try {
          job.attempts++;
          await handler(job.item);
          stats.processed++;
        } catch (e) {
          stats.failed++;
          if (job.attempts < (job.options.maxRetries || 3)) {
            q.push(job); // Retry
            stats.retried++;
          }
        }
      }
    },
    processBatch: async (handler, batchSize = 10) => {
      const batch = q.splice(0, batchSize);
      if (batch.length === 0) return;
      try {
        await handler(batch.map(j => j.item));
        stats.processed += batch.length;
      } catch (e) {
        stats.failed += batch.length;
        // Put back for retry
        for (const job of batch) {
          if (job.attempts < (job.options.maxRetries || 3)) {
            job.attempts++;
            q.push(job);
            stats.retried++;
          }
        }
      }
    },
    size: () => q.length,
    clear: () => { q.length = 0; },
    stats: () => ({ ...stats, pending: q.length }),
    peek: (n = 1) => q.slice(0, n).map(j => j.item),
    getByPriority: (priority) => q.filter(j => j.priority === priority).map(j => j.item)
  };
};

// Actor pattern implementation
const __actors__ = new Map();
const actor = (type) => ({
  register: (id, state = {}) => {
    const key = type + ':' + id;
    __actors__.set(key, { id, type, state, createdAt: new Date() });
    return __actors__.get(key);
  },
  get: (id) => __actors__.get(type + ':' + id),
  send: async (id, message) => {
    const a = __actors__.get(type + ':' + id);
    if (!a) throw new Error('Actor not found: ' + type + ':' + id);
    // Handle message (stub - in real impl would dispatch to actor handler)
    return { delivered: true };
  }
});

// Actions API (workflow actions)
const __actions__ = new Map();
const actions = {
  async create(options) {
    const id = __generateId__();
    const action = {
      id,
      actor: options.actor,
      object: options.object,
      action: options.action,
      metadata: options.metadata || {},
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    __actions__.set(id, action);
    return action;
  },
  async get(id) {
    return __actions__.get(id) || null;
  },
  async start(id) {
    const action = __actions__.get(id);
    if (!action) throw new Error('Action not found: ' + id);
    action.status = 'active';
    action.startedAt = new Date();
    action.updatedAt = new Date();
    return action;
  },
  async complete(id, result = {}) {
    const action = __actions__.get(id);
    if (!action) throw new Error('Action not found: ' + id);
    action.status = 'completed';
    action.result = result;
    action.completedAt = new Date();
    action.updatedAt = new Date();
    return action;
  },
  async fail(id, error) {
    const action = __actions__.get(id);
    if (!action) throw new Error('Action not found: ' + id);
    action.status = 'failed';
    action.error = error;
    action.failedAt = new Date();
    action.updatedAt = new Date();
    return action;
  },
  async list(options = {}) {
    let results = Array.from(__actions__.values());
    if (options.status) results = results.filter(a => a.status === options.status);
    if (options.actor) results = results.filter(a => a.actor === options.actor);
    if (options.limit) results = results.slice(0, options.limit);
    return results;
  },
  async retry(id) {
    const action = __actions__.get(id);
    if (!action) throw new Error('Action not found: ' + id);
    action.status = 'pending';
    action.retryCount = (action.retryCount || 0) + 1;
    action.updatedAt = new Date();
    return action;
  },
  async cancel(id) {
    const action = __actions__.get(id);
    if (!action) throw new Error('Action not found: ' + id);
    action.status = 'cancelled';
    action.cancelledAt = new Date();
    action.updatedAt = new Date();
    return action;
  }
};

// Artifacts API (for storing results)
const __artifacts__ = new Map();
const artifacts = {
  async store(options) {
    const id = __generateId__();
    const artifact = {
      id,
      type: options.type,
      data: options.data,
      metadata: options.metadata || {},
      createdAt: new Date()
    };
    __artifacts__.set(id, artifact);
    return artifact;
  },
  async get(id) {
    return __artifacts__.get(id) || null;
  },
  async list(options = {}) {
    let results = Array.from(__artifacts__.values());
    if (options.type) results = results.filter(a => a.type === options.type);
    if (options.limit) results = results.slice(0, options.limit);
    return results;
  }
};

// Events API (for event sourcing)
const __events__ = [];
const events = {
  async record(options) {
    const event = {
      id: __generateId__(),
      type: options.type,
      subject: options.subject,
      data: options.data,
      metadata: options.metadata || {},
      timestamp: new Date()
    };
    __events__.push(event);
    return event;
  },
  async list(options = {}) {
    let results = [...__events__];
    if (options.type) results = results.filter(e => e.type === options.type);
    if (options.subject) results = results.filter(e => e.subject === options.subject);
    if (options.limit) results = results.slice(0, options.limit);
    return results;
  },
  // Query is an alias for list with more flexible filtering
  async query(options = {}) {
    let results = [...__events__];
    if (options.type) results = results.filter(e => e.type === options.type);
    if (options.subject) results = results.filter(e => e.subject === options.subject);
    if (options.actor) results = results.filter(e => e.metadata?.actor === options.actor);
    if (options.from) results = results.filter(e => new Date(e.timestamp) >= new Date(options.from));
    if (options.to) results = results.filter(e => new Date(e.timestamp) <= new Date(options.to));
    if (options.orderBy === 'timestamp') {
      results.sort((a, b) => options.order === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);
    }
    if (options.limit) results = results.slice(0, options.limit);
    return results;
  },
  async replay(handler, options = {}) {
    const evts = await events.list(options);
    for (const evt of evts) {
      await handler(evt);
    }
  },
  // Subscribe to events
  subscribe(type, handler) {
    on(type, handler);
    return { unsubscribe: () => {} };
  },
  // Emit an event (alias for record + send)
  async emit(type, data, metadata = {}) {
    const event = await events.record({ type, data, metadata });
    await send(type, data);
    return event;
  }
};

// MDX Parsing helpers (basic implementation)
const parse = (content) => {
  const frontmatterMatch = content.match(/^---\\n([\\s\\S]*?)\\n---\\n?([\\s\\S]*)$/);
  if (!frontmatterMatch) {
    return { data: {}, content: content.trim(), type: null, id: null };
  }
  const [, frontmatter, body] = frontmatterMatch;
  const data = {};
  let currentKey = null;
  let inArray = false;
  const lines = frontmatter.split('\\n');
  for (const line of lines) {
    const keyMatch = line.match(/^(\\w+):\\s*(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      const value = keyMatch[2].trim();
      if (value === '') {
        data[currentKey] = [];
        inArray = true;
      } else {
        data[currentKey] = value;
        inArray = false;
      }
    } else if (inArray && currentKey && line.match(/^\\s+-\\s+(.+)$/)) {
      const itemMatch = line.match(/^\\s+-\\s+(.+)$/);
      if (itemMatch) {
        if (!Array.isArray(data[currentKey])) data[currentKey] = [];
        data[currentKey].push(itemMatch[1].trim());
      }
    }
  }
  return {
    data,
    content: body.trim(),
    type: data.$type || data['@type'] || null,
    id: data.$id || data['@id'] || null
  };
};

const stringify = (doc) => {
  const lines = ['---'];
  if (doc.type) lines.push('$type: ' + doc.type);
  if (doc.id) lines.push('$id: ' + doc.id);
  for (const [key, value] of Object.entries(doc.data || {})) {
    if (Array.isArray(value)) {
      lines.push(key + ':');
      for (const item of value) lines.push('  - ' + item);
    } else {
      lines.push(key + ': ' + value);
    }
  }
  lines.push('---');
  if (doc.content) lines.push('', doc.content);
  return lines.join('\\n');
};

const toAst = (doc) => {
  const children = [];
  const lines = (doc.content || '').split('\\n');
  for (const line of lines) {
    if (line.startsWith('# ')) children.push({ type: 'heading', depth: 1, text: line.slice(2) });
    else if (line.startsWith('## ')) children.push({ type: 'heading', depth: 2, text: line.slice(3) });
    else if (line.startsWith('- ')) {
      const lastList = children[children.length - 1];
      if (lastList?.type === 'list') {
        lastList.items.push(line.slice(2));
      } else {
        children.push({ type: 'list', items: [line.slice(2)] });
      }
    } else if (line.startsWith('\`\`\`')) {
      const lang = line.slice(3).trim();
      children.push({ type: 'code', lang: lang || null, value: '' });
    } else if (line.trim()) {
      children.push({ type: 'paragraph', text: line });
    }
  }
  return { type: 'root', children };
};

const renderMarkdown = (doc, options = {}) => {
  let result = '';
  if (options.includeFrontmatter && doc.data && Object.keys(doc.data).length > 0) {
    result += '---\\n';
    if (doc.type) result += '$type: ' + doc.type + '\\n';
    for (const [key, value] of Object.entries(doc.data)) {
      if (Array.isArray(value)) {
        result += key + ':\\n';
        for (const item of value) result += '  - ' + item + '\\n';
      } else {
        result += key + ': ' + value + '\\n';
      }
    }
    result += '---\\n';
  }
  result += doc.content || '';
  return result;
};

// Component factory (basic implementation)
const createComponents = (createElement) => {
  const components = {};
  const componentNames = ['Hero', 'Features', 'Pricing', 'CTA', 'Testimonials', 'FAQ', 'Footer', 'Header', 'Nav', 'Card', 'Grid', 'Section', 'Container', 'Button', 'Input', 'Form', 'Modal', 'Table', 'List', 'Badge', 'Alert', 'Progress', 'Spinner', 'Avatar', 'Image', 'Video', 'Code', 'Markdown'];
  for (const name of componentNames) {
    components[name] = (props) => createElement(name.toLowerCase() === 'hero' ? 'header' : 'section', { 'data-component': name, ...props });
  }
  return components;
};

const getComponentNames = () => ['Hero', 'Features', 'Pricing', 'CTA', 'Testimonials', 'FAQ', 'Footer', 'Header', 'Nav', 'Card', 'Grid', 'Section', 'Container', 'Button', 'Input', 'Form', 'Modal', 'Table', 'List', 'Badge', 'Alert', 'Progress', 'Spinner', 'Avatar', 'Image', 'Video', 'Code', 'Markdown'];

const getComponentMeta = (name) => ({
  category: ['Hero', 'Features', 'Pricing', 'CTA', 'Testimonials'].includes(name) ? 'landing' : 'ui',
  requiredProps: name === 'Hero' ? ['title'] : [],
  related: name === 'Hero' ? ['CTA', 'Features'] : []
});

const getComponentsByCategory = (category) => {
  if (category === 'landing') return ['Hero', 'Features', 'Pricing', 'CTA', 'Testimonials'];
  return ['Card', 'Button', 'Input', 'Form'];
};

const extractTests = (content) => {
  const tests = [];
  const regex = /\`\`\`(?:ts|js)\\s+test[^\\n]*\\n([\\s\\S]*?)\`\`\`/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    tests.push({ code: match[1].trim() });
  }
  return tests;
};

const parseMeta = (meta) => {
  const result = {};
  const parts = meta.split(/\\s+/);
  for (const part of parts) {
    if (part.includes('=')) {
      const [key, value] = part.split('=');
      result[key] = value;
    } else {
      result[part] = true;
    }
  }
  return result;
};

// Simple createElement for testing
const createElement = (type, props, ...children) => ({ type, props: props || {}, children });

// Graph/relationship helper functions
const extractLinks = (content) => {
  const links = [];
  const regex = /\\[([^\\]]+)\\]\\(([^)]+)\\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push({ text: match[1], url: match[2] });
  }
  return links;
};

const extractRelationships = (doc) => {
  const relationships = [];
  const url = doc.id || doc.url;
  if (!url) return relationships;
  // Extract from content links
  const links = extractLinks(doc.content || '');
  for (const link of links) {
    relationships.push({ from: url, to: link.url, type: 'links', label: link.text });
  }
  // Extract from data fields
  for (const [key, value] of Object.entries(doc.data || {})) {
    if (typeof value === 'string' && (value.startsWith('http') || value.startsWith('/'))) {
      relationships.push({ from: url, to: value, type: key });
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && (item.startsWith('http') || item.startsWith('/'))) {
          relationships.push({ from: url, to: item, type: key });
        }
      }
    }
  }
  return relationships;
};

const withRelationships = (doc) => {
  return { ...doc, relationships: extractRelationships(doc) };
};

const resolveUrl = (entity) => {
  if (entity.url) return entity.url;
  if (entity.ns && entity.type && entity.id) {
    return 'https://' + entity.ns + '/' + entity.type + '/' + entity.id;
  }
  if (entity.ns && entity.id) {
    return 'https://' + entity.ns + '/' + entity.id;
  }
  return null;
};

// Context object ($) - unified SDK context (aligned with ai-workflows WorkflowContext)
const $ = {
  ns: __SDK_CONFIG__.ns,
  db,
  ai,
  on,
  every,
  send,
  do: __doEvent__,
  try: __tryEvent__,
  queue,
  actor,
  actions,
  artifacts,
  events,
  decide,
  track,
  experiment,
  delay,
  // Workflow state
  state: {},
  history: __workflow_history__,
  // User context
  user: { id: 'test-user', name: 'Test User', role: 'admin' },
  request: { method: 'GET', path: '/', headers: {}, body: null },
  env: { NODE_ENV: 'test' },
  config: {},
  context: {},
  meta: {},
  // Logging
  log: (message, data) => {
    __workflow_history__.push({ type: 'action', name: 'log', data: { message, data }, timestamp: Date.now() });
    console.log('[sdk] ' + message, data ?? '');
  },
  error: console.error,
  warn: console.warn,
  // Scoped execution
  async scope(overrides, fn) {
    const prev = { ns: $.ns, user: $.user, state: { ...$.state } };
    Object.assign($, overrides);
    try { return await fn(); }
    finally { Object.assign($, prev); }
  },
  // Workflow helpers
  getHandlers() { return { events: Array.from(__event_handlers__.keys()), schedules: __schedule_handlers__.length }; },
  clearHandlers() { __event_handlers__.clear(); __schedule_handlers__.length = 0; },
  getHistory() { return [...__workflow_history__]; },
  clearHistory() { __workflow_history__.length = 0; }
};

// Standalone exports (for import { db, ai, on, send } from 'sdk')
const api = {};
const search = __db_core__.search.bind(__db_core__);
`
}

/**
 * Generate remote SDK code (RPC-based)
 *
 * This creates the platform.do-style SDK with:
 * - $ - Root context accessor
 * - db - Database operations
 * - ai - AI operations
 * - api - Platform API
 * - on/send - Event handling
 *
 * All operations go through RPC to actual services.
 */
function generateRemoteSDKCode(config: SDKConfig = {}): string {
  const rpcUrl = config.rpcUrl || 'https://rpc.do'
  const token = config.token || ''
  const ns = config.ns || 'default'

  return `
// ============================================================
// SDK - Thin RPC Proxy ($, db, ai, api, on, send)
// ============================================================

const __SDK_CONFIG__ = {
  rpcUrl: '${rpcUrl}',
  token: '${token}',
  ns: '${ns}'
};

// HTTP RPC client
const __rpc__ = {
  async do(path, ...args) {
    const headers = { 'Content-Type': 'application/json' };
    if (__SDK_CONFIG__.token) {
      headers['Authorization'] = 'Bearer ' + __SDK_CONFIG__.token;
    }

    // Serialize functions for remote execution
    const serializedArgs = args.map(arg => {
      if (typeof arg === 'function') {
        return { __fn: arg.toString().replace(/"/g, "'") };
      }
      return arg;
    });

    const response = await fetch(__SDK_CONFIG__.rpcUrl + '/rpc', {
      method: 'POST',
      headers,
      body: JSON.stringify({ method: 'do', path, args: serializedArgs })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'RPC error: ' + response.statusText);
    }

    return response.json();
  }
};

// Store for user-defined values
const __userDefinitions__ = new Map();

// Thin proxy that converts property access to RPC paths
const __createProxy__ = (path = '') => {
  // Track stored values for this proxy instance
  const localStore = new Map();

  const proxy = new Proxy(() => {}, {
    get: (target, prop, receiver) => {
      // Handle JSON serialization
      if (prop === 'toJSON') {
        // Return stored values as a plain object
        const obj = { __rpcPath: path };
        for (const [key, value] of localStore) {
          obj[key] = value;
        }
        for (const [key, value] of __userDefinitions__) {
          if (key.startsWith(path ? path + '.' : '') && !key.slice(path ? path.length + 1 : 0).includes('.')) {
            const localKey = key.slice(path ? path.length + 1 : 0);
            if (localKey) obj[localKey] = value;
          }
        }
        return () => obj;
      }
      if (prop === Symbol.toPrimitive || prop === 'valueOf' || prop === 'toString') {
        return () => path || '[SDK Proxy]';
      }
      if (prop === Symbol.toStringTag) {
        return 'SDKProxy';
      }
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return undefined; // Don't treat as thenable
      }
      // Handle .should by creating an assertion chain
      if (prop === 'should') {
        // Build an object from stored values for assertion
        const obj = {};
        for (const [key, value] of localStore) {
          obj[key] = value;
        }
        for (const [key, value] of __userDefinitions__) {
          if (key.startsWith(path ? path + '.' : '') && !key.slice(path ? path.length + 1 : 0).includes('.')) {
            const localKey = key.slice(path ? path.length + 1 : 0);
            if (localKey) obj[localKey] = value;
          }
        }
        // If we have stored values, assert on them; otherwise use path string or a marker
        if (Object.keys(obj).length > 0) {
          return __createShouldChain__(obj);
        }
        // For empty proxy, create a marker object that represents the proxy path
        return __createShouldChain__(path ? { __path: path } : { __sdk: true, ns: __SDK_CONFIG__.ns });
      }

      const fullPath = path ? path + '.' + String(prop) : String(prop);

      // Check local store first, then user definitions
      if (localStore.has(String(prop))) {
        return localStore.get(String(prop));
      }
      if (__userDefinitions__.has(fullPath)) {
        return __userDefinitions__.get(fullPath);
      }

      return __createProxy__(fullPath);
    },

    set: (_, prop, value) => {
      const fullPath = path ? path + '.' + String(prop) : String(prop);
      localStore.set(String(prop), value);
      __userDefinitions__.set(fullPath, value);
      return true;
    },

    apply: (_, __, args) => {
      // Handle tagged template literals
      if (Array.isArray(args[0]) && 'raw' in args[0]) {
        const strings = args[0];
        const values = args.slice(1);
        const text = strings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '');
        return __rpc__.do(path, text);
      }

      return __rpc__.do(path, ...args);
    },

    // Prevent enumeration from causing infinite loops
    ownKeys: () => {
      const keys = [];
      for (const [key, value] of localStore) {
        keys.push(key);
      }
      for (const [key, value] of __userDefinitions__) {
        if (key.startsWith(path ? path + '.' : '') && !key.slice(path ? path.length + 1 : 0).includes('.')) {
          const localKey = key.slice(path ? path.length + 1 : 0);
          if (localKey && !keys.includes(localKey)) keys.push(localKey);
        }
      }
      return keys;
    },

    getOwnPropertyDescriptor: (_, prop) => {
      const fullPath = path ? path + '.' + String(prop) : String(prop);
      if (localStore.has(String(prop)) || __userDefinitions__.has(fullPath)) {
        return { configurable: true, enumerable: true, writable: true };
      }
      return undefined;
    }
  });

  return proxy;
};

// Root proxy and named exports
const $ = __createProxy__();
const db = $.db;
const ai = $.ai;
const api = $.api;
const on = $.on;
const send = $.send;
const search = $.search;
const track = $.track;
const every = $.every;
const decide = $.decide;

// Set default namespace and context properties
$.ns = __SDK_CONFIG__.ns;
$.user = { id: 'anonymous', name: 'Anonymous', role: 'guest' };
$.request = { method: 'GET', path: '/', headers: {}, body: null };
$.env = typeof process !== 'undefined' ? (process.env || {}) : {};
$.config = {};
$.context = {};
$.meta = {};
`
}

/**
 * Generate .should chainable assertions code
 */
function generateShouldCode(): string {
  return `
// ============================================================
// Global .should Chainable Assertions
// ============================================================

const __createShouldChain__ = (actual, negated = false) => {
  const check = (condition, message) => {
    const passes = negated ? !condition : condition;
    if (!passes) throw new Error(negated ? 'Expected NOT: ' + message : message);
  };

  const stringify = (val) => {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  };

  // Create a lazy chain getter - returns 'this' assertion for chaining
  const assertion = {};

  // Core assertion methods
  assertion.equal = (expected) => {
    check(actual === expected, 'Expected ' + stringify(actual) + ' to equal ' + stringify(expected));
    return assertion;
  };
  assertion.deep = {
    equal: (expected) => {
      check(stringify(actual) === stringify(expected), 'Expected deep equal to ' + stringify(expected));
      return assertion;
    },
    include: (expected) => {
      const actualStr = stringify(actual);
      const expectedStr = stringify(expected);
      // Check if expected properties exist with same values
      const matches = Object.entries(expected || {}).every(([k, v]) =>
        actual && stringify(actual[k]) === stringify(v)
      );
      check(matches, 'Expected ' + actualStr + ' to deeply include ' + expectedStr);
      return assertion;
    }
  };
  assertion.include = (value) => {
    if (typeof actual === 'string') check(actual.includes(String(value)), 'Expected "' + actual + '" to include "' + value + '"');
    else if (Array.isArray(actual)) check(actual.includes(value), 'Expected array to include ' + stringify(value));
    return assertion;
  };
  assertion.contain = assertion.include;
  assertion.lengthOf = (n) => {
    check(actual?.length === n, 'Expected length ' + n + ', got ' + actual?.length);
    return assertion;
  };
  assertion.match = (regex) => {
    const str = String(actual);
    check(regex.test(str), 'Expected "' + str + '" to match ' + regex);
    return assertion;
  };
  assertion.matches = assertion.match;

  // .be accessor with type checks
  Object.defineProperty(assertion, 'be', {
    get: () => {
      const beObj = {
        a: (type) => {
          const actualType = actual === null ? 'null' : Array.isArray(actual) ? 'array' : actual instanceof Date ? 'date' : typeof actual;
          check(actualType === type.toLowerCase(), 'Expected ' + stringify(actual) + ' to be a ' + type);
          return assertion;
        },
        above: (n) => { check(actual > n, 'Expected ' + actual + ' to be above ' + n); return assertion; },
        below: (n) => { check(actual < n, 'Expected ' + actual + ' to be below ' + n); return assertion; },
        within: (min, max) => { check(actual >= min && actual <= max, 'Expected ' + actual + ' to be within ' + min + '..' + max); return assertion; },
        oneOf: (arr) => { check(Array.isArray(arr) && arr.includes(actual), 'Expected ' + stringify(actual) + ' to be one of ' + stringify(arr)); return assertion; },
        instanceOf: (cls) => { check(actual instanceof cls, 'Expected to be instance of ' + cls.name); return assertion; }
      };
      beObj.an = beObj.a;
      Object.defineProperty(beObj, 'true', { get: () => { check(actual === true, 'Expected ' + stringify(actual) + ' to be true'); return assertion; } });
      Object.defineProperty(beObj, 'false', { get: () => { check(actual === false, 'Expected ' + stringify(actual) + ' to be false'); return assertion; } });
      Object.defineProperty(beObj, 'ok', { get: () => { check(!!actual, 'Expected ' + stringify(actual) + ' to be truthy'); return assertion; } });
      Object.defineProperty(beObj, 'null', { get: () => { check(actual === null, 'Expected ' + stringify(actual) + ' to be null'); return assertion; } });
      Object.defineProperty(beObj, 'undefined', { get: () => { check(actual === undefined, 'Expected ' + stringify(actual) + ' to be undefined'); return assertion; } });
      Object.defineProperty(beObj, 'empty', { get: () => {
        const isEmpty = actual === '' || (Array.isArray(actual) && actual.length === 0) || (actual && typeof actual === 'object' && Object.keys(actual).length === 0);
        check(isEmpty, 'Expected ' + stringify(actual) + ' to be empty');
        return assertion;
      }});
      return beObj;
    }
  });

  // .have accessor with property/keys/lengthOf/at checks
  Object.defineProperty(assertion, 'have', {
    get: () => ({
      property: (name, value) => {
        const hasIt = actual != null && Object.prototype.hasOwnProperty.call(actual, name);
        if (value !== undefined) {
          check(hasIt && actual[name] === value, "Expected property '" + name + "' = " + stringify(value) + ", got " + stringify(actual?.[name]));
        } else {
          check(hasIt, "Expected to have property '" + name + "'");
        }
        if (hasIt) return __createShouldChain__(actual[name], negated);
        return assertion;
      },
      keys: (...keys) => {
        const actualKeys = Object.keys(actual || {});
        check(keys.every(k => actualKeys.includes(k)), 'Expected to have keys ' + stringify(keys));
        return assertion;
      },
      lengthOf: (n) => {
        check(actual?.length === n, 'Expected length ' + n + ', got ' + actual?.length);
        return assertion;
      },
      at: {
        least: (n) => {
          check(actual?.length >= n, 'Expected length at least ' + n + ', got ' + actual?.length);
          return assertion;
        },
        most: (n) => {
          check(actual?.length <= n, 'Expected length at most ' + n + ', got ' + actual?.length);
          return assertion;
        }
      }
    })
  });

  // .not negation
  Object.defineProperty(assertion, 'not', {
    get: () => __createShouldChain__(actual, !negated)
  });

  // .with passthrough for readability
  Object.defineProperty(assertion, 'with', {
    get: () => assertion
  });

  // .that passthrough for chaining (e.g. .have.property('x').that.matches(/.../) )
  Object.defineProperty(assertion, 'that', {
    get: () => assertion
  });

  // .and passthrough for chaining
  Object.defineProperty(assertion, 'and', {
    get: () => assertion
  });

  return assertion;
};

// Add .should to Object.prototype
Object.defineProperty(Object.prototype, 'should', {
  get: function() { return __createShouldChain__(this); },
  configurable: true,
  enumerable: false
});
`
}

/**
 * Extract export names from module code
 * Supports both CommonJS (exports.foo) and ES module (export const foo) syntax
 */
function getExportNames(moduleCode: string): string {
  const names = new Set<string>()

  // Match exports.name = ...
  const dotPattern = /exports\.(\w+)\s*=/g
  let match
  while ((match = dotPattern.exec(moduleCode)) !== null) {
    if (match[1]) names.add(match[1])
  }

  // Match exports['name'] = ... or exports["name"] = ...
  const bracketPattern = /exports\[['"](\w+)['"]\]\s*=/g
  while ((match = bracketPattern.exec(moduleCode)) !== null) {
    if (match[1]) names.add(match[1])
  }

  // Match export const name = ... or export let name = ... or export var name = ...
  const esConstPattern = /export\s+(?:const|let|var)\s+(\w+)\s*=/g
  while ((match = esConstPattern.exec(moduleCode)) !== null) {
    if (match[1]) names.add(match[1])
  }

  // Match export function name(...) or export async function name(...) or export async function* name(...)
  const esFunctionPattern = /export\s+(?:async\s+)?function\*?\s+(\w+)\s*\(/g
  while ((match = esFunctionPattern.exec(moduleCode)) !== null) {
    if (match[1]) names.add(match[1])
  }

  // Match export class name
  const esClassPattern = /export\s+class\s+(\w+)/g
  while ((match = esClassPattern.exec(moduleCode)) !== null) {
    if (match[1]) names.add(match[1])
  }

  return Array.from(names).join(', ') || '_unused'
}

/**
 * Transform module code to work in sandbox
 * Converts ES module exports to CommonJS-style for the sandbox
 */
function transformModuleCode(moduleCode: string): string {
  let code = moduleCode

  // Transform: export const foo = ... → const foo = ...; exports.foo = foo;
  code = code.replace(/export\s+(const|let|var)\s+(\w+)\s*=/g, '$1 $2 = exports.$2 =')

  // Transform: export function foo(...) → function foo(...) exports.foo = foo;
  // Also handles async generators: export async function* foo
  code = code.replace(/export\s+(async\s+)?function(\*?)\s+(\w+)/g, '$1function$2 $3')
  // Add exports for functions after their definition
  const funcNames = [...moduleCode.matchAll(/export\s+(?:async\s+)?function\*?\s+(\w+)/g)]
  for (const [, name] of funcNames) {
    code += `\nexports.${name} = ${name};`
  }

  // Transform: export class Foo → class Foo; exports.Foo = Foo;
  code = code.replace(/export\s+class\s+(\w+)/g, 'class $1')
  const classNames = [...moduleCode.matchAll(/export\s+class\s+(\w+)/g)]
  for (const [, name] of classNames) {
    code += `\nexports.${name} = ${name};`
  }

  return code
}

/**
 * Wrap script to auto-return the last expression
 * Converts: `add(1, 2)` → `return add(1, 2)`
 */
function wrapScriptForReturn(script: string): string {
  const trimmed = script.trim()
  if (!trimmed) return script

  // If script already contains a return statement anywhere, don't modify
  if (/\breturn\b/.test(trimmed)) return script

  // If script starts with throw, don't modify
  if (/^\s*throw\b/.test(trimmed)) return script

  // If it's a single expression (no newlines, no semicolons except at end), wrap it
  const withoutTrailingSemi = trimmed.replace(/;?\s*$/, '')
  const isSingleLine = !withoutTrailingSemi.includes('\n')

  // Check if it looks like a single expression (no control flow, no declarations)
  const startsWithKeyword =
    /^\s*(const|let|var|if|for|while|switch|try|class|function|async\s+function)\b/.test(
      withoutTrailingSemi
    )

  if (isSingleLine && !startsWithKeyword) {
    return `return ${withoutTrailingSemi}`
  }

  // For multi-statement scripts, try to return the last expression
  const lines = trimmed.split('\n')
  const lastLineRaw = lines[lines.length - 1]
  if (!lastLineRaw) return script
  const lastLine = lastLineRaw.trim()

  // If last line is an expression (not a declaration, control flow, or throw)
  if (
    lastLine &&
    !/^\s*(const|let|var|if|for|while|switch|try|class|function|return|throw)\b/.test(lastLine)
  ) {
    lines[lines.length - 1] = `return ${lastLine.replace(/;?\s*$/, '')}`
    return lines.join('\n')
  }

  return script
}

/**
 * Generate worker code for production (uses RPC to ai-tests)
 */
export function generateWorkerCode(options: {
  module?: string | undefined
  tests?: string | undefined
  script?: string | undefined
  sdk?: SDKConfig | boolean | undefined
  imports?: string[] | undefined
}): string {
  const { module: rawModule = '', tests = '', script: rawScript = '', sdk, imports = [] } = options
  const sdkConfig = sdk === true ? {} : sdk || null
  const module = rawModule ? transformModuleCode(rawModule) : ''
  const script = rawScript ? wrapScriptForReturn(rawScript) : ''
  const exportNames = getExportNames(rawModule)

  // Hoisted imports (from MDX test files) - placed at true module top level
  const hoistedImports = imports.length > 0 ? imports.join('\n') + '\n' : ''

  return `
// Sandbox Worker Entry Point
import { RpcTarget, newWorkersRpcResponse } from 'capnweb.js';
${hoistedImports}
const logs = [];

${sdkConfig ? generateShouldCode() : ''}

${sdkConfig ? generateSDKCode(sdkConfig) : '// SDK not enabled'}

// Capture console output
const originalConsole = { ...console };
const captureConsole = (level) => (...args) => {
  logs.push({
    level,
    message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
    timestamp: Date.now()
  });
  originalConsole[level](...args);
};
console.log = captureConsole('log');
console.warn = captureConsole('warn');
console.error = captureConsole('error');
console.info = captureConsole('info');
console.debug = captureConsole('debug');

// ============================================================
// USER MODULE CODE (embedded at generation time)
// ============================================================
// Module exports object - exports become top-level variables
const exports = {};

${
  module
    ? `
// Execute module code
try {
${module}
} catch (e) {
  console.error('Module error:', e.message);
}
`
    : '// No module code provided'
}

// Expose all exports as top-level variables for tests and scripts
// This allows: export const add = (a, b) => a + b; then later: add(1, 2)
${
  rawModule
    ? `
const { ${exportNames} } = exports;
`.trim()
    : ''
}

// ============================================================
// RPC SERVER - Expose exports via capnweb
// ============================================================
class ExportsRpcTarget extends RpcTarget {
  // Dynamically expose all exports as RPC methods
  constructor() {
    super();
    for (const [key, value] of Object.entries(exports)) {
      if (typeof value === 'function') {
        this[key] = value;
      }
    }
  }

  // List available exports
  list() {
    return Object.keys(exports);
  }

  // Get an export by name
  get(name) {
    return exports[name];
  }
}

// ============================================================
// WORKER ENTRY POINT
// ============================================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Route: GET / - Return info about exports
    if (request.method === 'GET' && url.pathname === '/') {
      return Response.json({
        exports: Object.keys(exports),
        rpc: '/rpc',
        execute: '/execute'
      });
    }

    // Route: /rpc - capnweb RPC to module exports
    if (url.pathname === '/rpc') {
      return newWorkersRpcResponse(request, new ExportsRpcTarget());
    }

    // Route: GET /:name - Simple JSON endpoint to access exports
    if (request.method === 'GET' && url.pathname !== '/execute') {
      const name = url.pathname.slice(1); // Remove leading /
      const value = exports[name];

      // Check if export exists
      if (!(name in exports)) {
        return Response.json({ error: \`Export "\${name}" not found\` }, { status: 404 });
      }

      // If it's not a function, just return the value
      if (typeof value !== 'function') {
        return Response.json({ result: value });
      }

      // It's a function - parse args and call it
      try {
        const args = [];
        const argsParam = url.searchParams.get('args');
        if (argsParam) {
          // Support JSON array: ?args=[1,2,3]
          try {
            const parsed = JSON.parse(argsParam);
            if (Array.isArray(parsed)) {
              args.push(...parsed);
            } else {
              args.push(parsed);
            }
          } catch {
            // Not JSON, use as single string arg
            args.push(argsParam);
          }
        } else {
          // Support named params: ?a=1&b=2 -> passed as object
          const params = Object.fromEntries(url.searchParams.entries());
          if (Object.keys(params).length > 0) {
            // Try to parse numeric values
            for (const [key, val] of Object.entries(params)) {
              const num = Number(val);
              params[key] = !isNaN(num) && val !== '' ? num : val;
            }
            args.push(params);
          }
        }

        const result = await value(...args);
        return Response.json({ result });
      } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
      }
    }

    // Route: /execute - Run tests and scripts
    // Check for TEST service binding
    if (!env.TEST) {
      return Response.json({
        success: false,
        error: 'TEST service binding not available. Ensure ai-tests worker is bound.',
        logs,
        duration: 0
      });
    }

    // Connect to get the TestServiceCore via RPC
    const testService = await env.TEST.connect();

    // Create global test functions that proxy to the RPC service
    const describe = (name, fn) => testService.describe(name, fn);
    const it = (name, fn) => testService.it(name, fn);
    const test = (name, fn) => testService.test(name, fn);
    const expect = (value, message) => testService.expect(value, message);
    const should = (value) => testService.should(value);
    const assert = testService.assert;
    const beforeEach = (fn) => testService.beforeEach(fn);
    const afterEach = (fn) => testService.afterEach(fn);
    const beforeAll = (fn) => testService.beforeAll(fn);
    const afterAll = (fn) => testService.afterAll(fn);

    // Add skip/only modifiers
    it.skip = (name, fn) => testService.skip(name, fn);
    it.only = (name, fn) => testService.only(name, fn);
    test.skip = it.skip;
    test.only = it.only;

    let scriptResult = undefined;
    let scriptError = null;
    let testResults = undefined;

    // ============================================================
    // USER TEST CODE (embedded at generation time)
    // ============================================================

    ${
      tests
        ? `
    // Register tests
    try {
${tests}
    } catch (e) {
      console.error('Test registration error:', e.message);
    }
    `
        : '// No test code provided'
    }

    // Execute user script
    ${
      script
        ? `
    try {
      scriptResult = await (async () => {
${script}
      })();
    } catch (e) {
      console.error('Script error:', e.message);
      scriptError = e.message;
    }
    `
        : '// No script code provided'
    }

    // Run tests if any were registered
    ${
      tests
        ? `
    try {
      testResults = await testService.run();
    } catch (e) {
      console.error('Test run error:', e.message);
      testResults = { total: 0, passed: 0, failed: 1, skipped: 0, tests: [], duration: 0, error: e.message };
    }
    `
        : ''
    }

    const hasTests = ${tests ? 'true' : 'false'};
    const success = scriptError === null && (!hasTests || (testResults && testResults.failed === 0));

    return Response.json({
      success,
      value: scriptResult,
      logs,
      testResults: hasTests ? testResults : undefined,
      error: scriptError || undefined,
      duration: 0
    });
  }
};
`
}

/**
 * Generate worker code for development (embedded test framework)
 *
 * This version bundles the test framework directly into the worker,
 * avoiding the need for RPC service bindings in local development.
 */
export function generateDevWorkerCode(options: {
  module?: string | undefined
  tests?: string | undefined
  script?: string | undefined
  sdk?: SDKConfig | boolean | undefined
  imports?: string[] | undefined
  fetch?: null | undefined
}): string {
  const {
    module: rawModule = '',
    tests = '',
    script: rawScript = '',
    sdk,
    imports = [],
    fetch: fetchOption,
  } = options
  const sdkConfig = sdk === true ? {} : sdk || null
  const module = rawModule ? transformModuleCode(rawModule) : ''
  const script = rawScript ? wrapScriptForReturn(rawScript) : ''
  const exportNames = getExportNames(rawModule)
  const blockFetch = fetchOption === null

  // Hoisted imports (from MDX test files) - placed at true module top level
  const hoistedImports = imports.length > 0 ? imports.join('\n') + '\n' : ''

  return `
// Sandbox Worker Entry Point (Dev Mode - embedded test framework)
${hoistedImports}
const logs = [];
const testResults = { total: 0, passed: 0, failed: 0, skipped: 0, tests: [], duration: 0 };
const pendingTests = [];

${
  blockFetch
    ? `
// Block fetch when fetch: null is specified
const __originalFetch__ = globalThis.fetch;
globalThis.fetch = async (...args) => {
  throw new Error('Network access blocked: fetch is disabled in this sandbox');
};
`
    : ''
}

${sdkConfig ? generateShouldCode() : ''}

${sdkConfig ? generateSDKCode(sdkConfig) : '// SDK not enabled'}

// Capture console output
const originalConsole = { ...console };
const captureConsole = (level) => (...args) => {
  logs.push({
    level,
    message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
    timestamp: Date.now()
  });
  originalConsole[level](...args);
};
console.log = captureConsole('log');
console.warn = captureConsole('warn');
console.error = captureConsole('error');
console.info = captureConsole('info');
console.debug = captureConsole('debug');

// Test framework (vitest-compatible API)
let currentDescribe = '';
let beforeEachFns = [];
let afterEachFns = [];

const describe = (name, fn) => {
  const prev = currentDescribe;
  const prevBeforeEach = [...beforeEachFns];
  const prevAfterEach = [...afterEachFns];
  currentDescribe = currentDescribe ? currentDescribe + ' > ' + name : name;
  try { fn(); } finally {
    currentDescribe = prev;
    beforeEachFns = prevBeforeEach;
    afterEachFns = prevAfterEach;
  }
};

// Hooks
const beforeEach = (fn) => { beforeEachFns.push(fn); };
const afterEach = (fn) => { afterEachFns.push(fn); };

const it = (name, fn) => {
  const fullName = currentDescribe ? currentDescribe + ' > ' + name : name;
  const hooks = { before: [...beforeEachFns], after: [...afterEachFns] };
  pendingTests.push({ name: fullName, fn, hooks });
};
const test = it;

it.skip = (name, fn) => {
  const fullName = currentDescribe ? currentDescribe + ' > ' + name : name;
  pendingTests.push({ name: fullName, fn: null, skip: true });
};
test.skip = it.skip;

it.only = (name, fn) => {
  const fullName = currentDescribe ? currentDescribe + ' > ' + name : name;
  const hooks = { before: [...beforeEachFns], after: [...afterEachFns] };
  pendingTests.push({ name: fullName, fn, hooks, only: true });
};
test.only = it.only;

// Deep equality check
const deepEqual = (a, b) => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(k => deepEqual(a[k], b[k]));
};

// Expect implementation with vitest-compatible matchers
const expect = (actual) => {
  const matchers = {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(\`Expected \${JSON.stringify(expected)} but got \${JSON.stringify(actual)}\`);
      }
    },
    toEqual: (expected) => {
      if (!deepEqual(actual, expected)) {
        throw new Error(\`Expected \${JSON.stringify(expected)} but got \${JSON.stringify(actual)}\`);
      }
    },
    toStrictEqual: (expected) => {
      if (!deepEqual(actual, expected)) {
        throw new Error(\`Expected \${JSON.stringify(expected)} but got \${JSON.stringify(actual)}\`);
      }
    },
    toBeTruthy: () => {
      if (!actual) throw new Error(\`Expected truthy but got \${JSON.stringify(actual)}\`);
    },
    toBeFalsy: () => {
      if (actual) throw new Error(\`Expected falsy but got \${JSON.stringify(actual)}\`);
    },
    toBeNull: () => {
      if (actual !== null) throw new Error(\`Expected null but got \${JSON.stringify(actual)}\`);
    },
    toBeUndefined: () => {
      if (actual !== undefined) throw new Error(\`Expected undefined but got \${JSON.stringify(actual)}\`);
    },
    toBeDefined: () => {
      if (actual === undefined) throw new Error('Expected defined but got undefined');
    },
    toBeNaN: () => {
      if (!Number.isNaN(actual)) throw new Error(\`Expected NaN but got \${actual}\`);
    },
    toContain: (item) => {
      if (Array.isArray(actual)) {
        if (!actual.includes(item)) throw new Error(\`Expected array to contain \${JSON.stringify(item)}\`);
      } else if (typeof actual === 'string') {
        if (!actual.includes(item)) throw new Error(\`Expected string to contain "\${item}"\`);
      } else {
        throw new Error('toContain only works on arrays and strings');
      }
    },
    toContainEqual: (item) => {
      if (!Array.isArray(actual)) throw new Error('toContainEqual only works on arrays');
      if (!actual.some(v => deepEqual(v, item))) {
        throw new Error(\`Expected array to contain \${JSON.stringify(item)}\`);
      }
    },
    toHaveLength: (length) => {
      if (actual?.length !== length) {
        throw new Error(\`Expected length \${length} but got \${actual?.length}\`);
      }
    },
    toHaveProperty: function(path, value) {
      const parts = typeof path === 'string' ? path.split('.') : [path];
      let obj = actual;
      for (const part of parts) {
        if (obj == null || !(part in obj)) {
          throw new Error(\`Expected object to have property "\${path}"\`);
        }
        obj = obj[part];
      }
      if (arguments.length > 1 && !deepEqual(obj, value)) {
        throw new Error(\`Expected property "\${path}" to be \${JSON.stringify(value)} but got \${JSON.stringify(obj)}\`);
      }
    },
    toMatchObject: (expected) => {
      if (typeof actual !== 'object' || actual === null) {
        throw new Error('toMatchObject expects an object');
      }
      for (const key of Object.keys(expected)) {
        if (!deepEqual(actual[key], expected[key])) {
          throw new Error(\`Expected property "\${key}" to be \${JSON.stringify(expected[key])} but got \${JSON.stringify(actual[key])}\`);
        }
      }
    },
    toThrow: (expected) => {
      if (typeof actual !== 'function') throw new Error('toThrow expects a function');
      let threw = false;
      let error;
      try {
        actual();
      } catch (e) {
        threw = true;
        error = e;
      }
      if (!threw) throw new Error('Expected function to throw');
      if (expected !== undefined) {
        if (typeof expected === 'string' && !error.message.includes(expected)) {
          throw new Error(\`Expected error message to contain "\${expected}" but got "\${error.message}"\`);
        }
        if (expected instanceof RegExp && !expected.test(error.message)) {
          throw new Error(\`Expected error message to match \${expected} but got "\${error.message}"\`);
        }
        if (typeof expected === 'function' && !(error instanceof expected)) {
          throw new Error(\`Expected error to be instance of \${expected.name}\`);
        }
      }
    },
    toBeGreaterThan: (n) => {
      if (!(actual > n)) throw new Error(\`Expected \${actual} to be greater than \${n}\`);
    },
    toBeLessThan: (n) => {
      if (!(actual < n)) throw new Error(\`Expected \${actual} to be less than \${n}\`);
    },
    toBeGreaterThanOrEqual: (n) => {
      if (!(actual >= n)) throw new Error(\`Expected \${actual} to be >= \${n}\`);
    },
    toBeLessThanOrEqual: (n) => {
      if (!(actual <= n)) throw new Error(\`Expected \${actual} to be <= \${n}\`);
    },
    toBeCloseTo: (n, digits = 2) => {
      const diff = Math.abs(actual - n);
      const threshold = Math.pow(10, -digits) / 2;
      if (diff > threshold) {
        throw new Error(\`Expected \${actual} to be close to \${n}\`);
      }
    },
    toMatch: (pattern) => {
      if (typeof actual !== 'string') throw new Error('toMatch expects a string');
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      if (!regex.test(actual)) {
        throw new Error(\`Expected "\${actual}" to match \${pattern}\`);
      }
    },
    toBeInstanceOf: (cls) => {
      if (!(actual instanceof cls)) {
        throw new Error(\`Expected instance of \${cls.name}\`);
      }
    },
    toBeTypeOf: (type) => {
      if (typeof actual !== type) {
        throw new Error(\`Expected typeof to be "\${type}" but got "\${typeof actual}"\`);
      }
    },
  };

  matchers.not = {
    toBe: (expected) => {
      if (actual === expected) throw new Error(\`Expected not \${JSON.stringify(expected)}\`);
    },
    toEqual: (expected) => {
      if (deepEqual(actual, expected)) {
        throw new Error(\`Expected not equal to \${JSON.stringify(expected)}\`);
      }
    },
    toBeTruthy: () => {
      if (actual) throw new Error('Expected not truthy');
    },
    toBeFalsy: () => {
      if (!actual) throw new Error('Expected not falsy');
    },
    toBeNull: () => {
      if (actual === null) throw new Error('Expected not null');
    },
    toBeUndefined: () => {
      if (actual === undefined) throw new Error('Expected not undefined');
    },
    toBeDefined: () => {
      if (actual !== undefined) throw new Error('Expected undefined');
    },
    toContain: (item) => {
      if (Array.isArray(actual) && actual.includes(item)) {
        throw new Error(\`Expected array not to contain \${JSON.stringify(item)}\`);
      }
      if (typeof actual === 'string' && actual.includes(item)) {
        throw new Error(\`Expected string not to contain "\${item}"\`);
      }
    },
    toHaveProperty: (path) => {
      const parts = typeof path === 'string' ? path.split('.') : [path];
      let obj = actual;
      try {
        for (const part of parts) {
          if (obj == null || !(part in obj)) return;
          obj = obj[part];
        }
        throw new Error(\`Expected object not to have property "\${path}"\`);
      } catch {}
    },
    toThrow: () => {
      if (typeof actual !== 'function') throw new Error('toThrow expects a function');
      try {
        actual();
      } catch (e) {
        throw new Error('Expected function not to throw');
      }
    },
    toMatch: (pattern) => {
      if (typeof actual !== 'string') throw new Error('toMatch expects a string');
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      if (regex.test(actual)) {
        throw new Error(\`Expected "\${actual}" not to match \${pattern}\`);
      }
    },
  };

  matchers.resolves = new Proxy({}, {
    get: (_, prop) => async (...args) => {
      const resolved = await actual;
      return expect(resolved)[prop](...args);
    }
  });

  matchers.rejects = new Proxy({}, {
    get: (_, prop) => async (...args) => {
      try {
        await actual;
        throw new Error('Expected promise to reject');
      } catch (e) {
        if (e.message === 'Expected promise to reject') throw e;
        return expect(e)[prop](...args);
      }
    }
  });

  return matchers;
};

// ============================================================
// USER MODULE CODE (embedded at generation time)
// ============================================================
// Module exports object - exports become top-level variables
const exports = {};

${
  module
    ? `
// Execute module code
try {
${module}
} catch (e) {
  console.error('Module error:', e.message);
}
`
    : '// No module code provided'
}

// Expose all exports as top-level variables for tests and scripts
// This allows: export const add = (a, b) => a + b; then later: add(1, 2)
${
  rawModule
    ? `
const { ${exportNames} } = exports;
`.trim()
    : ''
}

// ============================================================
// USER TEST CODE (embedded at generation time)
// ============================================================
${
  tests
    ? `
// Register tests
try {
${tests}
} catch (e) {
  console.error('Test registration error:', e.message);
}
`
    : '// No test code provided'
}

// ============================================================
// SIMPLE RPC HANDLER (dev mode - no capnweb dependency)
// ============================================================
async function handleRpc(request) {
  try {
    const { method, args = [] } = await request.json();
    if (method === 'list') {
      return Response.json({ result: Object.keys(exports) });
    }
    if (method === 'get') {
      const [name] = args;
      const value = exports[name];
      if (typeof value === 'function') {
        return Response.json({ result: { type: 'function', name } });
      }
      return Response.json({ result: value });
    }
    // Call an exported function
    const fn = exports[method];
    if (typeof fn !== 'function') {
      return Response.json({ error: \`Export "\${method}" is not a function\` }, { status: 400 });
    }
    const result = await fn(...args);
    return Response.json({ result });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// ============================================================
// WORKER ENTRY POINT
// ============================================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Route: GET / - Return info about exports
    if (request.method === 'GET' && url.pathname === '/') {
      return Response.json({
        exports: Object.keys(exports),
        rpc: '/rpc',
        execute: '/execute'
      });
    }

    // Route: POST /rpc - Simple RPC to module exports
    if (url.pathname === '/rpc' && request.method === 'POST') {
      return handleRpc(request);
    }

    // Route: GET /:name - Simple JSON endpoint to access exports
    if (request.method === 'GET' && url.pathname !== '/execute') {
      const name = url.pathname.slice(1);
      const value = exports[name];

      // Check if export exists
      if (!(name in exports)) {
        return Response.json({ error: \`Export "\${name}" not found\` }, { status: 404 });
      }

      // If it's not a function, just return the value
      if (typeof value !== 'function') {
        return Response.json({ result: value });
      }

      // It's a function - parse args and call it
      try {
        const args = [];
        const argsParam = url.searchParams.get('args');
        if (argsParam) {
          try {
            const parsed = JSON.parse(argsParam);
            if (Array.isArray(parsed)) args.push(...parsed);
            else args.push(parsed);
          } catch {
            args.push(argsParam);
          }
        } else {
          const params = Object.fromEntries(url.searchParams.entries());
          if (Object.keys(params).length > 0) {
            for (const [key, val] of Object.entries(params)) {
              const num = Number(val);
              params[key] = !isNaN(num) && val !== '' ? num : val;
            }
            args.push(params);
          }
        }
        const result = await value(...args);
        return Response.json({ result });
      } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
      }
    }

    // Route: /execute - Run tests and scripts
    let scriptResult = undefined;
    let scriptError = null;

    // Execute user script
    ${
      script
        ? `
    try {
      scriptResult = await (async () => {
${script}
      })();
    } catch (e) {
      console.error('Script error:', e.message);
      scriptError = e.message;
    }
    `
        : '// No script code provided'
    }

    // Run all pending tests
    const testStart = Date.now();
    const hasOnly = pendingTests.some(t => t.only);
    const testsToRun = hasOnly ? pendingTests.filter(t => t.only || t.skip) : pendingTests;

    for (const { name, fn, hooks, skip } of testsToRun) {
      testResults.total++;

      if (skip) {
        testResults.skipped++;
        testResults.tests.push({ name, passed: true, skipped: true, duration: 0 });
        continue;
      }

      const start = Date.now();
      try {
        // Run beforeEach hooks
        if (hooks?.before) {
          for (const hook of hooks.before) {
            const hookResult = hook();
            if (hookResult && typeof hookResult.then === 'function') {
              await hookResult;
            }
          }
        }

        // Run the test
        const result = fn();
        if (result && typeof result.then === 'function') {
          await result;
        }

        // Run afterEach hooks
        if (hooks?.after) {
          for (const hook of hooks.after) {
            const hookResult = hook();
            if (hookResult && typeof hookResult.then === 'function') {
              await hookResult;
            }
          }
        }

        testResults.passed++;
        testResults.tests.push({ name, passed: true, duration: Date.now() - start });
      } catch (e) {
        testResults.failed++;
        testResults.tests.push({
          name,
          passed: false,
          error: e.message || String(e),
          duration: Date.now() - start
        });
      }
    }

    testResults.duration = Date.now() - testStart;

    const hasTests = ${tests ? 'true' : 'false'};
    const success = scriptError === null && (!hasTests || testResults.failed === 0);

    return Response.json({
      success,
      value: scriptResult,
      logs,
      testResults: hasTests ? testResults : undefined,
      error: scriptError || undefined,
      duration: 0
    });
  }
};
`
}
