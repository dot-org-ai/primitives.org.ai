/**
 * HubSpot CRM Provider
 *
 * Concrete implementation of CRMProvider using HubSpot CRM API v3.
 *
 * @packageDocumentation
 */

import type {
  CRMProvider,
  ProviderConfig,
  ProviderHealth,
  ProviderInfo,
  CreateContactOptions,
  CRMContactData,
  ContactListOptions,
  PaginatedResult,
  CreateDealOptions,
  DealData,
  DealListOptions,
  CreateActivityOptions,
  CRMActivityData,
} from '../types.js'
import { defineProvider } from '../registry.js'

const HUBSPOT_API_URL = 'https://api.hubapi.com/crm/v3'

/**
 * HubSpot provider info
 */
export const hubspotInfo: ProviderInfo = {
  id: 'crm.hubspot',
  name: 'HubSpot',
  description: 'HubSpot CRM platform for managing contacts, deals, and activities',
  category: 'crm',
  website: 'https://www.hubspot.com',
  docsUrl: 'https://developers.hubspot.com/docs/api/overview',
  requiredConfig: ['accessToken'],
  optionalConfig: ['baseUrl'],
}

/**
 * Map HubSpot contact properties to CRMContactData
 */
function mapContactFromHubSpot(contact: any): CRMContactData {
  const props = contact.properties || {}
  return {
    id: contact.id,
    firstName: props.firstname || '',
    lastName: props.lastname || '',
    email: props.email,
    phone: props.phone,
    company: props.company,
    title: props.jobtitle,
    ownerId: props.hubspot_owner_id,
    createdAt: new Date(props.createdate || contact.createdAt),
    updatedAt: new Date(props.lastmodifieddate || contact.updatedAt),
  }
}

/**
 * Map HubSpot deal properties to DealData
 */
function mapDealFromHubSpot(deal: any): DealData {
  const props = deal.properties || {}
  return {
    id: deal.id,
    name: props.dealname || '',
    value: props.amount ? parseFloat(props.amount) : undefined,
    currency: props.deal_currency_code,
    stage: props.dealstage || '',
    probability: props.hs_deal_stage_probability ? parseFloat(props.hs_deal_stage_probability) : undefined,
    contactId: props.associatedcontactid,
    companyId: props.associatedcompanyid,
    ownerId: props.hubspot_owner_id,
    closeDate: props.closedate ? new Date(props.closedate) : undefined,
    createdAt: new Date(props.createdate || deal.createdAt),
    updatedAt: new Date(props.hs_lastmodifieddate || deal.updatedAt),
    wonAt: props.hs_date_entered_closedwon ? new Date(props.hs_date_entered_closedwon) : undefined,
    lostAt: props.hs_date_entered_closedlost ? new Date(props.hs_date_entered_closedlost) : undefined,
  }
}

/**
 * Map HubSpot engagement to CRMActivityData
 */
function mapActivityFromHubSpot(engagement: any, contactId: string): CRMActivityData {
  const props = engagement.properties || {}
  return {
    id: engagement.id,
    type: props.hs_engagement_type || 'note',
    subject: props.hs_engagement_subject || '',
    body: props.hs_note_body || props.hs_email_text || '',
    contactId,
    ownerId: props.hubspot_owner_id || '',
    dueDate: props.hs_task_due_date ? new Date(props.hs_task_due_date) : undefined,
    completedAt: props.hs_engagement_completed_at ? new Date(props.hs_engagement_completed_at) : undefined,
    createdAt: new Date(props.hs_createdate || engagement.createdAt),
  }
}

/**
 * Create HubSpot CRM provider
 */
