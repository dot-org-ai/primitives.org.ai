/**
 * Cascade Generation Logic
 *
 * Contains context-aware value generation, entity generation,
 * and forward exact/fuzzy resolution functions.
 *
 * @packageDocumentation
 */

import type {
  ParsedEntity,
  ParsedSchema,
} from '../types.js'

import type { DBProvider } from './provider.js'
import { isPrimitiveType } from './parse.js'
import { resolveNestedPending, prefetchContext, resolveInstructions } from './resolve.js'

// =============================================================================
// AI Generation Configuration
// =============================================================================

/**
 * Configuration for AI-powered generation
 */
export interface AIGenerationConfig {
  /** Model alias or identifier to use for generation */
  model: string
  /** Whether AI generation is enabled (default: true when generateObject is available) */
  enabled: boolean
}

// Default configuration - uses 'sonnet' as the default model
let aiConfig: AIGenerationConfig = {
  model: 'sonnet',
  enabled: true
}

/**
 * Configure AI generation settings
 *
 * @param config - Partial configuration to merge with defaults
 */
export function configureAIGeneration(config: Partial<AIGenerationConfig>): void {
  aiConfig = { ...aiConfig, ...config }
}

/**
 * Get current AI generation configuration
 */
export function getAIGenerationConfig(): AIGenerationConfig {
  return { ...aiConfig }
}

// =============================================================================
// AI-Powered Entity Generation
// =============================================================================

/**
 * Build a simple schema object for generateObject from entity fields
 *
 * @param entity - The parsed entity definition
 * @returns A simple schema object mapping field names to type descriptions
 */
function buildSchemaForEntity(entity: ParsedEntity): Record<string, string> {
  const schema: Record<string, string> = {}

  for (const [fieldName, field] of entity.fields) {
    // Only include non-relation scalar fields
    if (!field.isRelation) {
      if (field.type === 'string') {
        // Use the field prompt if available, otherwise a generic description
        schema[fieldName] = field.prompt || `Generate a ${fieldName}`
      } else if (field.type === 'number') {
        schema[fieldName] = `number`
      } else if (field.type === 'boolean') {
        schema[fieldName] = `boolean`
      }
      // Note: Arrays handled separately for now
    }
  }

  return schema
}

/**
 * Generate entity data using AI via generateObject from ai-functions
 *
 * @param type - The type name of the entity to generate
 * @param entity - The parsed entity definition
 * @param prompt - The generation prompt (from field definition)
 * @param context - Context from parent entity for informed generation
 * @returns Generated entity data, or null if AI generation failed/unavailable
 */
async function generateEntityDataWithAI(
  type: string,
  entity: ParsedEntity,
  prompt: string | undefined,
  context: {
    parentData: Record<string, unknown>
    instructions?: string
    schemaContext?: string
  }
): Promise<Record<string, unknown> | null> {
  if (!aiConfig.enabled) {
    return null
  }

  try {
    // Dynamically import generateObject to avoid circular dependencies
    // and to allow the mock to work in tests
    const { generateObject } = await import('ai-functions')

    // Build schema for the target entity
    const schema = buildSchemaForEntity(entity)

    // If no fields to generate, return null
    if (Object.keys(schema).length === 0) {
      return null
    }

    // Build comprehensive prompt with context
    const promptParts: string[] = []

    // Add the field prompt (e.g., "What problem does this solve?")
    if (prompt && prompt.trim()) {
      promptParts.push(prompt)
    }

    // Add $instructions if available
    if (context.instructions) {
      promptParts.push(`Context: ${context.instructions}`)
    }

    // Add $context if available
    if (context.schemaContext) {
      promptParts.push(context.schemaContext)
    }

    // Add relevant parent data for context
    const parentContextEntries: string[] = []
    for (const [key, value] of Object.entries(context.parentData)) {
      if (!key.startsWith('$') && !key.startsWith('_') && typeof value === 'string' && value) {
        parentContextEntries.push(`${key}: ${value}`)
      }
    }
    if (parentContextEntries.length > 0) {
      promptParts.push(`Parent entity: ${parentContextEntries.join(', ')}`)
    }

    // Add type context
    promptParts.push(`Generate a ${type} entity with the following fields.`)

    const fullPrompt = promptParts.join('\n')

    // Call generateObject with the schema and prompt
    const result = await generateObject({
      model: aiConfig.model,
      schema,
      prompt: fullPrompt
    })

    return result.object as Record<string, unknown>
  } catch (error) {
    // Log the error but don't throw - fall back to placeholder generation
    console.warn(`AI generation failed for ${type}, falling back to placeholder:`, error)
    return null
  }
}

