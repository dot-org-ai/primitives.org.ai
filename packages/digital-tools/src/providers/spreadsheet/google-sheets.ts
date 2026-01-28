/**
 * Google Sheets Provider
 *
 * Concrete implementation of SpreadsheetProvider using Google Sheets API.
 *
 * @packageDocumentation
 */

import type {
  SpreadsheetProvider,
  ProviderConfig,
  ProviderHealth,
  ProviderInfo,
  SpreadsheetData,
  SheetInfo,
  SheetData,
  CellValue,
  CreateSpreadsheetOptions,
  SpreadsheetListOptions,
  AddSheetOptions,
  UpdateResult,
  AppendResult,
  ImportOptions,
  PaginatedResult,
} from '../types.js'
import { defineProvider } from '../registry.js'

const SHEETS_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files'

// =============================================================================
// Google Sheets API Response Types
// =============================================================================

/** Google API error response */
interface GoogleErrorResponse {
  error?: {
    message?: string
    code?: number
  }
}

/** Google Drive file from list response */
interface GoogleDriveFile {
  id: string
  name: string
  createdTime?: string
  modifiedTime?: string
}

/** Google Drive list response */
interface GoogleDriveListResponse {
  files?: GoogleDriveFile[]
  nextPageToken?: string
}

/** Google Sheets grid properties */
interface GoogleGridProperties {
  rowCount?: number
  columnCount?: number
  frozenRowCount?: number
  frozenColumnCount?: number
}

/** Google Sheets sheet properties */
interface GoogleSheetProperties {
  sheetId: number
  title: string
  index: number
  gridProperties?: GoogleGridProperties
}

/** Google Sheets cell effective value */
interface GoogleCellEffectiveValue {
  numberValue?: number
  stringValue?: string
  boolValue?: boolean
  formulaValue?: string
  errorValue?: { message: string }
}

/** Google Sheets cell data */
interface GoogleCellData {
  effectiveValue?: GoogleCellEffectiveValue
}

/** Google Sheets row data */
interface GoogleRowData {
  values?: GoogleCellData[]
}

/** Google Sheets grid data */
interface GoogleGridData {
  rowData?: GoogleRowData[]
}

/** Google Sheets sheet from API */
interface GoogleSheet {
  properties: GoogleSheetProperties
  data?: GoogleGridData[]
}

/** Google Sheets spreadsheet from API */
interface GoogleSpreadsheet {
  spreadsheetId: string
  properties: { title: string }
  sheets?: GoogleSheet[]
  spreadsheetUrl?: string
}

/** Google Sheets value range from API */
interface GoogleValueRange {
  range: string
  values?: CellValue[][]
}

/** Google Sheets batch update reply */
interface GoogleBatchUpdateReply {
  addSheet?: {
    properties: GoogleSheetProperties
  }
}

/** Google Sheets batch update response */
interface GoogleBatchUpdateResponse {
  replies: GoogleBatchUpdateReply[]
}

/** Google Sheets value update response */
interface GoogleValueUpdateResponse {
  spreadsheetId: string
  updatedRange?: string
  updatedRows?: number
  updatedColumns?: number
  updatedCells?: number
  updates?: {
    updatedRange?: string
    updatedRows?: number
  }
}

/** Google Sheets batch get response */
interface GoogleBatchGetResponse {
  valueRanges?: GoogleValueRange[]
}

/** Google Sheets batch value update response */
interface GoogleBatchValueUpdateResponse {
  totalUpdatedRows?: number
  totalUpdatedColumns?: number
  totalUpdatedCells?: number
}

/**
 * Google Sheets provider info
 */
export const googleSheetsInfo: ProviderInfo = {
  id: 'spreadsheet.google-sheets',
  name: 'Google Sheets',
  description: 'Google Sheets cloud spreadsheet service',
  category: 'spreadsheet',
  website: 'https://sheets.google.com',
  docsUrl: 'https://developers.google.com/sheets/api',
  requiredConfig: ['accessToken'],
  optionalConfig: ['refreshToken', 'clientId', 'clientSecret'],
}

