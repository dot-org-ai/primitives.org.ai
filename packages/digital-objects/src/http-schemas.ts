import { z } from 'zod'

export const NounDefinitionSchema = z.object({
  name: z.string().min(1),
  singular: z.string().optional(),
  plural: z.string().optional(),
  description: z.string().optional(),
  schema: z.record(z.any()).optional(),
})

export const VerbDefinitionSchema = z.object({
  name: z.string().min(1),
  action: z.string().optional(),
  act: z.string().optional(),
  activity: z.string().optional(),
  event: z.string().optional(),
  reverseBy: z.string().optional(),
  inverse: z.string().optional(),
  description: z.string().optional(),
})

export const CreateThingSchema = z.object({
  noun: z.string().min(1),
  data: z.record(z.any()),
  id: z.string().optional(),
})

export const UpdateThingSchema = z.object({
  data: z.record(z.any()),
})

export const PerformActionSchema = z.object({
  verb: z.string().min(1),
  subject: z.string().optional(),
  object: z.string().optional(),
  data: z.any().optional(),
})

// Batch operation schemas
export const BatchCreateThingsSchema = z.object({
  noun: z.string().min(1),
  items: z.array(z.record(z.any())),
})

export const BatchUpdateThingsSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().min(1),
      data: z.record(z.any()),
    })
  ),
})

export const BatchDeleteThingsSchema = z.object({
  ids: z.array(z.string().min(1)),
})

export const BatchPerformActionsSchema = z.object({
  actions: z.array(
    z.object({
      verb: z.string().min(1),
      subject: z.string().optional(),
      object: z.string().optional(),
      data: z.any().optional(),
    })
  ),
})