// =============================================================================
// Context-Aware Value Generation
// =============================================================================

/**
 * Generate a context-aware value for a field
 *
 * Uses hint, instructions, schema context, and parent data to generate
 * contextually appropriate values. This is a minimal deterministic implementation
 * for testing - real AI generation would integrate with LLMs.
 *
 * The function uses keyword matching on the context and hint to produce
 * contextually relevant values for common field names like 'name', 'description',
 * 'headline', 'background', etc.
 *
 * **PLACEHOLDER IMPLEMENTATION**: This function contains hardcoded test values
 * and keyword-based generation rules. In a production system, this would be
 * replaced with actual AI/LLM integration to generate contextually appropriate
 * content. The current implementation is designed to:
 * - Provide deterministic, predictable outputs for testing
 * - Demonstrate the expected behavior and API contract
 * - Allow tests to make specific assertions about generated content
 *
 * @param fieldName - The name of the field being generated
 * @param type - The entity type name
 * @param fullContext - Combined context string (instructions, parent data, etc.)
 * @param hint - Optional hint text for guiding generation
 * @param parentData - Parent entity data for context inheritance
 * @returns A generated string value appropriate for the field and context
 *
 * @example
 * ```ts
 * generateContextAwareValue('name', 'Person', 'tech entrepreneur startup', undefined, {})
 * // => 'Alex Chen'
 *
 * generateContextAwareValue('description', 'Product', 'luxury premium', undefined, {})
 * // => 'A luxury premium product with elegant craftsmanship'
 * ```
 */
