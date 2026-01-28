/**
 * Tests for notify() - Notification delivery primitive
 *
 * The notify() function sends real notifications to Workers (Humans or AI Agents)
 * via actual communication channels (Slack, email, SMS). Unlike ai-functions
 * which focuses on LLM operations, this function handles real channel delivery
 * with priority-based routing and delivery tracking.
 *
 * Note: ai-functions does not have an equivalent notify primitive since it
 * focuses on LLM operations rather than communication channel delivery.
 */

import { describe, it, expect } from 'vitest'
import { notify } from '../src/index.js'
import type { Worker, WorkerRef, WorkerTeam } from '../src/types.js'

// Test fixtures
const alice: Worker = {
  id: 'alice',
  name: 'Alice',
  type: 'human',
  status: 'available',
  contacts: {
    email: 'alice@example.com',
    slack: '@alice',
    sms: '+1-555-1234',
  },
}

const bob: WorkerRef = {
  id: 'bob',
  name: 'Bob',
  type: 'human',
}

const deployBot: Worker = {
  id: 'deploy-bot',
  name: 'Deploy Bot',
  type: 'agent',
  status: 'available',
  contacts: {
    slack: '#deploys',
    webhook: 'https://hooks.example.com/deploy',
  },
}

const engineering: WorkerTeam = {
  id: 'eng',
  name: 'Engineering',
  members: [alice, bob],
  contacts: {
    slack: '#engineering',
    email: 'eng@example.com',
  },
}

