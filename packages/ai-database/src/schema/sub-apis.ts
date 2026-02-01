/**
 * Sub-API Factories
 *
 * Creates the Events, Actions, Artifacts, Nouns, and Verbs APIs
 * that are returned alongside the main DB object.
 *
 * These APIs provide access to:
 * - Events: Event sourcing and subscription
 * - Actions: Durable execution tracking
 * - Artifacts: Cached computed content
 * - Nouns: Type introspection
 * - Verbs: Action introspection and conjugation
 */

import type {
  EventsAPI,
  ActionsAPI,
  ArtifactsAPI,
  NounsAPI,
  VerbsAPI,
  CreateEventOptions,
  CreateActionOptions,
  DBEvent,
  DBAction,
} from './types.js'
import type { Noun, Verb } from '../types.js'
import type { DBProvider } from './provider.js'
import { hasEventsAPI, hasActionsAPI, hasArtifactsAPI } from './provider.js'
import { conjugate } from '../linguistic.js'

/**
 * Create the Events API
 *
 * @param resolveProvider - Function to get the database provider
 * @returns EventsAPI implementation
 */
export function createEventsAPI(resolveProvider: () => Promise<DBProvider>): EventsAPI {
  return {
    on(pattern, handler) {
      let unsubscribe = () => {}
      resolveProvider().then((provider) => {
        if (hasEventsAPI(provider)) {
          unsubscribe = provider.on(pattern, handler)
        }
      })
      return () => unsubscribe()
    },

    async emit(optionsOrType: CreateEventOptions | string, data?: unknown): Promise<DBEvent> {
      const provider = await resolveProvider()
      if (hasEventsAPI(provider)) {
        if (typeof optionsOrType === 'string') {
          return provider.emit(optionsOrType, data)
        }
        return provider.emit(optionsOrType)
      }
      // Return minimal event if provider doesn't support emit
      const now = new Date()
      if (typeof optionsOrType === 'string') {
        const baseEvent: DBEvent = {
          id: crypto.randomUUID(),
          actor: 'system',
          event: optionsOrType,
          timestamp: now,
        }
        if (data !== undefined) baseEvent.objectData = data as Record<string, unknown>
        return baseEvent
      }
      const baseEvent: DBEvent = {
        id: crypto.randomUUID(),
        actor: optionsOrType.actor,
        event: optionsOrType.event,
        timestamp: now,
      }
      if (optionsOrType.actorData !== undefined) baseEvent.actorData = optionsOrType.actorData
      if (optionsOrType.object !== undefined) baseEvent.object = optionsOrType.object
      if (optionsOrType.objectData !== undefined) baseEvent.objectData = optionsOrType.objectData
      if (optionsOrType.result !== undefined) baseEvent.result = optionsOrType.result
      if (optionsOrType.resultData !== undefined) baseEvent.resultData = optionsOrType.resultData
      if (optionsOrType.meta !== undefined) baseEvent.meta = optionsOrType.meta
      return baseEvent
    },

    async list(options) {
      const provider = await resolveProvider()
      if (hasEventsAPI(provider)) {
        return provider.listEvents(options)
      }
      return []
    },

    async replay(options) {
      const provider = await resolveProvider()
      if (hasEventsAPI(provider)) {
        await provider.replayEvents(options)
      }
    },
  }
}

/**
 * Create the Actions API (public version with full DBAction types)
 *
 * @param resolveProvider - Function to get the database provider
 * @returns ActionsAPI implementation
 */
export function createActionsPublicAPI(resolveProvider: () => Promise<DBProvider>): ActionsAPI {
  return {
    async create(options: CreateActionOptions | { type: string; data: unknown; total?: number }) {
      const provider = await resolveProvider()
      if (hasActionsAPI(provider)) {
        return provider.createAction(options)
      }
      throw new Error('Provider does not support actions')
    },

    async get(id: string) {
      const provider = await resolveProvider()
      if (hasActionsAPI(provider)) {
        return provider.getAction(id)
      }
      return null
    },

    async update(
      id: string,
      updates: Partial<Pick<DBAction, 'status' | 'progress' | 'result' | 'error'>>
    ) {
      const provider = await resolveProvider()
      if (hasActionsAPI(provider)) {
        return provider.updateAction(id, updates)
      }
      throw new Error('Provider does not support actions')
    },

    async list(options) {
      const provider = await resolveProvider()
      if (hasActionsAPI(provider)) {
        return provider.listActions(options)
      }
      return []
    },

    async retry(id) {
      const provider = await resolveProvider()
      if (hasActionsAPI(provider)) {
        return provider.retryAction(id)
      }
      throw new Error('Provider does not support actions')
    },

    async cancel(id) {
      const provider = await resolveProvider()
      if (hasActionsAPI(provider)) {
        await provider.cancelAction(id)
      }
    },

    conjugate,
  }
}

/**
 * Create the Artifacts API
 *
 * @param resolveProvider - Function to get the database provider
 * @returns ArtifactsAPI implementation
 */
export function createArtifactsAPI(resolveProvider: () => Promise<DBProvider>): ArtifactsAPI {
  return {
    async get(url, type) {
      const provider = await resolveProvider()
      if (hasArtifactsAPI(provider)) {
        return provider.getArtifact(url, type)
      }
      return null
    },

    async set(url, type, data) {
      const provider = await resolveProvider()
      if (hasArtifactsAPI(provider)) {
        await provider.setArtifact(url, type, data)
      }
    },

    async delete(url, type) {
      const provider = await resolveProvider()
      if (hasArtifactsAPI(provider)) {
        await provider.deleteArtifact(url, type)
      }
    },

    async list(url) {
      const provider = await resolveProvider()
      if (hasArtifactsAPI(provider)) {
        return provider.listArtifacts(url)
      }
      return []
    },
  }
}

/**
 * Create the Nouns API
 *
 * @param nounDefinitions - Map of entity names to Noun definitions
 * @returns NounsAPI implementation
 */
export function createNounsAPI(nounDefinitions: Map<string, Noun>): NounsAPI {
  return {
    async get(name) {
      return nounDefinitions.get(name) ?? null
    },

    async list() {
      return Array.from(nounDefinitions.values())
    },

    async define(noun) {
      nounDefinitions.set(noun.singular, noun)
    },
  }
}

/**
 * Create the Verbs API
 *
 * @param verbDefinitions - Map of verb actions to Verb definitions
 * @returns VerbsAPI implementation
 */
export function createVerbsAPI(verbDefinitions: Map<string, Verb>): VerbsAPI {
  return {
    get(action) {
      return verbDefinitions.get(action) ?? null
    },

    list() {
      return Array.from(verbDefinitions.values())
    },

    define(verb) {
      verbDefinitions.set(verb.action, verb)
    },

    conjugate,
  }
}