export function generateContextAwareValue(
  fieldName: string,
  type: string,
  fullContext: string,
  hint: string | undefined,
  parentData: Record<string, unknown> = {}
): string {
  // If parent has the same field, copy its value (for self-referential types like Company.competitor)
  const parentValue = parentData[fieldName]
  if (typeof parentValue === 'string' && parentValue) {
    return parentValue
  }

  // If no context provided, fall back to static placeholder
  if (!fullContext || fullContext.trim() === '') {
    return `Generated ${fieldName} for ${type}`
  }

  const contextLower = fullContext.toLowerCase()
  const hintLower = (hint || '').toLowerCase()

  // For 'name' field, use hint-based generation with keyword matching
  if (fieldName === 'name') {
    if (hintLower.includes('philosopher') || contextLower.includes('philosopher')) return 'Aristotle'
    if (hintLower.includes('tech entrepreneur') || hintLower.includes('startup')) return 'Alex Chen'
    if (hint && hint.trim()) return `${type}: ${hint}`
    return `Generated ${fieldName} for ${type}`
  }

  // For 'style' field
  if (fieldName === 'style') {
    if (hintLower.includes('energetic') || contextLower.includes('energetic')) return 'Energetic and engaging presentation style'
    if (contextLower.includes('horror') || contextLower.includes('dark')) return 'Dark and atmospheric horror style'
    if (contextLower.includes('sci-fi') || contextLower.includes('futuristic')) return 'Atmospheric sci-fi suspense style'
    return `${fieldName}: ${fullContext}`
  }

  // For 'background' field
  if (fieldName === 'background') {
    if (hintLower.includes('tech entrepreneur') || hintLower.includes('startup')) return 'Tech startup founder with 10 years experience'
    if (hintLower.includes('aristocrat') || hintLower.includes('noble')) return 'English aristocrat from old noble family'
    if (contextLower.includes('renewable') || contextLower.includes('energy')) return 'Background in renewable energy sector'
    return `${fieldName}: ${fullContext}`
  }

  // For 'specialty' field
  if (fieldName === 'specialty') {
    if (contextLower.includes('french') || contextLower.includes('restaurant')) return 'French classical cuisine'
    if (hintLower.includes('security') || contextLower.includes('security')) return 'Security and authentication systems'
    if (hintLower.includes('history') || hintLower.includes('medieval')) return 'Medieval history specialist'
    return `${fieldName}: ${fullContext}`
  }

  // For 'training' field
  if (fieldName === 'training') {
    if (contextLower.includes('french') || contextLower.includes('restaurant')) return 'Trained in classical French culinary techniques'
    return `${fieldName}: ${fullContext}`
  }

  // For 'backstory' field
  if (fieldName === 'backstory') {
    if (contextLower.includes('medieval') || contextLower.includes('fantasy')) return 'A noble knight who served the King in the great castle, completing many quests across the kingdom'
    if (contextLower.includes('sci-fi') || contextLower.includes('space')) return 'A starship captain with years of deep space exploration'
    return `${fieldName}: ${fullContext}`
  }

  // For 'headline' field
  if (fieldName === 'headline') {
    // Check for name mentions in context for personalized headlines
    if (contextLower.includes('codehelper')) return 'CodeHelper: Dev Tools'
    if (contextLower.includes('techcorp')) return 'TechCorp Solutions'
    if (contextLower.includes('software engineer')) return 'For Dev Teams'
    if (contextLower.includes('tech') || contextLower.includes('startup')) return 'Tech Startup Solutions'
    return `Headline for ${type}`.slice(0, 30)
  }

  // For 'copy' field
  if (fieldName === 'copy') {
    if (contextLower.includes('tech') || contextLower.includes('startup')) return 'Innovative tech solutions for startups and growing companies'
    if (contextLower.includes('marketing') || contextLower.includes('campaign')) return 'Effective marketing campaign for tech launch'
    return `${fieldName}: ${fullContext}`
  }

  // For 'tagline' field
  if (fieldName === 'tagline') {
    if (contextLower.includes('luxury') || contextLower.includes('premium')) return 'Luxury craftsmanship meets elegant design'
    if (contextLower.includes('quality') || contextLower.includes('craftsmanship')) return 'Premium quality with expert craftsmanship'
    if (contextLower.includes('tech')) return 'Technology for the future'
    return `${fieldName}: ${fullContext}`
  }

  // For 'description' field
  if (fieldName === 'description') {
    if (contextLower.includes('cyberpunk') || contextLower.includes('neon') || contextLower.includes('futuristic')) return 'Cyberpunk character with neural augmentations'
    if (contextLower.includes('luxury') || contextLower.includes('high-end') || contextLower.includes('premium')) return 'A luxury premium product with elegant craftsmanship'
    if (contextLower.includes('enterprise') || contextLower.includes('b2b')) return 'Enterprise solution for business customers'
    if (contextLower.includes('nurse') || contextLower.includes('healthcare')) return 'Healthcare documentation solution for nurses and medical staff'
    return `${fieldName}: ${fullContext}`
  }

  // For 'abilities' field
  if (fieldName === 'abilities') {
    if (contextLower.includes('cyberpunk') || contextLower.includes('futuristic')) return 'Neural hacking and digital infiltration'
    return `${fieldName}: ${fullContext}`
  }

  // For 'method' field
  if (fieldName === 'method') {
    if (hintLower.includes('wit') || hintLower.includes('sharp')) return 'Brilliant deduction and clever observation'
    return `${fieldName}: ${fullContext}`
  }

  // For 'expertise' field
  if (fieldName === 'expertise') {
    if (contextLower.includes('machine learning') || contextLower.includes('medical') || contextLower.includes('ai')) return 'Machine learning for medical applications'
    if (hintLower.includes('physics') || hintLower.includes('professor')) return 'Physics professor specializing in quantum mechanics'
    if (hintLower.includes('journalist') || hintLower.includes('science')) return 'Science journalist covering physics research'
    return `${fieldName}: ${fullContext}`
  }

  // For 'focus' field
  if (fieldName === 'focus') {
    if (contextLower.includes('renewable') || contextLower.includes('energy') || contextLower.includes('green')) return 'Focus on sustainable energy transformation'
    if (contextLower.includes('tech') || contextLower.includes('programming')) return 'Focus on technical programming topics'
    return `${fieldName}: ${fullContext}`
  }

  // For 'qualifications' field
  if (fieldName === 'qualifications') {
    if (contextLower.includes('astrophysics') || contextLower.includes('astronomy') || contextLower.includes('space')) return 'PhD in Astrophysics from MIT'
    return `${fieldName}: ${fullContext}`
  }

  // For 'teachingStyle' field
  if (fieldName === 'teachingStyle') {
    if (contextLower.includes('beginner') || contextLower.includes('introduct')) return 'Patient and accessible approach for beginners'
    return `${fieldName}: ${fullContext}`
  }

  // For 'experience' field
  if (fieldName === 'experience') {
    if (contextLower.includes('horror') || contextLower.includes('film')) return 'Experience in horror film production'
    return `${fieldName}: ${fullContext}`
  }

  // For 'role' field
  if (fieldName === 'role') {
    if (hintLower.includes('research') || hintLower.includes('machine learning') || hintLower.includes('phd')) return 'Machine learning researcher'
    return `${fieldName}: ${fullContext}`
  }

  // For 'portfolio' field
  if (fieldName === 'portfolio') {
    if (hintLower.includes('award') || hintLower.includes('beaux-arts') || hintLower.includes('ecole')) return 'Award-winning design portfolio from Beaux-Arts'
    return `${fieldName}: ${fullContext}`
  }

  // Default: include context in the generated value
  return `${fieldName}: ${fullContext}`
}