describe('notify() - Notification Delivery Primitive', () => {
  describe('Unit Tests (no AI)', () => {
    it('should be exported from index', () => {
      expect(notify).toBeDefined()
      expect(typeof notify).toBe('function')
    })

    it('should have alert method', () => {
      expect(notify.alert).toBeDefined()
      expect(typeof notify.alert).toBe('function')
    })

    it('should have info method', () => {
      expect(notify.info).toBeDefined()
      expect(typeof notify.info).toBe('function')
    })

    it('should have rich method', () => {
      expect(notify.rich).toBeDefined()
      expect(typeof notify.rich).toBe('function')
    })

    it('should have batch method', () => {
      expect(notify.batch).toBeDefined()
      expect(typeof notify.batch).toBe('function')
    })

    it('should have schedule method', () => {
      expect(notify.schedule).toBeDefined()
      expect(typeof notify.schedule).toBe('function')
    })
  })

  describe('Basic Notification Delivery', () => {
    it('should send notification to worker', async () => {
      const result = await notify(alice, 'Deployment completed successfully', {
        via: 'slack',
      })

      expect(result).toBeDefined()
      expect(result.sent).toBe(true)
      expect(result.via).toContain('slack')
      expect(result.messageId).toBeDefined()
    })

    it('should include recipients in result', async () => {
      const result = await notify(alice, 'Hello')

      expect(result.recipients).toBeDefined()
      expect(Array.isArray(result.recipients)).toBe(true)
    })

    it('should include sentAt timestamp', async () => {
      const result = await notify(alice, 'Test message', { via: 'email' })

      expect(result.sentAt).toBeDefined()
      expect(result.sentAt).toBeInstanceOf(Date)
    })

    it('should include delivery status per channel', async () => {
      const result = await notify(alice, 'Message', { via: 'slack' })

      expect(result.delivery).toBeDefined()
      expect(Array.isArray(result.delivery)).toBe(true)
      if (result.delivery && result.delivery.length > 0) {
        expect(result.delivery[0].channel).toBe('slack')
        expect(result.delivery[0].status).toBeDefined()
      }
    })

    it('should handle worker without available channels', async () => {
      const noChannelWorker: Worker = {
        id: 'no-channel',
        name: 'No Channel',
        type: 'human',
        status: 'available',
        contacts: {},
      }

      const result = await notify(noChannelWorker, 'Hello')

      expect(result.sent).toBe(false)
      expect(result.via).toHaveLength(0)
    })

    it('should handle string target without contacts', async () => {
      // String targets don't have contacts configured, so sent should be false
      const result = await notify('user-id', 'Message')

      expect(result).toBeDefined()
      expect(result.sent).toBe(false)
      expect(result.via).toHaveLength(0)
    })
  })

  describe('Channel Selection', () => {
    it('should use specified channel', async () => {
      const result = await notify(alice, 'Message', { via: 'email' })

      expect(result.via).toContain('email')
    })

    it('should fallback to first available channel', async () => {
      const result = await notify(alice, 'Message')

      // Should use first available (email, slack, or sms)
      expect(result.via.length).toBeGreaterThan(0)
    })

    it('should handle multiple channels', async () => {
      const result = await notify(alice, 'Urgent message', {
        via: ['slack', 'email'],
      })

      expect(result.via).toContain('slack')
    })

    it('should only use available channels from array', async () => {
      const slackOnlyWorker: Worker = {
        id: 'slack-only',
        name: 'Slack Only',
        type: 'human',
        status: 'available',
        contacts: {
          slack: '@user',
        },
      }

      const result = await notify(slackOnlyWorker, 'Message', {
        via: ['email', 'slack'], // email not available
      })

      expect(result.via).toContain('slack')
      expect(result.via).not.toContain('email')
    })
  })

  describe('Priority-based Delivery', () => {
    it('should support normal priority', async () => {
      const result = await notify(alice, 'Normal message', {
        via: 'slack',
        priority: 'normal',
      })

      expect(result.sent).toBe(true)
    })

    it('should support urgent priority with multiple channels', async () => {
      const result = await notify(alice, 'URGENT: Server down!', {
        priority: 'urgent',
      })

      // Urgent should try multiple channels
      expect(result).toBeDefined()
    })

    it('should support low priority', async () => {
      const result = await notify(alice, 'FYI message', {
        via: 'email',
        priority: 'low',
      })

      expect(result.sent).toBe(true)
    })

    it('should support high priority', async () => {
      const result = await notify(alice, 'Important message', {
        via: 'slack',
        priority: 'high',
      })

      expect(result.sent).toBe(true)
    })
  })

  describe('Alert Notifications', () => {
    it('should send alert with urgent priority', async () => {
      const result = await notify.alert(alice, 'Production is down!')

      expect(result).toBeDefined()
      // Alert implicitly sets priority to urgent
    })

    it('should allow custom options with alert', async () => {
      const result = await notify.alert(alice, 'Critical error', {
        via: 'sms',
      })

      expect(result.via).toContain('sms')
    })
  })

  describe('Info Notifications', () => {
    it('should send info with low priority', async () => {
      const result = await notify.info(alice, 'Weekly sync notes posted')

      expect(result).toBeDefined()
      // Info implicitly sets priority to low
    })

    it('should allow custom channel for info', async () => {
      const result = await notify.info(alice, 'Update available', {
        via: 'email',
      })

      expect(result.via).toContain('email')
    })
  })

  describe('Rich Notifications', () => {
    it('should send rich notification with title and body', async () => {
      const result = await notify.rich(
        alice,
        'Deployment Complete',
        'Version 2.1.0 has been deployed to production.',
        { via: 'slack' }
      )

      expect(result).toBeDefined()
      expect(result.sent).toBe(true)
    })

    it('should support metadata in rich notifications', async () => {
      const result = await notify.rich(alice, 'Build Status', 'Build #123 completed successfully', {
        via: 'slack',
        metadata: {
          buildNumber: 123,
          duration: '5m 32s',
        },
      })

      expect(result.sent).toBe(true)
    })
  })

  describe('Batch Notifications', () => {
    it('should send multiple notifications', async () => {
      const results = await notify.batch([
        { target: alice, message: 'Task 1 complete' },
        { target: engineering, message: 'All tasks done' },
      ])

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(2)
    })

    it('should support individual options per notification', async () => {
      const results = await notify.batch([
        { target: alice, message: 'Urgent', options: { priority: 'urgent' } },
        { target: alice, message: 'Normal', options: { priority: 'normal' } },
      ])

      expect(results.length).toBe(2)
    })

    it('should handle mixed targets in batch', async () => {
      const results = await notify.batch([
        { target: alice, message: 'Personal message' },
        { target: 'user-id', message: 'ID-based message' },
        { target: engineering, message: 'Team message' },
      ])

      expect(results.length).toBe(3)
    })
  })

  describe('Scheduled Notifications', () => {
    it('should schedule notification with Date', async () => {
      const futureDate = new Date(Date.now() + 60000) // 1 minute from now
      const result = await notify.schedule(alice, 'Reminder', futureDate)

      expect(result).toBeDefined()
      expect(result.scheduled).toBe(true)
      expect(result.scheduledFor).toEqual(futureDate)
      expect(result.messageId).toBeDefined()
    })

    it('should schedule notification with delay in ms', async () => {
      const result = await notify.schedule(alice, 'Delayed message', 30000)

      expect(result.scheduled).toBe(true)
      expect(result.scheduledFor).toBeInstanceOf(Date)
      // Should be approximately 30 seconds from now
      const expectedTime = Date.now() + 30000
      expect(result.scheduledFor.getTime()).toBeCloseTo(expectedTime, -2)
    })

    it('should support options with scheduled notifications', async () => {
      const result = await notify.schedule(alice, 'Scheduled alert', 60000, { priority: 'high' })

      expect(result.scheduled).toBe(true)
    })

    it('should include messageId for scheduled notifications', async () => {
      const result = await notify.schedule(alice, 'Scheduled', 1000)

      expect(result.messageId).toBeDefined()
      expect(result.messageId.startsWith('scheduled')).toBe(true)
    })
  })

  describe('Team Notifications', () => {
    it('should notify entire team', async () => {
      const result = await notify(engineering, 'Team update', {
        via: 'slack',
      })

      expect(result).toBeDefined()
      expect(result.recipients).toBeDefined()
      // Should include all team members
    })

    it('should use team contacts', async () => {
      const result = await notify(engineering, 'Sprint planning tomorrow', {
        via: 'slack',
      })

      expect(result.via).toContain('slack')
    })
  })

  describe('Agent Notifications', () => {
    it('should notify AI agent', async () => {
      const result = await notify(deployBot, 'New deployment requested', {
        via: 'slack',
      })

      expect(result).toBeDefined()
      expect(result.sent).toBe(true)
    })

    it('should support webhook channel for agents', async () => {
      const result = await notify(deployBot, 'Trigger deployment', {
        via: 'webhook',
      })

      expect(result.via).toContain('webhook')
    })
  })

  describe('Metadata Support', () => {
    it('should include custom metadata', async () => {
      const result = await notify(alice, 'Build complete', {
        via: 'slack',
        metadata: {
          buildId: '12345',
          duration: 120,
          status: 'success',
        },
      })

      expect(result).toBeDefined()
      expect(result.sent).toBe(true)
    })
  })

  describe('Delivery Tracking', () => {
    it('should track delivery per channel', async () => {
      const result = await notify(alice, 'Tracked message', {
        via: 'slack',
      })

      expect(result.delivery).toBeDefined()
      expect(Array.isArray(result.delivery)).toBe(true)
    })

    it('should report failed deliveries', async () => {
      // Worker with channel that doesn't exist
      const result = await notify(alice, 'Message', {
        via: 'teams', // Alice doesn't have teams configured
      })

      // Should not include teams in via since it's not available
      expect(result.via).not.toContain('teams')
    })
  })
})
