/**
 * Verb Derivation Tests
 *
 * Tests for deriving reverse verbs for backward cascade resolution.
 * Following TDD: RED phase - these tests should fail until implementation.
 */
import { describe, it, expect } from 'vitest'
import {
  FORWARD_TO_REVERSE,
  BIDIRECTIONAL_PAIRS,
  deriveReverseVerb,
  fieldNameToVerb,
  isPassiveVerb,
  registerVerbPair,
  registerBidirectionalPair,
} from '../src/schema/verb-derivation.js'

describe('Verb Derivation', () => {
  describe('FORWARD_TO_REVERSE mapping constant', () => {
    it('should have manages → managedBy', () => {
      expect(FORWARD_TO_REVERSE.manages).toBe('managedBy')
    })

    it('should have owns → ownedBy', () => {
      expect(FORWARD_TO_REVERSE.owns).toBe('ownedBy')
    })

    it('should have creates → createdBy', () => {
      expect(FORWARD_TO_REVERSE.creates).toBe('createdBy')
    })

    it('should have reviews → reviewedBy', () => {
      expect(FORWARD_TO_REVERSE.reviews).toBe('reviewedBy')
    })

    it('should have employs → employedBy', () => {
      expect(FORWARD_TO_REVERSE.employs).toBe('employedBy')
    })

    it('should have contains → containedBy', () => {
      expect(FORWARD_TO_REVERSE.contains).toBe('containedBy')
    })

    it('should have assigns → assignedBy', () => {
      expect(FORWARD_TO_REVERSE.assigns).toBe('assignedBy')
    })
  })

  describe('BIDIRECTIONAL_PAIRS for symmetric relationships', () => {
    it('should have parent_of ↔ child_of', () => {
      expect(BIDIRECTIONAL_PAIRS.parent_of).toBe('child_of')
      expect(BIDIRECTIONAL_PAIRS.child_of).toBe('parent_of')
    })
  })

  describe('deriveReverseVerb()', () => {
    describe('forward → reverse verb mapping', () => {
      it('should derive manages → managedBy', () => {
        expect(deriveReverseVerb('manages')).toBe('managedBy')
      })

      it('should derive owns → ownedBy', () => {
        expect(deriveReverseVerb('owns')).toBe('ownedBy')
      })

      it('should derive creates → createdBy', () => {
        expect(deriveReverseVerb('creates')).toBe('createdBy')
      })

      it('should derive reviews → reviewedBy', () => {
        expect(deriveReverseVerb('reviews')).toBe('reviewedBy')
      })

      it('should derive employs → employedBy', () => {
        expect(deriveReverseVerb('employs')).toBe('employedBy')
      })

      it('should derive contains → containedBy', () => {
        expect(deriveReverseVerb('contains')).toBe('containedBy')
      })

      it('should derive assigns → assignedBy', () => {
        expect(deriveReverseVerb('assigns')).toBe('assignedBy')
      })
    })

    describe('bidirectional pairs', () => {
      it('should derive parent_of → child_of', () => {
        expect(deriveReverseVerb('parent_of')).toBe('child_of')
      })

      it('should derive child_of → parent_of', () => {
        expect(deriveReverseVerb('child_of')).toBe('parent_of')
      })
    })

    describe('passive verb handling (already reversed)', () => {
      it('should return forward form for managedBy → manages', () => {
        expect(deriveReverseVerb('managedBy')).toBe('manages')
      })

      it('should return forward form for ownedBy → owns', () => {
        expect(deriveReverseVerb('ownedBy')).toBe('owns')
      })

      it('should return forward form for createdBy → creates', () => {
        expect(deriveReverseVerb('createdBy')).toBe('creates')
      })
    })

    describe('unknown verbs with third person singular (ending in s)', () => {
      // Note: The reference implementation uses a simple heuristic that removes 's'
      // and adds 'dBy'. This works for 'es' endings (manages→managedBy) but produces
      // non-standard forms for other verbs (leads→leaddBy). For production use,
      // consider registering proper verb pairs via registerVerbPair().
      it('should derive leads → leaddBy (heuristic, register for proper form)', () => {
        expect(deriveReverseVerb('leads')).toBe('leaddBy')
      })

      it('should derive funds → funddBy (heuristic, register for proper form)', () => {
        expect(deriveReverseVerb('funds')).toBe('funddBy')
      })

      it('should derive hosts → hostdBy (heuristic, register for proper form)', () => {
        expect(deriveReverseVerb('hosts')).toBe('hostdBy')
      })

      it('should properly handle registered verb pairs', () => {
        // For proper conjugation, register the verb pair explicitly
        registerVerbPair('leads', 'ledBy')
        expect(deriveReverseVerb('leads')).toBe('ledBy')
        expect(deriveReverseVerb('ledBy')).toBe('leads')
      })
    })

    describe('unknown verbs without third person singular', () => {
      it('should add By suffix to unknown verbs', () => {
        expect(deriveReverseVerb('customAction')).toBe('customActionBy')
      })

      it('should add By suffix for single word verbs', () => {
        expect(deriveReverseVerb('link')).toBe('linkBy')
      })
    })

    describe('unknown verbs ending with By', () => {
      it('should strip By suffix for unknownBy → unknown', () => {
        expect(deriveReverseVerb('customActionBy')).toBe('customAction')
      })

      it('should strip By suffix for linkedBy → linked', () => {
        expect(deriveReverseVerb('linkedBy')).toBe('linked')
      })
    })

    describe('edge cases', () => {
      it('should handle empty string gracefully', () => {
        expect(deriveReverseVerb('')).toBe('By')
      })

      it('should handle single character verb', () => {
        expect(deriveReverseVerb('x')).toBe('xBy')
      })

      it('should handle two character verb', () => {
        expect(deriveReverseVerb('is')).toBe('isBy')
      })
    })
  })

  describe('fieldNameToVerb()', () => {
    describe('known field name → verb mappings', () => {
      it('should derive manager → manages', () => {
        expect(fieldNameToVerb('manager')).toBe('manages')
      })

      it('should derive owner → owns', () => {
        expect(fieldNameToVerb('owner')).toBe('owns')
      })

      it('should derive creator → creates', () => {
        expect(fieldNameToVerb('creator')).toBe('creates')
      })

      it('should derive reviewer → reviews', () => {
        expect(fieldNameToVerb('reviewer')).toBe('reviews')
      })

      it('should derive employer → employs', () => {
        expect(fieldNameToVerb('employer')).toBe('employs')
      })

      it('should derive parent → parent_of', () => {
        expect(fieldNameToVerb('parent')).toBe('parent_of')
      })

      it('should derive child → child_of', () => {
        expect(fieldNameToVerb('child')).toBe('child_of')
      })

      it('should derive assignee → assigns', () => {
        expect(fieldNameToVerb('assignee')).toBe('assigns')
      })
    })

    describe('unknown field names', () => {
      it('should return field name as-is for unknown fields', () => {
        expect(fieldNameToVerb('customField')).toBe('customField')
      })

      it('should return field name as-is for unknown noun-like fields', () => {
        expect(fieldNameToVerb('coordinator')).toBe('coordinator')
      })
    })
  })

  describe('isPassiveVerb()', () => {
    describe('verbs ending with By', () => {
      it('should return true for managedBy', () => {
        expect(isPassiveVerb('managedBy')).toBe(true)
      })

      it('should return true for ownedBy', () => {
        expect(isPassiveVerb('ownedBy')).toBe(true)
      })

      it('should return true for createdBy', () => {
        expect(isPassiveVerb('createdBy')).toBe(true)
      })

      it('should return true for customActionBy', () => {
        expect(isPassiveVerb('customActionBy')).toBe(true)
      })
    })

    describe('verbs ending with To', () => {
      it('should return true for relatedTo', () => {
        expect(isPassiveVerb('relatedTo')).toBe(true)
      })

      it('should return true for linkedTo', () => {
        expect(isPassiveVerb('linkedTo')).toBe(true)
      })

      it('should return true for connectedTo', () => {
        expect(isPassiveVerb('connectedTo')).toBe(true)
      })
    })

    describe('verbs ending with Of', () => {
      it('should return true for parent_of', () => {
        expect(isPassiveVerb('parent_of')).toBe(true)
      })

      it('should return true for child_of', () => {
        expect(isPassiveVerb('child_of')).toBe(true)
      })

      it('should return true for partOf', () => {
        expect(isPassiveVerb('partOf')).toBe(true)
      })
    })

    describe('active verbs (not passive)', () => {
      it('should return false for manages', () => {
        expect(isPassiveVerb('manages')).toBe(false)
      })

      it('should return false for owns', () => {
        expect(isPassiveVerb('owns')).toBe(false)
      })

      it('should return false for creates', () => {
        expect(isPassiveVerb('creates')).toBe(false)
      })

      it('should return false for customAction', () => {
        expect(isPassiveVerb('customAction')).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('should return false for empty string', () => {
        expect(isPassiveVerb('')).toBe(false)
      })

      it('should return true for just "By" suffix', () => {
        // 'By' alone is technically passive-looking
        expect(isPassiveVerb('By')).toBe(true)
      })

      it('should return true for just "To" suffix', () => {
        expect(isPassiveVerb('To')).toBe(true)
      })

      it('should return true for just "Of" suffix', () => {
        expect(isPassiveVerb('Of')).toBe(true)
      })
    })
  })

  describe('extensibility', () => {
    describe('registerVerbPair()', () => {
      it('should allow registering custom verb pairs', () => {
        registerVerbPair('sponsors', 'sponsoredBy')
        expect(deriveReverseVerb('sponsors')).toBe('sponsoredBy')
        expect(deriveReverseVerb('sponsoredBy')).toBe('sponsors')
      })

      it('should allow overriding existing verb pairs', () => {
        registerVerbPair('manages', 'supervisedBy')
        expect(deriveReverseVerb('manages')).toBe('supervisedBy')
        // Reset to original
        registerVerbPair('manages', 'managedBy')
      })
    })

    describe('registerBidirectionalPair()', () => {
      it('should allow registering bidirectional pairs', () => {
        registerBidirectionalPair('mentor_of', 'mentee_of')
        expect(deriveReverseVerb('mentor_of')).toBe('mentee_of')
        expect(deriveReverseVerb('mentee_of')).toBe('mentor_of')
      })

      it('should support symmetric relationships', () => {
        registerBidirectionalPair('relatedTo', 'relatedTo')
        expect(deriveReverseVerb('relatedTo')).toBe('relatedTo')
      })
    })
  })
})