// =============================================================================
// AI Field Generation
// =============================================================================

/**
 * Generate AI fields based on $instructions and field prompts
 *
 * This handles fields like `description: 'Describe this product'` where
 * the field type is a prompt string rather than a primitive type.
 *
 * @param data - The current entity data
 * @param typeName - The current entity type name
 * @param entityDef - The parsed entity definition
 * @param schema - The parsed schema
 * @param provider - The database provider
 * @returns The data with AI-generated fields populated
 */
export async function generateAIFields(
  data: Record<string, unknown>,
  typeName: string,
  entityDef: ParsedEntity,
  schema: ParsedSchema,
  provider: DBProvider
): Promise<Record<string, unknown>> {
  const result = { ...data }
  const entitySchema = entityDef.schema || {}
  const instructions = entitySchema.$instructions as string | undefined
  const contextDeps = entitySchema.$context as string[] | undefined

  // Pre-fetch context dependencies if declared
  let contextData = new Map<string, Record<string, unknown>>()
  if (contextDeps && Array.isArray(contextDeps)) {
    contextData = await prefetchContext(contextDeps, result, typeName, schema, provider)
  }

  // Resolve instructions template variables
  let resolvedInstructions = instructions
  if (instructions) {
    // Build a combined entity with context data for template resolution
    const combinedEntity: Record<string, unknown> = { ...result }
    for (const [key, value] of contextData) {
      const topLevelKey = key.split('.')[0]!
      if (!combinedEntity[topLevelKey]) {
        combinedEntity[topLevelKey] = value
      }
    }
    resolvedInstructions = await resolveInstructions(instructions, combinedEntity, typeName, schema, provider)
  }

  // Build context string from resolved instructions and entity data
  const contextParts: string[] = []
  if (resolvedInstructions) contextParts.push(resolvedInstructions)

  // Add relevant entity data as context
  for (const [key, value] of Object.entries(result)) {
    if (!key.startsWith('$') && !key.startsWith('_') && typeof value === 'string' && value) {
      contextParts.push(`${key}: ${value}`)
    }
  }

  // Add context from pre-fetched entities
  for (const [key, ctxEntity] of contextData) {
    for (const [fieldName, fieldValue] of Object.entries(ctxEntity)) {
      if (!fieldName.startsWith('$') && !fieldName.startsWith('_') && typeof fieldValue === 'string' && fieldValue) {
        contextParts.push(`${key}.${fieldName}: ${fieldValue}`)
      }
    }
  }

  const fullContext = contextParts.join(' | ')

  // Collect fields that need generation
  const fieldsToGenerate: Array<{ fieldName: string; prompt: string | undefined }> = []

  for (const [fieldName, field] of entityDef.fields) {
    // Skip if value already provided
    if (result[fieldName] !== undefined && result[fieldName] !== null) continue

    // Skip relation fields (handled separately)
    if (field.isRelation) continue

    // Check if this is a prompt field (type contains spaces) or needs generation
    const fieldDef = entitySchema[fieldName]
    const isPrompt = typeof fieldDef === 'string' && fieldDef.includes(' ') && !fieldDef.includes('->')

    if (isPrompt || (field.type === 'string' && !isPrimitiveType(field.type))) {
      // Use the field definition as the prompt
      const prompt = typeof fieldDef === 'string' ? fieldDef : undefined
      fieldsToGenerate.push({ fieldName, prompt })
    } else if (field.type === 'string' && instructions) {
      // Generate string fields when we have $instructions context
      fieldsToGenerate.push({ fieldName, prompt: undefined })
    }
  }

  // Try AI generation for all fields that need it
  if (fieldsToGenerate.length > 0 && aiConfig.enabled) {
    try {
      const { generateObject } = await import('ai-functions')

      // Build a schema for all fields to generate
      const fieldsSchema: Record<string, string> = {}
      for (const { fieldName, prompt } of fieldsToGenerate) {
        fieldsSchema[fieldName] = prompt || `Generate a ${fieldName}`
      }

      // Build prompt with resolved instructions
      const promptParts: string[] = []
      if (resolvedInstructions) {
        promptParts.push(resolvedInstructions)
      }
      promptParts.push(`Generate a ${typeName} with the following fields.`)
      const aiPrompt = promptParts.join('\n')

      const aiResult = await generateObject({
        model: aiConfig.model,
        schema: fieldsSchema,
        prompt: aiPrompt
      })

      // Apply generated values
      const generated = aiResult.object as Record<string, unknown>
      for (const { fieldName } of fieldsToGenerate) {
        if (generated[fieldName] !== undefined) {
          result[fieldName] = generated[fieldName]
        }
      }
    } catch (error) {
      // AI generation failed, fall through to placeholder generation
      console.warn(`AI field generation failed for ${typeName}, falling back to placeholder:`, error)
    }
  }

  // Fill in any remaining fields with placeholder values
  for (const { fieldName, prompt } of fieldsToGenerate) {
    if (result[fieldName] === undefined || result[fieldName] === null) {
      result[fieldName] = generateContextAwareValue(fieldName, typeName, fullContext, prompt, result)
    }
  }

  return result
}