/**
 * Create Google Sheets provider
 */
export function createGoogleSheetsProvider(config: ProviderConfig): SpreadsheetProvider {
  let accessToken: string

  async function sheetsApi<T>(
    path: string,
    method: string = 'GET',
    body?: unknown,
    baseUrl: string = SHEETS_API_URL
  ): Promise<T> {
    const url = path.startsWith('http') ? path : `${baseUrl}${path}`

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as GoogleErrorResponse
      throw new Error(error.error?.message || `HTTP ${response.status}`)
    }

    return response.json() as Promise<T>
  }

  return {
    info: googleSheetsInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      accessToken = cfg.accessToken as string
      if (!accessToken) {
        throw new Error('Google Sheets access token is required')
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      try {
        // Test with a minimal API call
        await sheetsApi('', 'GET', undefined, 'https://www.googleapis.com/oauth2/v1/tokeninfo')
        return {
          healthy: true,
          latencyMs: Date.now() - start,
          message: 'Connected',
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

    async create(name: string, options?: CreateSpreadsheetOptions): Promise<SpreadsheetData> {
      const sheets = options?.sheets || [{ name: 'Sheet1' }]

      const body = {
        properties: {
          title: name,
          locale: options?.locale,
          timeZone: options?.timeZone,
        },
        sheets: sheets.map((s, index) => ({
          properties: {
            title: s.name,
            index,
          },
        })),
      }

      const data = await sheetsApi<GoogleSpreadsheet>('', 'POST', body)

      return mapSpreadsheet(data)
    },

    async get(spreadsheetId: string): Promise<SpreadsheetData | null> {
      try {
        const data = await sheetsApi<GoogleSpreadsheet>(`/${spreadsheetId}?includeGridData=false`)
        return mapSpreadsheet(data)
      } catch {
        return null
      }
    },

    async list(options?: SpreadsheetListOptions): Promise<PaginatedResult<SpreadsheetData>> {
      const params = new URLSearchParams({
        q: `mimeType='application/vnd.google-apps.spreadsheet'${
          options?.query ? ` and name contains '${options.query}'` : ''
        }`,
        pageSize: (options?.limit || 100).toString(),
        fields: 'files(id,name,createdTime,modifiedTime),nextPageToken',
      })

      if (options?.cursor) {
        params.append('pageToken', options.cursor)
      }

      const data = await sheetsApi<GoogleDriveListResponse>(
        `?${params.toString()}`,
        'GET',
        undefined,
        DRIVE_API_URL
      )

      return {
        items:
          data.files?.map((f) => ({
            id: f.id,
            name: f.name,
            sheets: [], // Would need separate API call to get sheets
            ...(f.createdTime && { createdAt: new Date(f.createdTime) }),
            ...(f.modifiedTime && { modifiedAt: new Date(f.modifiedTime) }),
            url: `https://docs.google.com/spreadsheets/d/${f.id}`,
          })) || [],
        hasMore: !!data.nextPageToken,
        ...(data.nextPageToken !== undefined && { nextCursor: data.nextPageToken }),
      }
    },

    async delete(spreadsheetId: string): Promise<boolean> {
      try {
        await sheetsApi(`/${spreadsheetId}`, 'DELETE', undefined, DRIVE_API_URL)
        return true
      } catch {
        return false
      }
    },

    async getSheet(spreadsheetId: string, sheetId: string | number): Promise<SheetData | null> {
      try {
        const spreadsheet = await sheetsApi<GoogleSpreadsheet>(
          `/${spreadsheetId}?includeGridData=true`
        )

        const sheet =
          typeof sheetId === 'number'
            ? spreadsheet.sheets?.find((s) => s.properties.sheetId === sheetId)
            : spreadsheet.sheets?.find((s) => s.properties.title === sheetId)

        if (!sheet) return null

        // Extract data from grid
        const gridData = sheet.data?.[0]
        const data: CellValue[][] = []

        if (gridData?.rowData) {
          for (const row of gridData.rowData) {
            const rowValues: CellValue[] = []
            if (row.values) {
              for (const cell of row.values) {
                rowValues.push(extractCellValue(cell))
              }
            }
            data.push(rowValues)
          }
        }

        return {
          id: sheet.properties.sheetId.toString(),
          name: sheet.properties.title,
          index: sheet.properties.index,
          rowCount: sheet.properties.gridProperties?.rowCount || 0,
          columnCount: sheet.properties.gridProperties?.columnCount || 0,
          data,
          ...(sheet.properties.gridProperties?.frozenRowCount !== undefined && {
            frozenRows: sheet.properties.gridProperties.frozenRowCount,
          }),
          ...(sheet.properties.gridProperties?.frozenColumnCount !== undefined && {
            frozenColumns: sheet.properties.gridProperties.frozenColumnCount,
          }),
        }
      } catch {
        return null
      }
    },

    async addSheet(
      spreadsheetId: string,
      name: string,
      options?: AddSheetOptions
    ): Promise<SheetData> {
      const body = {
        requests: [
          {
            addSheet: {
              properties: {
                title: name,
                index: options?.index,
                gridProperties: {
                  rowCount: options?.rowCount || 1000,
                  columnCount: options?.columnCount || 26,
                },
              },
            },
          },
        ],
      }

      const data = await sheetsApi<GoogleBatchUpdateResponse>(
        `/${spreadsheetId}:batchUpdate`,
        'POST',
        body
      )

      const reply = data.replies[0]!.addSheet!
      return {
        id: reply.properties.sheetId.toString(),
        name: reply.properties.title,
        index: reply.properties.index,
        rowCount: reply.properties.gridProperties?.rowCount || 0,
        columnCount: reply.properties.gridProperties?.columnCount || 0,
      }
    },

    async deleteSheet(spreadsheetId: string, sheetId: string | number): Promise<boolean> {
      try {
        // If sheetId is a string (name), we need to look up the actual sheet ID
        let actualSheetId = typeof sheetId === 'number' ? sheetId : parseInt(sheetId, 10)

        if (isNaN(actualSheetId)) {
          // Look up by name
          const spreadsheet = await sheetsApi<GoogleSpreadsheet>(`/${spreadsheetId}`)
          const sheet = spreadsheet.sheets?.find((s) => s.properties.title === sheetId)
          if (!sheet) return false
          actualSheetId = sheet.properties.sheetId
        }

        const body = {
          requests: [
            {
              deleteSheet: {
                sheetId: actualSheetId,
              },
            },
          ],
        }

        await sheetsApi(`/${spreadsheetId}:batchUpdate`, 'POST', body)
        return true
      } catch {
        return false
      }
    },

    async renameSheet(
      spreadsheetId: string,
      sheetId: string | number,
      name: string
    ): Promise<boolean> {
      try {
        let actualSheetId = typeof sheetId === 'number' ? sheetId : parseInt(sheetId, 10)

        if (isNaN(actualSheetId)) {
          const spreadsheet = await sheetsApi<GoogleSpreadsheet>(`/${spreadsheetId}`)
          const sheet = spreadsheet.sheets?.find((s) => s.properties.title === sheetId)
          if (!sheet) return false
          actualSheetId = sheet.properties.sheetId
        }

        const body = {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: actualSheetId,
                  title: name,
                },
                fields: 'title',
              },
            },
          ],
        }

        await sheetsApi<GoogleBatchUpdateResponse>(`/${spreadsheetId}:batchUpdate`, 'POST', body)
        return true
      } catch {
        return false
      }
    },

    async readRange(spreadsheetId: string, range: string): Promise<CellValue[][]> {
      const data = await sheetsApi<GoogleValueRange>(
        `/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`
      )

      return data.values || []
    },

    async writeRange(
      spreadsheetId: string,
      range: string,
      values: CellValue[][]
    ): Promise<UpdateResult> {
      const body = {
        values,
      }

      const data = await sheetsApi<GoogleValueUpdateResponse>(
        `/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        'PUT',
        body
      )

      return {
        updatedRange: data.updatedRange || range,
        updatedRows: data.updatedRows || 0,
        updatedColumns: data.updatedColumns || 0,
        updatedCells: data.updatedCells || 0,
      }
    },

    async appendRows(
      spreadsheetId: string,
      range: string,
      values: CellValue[][]
    ): Promise<AppendResult> {
      const body = {
        values,
      }

      const data = await sheetsApi<GoogleValueUpdateResponse>(
        `/${spreadsheetId}/values/${encodeURIComponent(
          range
        )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        'POST',
        body
      )

      return {
        spreadsheetId: data.spreadsheetId,
        updatedRange: data.updates?.updatedRange || range,
        updatedRows: data.updates?.updatedRows || values.length,
      }
    },

    async clearRange(spreadsheetId: string, range: string): Promise<boolean> {
      try {
        await sheetsApi(`/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`, 'POST', {})
        return true
      } catch {
        return false
      }
    },

    async batchRead(spreadsheetId: string, ranges: string[]): Promise<Map<string, CellValue[][]>> {
      const params = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&')
      const data = await sheetsApi<GoogleBatchGetResponse>(
        `/${spreadsheetId}/values:batchGet?${params}&valueRenderOption=UNFORMATTED_VALUE`
      )

      const result = new Map<string, CellValue[][]>()
      data.valueRanges?.forEach((vr) => {
        result.set(vr.range, vr.values || [])
      })

      return result
    },

    async batchWrite(
      spreadsheetId: string,
      data: Array<{ range: string; values: CellValue[][] }>
    ): Promise<UpdateResult> {
      const body = {
        valueInputOption: 'USER_ENTERED',
        data: data.map((d) => ({
          range: d.range,
          values: d.values,
        })),
      }

      const response = await sheetsApi<GoogleBatchValueUpdateResponse>(
        `/${spreadsheetId}/values:batchUpdate`,
        'POST',
        body
      )

      return {
        updatedRange: 'batch',
        updatedRows: response.totalUpdatedRows || 0,
        updatedColumns: response.totalUpdatedColumns || 0,
        updatedCells: response.totalUpdatedCells || 0,
      }
    },

    async export(spreadsheetId: string, format: 'xlsx' | 'csv' | 'pdf'): Promise<Buffer> {
      const mimeTypes: Record<string, string> = {
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        csv: 'text/csv',
        pdf: 'application/pdf',
      }

      const response = await fetch(
        `${DRIVE_API_URL}/${spreadsheetId}/export?mimeType=${encodeURIComponent(
          mimeTypes[format]!
        )}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Export failed: HTTP ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    },
  }
}

function mapSpreadsheet(data: GoogleSpreadsheet): SpreadsheetData {
  return {
    id: data.spreadsheetId,
    name: data.properties.title,
    sheets:
      data.sheets?.map((s) => ({
        id: s.properties.sheetId.toString(),
        name: s.properties.title,
        index: s.properties.index,
        rowCount: s.properties.gridProperties?.rowCount ?? 0,
        columnCount: s.properties.gridProperties?.columnCount ?? 0,
      })) || [],
    // createdAt and modifiedAt not available from Sheets API
    ...(data.spreadsheetUrl !== undefined && { url: data.spreadsheetUrl }),
  }
}

function extractCellValue(cell: any): CellValue {
  if (!cell) return null

  const ev = cell.effectiveValue
  if (!ev) return null

  if ('numberValue' in ev) return ev.numberValue
  if ('stringValue' in ev) return ev.stringValue
  if ('boolValue' in ev) return ev.boolValue
  if ('formulaValue' in ev) return ev.formulaValue
  if ('errorValue' in ev) return `#ERROR: ${ev.errorValue.message}`

  return null
}

/**
 * Google Sheets provider definition
 */
export const googleSheetsProvider = defineProvider(googleSheetsInfo, async (config) =>
  createGoogleSheetsProvider(config)
)
