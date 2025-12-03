/**
 * Example: Using the Service Client
 *
 * This example demonstrates how to connect to a remote service using the Client
 */

import { Client, Provider, providers } from '../src/index.js'

// Connect to a service using a direct URL
const translationClient = Client({
  url: 'https://api.example.com/translation',
  auth: {
    type: 'api-key',
    credentials: {
      apiKey: 'your-api-key-here',
    },
  },
})

// Use the client
async function useDirectClient() {
  const result = await translationClient.do('translate', {
    text: 'Hello, world!',
    to: 'es',
  })
  console.log('Translation:', result)

  // Get a quote
  const quote = await translationClient.quote(
    { text: 'Large document...', to: 'es' },
    1000
  )
  console.log('Quote:', quote)

  // Subscribe to a plan
  const subscription = await translationClient.subscribe('pro')
  console.log('Subscription:', subscription)
}

// Use a provider to access multiple services
const awsProvider = providers.aws({
  accessKeyId: 'your-access-key',
  secretAccessKey: 'your-secret-key',
  region: 'us-east-1',
})

async function useProvider() {
  // Get the translate service from AWS
  const translate = awsProvider.service('translate')

  const result = await translate.do('translate', {
    text: 'Hello, world!',
    sourceLang: 'en',
    targetLang: 'es',
  })
  console.log('AWS Translation:', result)
}

// Create a custom provider
const customProvider = Provider({
  name: 'My Company',
  baseUrl: 'https://api.mycompany.com',
  auth: {
    type: 'jwt',
    credentials: {
      token: 'your-jwt-token',
    },
  },
  services: ['translation', 'summarization', 'sentiment'],
})

async function useCustomProvider() {
  const translation = customProvider.service('translation')
  const result = await translation.do('translate', {
    text: 'Hello',
    to: 'fr',
  })
  console.log('Custom provider result:', result)
}

// Export examples
export { useDirectClient, useProvider, useCustomProvider }