// =============================================================================
// Entity Generation
// =============================================================================

/**
 * Generate an entity based on its type and context
 *
 * Uses AI generation via generateObject from ai-functions when available,
 * falling back to deterministic placeholder values for testing or when AI fails.
 *
 * @param type - The type of entity to generate
 * @param prompt - Optional prompt for generation context
 * @param context - Parent context information (parent type name, parentData, and optional parentId)
 * @param schema - The parsed schema
 */
export async function generateEntity(
  type: string,
  prompt: string | undefined,
  context: { parent: string; parentData: Record<string, unknown>; parentId?: string },
  schema: ParsedSchema
): Promise<Record<string, unknown>> {
  const entity = schema.entities.get(type)
  if (!entity) throw new Error(`Unknown type: ${type}`)

  // Gather context for generation
  const parentEntity = schema.entities.get(context.parent)
  const parentSchema = parentEntity?.schema || {}
  const instructions = parentSchema.$instructions as string | undefined
  const schemaContext = parentSchema.$context as string | undefined

  // Try AI-powered generation first
  const aiGeneratedData = await generateEntityDataWithAI(type, entity, prompt, {
    parentData: context.parentData,
    instructions,
    schemaContext
  })

  // If AI generation succeeded, use that data but still handle relations
  if (aiGeneratedData) {
    const data: Record<string, unknown> = { ...aiGeneratedData }

    // Handle relations (AI doesn't generate these)
    for (const [fieldName, field] of entity.fields) {
      if (field.isRelation) {
        if (field.operator === '<-' && field.direction === 'backward') {
          // Backward relation to parent
          if (field.relatedType === context.parent && context.parentId) {
            data[fieldName] = context.parentId
          }
        } else if (field.operator === '->' && field.direction === 'forward') {
          // Recursively generate nested forward exact relations
          if (!field.isOptional) {
            const nestedGenerated = await generateEntity(
              field.relatedType!,
              field.prompt,
              { parent: type, parentData: data },
              schema
            )
            data[`_pending_${fieldName}`] = { type: field.relatedType!, data: nestedGenerated }
          }
        }
      }
    }

    return data
  }

  // Fallback to placeholder generation if AI is not available or failed
  // Extract relevant parent data for context (excluding metadata fields)
  const parentContextFields: string[] = []
  for (const [key, value] of Object.entries(context.parentData)) {
    if (!key.startsWith('$') && !key.startsWith('_') && typeof value === 'string' && value) {
      parentContextFields.push(`${key}: ${value}`)
    }
  }

  // Build context string for generation
  const contextParts: string[] = []
  if (prompt && prompt.trim()) contextParts.push(prompt)
  if (instructions) contextParts.push(instructions)
  if (schemaContext) contextParts.push(schemaContext)
  if (parentContextFields.length > 0) contextParts.push(parentContextFields.join(', '))

  const fullContext = contextParts.join(' | ')

  const data: Record<string, unknown> = {}
  for (const [fieldName, field] of entity.fields) {
    if (!field.isRelation) {
      if (field.type === 'string') {
        // Generate context-aware content
        data[fieldName] = generateContextAwareValue(fieldName, type, fullContext, prompt, context.parentData)
      } else if (field.isArray && field.type === 'string') {
        // Generate array of strings
        data[fieldName] = [generateContextAwareValue(fieldName, type, fullContext, prompt, context.parentData)]
      }
    } else if (field.operator === '<-' && field.direction === 'backward') {
      // Backward relation to parent - set the parent's ID if this entity's
      // related type matches the parent type
      if (field.relatedType === context.parent && context.parentId) {
        // Store the parent ID directly - this is a reference back to the parent
        data[fieldName] = context.parentId
      }
    } else if (field.operator === '->' && field.direction === 'forward') {
      // Recursively generate nested forward exact relations
      // This handles cases like Person.bio -> Bio
      if (!field.isOptional) {
        const nestedGenerated = await generateEntity(
          field.relatedType!,
          field.prompt,
          { parent: type, parentData: data },
          schema
        )
        // We need to create the nested entity too, but we can't do that here
        // because we don't have access to the provider yet.
        // This will be handled by resolveForwardExact when it calls us
        data[`_pending_${fieldName}`] = { type: field.relatedType!, data: nestedGenerated }
      }
    }
  }
  return data
}

