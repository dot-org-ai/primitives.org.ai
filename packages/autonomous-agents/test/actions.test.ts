/**
 * Tests for Actions functionality
 *
 * Covers standalone action functions.
 * Uses mocks since these functions require AI calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  doAction,
  ask,
  decide,
  approve,
  generate,
  is,
  notify,
} from '../src/actions.js'

// Mock the ai-functions module
vi.mock('ai-functions', () => ({
  generateObject: vi.fn(),
}))

import { generateObject } from 'ai-functions'

const mockGenerateObject = vi.mocked(generateObject)

describe('Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('doAction', () => {
    it('executes a task and returns result', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { result: 'Task completed successfully' },
      })

      const result = await doAction('Complete the task')

      expect(result).toBe('Task completed successfully')
      expect(mockGenerateObject).toHaveBeenCalledTimes(1)
    })

    it('passes context to the task', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { result: 'Analyzed' },
      })

      await doAction('Analyze data', { data: [1, 2, 3] })

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('data'),
        })
      )
    })

    it('uses custom options', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { result: 'Done' },
      })

      await doAction('Task', {}, { model: 'opus', temperature: 0.5 })

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'opus',
          temperature: 0.5,
        })
      )
    })

    it('uses default model when not specified', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { result: 'Done' },
      })

      await doAction('Task')

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'sonnet',
        })
      )
    })
  })

  describe('ask', () => {
    it('asks a question and returns answer', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { answer: 'Paris', reasoning: 'Paris is the capital of France' },
      })

      const result = await ask('What is the capital of France?')

      expect(result).toBe('Paris')
    })

    it('passes context to the question', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { answer: 'TypeScript', reasoning: 'Based on the context' },
      })

      await ask('What language?', { project: 'web' })

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('project'),
        })
      )
    })

    it('uses custom options', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { answer: 'Answer', reasoning: 'Reason' },
      })

      await ask('Question', {}, { model: 'opus' })

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'opus',
        })
      )
    })
  })

  describe('decide', () => {
    it('makes a decision between options', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          decision: 'option A',
          reasoning: 'Best choice',
          confidence: 85,
        },
      })

      const result = await decide(['option A', 'option B', 'option C'])

      expect(result).toBe('option A')
    })

    it('includes context in decision', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          decision: 'React',
          reasoning: 'Best for the use case',
          confidence: 90,
        },
      })

      await decide(['React', 'Vue', 'Angular'], 'Building a dashboard')

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('dashboard'),
        })
      )
    })

    it('uses custom model settings', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          decision: 'A',
          reasoning: 'Reason',
          confidence: 75,
        },
      })

      await decide(['A', 'B'], 'Context', { model: 'opus' })

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'opus',
        })
      )
    })
  })

  describe('approve', () => {
    it('creates an approval request', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          component: 'ApprovalForm',
          schema: { approved: 'boolean' },
        },
      })

      const result = await approve({
        title: 'Budget Request',
        description: 'Request $50k for marketing',
        data: { amount: 50000 },
      })

      expect(result.status).toBe('pending')
      expect(result.timestamp).toBeInstanceOf(Date)
    })

    it('includes approver in request', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { component: 'Form', schema: {} },
      })

      await approve({
        title: 'Request',
        description: 'Description',
        data: {},
        approver: 'manager@example.com',
      })

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('manager@example.com'),
        })
      )
    })

    it('includes priority in request', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { component: 'Form', schema: {} },
      })

      await approve({
        title: 'Urgent Request',
        description: 'Needs immediate attention',
        data: {},
        priority: 'high',
      })

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('high'),
        })
      )
    })

    it('supports different channels', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { blocks: [], text: 'Approval needed' },
      })

      await approve({
        title: 'Request',
        description: 'Description',
        data: {},
        channel: 'slack',
      })

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('slack'),
        })
      )
    })
  })

  describe('generate', () => {
    it('generates content with schema', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          title: 'AI in Healthcare',
          content: 'AI is transforming healthcare...',
          tags: ['AI', 'healthcare'],
        },
      })

      const result = await generate({
        schema: {
          title: 'Blog post title',
          content: 'Blog post content',
          tags: ['List of tags'],
        },
        prompt: 'Write a blog post about AI in healthcare',
      })

      expect(result).toHaveProperty('title')
      expect(result).toHaveProperty('content')
    })

    it('uses custom model', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { result: 'Generated' },
      })

      await generate({
        model: 'opus',
        prompt: 'Generate content',
      })

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'opus',
        })
      )
    })

    it('uses higher temperature by default', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { result: 'Creative content' },
      })

      await generate({
        prompt: 'Be creative',
      })

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.8,
        })
      )
    })

    it('allows custom temperature', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { result: 'Focused content' },
      })

      await generate({
        prompt: 'Be precise',
        temperature: 0.2,
      })

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.2,
        })
      )
    })
  })

  describe('is', () => {
    it('validates a type with string descriptor', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { isValid: true, reason: 'Valid email format' },
      })

      const result = await is('test@example.com', 'valid email address')

      expect(result).toBe(true)
    })

    it('validates a type with schema', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { isValid: true, reason: 'Matches schema' },
      })

      const result = await is(
        { name: 'John', age: 30 },
        { name: 'string', age: 'number' }
      )

      expect(result).toBe(true)
    })

    it('returns false for invalid type', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { isValid: false, reason: 'Not a valid email' },
      })

      const result = await is('not-an-email', 'valid email address')

      expect(result).toBe(false)
    })

    it('uses low temperature for validation', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { isValid: true, reason: 'Valid' },
      })

      await is('value', 'type')

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0,
        })
      )
    })
  })

  describe('notify', () => {
    it('sends a notification', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          title: 'Notification',
          message: 'Task completed',
          type: 'success',
        },
      })

      // Should not throw
      await expect(
        notify({
          message: 'Task completed successfully!',
        })
      ).resolves.toBeUndefined()
    })

    it('uses specified channel', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { blocks: [], text: 'Notification' },
      })

      await notify({
        message: 'Alert',
        channel: 'slack',
      })

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('slack'),
        })
      )
    })

    it('includes recipients', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { text: 'Notification' },
      })

      await notify({
        message: 'Update',
        recipients: ['#team', '@user'],
      })

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('#team'),
        })
      )
    })

    it('includes priority', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { text: 'Alert' },
      })

      await notify({
        message: 'Critical alert',
        priority: 'high',
      })

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('high'),
        })
      )
    })

    it('includes additional data', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { text: 'Notification' },
      })

      await notify({
        message: 'Task done',
        data: { taskId: '123', duration: '5 minutes' },
      })

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('taskId'),
        })
      )
    })
  })
})

describe('Action scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('chains multiple actions', async () => {
    // Mock ask
    mockGenerateObject.mockResolvedValueOnce({
      object: { answer: 'TypeScript', reasoning: 'Best for this project' },
    })

    // Mock decide
    mockGenerateObject.mockResolvedValueOnce({
      object: { decision: 'React', reasoning: 'Popular choice', confidence: 90 },
    })

    // Mock doAction
    mockGenerateObject.mockResolvedValueOnce({
      object: { result: 'Project created' },
    })

    // Execute chain
    const language = await ask('What language should we use?')
    const framework = await decide(['React', 'Vue', 'Angular'])
    const result = await doAction('Create project', { language, framework })

    expect(language).toBe('TypeScript')
    expect(framework).toBe('React')
    expect(result).toBe('Project created')
    expect(mockGenerateObject).toHaveBeenCalledTimes(3)
  })

  it('validates before processing', async () => {
    // Mock is
    mockGenerateObject.mockResolvedValueOnce({
      object: { isValid: true, reason: 'Valid email' },
    })

    // Mock doAction
    mockGenerateObject.mockResolvedValueOnce({
      object: { result: 'Email sent' },
    })

    const email = 'user@example.com'
    const isValid = await is(email, 'valid email address')

    if (isValid) {
      const result = await doAction('Send email', { to: email })
      expect(result).toBe('Email sent')
    }

    expect(mockGenerateObject).toHaveBeenCalledTimes(2)
  })
})
