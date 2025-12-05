/**
 * Typeform Forms Provider
 *
 * Concrete implementation of FormsProvider using Typeform API.
 *
 * @packageDocumentation
 */

import type {
  FormsProvider,
  ProviderConfig,
  ProviderHealth,
  ProviderInfo,
  FormData,
  CreateFormOptions,
  FormResponseData,
  ResponseListOptions,
  PaginatedResult,
  PaginationOptions,
} from '../types.js'
import { defineProvider } from '../registry.js'

const TYPEFORM_API_URL = 'https://api.typeform.com'

/**
 * Typeform provider info
 */
export const typeformInfo: ProviderInfo = {
  id: 'forms.typeform',
  name: 'Typeform',
  description: 'Beautiful, user-friendly online forms and surveys',
  category: 'forms',
  website: 'https://typeform.com',
  docsUrl: 'https://developer.typeform.com',
  requiredConfig: ['accessToken'],
  optionalConfig: ['workspaceId'],
}

/**
 * Create Typeform forms provider
 */
export function createTypeformProvider(config: ProviderConfig): FormsProvider {
  let accessToken: string
  let workspaceId: string | undefined

  return {
    info: typeformInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      accessToken = cfg.accessToken as string
      workspaceId = cfg.workspaceId as string | undefined

      if (!accessToken) {
        throw new Error('Typeform access token is required')
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      try {
        const response = await fetch(`${TYPEFORM_API_URL}/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        return {
          healthy: response.ok,
          latencyMs: Date.now() - start,
          message: response.ok ? 'Connected' : `HTTP ${response.status}`,
          checkedAt: new Date(),
        }
      } catch (error) {
        return {
          healthy: false,
          latencyMs: Date.now() - start,
          message: error instanceof Error ? error.message : 'Unknown error',
          checkedAt: new Date(),
        }
      }
    },

    async dispose(): Promise<void> {
      // No cleanup needed
    },

    async createForm(form: CreateFormOptions): Promise<FormData> {
      const body: Record<string, unknown> = {
        title: form.title,
        type: 'form',
      }

      if (workspaceId) {
        body.workspace = { href: `${TYPEFORM_API_URL}/workspaces/${workspaceId}` }
      }

      // Map fields to Typeform format
      if (form.fields && form.fields.length > 0) {
        body.fields = form.fields.map((field, index) => {
          const typeformField: Record<string, unknown> = {
            title: field.title,
            ref: `field_${index}`,
            properties: {},
          }

          // Map field types
          switch (field.type) {
            case 'text':
              typeformField.type = 'short_text'
              break
            case 'textarea':
              typeformField.type = 'long_text'
              break
            case 'email':
              typeformField.type = 'email'
              break
            case 'number':
              typeformField.type = 'number'
              break
            case 'date':
              typeformField.type = 'date'
              break
            case 'dropdown':
              typeformField.type = 'dropdown'
              if (field.choices) {
                typeformField.properties = {
                  choices: field.choices.map((choice) => ({ label: choice })),
                }
              }
              break
            case 'radio':
              typeformField.type = 'multiple_choice'
              if (field.choices) {
                typeformField.properties = {
                  choices: field.choices.map((choice) => ({ label: choice })),
                  allow_multiple_selection: false,
                }
              }
              break
            case 'checkbox':
              typeformField.type = 'multiple_choice'
              if (field.choices) {
                typeformField.properties = {
                  choices: field.choices.map((choice) => ({ label: choice })),
                  allow_multiple_selection: true,
                }
              }
              break
            case 'file':
              typeformField.type = 'file_upload'
              break
            default:
              typeformField.type = 'short_text'
          }

          if (field.description) {
            typeformField.properties = {
              ...(typeof typeformField.properties === 'object' ? typeformField.properties : {}),
              description: field.description,
            }
          }

          typeformField.validations = {
            required: field.required || false,
          }

          return typeformField
        })
      }

      // Add settings
      if (form.settings) {
        body.settings = {
          is_public: form.settings.isPublic !== undefined ? form.settings.isPublic : true,
          show_progress_bar: form.settings.showProgressBar || false,
        }

        if (form.settings.confirmationMessage) {
          body.thankyou_screens = [
            {
              title: 'Thank you!',
              properties: {
                show_button: false,
                share_icons: false,
              },
            },
          ]
        }

        if (form.settings.redirectUrl) {
          body.thankyou_screens = [
            {
              title: 'Thank you!',
              properties: {
                show_button: true,
                button_text: 'Continue',
                button_mode: 'redirect',
                redirect_url: form.settings.redirectUrl,
              },
            },
          ]
        }
      }

      try {
        const response = await fetch(`${TYPEFORM_API_URL}/forms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            `Failed to create form: ${(errorData as any)?.message || response.statusText}`
          )
        }

        const data = await response.json()
        return transformTypeformToFormData(data)
      } catch (error) {
        throw new Error(
          `Failed to create form: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },

    async getForm(formId: string): Promise<FormData | null> {
      try {
        const response = await fetch(`${TYPEFORM_API_URL}/forms/${formId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (response.status === 404) {
          return null
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        return transformTypeformToFormData(data)
      } catch (error) {
        throw new Error(
          `Failed to get form: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },

    async updateForm(formId: string, updates: Partial<CreateFormOptions>): Promise<FormData> {
      const body: Record<string, unknown> = {}

      if (updates.title) {
        body.title = updates.title
      }

      if (updates.fields) {
        body.fields = updates.fields.map((field, index) => {
          const typeformField: Record<string, unknown> = {
            title: field.title,
            ref: `field_${index}`,
            properties: {},
          }

          // Map field types (same as createForm)
          switch (field.type) {
            case 'text':
              typeformField.type = 'short_text'
              break
            case 'textarea':
              typeformField.type = 'long_text'
              break
            case 'email':
              typeformField.type = 'email'
              break
            case 'number':
              typeformField.type = 'number'
              break
            case 'date':
              typeformField.type = 'date'
              break
            case 'dropdown':
              typeformField.type = 'dropdown'
              if (field.choices) {
                typeformField.properties = {
                  choices: field.choices.map((choice) => ({ label: choice })),
                }
              }
              break
            case 'radio':
              typeformField.type = 'multiple_choice'
              if (field.choices) {
                typeformField.properties = {
                  choices: field.choices.map((choice) => ({ label: choice })),
                  allow_multiple_selection: false,
                }
              }
              break
            case 'checkbox':
              typeformField.type = 'multiple_choice'
              if (field.choices) {
                typeformField.properties = {
                  choices: field.choices.map((choice) => ({ label: choice })),
                  allow_multiple_selection: true,
                }
              }
              break
            case 'file':
              typeformField.type = 'file_upload'
              break
            default:
              typeformField.type = 'short_text'
          }

          if (field.description) {
            typeformField.properties = {
              ...(typeof typeformField.properties === 'object' ? typeformField.properties : {}),
              description: field.description,
            }
          }

          typeformField.validations = {
            required: field.required || false,
          }

          return typeformField
        })
      }

      if (updates.settings) {
        body.settings = {
          ...(updates.settings.isPublic !== undefined && {
            is_public: updates.settings.isPublic,
          }),
          ...(updates.settings.showProgressBar !== undefined && {
            show_progress_bar: updates.settings.showProgressBar,
          }),
        }
      }

      try {
        const response = await fetch(`${TYPEFORM_API_URL}/forms/${formId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            `Failed to update form: ${(errorData as any)?.message || response.statusText}`
          )
        }

        const data = await response.json()
        return transformTypeformToFormData(data)
      } catch (error) {
        throw new Error(
          `Failed to update form: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },

    async deleteForm(formId: string): Promise<boolean> {
      try {
        const response = await fetch(`${TYPEFORM_API_URL}/forms/${formId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        return response.ok || response.status === 204
      } catch (error) {
        throw new Error(
          `Failed to delete form: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },

    async listForms(options?: PaginationOptions): Promise<PaginatedResult<FormData>> {
      const params = new URLSearchParams()
      const pageSize = options?.limit || 10
      const page = options?.offset ? Math.floor(options.offset / pageSize) + 1 : 1

      params.set('page_size', pageSize.toString())
      params.set('page', page.toString())

      if (workspaceId) {
        params.set('workspace_id', workspaceId)
      }

      try {
        const response = await fetch(`${TYPEFORM_API_URL}/forms?${params}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = (await response.json()) as any
        const items = (data.items || []).map(transformTypeformToFormData)

        return {
          items,
          total: data.total_items,
          hasMore: data.page_count > page,
          nextCursor: data.page_count > page ? ((page + 1) * pageSize).toString() : undefined,
        }
      } catch (error) {
        throw new Error(
          `Failed to list forms: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },

    async getResponses(
      formId: string,
      options?: ResponseListOptions
    ): Promise<PaginatedResult<FormResponseData>> {
      const params = new URLSearchParams()
      const pageSize = options?.limit || 25

      params.set('page_size', pageSize.toString())

      if (options?.since) {
        params.set('since', options.since.toISOString())
      }

      if (options?.until) {
        params.set('until', options.until.toISOString())
      }

      if (options?.completed !== undefined) {
        params.set('completed', options.completed.toString())
      }

      if (options?.cursor) {
        params.set('before', options.cursor)
      }

      try {
        const response = await fetch(`${TYPEFORM_API_URL}/forms/${formId}/responses?${params}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = (await response.json()) as any
        const items = (data.items || []).map((item: any) =>
          transformTypeformResponseToFormResponseData(formId, item)
        )

        return {
          items,
          total: data.total_items,
          hasMore: !!data.next_cursor,
          nextCursor: data.next_cursor,
        }
      } catch (error) {
        throw new Error(
          `Failed to get responses: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },

    async getResponse(formId: string, responseId: string): Promise<FormResponseData | null> {
      try {
        const response = await fetch(`${TYPEFORM_API_URL}/forms/${formId}/responses`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = (await response.json()) as any
        const item = data.items?.find((r: any) => r.response_id === responseId)

        if (!item) {
          return null
        }

        return transformTypeformResponseToFormResponseData(formId, item)
      } catch (error) {
        throw new Error(
          `Failed to get response: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },
  }
}

/**
 * Transform Typeform API response to FormData
 */
function transformTypeformToFormData(data: any): FormData {
  // Map Typeform fields back to our format
  const fields = (data.fields || []).map((field: any) => {
    let type: any = 'text'

    // Map Typeform types back to our types
    switch (field.type) {
      case 'short_text':
        type = 'text'
        break
      case 'long_text':
        type = 'textarea'
        break
      case 'email':
        type = 'email'
        break
      case 'number':
        type = 'number'
        break
      case 'date':
        type = 'date'
        break
      case 'dropdown':
        type = 'dropdown'
        break
      case 'multiple_choice':
        type = field.properties?.allow_multiple_selection ? 'checkbox' : 'radio'
        break
      case 'file_upload':
        type = 'file'
        break
    }

    return {
      type,
      title: field.title,
      description: field.properties?.description,
      required: field.validations?.required || false,
      choices: field.properties?.choices?.map((c: any) => c.label),
    }
  })

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    fields,
    responseCount: data.response_count || 0,
    url: data._links?.display || `https://form.typeform.com/to/${data.id}`,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.last_updated_at || data.created_at),
  }
}

/**
 * Transform Typeform response to FormResponseData
 */
function transformTypeformResponseToFormResponseData(formId: string, data: any): FormResponseData {
  const answers = (data.answers || []).map((answer: any) => ({
    fieldId: answer.field.ref || answer.field.id,
    value: answer[answer.type] || answer.text || answer.choice || answer.choices,
  }))

  return {
    id: data.response_id || data.token,
    formId,
    answers,
    submittedAt: new Date(data.submitted_at),
    metadata: data.metadata
      ? {
          ip: data.metadata.user_agent,
          userAgent: data.metadata.user_agent,
          referer: data.metadata.referer,
        }
      : undefined,
  }
}

/**
 * Typeform provider definition
 */
export const typeformProvider = defineProvider(typeformInfo, async (config) =>
  createTypeformProvider(config)
)