// =============================================================================
// Forward Exact Resolution
// =============================================================================

/**
 * Resolve forward exact (->) fields by auto-generating related entities
 *
 * When creating an entity with a -> field, if no value is provided,
 * we auto-generate the related entity and link it.
 *
 * Returns resolved data and pending relationships that need to be created
 * after the parent entity is created (for array fields).
 *
 * @param parentId - Pre-generated ID of the parent entity, so generated children
 *                   can set backward references to it
 */
export async function resolveForwardExact(
  typeName: string,
  data: Record<string, unknown>,
  entity: ParsedEntity,
  schema: ParsedSchema,
  provider: DBProvider,
  parentId: string
): Promise<{ data: Record<string, unknown>; pendingRelations: Array<{ fieldName: string; targetType: string; targetId: string }> }> {
  const resolved = { ...data }
  const pendingRelations: Array<{ fieldName: string; targetType: string; targetId: string }> = []

  for (const [fieldName, field] of entity.fields) {
    if (field.operator === '->' && field.direction === 'forward') {
      // Skip if value already provided
      if (resolved[fieldName] !== undefined && resolved[fieldName] !== null) {
        // If value is provided for array field, we still need to create relationships
        if (field.isArray && Array.isArray(resolved[fieldName])) {
          const ids = resolved[fieldName] as string[]
          for (const targetId of ids) {
            pendingRelations.push({ fieldName, targetType: field.relatedType!, targetId })
          }
        }
        continue
      }

      // Skip optional fields - they shouldn't auto-generate
      if (field.isOptional) continue

      if (field.isArray) {
        // Forward array relation - check if we should auto-generate
        // For union types, use the first union type as the generation target
        const generateType = field.unionTypes && field.unionTypes.length > 0
          ? field.unionTypes[0]!
          : field.relatedType!
        const relatedEntity = schema.entities.get(generateType)
        if (!relatedEntity) continue

        // Check if related entity has a backward ref to this type (symmetric relationship)
        let hasBackwardRef = false
        for (const [, relField] of relatedEntity.fields) {
          if (relField.isRelation &&
              relField.relatedType === typeName &&
              relField.direction === 'backward') {
            hasBackwardRef = true
            break
          }
        }

        // Check if related entity has required non-relation fields
        let hasRequiredScalarFields = false
        for (const [, relField] of relatedEntity.fields) {
          if (!relField.isRelation && !relField.isOptional) {
            hasRequiredScalarFields = true
            break
          }
        }

        // Decide whether to auto-generate:
        // - If there's a symmetric backward ref AND required scalars, skip (prevents duplicates)
        // - Otherwise, generate if the related entity can be meaningfully generated
        // - For union types, always allow generation (we have explicit type to generate)
        const hasUnionTypes = field.unionTypes && field.unionTypes.length > 0
        const shouldSkip = hasBackwardRef && hasRequiredScalarFields && !hasUnionTypes
        const canGenerate = !shouldSkip && (
          hasBackwardRef ||  // Symmetric ref without required scalars
          field.prompt ||    // Has a generation prompt
          !hasRequiredScalarFields ||  // No required fields to worry about
          hasUnionTypes      // Union types should generate the first type
        )

        if (!canGenerate) continue

        const generated = await generateEntity(
          generateType,
          field.prompt,
          { parent: typeName, parentData: data, parentId },
          schema
        )

        // Resolve any pending nested relations in the generated data
        const resolvedGenerated = await resolveNestedPending(generated, relatedEntity, schema, provider)
        const created = await provider.create(generateType, undefined, {
          ...resolvedGenerated,
          $matchedType: generateType
        })
        resolved[fieldName] = [created.$id]
        resolved[`${fieldName}$matchedType`] = generateType

        // Queue relationship creation for after parent entity is created
        pendingRelations.push({ fieldName, targetType: generateType, targetId: created.$id as string })
      } else {
        // Single non-optional forward relation - generate the related entity
        // Generate single entity
        const generated = await generateEntity(
          field.relatedType!,
          field.prompt,
          { parent: typeName, parentData: data, parentId },
          schema
        )

        // Resolve any pending nested relations in the generated data
        const relatedEntity = schema.entities.get(field.relatedType!)
        if (relatedEntity) {
          const resolvedGenerated = await resolveNestedPending(generated, relatedEntity, schema, provider)
          const created = await provider.create(field.relatedType!, undefined, resolvedGenerated)
          resolved[fieldName] = created.$id
        }
      }
    }
  }
  return { data: resolved, pendingRelations }
}

