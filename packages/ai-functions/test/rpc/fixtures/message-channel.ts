/**
 * MessageChannel-based postMessage testing
 *
 * Uses the MessageChannel API (available in Node.js, Bun, and Workers)
 * to simulate postMessage communication without requiring a browser.
 */

import { PostMessageTransport } from '../../../src/rpc/transport.js'
import type { RPCMessage } from '../../../src/rpc/transport.js'
import { testMethods, type TestContext } from './test-methods.js'

export interface MessageChannelPair {
  /** Client-side transport */
  client: PostMessageTransport
  /** Cleanup function */
  cleanup: () => void
  /** Port for direct access if needed */
  clientPort: MessagePort
  serverPort: MessagePort
}

/**
 * Create a MessageChannel pair for postMessage testing
 *
 * The server side automatically handles RPC calls using testMethods.
 */
export function createMessageChannelPair(): MessageChannelPair {
  const channel = new MessageChannel()

  // Client transport uses port1
  const client = new PostMessageTransport({
    target: channel.port1,
  })

  // Server handler on port2
  channel.port2.onmessage = async (event: MessageEvent) => {
    const message = event.data as RPCMessage

    if (message.type === 'call' && message.method) {
      const method = testMethods[message.method]

      if (!method) {
        channel.port2.postMessage({
          id: message.id,
          type: 'error',
          error: { message: `Unknown method: ${message.method}`, code: 'METHOD_NOT_FOUND' },
        } satisfies RPCMessage)
        return
      }

      try {
        const ctx: TestContext = {}
        const result = await (method as Function)(ctx, ...(message.params || []))

        channel.port2.postMessage({
          id: message.id,
          type: 'result',
          result,
        } satisfies RPCMessage)
      } catch (err) {
        channel.port2.postMessage({
          id: message.id,
          type: 'error',
          error: {
            message: err instanceof Error ? err.message : String(err),
            code: 'INTERNAL_ERROR',
          },
        } satisfies RPCMessage)
      }
    }
  }

  // Start both ports
  channel.port1.start()
  channel.port2.start()

  return {
    client,
    clientPort: channel.port1,
    serverPort: channel.port2,
    cleanup: () => {
      channel.port1.close()
      channel.port2.close()
    },
  }
}

/**
 * Create a raw MessageChannel pair without RPC handling
 *
 * Useful for testing custom message handling or the bridge.
 */
export function createRawMessageChannelPair() {
  const channel = new MessageChannel()

  channel.port1.start()
  channel.port2.start()

  return {
    port1: channel.port1,
    port2: channel.port2,
    cleanup: () => {
      channel.port1.close()
      channel.port2.close()
    },
  }
}

/**
 * Create a mock window-like object for testing
 *
 * Simulates window.postMessage behavior using MessageChannel.
 */
export function createMockWindow() {
  const channel = new MessageChannel()
  const listeners: Array<(event: MessageEvent) => void> = []

  channel.port1.start()
  channel.port2.start()

  // Forward messages from port2 to listeners
  channel.port2.onmessage = (event) => {
    for (const listener of listeners) {
      listener(event)
    }
  }

  const mockWindow = {
    postMessage: (message: unknown, targetOrigin: string) => {
      channel.port1.postMessage(message)
    },
    addEventListener: (type: string, listener: (event: MessageEvent) => void) => {
      if (type === 'message') {
        listeners.push(listener)
      }
    },
    removeEventListener: (type: string, listener: (event: MessageEvent) => void) => {
      if (type === 'message') {
        const index = listeners.indexOf(listener)
        if (index !== -1) {
          listeners.splice(index, 1)
        }
      }
    },
  }

  return {
    window: mockWindow,
    injectResponse: (message: unknown) => {
      channel.port2.postMessage(message)
    },
    cleanup: () => {
      channel.port1.close()
      channel.port2.close()
      listeners.length = 0
    },
  }
}
