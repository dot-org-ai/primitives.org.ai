/**
 * Google Sheets Provider Tests
 *
 * Tests for the Google Sheets spreadsheet provider implementation covering:
 * - Provider initialization with access tokens
 * - Spreadsheet creation and management
 * - Sheet operations (add, delete, rename)
 * - Cell range reading and writing
 * - Batch operations
 * - Export functionality
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import {
  createGoogleSheetsProvider,
  googleSheetsInfo,
} from '../../src/providers/spreadsheet/google-sheets.js'
import type { SpreadsheetProvider } from '../../src/providers/types.js'
import {
  setupMockFetch,
  resetMockFetch,
  mockJsonResponse,
  mockErrorResponse,
  mockNetworkError,
  getLastFetchCall,
  getFetchCall,
  parseFetchJsonBody,
  googleSheetsMocks,
  createTestSpreadsheetData,
} from './helpers.js'

describe('Google Sheets Provider', () => {
  let mockFetch: MockInstance
  let provider: SpreadsheetProvider

  beforeEach(() => {
    mockFetch = setupMockFetch()
  })

  afterEach(() => {
    resetMockFetch(mockFetch)
  })

  // ===========================================================================
  // Provider Initialization Tests
  // ===========================================================================

  describe('initialization', () => {
    it('should have correct provider info', () => {
      const provider = createGoogleSheetsProvider({})
      expect(provider.info).toBe(googleSheetsInfo)
      expect(provider.info.id).toBe('spreadsheet.google-sheets')
      expect(provider.info.name).toBe('Google Sheets')
      expect(provider.info.category).toBe('spreadsheet')
    })

    it('should require access token for initialization', async () => {
      provider = createGoogleSheetsProvider({})
      await expect(provider.initialize({})).rejects.toThrow(
        'Google Sheets access token is required'
      )
    })

    it('should initialize successfully with valid access token', async () => {
      provider = createGoogleSheetsProvider({ accessToken: 'test-token' })
      await expect(provider.initialize({ accessToken: 'test-token' })).resolves.toBeUndefined()
    })

    it('should include requiredConfig in provider info', () => {
      provider = createGoogleSheetsProvider({})
      expect(provider.info.requiredConfig).toContain('accessToken')
    })

    it('should include optionalConfig in provider info', () => {
      provider = createGoogleSheetsProvider({})
      expect(provider.info.optionalConfig).toContain('refreshToken')
    })
  })

  // ===========================================================================
  // Health Check Tests
  // ===========================================================================

  describe('healthCheck', () => {
    beforeEach(async () => {
      provider = createGoogleSheetsProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should return healthy status on successful token check', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse({ access_token: 'valid' }))

      const health = await provider.healthCheck()

      expect(health.healthy).toBe(true)
      expect(health.message).toBe('Connected')
      expect(health.latencyMs).toBeGreaterThanOrEqual(0)
      expect(health.checkedAt).toBeInstanceOf(Date)
    })

    it('should call tokeninfo endpoint for health check', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse({}))

      await provider.healthCheck()

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('tokeninfo')
    })

    it('should return unhealthy status on invalid token', async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse({ error: { message: 'Invalid token' } }, 401)
      )

      const health = await provider.healthCheck()

      expect(health.healthy).toBe(false)
      expect(health.message).toBe('Invalid token')
    })

    it('should return unhealthy status on network error', async () => {
      mockFetch.mockRejectedValueOnce(mockNetworkError('Connection failed'))

      const health = await provider.healthCheck()

      expect(health.healthy).toBe(false)
      expect(health.message).toBe('Connection failed')
    })
  })

  // ===========================================================================
  // Spreadsheet Creation Tests
  // ===========================================================================

  describe('create', () => {
    beforeEach(async () => {
      provider = createGoogleSheetsProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should create spreadsheet with name', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(googleSheetsMocks.spreadsheet('sheet-123', 'My Spreadsheet'))
      )

      const result = await provider.create('My Spreadsheet')

      expect(result.id).toBe('sheet-123')
      expect(result.name).toBe('My Spreadsheet')
    })

    it('should create spreadsheet with custom sheets', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          googleSheetsMocks.spreadsheet('sheet-123', 'Test', [
            { id: 0, title: 'Data' },
            { id: 1, title: 'Summary' },
          ])
        )
      )

      const result = await provider.create('Test', {
        sheets: [{ name: 'Data' }, { name: 'Summary' }],
      })

      expect(result.sheets).toHaveLength(2)
      expect(result.sheets[0].name).toBe('Data')
      expect(result.sheets[1].name).toBe('Summary')
    })

    it('should use POST method', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(googleSheetsMocks.spreadsheet('sheet-123', 'Test'))
      )

      await provider.create('Test')

      const { options } = getLastFetchCall(mockFetch)
      expect(options?.method).toBe('POST')
    })

    it('should include locale and timezone when provided', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(googleSheetsMocks.spreadsheet('sheet-123', 'Test'))
      )

      await provider.create('Test', {
        locale: 'en_US',
        timeZone: 'America/New_York',
      })

      const body = parseFetchJsonBody(mockFetch) as { properties: Record<string, unknown> }
      expect(body.properties.locale).toBe('en_US')
      expect(body.properties.timeZone).toBe('America/New_York')
    })

    it('should include Authorization header', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(googleSheetsMocks.spreadsheet('sheet-123', 'Test'))
      )

      await provider.create('Test')

      const { options } = getLastFetchCall(mockFetch)
      expect(options?.headers).toHaveProperty('Authorization', 'Bearer test-token')
    })
  })

  // ===========================================================================
  // Spreadsheet Retrieval Tests
  // ===========================================================================

  describe('get', () => {
    beforeEach(async () => {
      provider = createGoogleSheetsProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should retrieve spreadsheet by ID', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(googleSheetsMocks.spreadsheet('sheet-123', 'My Sheet'))
      )

      const spreadsheet = await provider.get('sheet-123')

      expect(spreadsheet).not.toBeNull()
      expect(spreadsheet?.id).toBe('sheet-123')
      expect(spreadsheet?.name).toBe('My Sheet')
    })

    it('should return null for non-existent spreadsheet', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse({ error: { message: 'Not found' } }, 404))

      const spreadsheet = await provider.get('nonexistent')

      expect(spreadsheet).toBeNull()
    })

    it('should include spreadsheet URL', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(googleSheetsMocks.spreadsheet('sheet-123', 'Test'))
      )

      const spreadsheet = await provider.get('sheet-123')

      expect(spreadsheet?.url).toContain('sheet-123')
    })
  })

  // ===========================================================================
  // List Spreadsheets Tests
  // ===========================================================================

  describe('list', () => {
    beforeEach(async () => {
      provider = createGoogleSheetsProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should return paginated spreadsheets from Drive', async () => {
      const files = [
        googleSheetsMocks.driveFile('sheet-1', 'Sheet 1'),
        googleSheetsMocks.driveFile('sheet-2', 'Sheet 2'),
      ]
      mockFetch.mockResolvedValueOnce(mockJsonResponse(googleSheetsMocks.driveListResponse(files)))

      const result = await provider.list!()

      expect(result.items).toHaveLength(2)
      expect(result.items[0].name).toBe('Sheet 1')
    })

    it('should apply search query', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(googleSheetsMocks.driveListResponse([])))

      await provider.list!({ query: 'budget' })

      const { url } = getLastFetchCall(mockFetch)
      // URL may use + or %20 for spaces, so check the essential parts
      expect(url).toContain('budget')
      expect(url).toContain('name')
      expect(url).toContain('contains')
    })

    it('should apply pagination options', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(googleSheetsMocks.driveListResponse([])))

      await provider.list!({ limit: 50, cursor: 'pageToken123' })

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('pageSize=50')
      expect(url).toContain('pageToken=pageToken123')
    })

    it('should include Drive spreadsheet URL', async () => {
      const files = [googleSheetsMocks.driveFile('sheet-1', 'Sheet 1')]
      mockFetch.mockResolvedValueOnce(mockJsonResponse(googleSheetsMocks.driveListResponse(files)))

      const result = await provider.list!()

      expect(result.items[0].url).toContain('docs.google.com/spreadsheets')
    })
  })

  // ===========================================================================
  // Delete Spreadsheet Tests
  // ===========================================================================

  describe('delete', () => {
    beforeEach(async () => {
      provider = createGoogleSheetsProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should delete spreadsheet successfully', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse({}))

      const result = await provider.delete!('sheet-123')

      expect(result).toBe(true)
      const { options } = getLastFetchCall(mockFetch)
      expect(options?.method).toBe('DELETE')
    })

    it('should return false on deletion failure', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse({ error: { message: 'Forbidden' } }, 403))

      const result = await provider.delete!('sheet-123')

      expect(result).toBe(false)
    })
  })

  // ===========================================================================
  // Sheet Operations Tests
  // ===========================================================================

  describe('getSheet', () => {
    beforeEach(async () => {
      provider = createGoogleSheetsProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should retrieve sheet by numeric ID', async () => {
      const spreadsheet = {
        ...googleSheetsMocks.spreadsheet('sheet-123', 'Test'),
        sheets: [
          googleSheetsMocks.sheetWithData(0, 'Sheet1', [
            ['A', 'B'],
            [1, 2],
          ]),
        ],
      }
      mockFetch.mockResolvedValueOnce(mockJsonResponse(spreadsheet))

      const sheet = await provider.getSheet('sheet-123', 0)

      expect(sheet).not.toBeNull()
      expect(sheet?.id).toBe('0')
      expect(sheet?.name).toBe('Sheet1')
    })

    it('should retrieve sheet by name', async () => {
      const spreadsheet = {
        ...googleSheetsMocks.spreadsheet('sheet-123', 'Test'),
        sheets: [googleSheetsMocks.sheetWithData(0, 'MySheet', [['Data']])],
      }
      mockFetch.mockResolvedValueOnce(mockJsonResponse(spreadsheet))

      const sheet = await provider.getSheet('sheet-123', 'MySheet')

      expect(sheet?.name).toBe('MySheet')
    })

    it('should return null for non-existent sheet', async () => {
      const spreadsheet = googleSheetsMocks.spreadsheet('sheet-123', 'Test')
      mockFetch.mockResolvedValueOnce(mockJsonResponse(spreadsheet))

      const sheet = await provider.getSheet('sheet-123', 'NonExistent')

      expect(sheet).toBeNull()
    })

    it('should include sheet data when available', async () => {
      const spreadsheet = {
        ...googleSheetsMocks.spreadsheet('sheet-123', 'Test'),
        sheets: [
          googleSheetsMocks.sheetWithData(0, 'Sheet1', [
            ['A', 'B'],
            [1, 2],
          ]),
        ],
      }
      mockFetch.mockResolvedValueOnce(mockJsonResponse(spreadsheet))

      const sheet = await provider.getSheet('sheet-123', 0)

      expect(sheet?.data).toBeDefined()
      expect(sheet?.data).toHaveLength(2)
    })
  })

  describe('addSheet', () => {
    beforeEach(async () => {
      provider = createGoogleSheetsProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should add new sheet to spreadsheet', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          googleSheetsMocks.batchUpdateResponse([
            {
              addSheet: {
                properties: { sheetId: 123, title: 'NewSheet', index: 1 },
              },
            },
          ])
        )
      )

      const sheet = await provider.addSheet('sheet-123', 'NewSheet')

      expect(sheet.name).toBe('NewSheet')
      expect(sheet.id).toBe('123')
    })

    it('should include row and column count options', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          googleSheetsMocks.batchUpdateResponse([
            {
              addSheet: {
                properties: {
                  sheetId: 123,
                  title: 'NewSheet',
                  index: 0,
                  gridProperties: { rowCount: 500, columnCount: 10 },
                },
              },
            },
          ])
        )
      )

      await provider.addSheet('sheet-123', 'NewSheet', {
        rowCount: 500,
        columnCount: 10,
      })

      const body = parseFetchJsonBody(mockFetch) as { requests: unknown[] }
      expect(body.requests).toBeDefined()
    })

    it('should use batchUpdate endpoint', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          googleSheetsMocks.batchUpdateResponse([
            { addSheet: { properties: { sheetId: 1, title: 'Test', index: 0 } } },
          ])
        )
      )

      await provider.addSheet('sheet-123', 'Test')

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain(':batchUpdate')
    })
  })

  describe('deleteSheet', () => {
    beforeEach(async () => {
      provider = createGoogleSheetsProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should delete sheet by numeric ID', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(googleSheetsMocks.batchUpdateResponse([])))

      const result = await provider.deleteSheet('sheet-123', 456)

      expect(result).toBe(true)
    })

    it('should look up sheet ID when given name', async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse(
            googleSheetsMocks.spreadsheet('sheet-123', 'Test', [{ id: 789, title: 'ToDelete' }])
          )
        )
        .mockResolvedValueOnce(mockJsonResponse(googleSheetsMocks.batchUpdateResponse([])))

      const result = await provider.deleteSheet('sheet-123', 'ToDelete')

      expect(result).toBe(true)
    })

    it('should return false when sheet not found', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(googleSheetsMocks.spreadsheet('sheet-123', 'Test'))
      )

      const result = await provider.deleteSheet('sheet-123', 'NonExistent')

      expect(result).toBe(false)
    })
  })

  describe('renameSheet', () => {
    beforeEach(async () => {
      provider = createGoogleSheetsProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should rename sheet successfully', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(googleSheetsMocks.batchUpdateResponse([])))

      const result = await provider.renameSheet!('sheet-123', 0, 'NewName')

      expect(result).toBe(true)
    })
  })

  // ===========================================================================
  // Cell Range Operations Tests
  // ===========================================================================

  describe('readRange', () => {
    beforeEach(async () => {
      provider = createGoogleSheetsProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should read cell values from range', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(
          googleSheetsMocks.valueRange('Sheet1!A1:B2', [
            ['Name', 'Value'],
            ['Test', 123],
          ])
        )
      )

      const data = await provider.readRange('sheet-123', 'Sheet1!A1:B2')

      expect(data).toHaveLength(2)
      expect(data[0]).toEqual(['Name', 'Value'])
      expect(data[1]).toEqual(['Test', 123])
    })

    it('should return empty array for empty range', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse({ range: 'Sheet1!A1:B2' }))

      const data = await provider.readRange('sheet-123', 'Sheet1!A1:B2')

      expect(data).toEqual([])
    })

    it('should URL encode range', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse({ values: [] }))

      await provider.readRange('sheet-123', 'Sheet1!A1:B2')

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain(encodeURIComponent('Sheet1!A1:B2'))
    })
  })

  describe('writeRange', () => {
    beforeEach(async () => {
      provider = createGoogleSheetsProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should write values to range', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(googleSheetsMocks.updateResponse('Sheet1!A1:B2', 2, 2, 4))
      )

      const result = await provider.writeRange('sheet-123', 'Sheet1!A1:B2', [
        ['Name', 'Value'],
        ['Test', 123],
      ])

      expect(result.updatedRows).toBe(2)
      expect(result.updatedCells).toBe(4)
    })

    it('should use PUT method', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(googleSheetsMocks.updateResponse('A1:B2', 1, 2, 2))
      )

      await provider.writeRange('sheet-123', 'A1:B2', [['A', 'B']])

      const { options } = getLastFetchCall(mockFetch)
      expect(options?.method).toBe('PUT')
    })

    it('should use USER_ENTERED value input option', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(googleSheetsMocks.updateResponse('A1:B2', 1, 2, 2))
      )

      await provider.writeRange('sheet-123', 'A1:B2', [['A', 'B']])

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('valueInputOption=USER_ENTERED')
    })
  })

  describe('appendRows', () => {
    beforeEach(async () => {
      provider = createGoogleSheetsProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should append rows to sheet', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          spreadsheetId: 'sheet-123',
          updates: { updatedRange: 'Sheet1!A5:B6', updatedRows: 2 },
        })
      )

      const result = await provider.appendRows('sheet-123', 'Sheet1', [
        ['New', 'Data'],
        ['More', 'Data'],
      ])

      expect(result.updatedRows).toBe(2)
    })

    it('should use :append endpoint', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          spreadsheetId: 'sheet-123',
          updates: {},
        })
      )

      await provider.appendRows('sheet-123', 'Sheet1', [['Data']])

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain(':append')
    })
  })

  describe('clearRange', () => {
    beforeEach(async () => {
      provider = createGoogleSheetsProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should clear cell range', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse({}))

      const result = await provider.clearRange('sheet-123', 'Sheet1!A1:B10')

      expect(result).toBe(true)
    })

    it('should use :clear endpoint', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse({}))

      await provider.clearRange('sheet-123', 'A1:B2')

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain(':clear')
    })
  })

  // ===========================================================================
  // Batch Operations Tests
  // ===========================================================================

  describe('batchRead', () => {
    beforeEach(async () => {
      provider = createGoogleSheetsProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should read multiple ranges at once', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          valueRanges: [
            { range: 'Sheet1!A1:B2', values: [['A', 'B']] },
            { range: 'Sheet1!C1:D2', values: [['C', 'D']] },
          ],
        })
      )

      const result = await provider.batchRead!('sheet-123', ['Sheet1!A1:B2', 'Sheet1!C1:D2'])

      expect(result.size).toBe(2)
      expect(result.get('Sheet1!A1:B2')).toEqual([['A', 'B']])
    })
  })

  describe('batchWrite', () => {
    beforeEach(async () => {
      provider = createGoogleSheetsProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should write to multiple ranges at once', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          totalUpdatedRows: 4,
          totalUpdatedColumns: 4,
          totalUpdatedCells: 8,
        })
      )

      const result = await provider.batchWrite!('sheet-123', [
        {
          range: 'Sheet1!A1:B2',
          values: [
            ['A', 'B'],
            [1, 2],
          ],
        },
        {
          range: 'Sheet1!C1:D2',
          values: [
            ['C', 'D'],
            [3, 4],
          ],
        },
      ])

      expect(result.updatedCells).toBe(8)
    })
  })

  // ===========================================================================
  // Export Tests
  // ===========================================================================

  describe('export', () => {
    beforeEach(async () => {
      provider = createGoogleSheetsProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should export spreadsheet as xlsx', async () => {
      const mockBuffer = new ArrayBuffer(100)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockBuffer,
      } as Response)

      const result = await provider.export!('sheet-123', 'xlsx')

      expect(result).toBeInstanceOf(Buffer)
      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('mimeType=')
    })

    it('should export spreadsheet as csv', async () => {
      const mockBuffer = new ArrayBuffer(50)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockBuffer,
      } as Response)

      await provider.export!('sheet-123', 'csv')

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('text%2Fcsv')
    })

    it('should export spreadsheet as pdf', async () => {
      const mockBuffer = new ArrayBuffer(200)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockBuffer,
      } as Response)

      await provider.export!('sheet-123', 'pdf')

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('application%2Fpdf')
    })

    it('should throw on export failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response)

      await expect(provider.export!('sheet-123', 'xlsx')).rejects.toThrow('Export failed')
    })
  })

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    beforeEach(async () => {
      provider = createGoogleSheetsProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should handle permission errors', async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse(googleSheetsMocks.error('Permission denied', 403), 403)
      )

      const spreadsheet = await provider.get('sheet-123')

      expect(spreadsheet).toBeNull()
    })

    it('should handle rate limit errors', async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse(googleSheetsMocks.error('Rate Limit Exceeded', 429), 429)
      )

      await expect(provider.writeRange('sheet-123', 'A1:B2', [['Data']])).rejects.toThrow(
        'Rate Limit Exceeded'
      )
    })

    it('should handle invalid range errors', async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse(googleSheetsMocks.error('Invalid range', 400), 400)
      )

      await expect(provider.readRange('sheet-123', 'InvalidRange!!!')).rejects.toThrow(
        'Invalid range'
      )
    })
  })

  // ===========================================================================
  // Dispose Tests
  // ===========================================================================

  describe('dispose', () => {
    it('should dispose without error', async () => {
      provider = createGoogleSheetsProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })

      await expect(provider.dispose()).resolves.toBeUndefined()
    })
  })
})