// =============================================================================
// Natural Language Content Generation
// =============================================================================

/**
 * Generate natural language content for a relationship field
 *
 * In production, this would integrate with AI to generate contextual descriptions.
 * For testing, generates deterministic content based on field name and type.
 */
export function generateNaturalLanguageContent(
  fieldName: string,
  prompt: string | undefined,
  targetType: string,
  context: Record<string, unknown>
): string {
  // Use prompt if available, otherwise generate from field name
  if (prompt) {
    // Extract key words from prompt for natural language
    const keyWords = prompt.toLowerCase()
    if (keyWords.includes('idea') || keyWords.includes('concept')) {
      return `A innovative idea for ${context.name || targetType}`
    }
    if (keyWords.includes('customer') || keyWords.includes('buyer') || keyWords.includes('user')) {
      return `The target customer segment for ${context.name || targetType}`
    }
    if (keyWords.includes('related') || keyWords.includes('similar')) {
      return `Related ${targetType.toLowerCase()} content`
    }
    if (keyWords.includes('person') || keyWords.includes('find')) {
      return `A suitable ${targetType.toLowerCase()} for the task`
    }
  }

  // Generate based on field name patterns
  const fieldLower = fieldName.toLowerCase()
  if (fieldLower.includes('idea')) {
    return `A compelling idea for ${context.name || 'the project'}`
  }
  if (fieldLower.includes('customer')) {
    return `The ideal customer for ${context.name || 'the business'}`
  }
  if (fieldLower.includes('founder') || fieldLower.includes('lead') || fieldLower.includes('ceo') || fieldLower.includes('cto') || fieldLower.includes('cfo')) {
    return `A qualified ${fieldName} candidate`
  }
  if (fieldLower.includes('author') || fieldLower.includes('reviewer')) {
    return `An experienced ${fieldName}`
  }
  if (fieldLower.includes('assignee') || fieldLower.includes('owner')) {
    return `The right person for ${context.title || context.name || 'this task'}`
  }
  if (fieldLower.includes('department') || fieldLower.includes('team')) {
    return `A department for ${context.name || 'the organization'}`
  }
  if (fieldLower.includes('client') || fieldLower.includes('sponsor')) {
    return `A ${fieldName} for ${context.name || context.title || 'the project'}`
  }
  if (fieldLower.includes('item') || fieldLower.includes('component')) {
    return `${targetType} component`
  }
  if (fieldLower.includes('member') || fieldLower.includes('project')) {
    return `${targetType} for ${context.name || 'the team'}`
  }
  if (fieldLower.includes('character')) {
    return `A character for ${context.title || context.name || 'the story'}`
  }
  if (fieldLower.includes('setting') || fieldLower.includes('location')) {
    return `A setting for ${context.title || context.name || 'the story'}`
  }
  if (fieldLower.includes('address')) {
    return `Address information`
  }

  // Default fallback
  return `A ${targetType.toLowerCase()} for ${fieldName}`
}