export function createHubSpotProvider(config: ProviderConfig): CRMProvider {
  let accessToken: string
  let baseUrl: string

  // Helper function to associate deal with contact
  async function associateDealWithContact(dealId: string, contactId: string): Promise<void> {
    try {
      const response = await fetch(
        `${baseUrl}/objects/deals/${dealId}/associations/contacts/${contactId}/deal_to_contact`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      // Log but don't throw - association is optional
      console.warn('Failed to associate deal with contact:', error)
    }
  }

  // Helper function to associate deal with company
  async function associateDealWithCompany(dealId: string, companyId: string): Promise<void> {
    try {
      const response = await fetch(
        `${baseUrl}/objects/deals/${dealId}/associations/companies/${companyId}/deal_to_company`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      // Log but don't throw - association is optional
      console.warn('Failed to associate deal with company:', error)
    }
  }

  // Helper function to associate engagement with contact
  async function associateEngagementWithContact(engagementId: string, contactId: string): Promise<void> {
    try {
      const response = await fetch(
        `${baseUrl}/objects/engagements/${engagementId}/associations/contacts/${contactId}/engagement_to_contact`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      console.warn('Failed to associate engagement with contact:', error)
    }
  }

  return {
    info: hubspotInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      accessToken = cfg.accessToken as string
      baseUrl = (cfg.baseUrl as string) || HUBSPOT_API_URL

      if (!accessToken) {
        throw new Error('HubSpot access token is required')
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      try {
        const response = await fetch(`${baseUrl}/objects/contacts?limit=1`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
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

    async createContact(contact: CreateContactOptions): Promise<CRMContactData> {
      const properties: Record<string, any> = {
        firstname: contact.firstName,
        lastname: contact.lastName,
      }

      if (contact.email) properties.email = contact.email
      if (contact.phone) properties.phone = contact.phone
      if (contact.company) properties.company = contact.company
      if (contact.title) properties.jobtitle = contact.title

      // Add custom fields
      if (contact.customFields) {
        Object.assign(properties, contact.customFields)
      }

      try {
        const response = await fetch(`${baseUrl}/objects/contacts`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ properties }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error((errorData as any)?.message || `HTTP ${response.status}`)
        }

        const data: any = await response.json()
        return mapContactFromHubSpot(data)
      } catch (error) {
        throw new Error(
          `Failed to create contact: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },

    async getContact(contactId: string): Promise<CRMContactData | null> {
      try {
        const response = await fetch(`${baseUrl}/objects/contacts/${contactId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        })

        if (response.status === 404) {
          return null
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data: any = await response.json()
        return mapContactFromHubSpot(data)
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          return null
        }
        throw new Error(
          `Failed to get contact: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },

    async updateContact(
      contactId: string,
      updates: Partial<CreateContactOptions>
    ): Promise<CRMContactData> {
      const properties: Record<string, any> = {}

      if (updates.firstName !== undefined) properties.firstname = updates.firstName
      if (updates.lastName !== undefined) properties.lastname = updates.lastName
      if (updates.email !== undefined) properties.email = updates.email
      if (updates.phone !== undefined) properties.phone = updates.phone
      if (updates.company !== undefined) properties.company = updates.company
      if (updates.title !== undefined) properties.jobtitle = updates.title

      // Add custom fields
      if (updates.customFields) {
        Object.assign(properties, updates.customFields)
      }

      try {
        const response = await fetch(`${baseUrl}/objects/contacts/${contactId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ properties }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error((errorData as any)?.message || `HTTP ${response.status}`)
        }

        const data: any = await response.json()
        return mapContactFromHubSpot(data)
      } catch (error) {
        throw new Error(
          `Failed to update contact: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },

    async listContacts(options?: ContactListOptions): Promise<PaginatedResult<CRMContactData>> {
      const params = new URLSearchParams({
        limit: String(options?.limit || 100),
      })

      if (options?.cursor) {
        params.set('after', options.cursor)
      }

      try {
        const response = await fetch(`${baseUrl}/objects/contacts?${params}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data: any = await response.json()
        return {
          items: (data.results || []).map(mapContactFromHubSpot),
          total: data.total,
          hasMore: !!data.paging?.next,
          nextCursor: data.paging?.next?.after,
        }
      } catch (error) {
        throw new Error(
          `Failed to list contacts: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },

    async searchContacts(query: string): Promise<CRMContactData[]> {
      try {
        const response = await fetch(`${baseUrl}/objects/contacts/search`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: 'email',
                    operator: 'CONTAINS_TOKEN',
                    value: query,
                  },
                  {
                    propertyName: 'firstname',
                    operator: 'CONTAINS_TOKEN',
                    value: query,
                  },
                  {
                    propertyName: 'lastname',
                    operator: 'CONTAINS_TOKEN',
                    value: query,
                  },
                ],
              },
            ],
            limit: 100,
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data: any = await response.json()
        return (data.results || []).map(mapContactFromHubSpot)
      } catch (error) {
        throw new Error(
          `Failed to search contacts: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },

    async createDeal(deal: CreateDealOptions): Promise<DealData> {
      const properties: Record<string, any> = {
        dealname: deal.name,
        dealstage: deal.stage,
      }

      if (deal.value !== undefined) properties.amount = String(deal.value)
      if (deal.currency) properties.deal_currency_code = deal.currency
      if (deal.closeDate) properties.closedate = deal.closeDate.toISOString()
      if (deal.probability !== undefined) properties.hs_deal_stage_probability = String(deal.probability)

      try {
        const response = await fetch(`${baseUrl}/objects/deals`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ properties }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error((errorData as any)?.message || `HTTP ${response.status}`)
        }

        const data: any = await response.json()
        const dealData = mapDealFromHubSpot(data)

        // Associate with contact if specified
        if (deal.contactId) {
          await associateDealWithContact(dealData.id, deal.contactId)
        }

        // Associate with company if specified
        if (deal.companyId) {
          await associateDealWithCompany(dealData.id, deal.companyId)
        }

        return dealData
      } catch (error) {
        throw new Error(
          `Failed to create deal: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },

    async getDeal(dealId: string): Promise<DealData | null> {
      try {
        const response = await fetch(`${baseUrl}/objects/deals/${dealId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        })

        if (response.status === 404) {
          return null
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data: any = await response.json()
        return mapDealFromHubSpot(data)
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          return null
        }
        throw new Error(
          `Failed to get deal: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },

    async updateDeal(dealId: string, updates: Partial<CreateDealOptions>): Promise<DealData> {
      const properties: Record<string, any> = {}

      if (updates.name !== undefined) properties.dealname = updates.name
      if (updates.stage !== undefined) properties.dealstage = updates.stage
      if (updates.value !== undefined) properties.amount = String(updates.value)
      if (updates.currency !== undefined) properties.deal_currency_code = updates.currency
      if (updates.closeDate !== undefined) properties.closedate = updates.closeDate.toISOString()
      if (updates.probability !== undefined) properties.hs_deal_stage_probability = String(updates.probability)

      try {
        const response = await fetch(`${baseUrl}/objects/deals/${dealId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ properties }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error((errorData as any)?.message || `HTTP ${response.status}`)
        }

        const data: any = await response.json()
        return mapDealFromHubSpot(data)
      } catch (error) {
        throw new Error(
          `Failed to update deal: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },

    async listDeals(options?: DealListOptions): Promise<PaginatedResult<DealData>> {
      const params = new URLSearchParams({
        limit: String(options?.limit || 100),
      })

      if (options?.cursor) {
        params.set('after', options.cursor)
      }

      try {
        const response = await fetch(`${baseUrl}/objects/deals?${params}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data: any = await response.json()
        return {
          items: (data.results || []).map(mapDealFromHubSpot),
          total: data.total,
          hasMore: !!data.paging?.next,
          nextCursor: data.paging?.next?.after,
        }
      } catch (error) {
        throw new Error(
          `Failed to list deals: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },

    async logActivity(contactId: string, activity: CreateActivityOptions): Promise<CRMActivityData> {
      // Map activity type to HubSpot engagement type
      const engagementType = activity.type === 'email' ? 'EMAIL' :
                             activity.type === 'call' ? 'CALL' :
                             activity.type === 'meeting' ? 'MEETING' :
                             activity.type === 'task' ? 'TASK' :
                             'NOTE'

      const properties: Record<string, any> = {
        hs_engagement_type: engagementType.toLowerCase(),
        hs_engagement_subject: activity.subject,
      }

      if (activity.body) {
        if (engagementType === 'NOTE') {
          properties.hs_note_body = activity.body
        } else if (engagementType === 'EMAIL') {
          properties.hs_email_text = activity.body
        }
      }

      if (activity.dueDate) {
        properties.hs_task_due_date = activity.dueDate.toISOString()
      }

      try {
        const response = await fetch(`${baseUrl}/objects/engagements`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ properties }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error((errorData as any)?.message || `HTTP ${response.status}`)
        }

        const data: any = await response.json()

        // Associate engagement with contact
        await associateEngagementWithContact(data.id, contactId)

        return mapActivityFromHubSpot(data, contactId)
      } catch (error) {
        throw new Error(
          `Failed to log activity: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },

    async listActivities(contactId: string): Promise<CRMActivityData[]> {
      try {
        // Get associated engagements for the contact
        const response = await fetch(
          `${baseUrl}/objects/contacts/${contactId}/associations/engagements`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        )

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data: any = await response.json()
        const engagementIds = (data.results || []).map((r: any) => r.id)

        if (engagementIds.length === 0) {
          return []
        }

        // Fetch engagement details in batch
        const engagements = await Promise.all(
          engagementIds.map(async (id: string) => {
            const engResponse = await fetch(`${baseUrl}/objects/engagements/${id}`, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            })
            if (engResponse.ok) {
              return engResponse.json()
            }
            return null
          })
        )

        return engagements
          .filter((eng: any) => eng !== null)
          .map((eng: any) => mapActivityFromHubSpot(eng, contactId))
      } catch (error) {
        throw new Error(
          `Failed to list activities: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },
  }
}

/**
 * HubSpot provider definition
 */
export const hubspotProvider = defineProvider(hubspotInfo, async (config) =>
  createHubSpotProvider(config)
)
