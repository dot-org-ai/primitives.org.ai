/**
 * Spreadsheet Entity Types (Nouns)
 *
 * Semantic type definitions for spreadsheets that support
 * Google Sheets, Microsoft Excel/XLSX, and CSV formats.
 * Each entity defines:
 * - Properties: The data fields
 * - Actions: Operations that can be performed (Verbs)
 * - Events: State changes that occur
 *
 * @packageDocumentation
 */

import type { Noun } from 'ai-database'

// =============================================================================
// Spreadsheet
// =============================================================================

/**
 * Spreadsheet entity
 *
 * Represents a spreadsheet workbook containing one or more sheets.
 * Supports Google Sheets, Microsoft Excel/XLSX, and CSV formats.
 */
export const Spreadsheet: Noun = {
  singular: 'spreadsheet',
  plural: 'spreadsheets',
  description: 'A spreadsheet workbook for organizing and analyzing data',

  properties: {
    // Identity
    title: {
      type: 'string',
      description: 'Spreadsheet title',
    },
    slug: {
      type: 'string',
      optional: true,
      description: 'URL-friendly identifier',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Spreadsheet description',
    },

    // Format
    format: {
      type: 'string',
      description: 'Spreadsheet format: xlsx, gsheet, csv, tsv, ods',
      examples: ['xlsx', 'gsheet', 'csv', 'tsv', 'ods'],
    },
    fileSize: {
      type: 'number',
      optional: true,
      description: 'File size in bytes',
    },

    // Status
    status: {
      type: 'string',
      description: 'Spreadsheet status: draft, active, archived',
      examples: ['draft', 'active', 'archived'],
    },
    visibility: {
      type: 'string',
      description: 'Visibility: private, internal, public',
      examples: ['private', 'internal', 'public'],
    },

    // Structure
    sheetCount: {
      type: 'number',
      optional: true,
      description: 'Number of sheets in the workbook',
    },
    totalRows: {
      type: 'number',
      optional: true,
      description: 'Total rows across all sheets',
    },
    totalColumns: {
      type: 'number',
      optional: true,
      description: 'Total columns across all sheets',
    },
    totalCells: {
      type: 'number',
      optional: true,
      description: 'Total cells across all sheets',
    },

    // Settings
    locale: {
      type: 'string',
      optional: true,
      description: 'Locale for number and date formatting',
    },
    timezone: {
      type: 'string',
      optional: true,
      description: 'Timezone for date/time values',
    },
    defaultDateFormat: {
      type: 'string',
      optional: true,
      description: 'Default date format string',
    },
    defaultNumberFormat: {
      type: 'string',
      optional: true,
      description: 'Default number format string',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Default currency code',
    },

    // Recalculation
    autoRecalculate: {
      type: 'boolean',
      optional: true,
      description: 'Whether formulas auto-recalculate',
    },
    iterativeCalculation: {
      type: 'boolean',
      optional: true,
      description: 'Whether iterative calculation is enabled',
    },
    maxIterations: {
      type: 'number',
      optional: true,
      description: 'Maximum calculation iterations',
    },

    // Collaboration
    allowComments: {
      type: 'boolean',
      optional: true,
      description: 'Whether comments are enabled',
    },
    shareMode: {
      type: 'string',
      optional: true,
      description: 'Sharing mode: view, comment, edit',
      examples: ['view', 'comment', 'edit'],
    },
    allowDownload: {
      type: 'boolean',
      optional: true,
      description: 'Whether download is allowed',
    },
    allowCopy: {
      type: 'boolean',
      optional: true,
      description: 'Whether copying is allowed',
    },
    allowPrint: {
      type: 'boolean',
      optional: true,
      description: 'Whether printing is allowed',
    },

    // Protection
    protected: {
      type: 'boolean',
      optional: true,
      description: 'Whether spreadsheet is protected',
    },
    password: {
      type: 'string',
      optional: true,
      description: 'Protection password',
    },

    // Templates
    isTemplate: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is a template',
    },
    templateId: {
      type: 'string',
      optional: true,
      description: 'ID of template this was created from',
    },
    templateCategory: {
      type: 'string',
      optional: true,
      description: 'Template category',
      examples: ['budget', 'schedule', 'tracker', 'analysis', 'report'],
    },

    // Integration
    externalId: {
      type: 'string',
      optional: true,
      description: 'External system ID (Google Sheets ID, OneDrive ID, etc.)',
    },
    externalUrl: {
      type: 'url',
      optional: true,
      description: 'URL in external system',
    },
    syncEnabled: {
      type: 'boolean',
      optional: true,
      description: 'Whether sync is enabled',
    },
    lastSyncedAt: {
      type: 'datetime',
      optional: true,
      description: 'Last sync timestamp',
    },
    dataSource: {
      type: 'json',
      optional: true,
      description: 'External data source configuration',
    },

    // Metadata
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },
    category: {
      type: 'string',
      optional: true,
      description: 'Spreadsheet category',
    },
    folder: {
      type: 'string',
      optional: true,
      description: 'Folder or workspace path',
    },
    customMetadata: {
      type: 'json',
      optional: true,
      description: 'Custom metadata fields',
    },

    // Analytics
    viewCount: {
      type: 'number',
      optional: true,
      description: 'Number of views',
    },
    editCount: {
      type: 'number',
      optional: true,
      description: 'Number of edits',
    },
    downloadCount: {
      type: 'number',
      optional: true,
      description: 'Number of downloads',
    },
    lastViewedAt: {
      type: 'datetime',
      optional: true,
      description: 'Last view timestamp',
    },
    lastEditedAt: {
      type: 'datetime',
      optional: true,
      description: 'Last edit timestamp',
    },
  },

  relationships: {
    owner: {
      type: 'Contact',
      description: 'Spreadsheet owner',
    },
    creator: {
      type: 'Contact',
      description: 'User who created the spreadsheet',
    },
    lastEditor: {
      type: 'Contact',
      required: false,
      description: 'User who last edited',
    },
    sheets: {
      type: 'Sheet[]',
      backref: 'spreadsheet',
      description: 'Sheets in this workbook',
    },
    charts: {
      type: 'Chart[]',
      backref: 'spreadsheet',
      description: 'Charts in the spreadsheet',
    },
    pivotTables: {
      type: 'PivotTable[]',
      backref: 'spreadsheet',
      description: 'Pivot tables in the spreadsheet',
    },
    collaborators: {
      type: 'Contact[]',
      description: 'Users with access',
    },
  },

  actions: [
    'create',
    'open',
    'edit',
    'save',
    'saveAs',
    'duplicate',
    'rename',
    'delete',
    'restore',
    'export',
    'download',
    'print',
    'share',
    'unshare',
    'archive',
    'unarchive',
    'move',
    'copy',
    'protect',
    'unprotect',
    'addSheet',
    'removeSheet',
    'reorderSheets',
    'makeTemplate',
    'createFromTemplate',
    'importData',
    'exportData',
    'refreshData',
    'calculate',
    'sort',
    'filter',
    'search',
    'findAndReplace',
    'insertChart',
    'insertPivotTable',
    'merge',
    'split',
    'freeze',
    'unfreeze',
    'hideSheet',
    'unhideSheet',
  ],

  events: [
    'created',
    'opened',
    'edited',
    'saved',
    'renamed',
    'deleted',
    'restored',
    'exported',
    'downloaded',
    'printed',
    'shared',
    'unshared',
    'archived',
    'unarchived',
    'moved',
    'copied',
    'protected',
    'unprotected',
    'sheetAdded',
    'sheetRemoved',
    'sheetReordered',
    'dataImported',
    'dataExported',
    'dataRefreshed',
    'calculated',
    'chartInserted',
    'pivotTableInserted',
    'collaboratorAdded',
    'collaboratorRemoved',
    'permissionChanged',
    'synced',
    'viewed',
  ],
}

// =============================================================================
// Sheet
// =============================================================================

/**
 * Sheet entity
 *
 * Represents a single worksheet within a spreadsheet workbook.
 */
export const Sheet: Noun = {
  singular: 'sheet',
  plural: 'sheets',
  description: 'A worksheet within a spreadsheet workbook',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Sheet name',
    },
    index: {
      type: 'number',
      description: 'Sheet position in workbook (0-based)',
    },
    sheetId: {
      type: 'string',
      optional: true,
      description: 'Internal sheet identifier',
    },

    // Dimensions
    rowCount: {
      type: 'number',
      description: 'Number of rows',
    },
    columnCount: {
      type: 'number',
      description: 'Number of columns',
    },
    frozenRows: {
      type: 'number',
      optional: true,
      description: 'Number of frozen rows',
    },
    frozenColumns: {
      type: 'number',
      optional: true,
      description: 'Number of frozen columns',
    },

    // Visibility
    hidden: {
      type: 'boolean',
      optional: true,
      description: 'Whether sheet is hidden',
    },
    veryHidden: {
      type: 'boolean',
      optional: true,
      description: 'Whether sheet is very hidden (Excel)',
    },

    // Color and styling
    tabColor: {
      type: 'string',
      optional: true,
      description: 'Sheet tab color (hex)',
    },
    gridLinesVisible: {
      type: 'boolean',
      optional: true,
      description: 'Whether grid lines are visible',
    },
    gridLinesColor: {
      type: 'string',
      optional: true,
      description: 'Grid line color',
    },

    // Protection
    protected: {
      type: 'boolean',
      optional: true,
      description: 'Whether sheet is protected',
    },
    protectedRanges: {
      type: 'json',
      optional: true,
      description: 'Protected cell ranges',
    },

    // Data
    data: {
      type: 'json',
      optional: true,
      description: 'Sheet data as 2D array or object',
    },
    hasHeaders: {
      type: 'boolean',
      optional: true,
      description: 'Whether first row contains headers',
    },
    dataRange: {
      type: 'string',
      optional: true,
      description: 'Range containing data (e.g., A1:Z100)',
    },

    // Filters and sorts
    hasFilters: {
      type: 'boolean',
      optional: true,
      description: 'Whether filters are applied',
    },
    filterRange: {
      type: 'string',
      optional: true,
      description: 'Range with filters applied',
    },
    sortSpecs: {
      type: 'json',
      optional: true,
      description: 'Active sort specifications',
    },

    // Named ranges
    namedRanges: {
      type: 'json',
      optional: true,
      description: 'Named ranges in this sheet',
    },

    // Conditional formatting
    conditionalFormats: {
      type: 'json',
      optional: true,
      description: 'Conditional formatting rules',
    },

    // Data validation
    dataValidations: {
      type: 'json',
      optional: true,
      description: 'Data validation rules by range',
    },

    // Metadata
    notes: {
      type: 'string',
      optional: true,
      description: 'Sheet notes or description',
    },
    metadata: {
      type: 'json',
      optional: true,
      description: 'Custom metadata',
    },
  },

  relationships: {
    spreadsheet: {
      type: 'Spreadsheet',
      backref: 'sheets',
      description: 'Parent spreadsheet',
    },
    charts: {
      type: 'Chart[]',
      backref: 'sheet',
      description: 'Charts in this sheet',
    },
    pivotTables: {
      type: 'PivotTable[]',
      backref: 'sheet',
      description: 'Pivot tables in this sheet',
    },
  },

  actions: [
    'create',
    'rename',
    'delete',
    'duplicate',
    'move',
    'hide',
    'unhide',
    'protect',
    'unprotect',
    'clear',
    'clearFormats',
    'clearData',
    'insertRow',
    'insertRows',
    'deleteRow',
    'deleteRows',
    'insertColumn',
    'insertColumns',
    'deleteColumn',
    'deleteColumns',
    'freeze',
    'unfreeze',
    'sort',
    'filter',
    'clearFilter',
    'autoResize',
    'setTabColor',
    'addChart',
    'addPivotTable',
    'addConditionalFormat',
    'addDataValidation',
    'addNamedRange',
    'merge',
    'unmerge',
    'format',
    'copyFormat',
    'pasteFormat',
  ],

  events: [
    'created',
    'renamed',
    'deleted',
    'duplicated',
    'moved',
    'hidden',
    'unhidden',
    'protected',
    'unprotected',
    'cleared',
    'rowInserted',
    'rowDeleted',
    'columnInserted',
    'columnDeleted',
    'frozen',
    'unfrozen',
    'sorted',
    'filtered',
    'filterCleared',
    'chartAdded',
    'pivotTableAdded',
    'conditionalFormatAdded',
    'dataValidationAdded',
    'namedRangeAdded',
    'cellsMerged',
    'cellsUnmerged',
    'formatted',
  ],
}

// =============================================================================
// Cell
// =============================================================================

/**
 * Cell entity
 *
 * Represents a single cell in a spreadsheet.
 */
export const Cell: Noun = {
  singular: 'cell',
  plural: 'cells',
  description: 'A single cell in a spreadsheet',

  properties: {
    // Location
    row: {
      type: 'number',
      description: 'Row index (0-based)',
    },
    column: {
      type: 'number',
      description: 'Column index (0-based)',
    },
    address: {
      type: 'string',
      optional: true,
      description: 'Cell address (e.g., A1, B2)',
    },

    // Value
    value: {
      type: 'string',
      optional: true,
      description: 'Display value',
    },
    rawValue: {
      type: 'string',
      optional: true,
      description: 'Raw value before formatting',
    },
    dataType: {
      type: 'string',
      optional: true,
      description: 'Data type: string, number, boolean, date, formula, error',
      examples: ['string', 'number', 'boolean', 'date', 'formula', 'error', 'null'],
    },

    // Formula
    formula: {
      type: 'string',
      optional: true,
      description: 'Cell formula',
    },
    hasFormula: {
      type: 'boolean',
      optional: true,
      description: 'Whether cell contains a formula',
    },

    // Formatting
    format: {
      type: 'json',
      optional: true,
      description: 'Cell format configuration',
    },
    numberFormat: {
      type: 'string',
      optional: true,
      description: 'Number format string',
    },
    fontFamily: {
      type: 'string',
      optional: true,
      description: 'Font family',
    },
    fontSize: {
      type: 'number',
      optional: true,
      description: 'Font size in points',
    },
    fontWeight: {
      type: 'string',
      optional: true,
      description: 'Font weight: normal, bold',
      examples: ['normal', 'bold'],
    },
    fontStyle: {
      type: 'string',
      optional: true,
      description: 'Font style: normal, italic',
      examples: ['normal', 'italic'],
    },
    textColor: {
      type: 'string',
      optional: true,
      description: 'Text color (hex)',
    },
    backgroundColor: {
      type: 'string',
      optional: true,
      description: 'Background color (hex)',
    },
    horizontalAlignment: {
      type: 'string',
      optional: true,
      description: 'Horizontal alignment: left, center, right',
      examples: ['left', 'center', 'right'],
    },
    verticalAlignment: {
      type: 'string',
      optional: true,
      description: 'Vertical alignment: top, middle, bottom',
      examples: ['top', 'middle', 'bottom'],
    },
    wrapText: {
      type: 'boolean',
      optional: true,
      description: 'Whether text wraps',
    },

    // Borders
    borders: {
      type: 'json',
      optional: true,
      description: 'Border configuration',
    },

    // Validation
    dataValidation: {
      type: 'json',
      optional: true,
      description: 'Data validation rules',
    },
    isValid: {
      type: 'boolean',
      optional: true,
      description: 'Whether value passes validation',
    },

    // Merge
    isMerged: {
      type: 'boolean',
      optional: true,
      description: 'Whether cell is part of merged range',
    },
    mergeRange: {
      type: 'string',
      optional: true,
      description: 'Merged cell range',
    },

    // Notes and comments
    note: {
      type: 'string',
      optional: true,
      description: 'Cell note',
    },
    hasComment: {
      type: 'boolean',
      optional: true,
      description: 'Whether cell has a comment',
    },

    // Links
    hyperlink: {
      type: 'url',
      optional: true,
      description: 'Hyperlink URL',
    },

    // Protection
    locked: {
      type: 'boolean',
      optional: true,
      description: 'Whether cell is locked',
    },
  },

  relationships: {
    sheet: {
      type: 'Sheet',
      description: 'Parent sheet',
    },
  },

  actions: [
    'setValue',
    'setFormula',
    'clear',
    'clearFormat',
    'format',
    'merge',
    'unmerge',
    'lock',
    'unlock',
    'addNote',
    'removeNote',
    'addComment',
    'addHyperlink',
    'removeHyperlink',
    'copy',
    'cut',
    'paste',
    'validate',
  ],

  events: [
    'valueChanged',
    'formulaSet',
    'cleared',
    'formatted',
    'merged',
    'unmerged',
    'locked',
    'unlocked',
    'noteAdded',
    'noteRemoved',
    'commentAdded',
    'hyperlinkAdded',
    'hyperlinkRemoved',
    'copied',
    'pasted',
  ],
}

// =============================================================================
// Range
// =============================================================================

/**
 * Range entity
 *
 * Represents a range of cells in a spreadsheet.
 */
export const Range: Noun = {
  singular: 'range',
  plural: 'ranges',
  description: 'A range of cells in a spreadsheet',

  properties: {
    // Location
    startRow: {
      type: 'number',
      description: 'Starting row index (0-based)',
    },
    startColumn: {
      type: 'number',
      description: 'Starting column index (0-based)',
    },
    endRow: {
      type: 'number',
      description: 'Ending row index (0-based)',
    },
    endColumn: {
      type: 'number',
      description: 'Ending column index (0-based)',
    },
    address: {
      type: 'string',
      optional: true,
      description: 'Range address (e.g., A1:B10)',
    },

    // Dimensions
    rowCount: {
      type: 'number',
      optional: true,
      description: 'Number of rows in range',
    },
    columnCount: {
      type: 'number',
      optional: true,
      description: 'Number of columns in range',
    },
    cellCount: {
      type: 'number',
      optional: true,
      description: 'Total number of cells',
    },

    // Data
    values: {
      type: 'json',
      optional: true,
      description: 'Cell values as 2D array',
    },
    formulas: {
      type: 'json',
      optional: true,
      description: 'Cell formulas as 2D array',
    },

    // Named range
    name: {
      type: 'string',
      optional: true,
      description: 'Named range identifier',
    },
    isNamed: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is a named range',
    },

    // Format
    format: {
      type: 'json',
      optional: true,
      description: 'Range format configuration',
    },

    // Protection
    protected: {
      type: 'boolean',
      optional: true,
      description: 'Whether range is protected',
    },
  },

  relationships: {
    sheet: {
      type: 'Sheet',
      description: 'Parent sheet',
    },
  },

  actions: [
    'select',
    'setValue',
    'setValues',
    'setFormula',
    'setFormulas',
    'clear',
    'clearFormat',
    'clearData',
    'format',
    'copy',
    'cut',
    'paste',
    'merge',
    'unmerge',
    'sort',
    'filter',
    'protect',
    'unprotect',
    'autoFill',
    'insertRows',
    'insertColumns',
    'deleteRows',
    'deleteColumns',
    'name',
    'unname',
  ],

  events: [
    'selected',
    'valuesChanged',
    'formulasSet',
    'cleared',
    'formatted',
    'copied',
    'pasted',
    'merged',
    'unmerged',
    'sorted',
    'filtered',
    'protected',
    'unprotected',
    'autoFilled',
    'rowsInserted',
    'columnsInserted',
    'rowsDeleted',
    'columnsDeleted',
    'named',
    'unnamed',
  ],
}

// =============================================================================
// Chart
// =============================================================================

/**
 * Chart entity
 *
 * Represents a chart or graph in a spreadsheet.
 */
export const Chart: Noun = {
  singular: 'chart',
  plural: 'charts',
  description: 'A chart or graph visualizing spreadsheet data',

  properties: {
    // Identity
    title: {
      type: 'string',
      description: 'Chart title',
    },
    subtitle: {
      type: 'string',
      optional: true,
      description: 'Chart subtitle',
    },

    // Type
    type: {
      type: 'string',
      description: 'Chart type',
      examples: [
        'line',
        'bar',
        'column',
        'pie',
        'scatter',
        'area',
        'combo',
        'histogram',
        'waterfall',
        'candlestick',
        'treemap',
        'gauge',
        'radar',
      ],
    },
    subtype: {
      type: 'string',
      optional: true,
      description: 'Chart subtype variant',
    },

    // Data source
    dataRange: {
      type: 'string',
      description: 'Source data range',
    },
    hasHeaders: {
      type: 'boolean',
      optional: true,
      description: 'Whether data includes headers',
    },
    series: {
      type: 'json',
      optional: true,
      description: 'Data series configuration',
    },

    // Position and size
    position: {
      type: 'json',
      optional: true,
      description: 'Chart position on sheet',
    },
    width: {
      type: 'number',
      optional: true,
      description: 'Chart width in pixels',
    },
    height: {
      type: 'number',
      optional: true,
      description: 'Chart height in pixels',
    },

    // Axes
    xAxis: {
      type: 'json',
      optional: true,
      description: 'X-axis configuration',
    },
    yAxis: {
      type: 'json',
      optional: true,
      description: 'Y-axis configuration',
    },
    secondaryAxis: {
      type: 'json',
      optional: true,
      description: 'Secondary axis configuration',
    },

    // Legend
    showLegend: {
      type: 'boolean',
      optional: true,
      description: 'Whether to show legend',
    },
    legendPosition: {
      type: 'string',
      optional: true,
      description: 'Legend position: top, bottom, left, right',
      examples: ['top', 'bottom', 'left', 'right'],
    },

    // Styling
    theme: {
      type: 'string',
      optional: true,
      description: 'Chart theme',
    },
    colors: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Custom colors for series',
    },
    backgroundColor: {
      type: 'string',
      optional: true,
      description: 'Background color',
    },

    // Options
    showDataLabels: {
      type: 'boolean',
      optional: true,
      description: 'Whether to show data labels',
    },
    showGridLines: {
      type: 'boolean',
      optional: true,
      description: 'Whether to show grid lines',
    },
    stacked: {
      type: 'boolean',
      optional: true,
      description: 'Whether chart is stacked',
    },
    smooth: {
      type: 'boolean',
      optional: true,
      description: 'Whether to smooth line charts',
    },

    // Interaction
    interactive: {
      type: 'boolean',
      optional: true,
      description: 'Whether chart is interactive',
    },
    allowFiltering: {
      type: 'boolean',
      optional: true,
      description: 'Whether filtering is allowed',
    },

    // Metadata
    description: {
      type: 'string',
      optional: true,
      description: 'Chart description',
    },
  },

  relationships: {
    spreadsheet: {
      type: 'Spreadsheet',
      backref: 'charts',
      description: 'Parent spreadsheet',
    },
    sheet: {
      type: 'Sheet',
      backref: 'charts',
      description: 'Sheet containing the chart',
    },
  },

  actions: [
    'create',
    'edit',
    'delete',
    'duplicate',
    'move',
    'resize',
    'refresh',
    'changeType',
    'updateData',
    'export',
    'copyImage',
    'setTitle',
    'setTheme',
    'showLegend',
    'hideLegend',
    'addSeries',
    'removeSeries',
  ],

  events: [
    'created',
    'edited',
    'deleted',
    'duplicated',
    'moved',
    'resized',
    'refreshed',
    'typeChanged',
    'dataUpdated',
    'exported',
    'titleSet',
    'themeSet',
    'seriesAdded',
    'seriesRemoved',
  ],
}

// =============================================================================
// PivotTable
// =============================================================================

/**
 * PivotTable entity
 *
 * Represents a pivot table for data analysis and summarization.
 */
export const PivotTable: Noun = {
  singular: 'pivot table',
  plural: 'pivot tables',
  description: 'A pivot table for analyzing and summarizing data',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Pivot table name',
    },

    // Source
    sourceRange: {
      type: 'string',
      description: 'Source data range',
    },
    targetRange: {
      type: 'string',
      optional: true,
      description: 'Target range for pivot table output',
    },

    // Configuration
    rows: {
      type: 'json',
      description: 'Row field configuration',
    },
    columns: {
      type: 'json',
      optional: true,
      description: 'Column field configuration',
    },
    values: {
      type: 'json',
      description: 'Value field configuration with aggregations',
    },
    filters: {
      type: 'json',
      optional: true,
      description: 'Filter field configuration',
    },

    // Aggregation
    aggregationFunctions: {
      type: 'json',
      optional: true,
      description: 'Aggregation functions by field',
    },

    // Sorting
    sortBy: {
      type: 'string',
      optional: true,
      description: 'Field to sort by',
    },
    sortOrder: {
      type: 'string',
      optional: true,
      description: 'Sort order: asc, desc',
      examples: ['asc', 'desc'],
    },

    // Filtering
    activeFilters: {
      type: 'json',
      optional: true,
      description: 'Active filter values',
    },

    // Display
    showGrandTotals: {
      type: 'boolean',
      optional: true,
      description: 'Whether to show grand totals',
    },
    showSubtotals: {
      type: 'boolean',
      optional: true,
      description: 'Whether to show subtotals',
    },
    compactLayout: {
      type: 'boolean',
      optional: true,
      description: 'Whether to use compact layout',
    },

    // Refresh
    autoRefresh: {
      type: 'boolean',
      optional: true,
      description: 'Whether to auto-refresh on data change',
    },
    lastRefreshedAt: {
      type: 'datetime',
      optional: true,
      description: 'Last refresh timestamp',
    },

    // Calculated fields
    calculatedFields: {
      type: 'json',
      optional: true,
      description: 'Custom calculated field definitions',
    },
  },

  relationships: {
    spreadsheet: {
      type: 'Spreadsheet',
      backref: 'pivotTables',
      description: 'Parent spreadsheet',
    },
    sheet: {
      type: 'Sheet',
      backref: 'pivotTables',
      description: 'Sheet containing the pivot table',
    },
  },

  actions: [
    'create',
    'edit',
    'delete',
    'refresh',
    'addField',
    'removeField',
    'moveField',
    'setAggregation',
    'filter',
    'clearFilter',
    'sort',
    'expand',
    'collapse',
    'expandAll',
    'collapseAll',
    'addCalculatedField',
    'removeCalculatedField',
    'showFieldList',
    'export',
  ],

  events: [
    'created',
    'edited',
    'deleted',
    'refreshed',
    'fieldAdded',
    'fieldRemoved',
    'fieldMoved',
    'aggregationSet',
    'filtered',
    'filterCleared',
    'sorted',
    'expanded',
    'collapsed',
    'calculatedFieldAdded',
    'calculatedFieldRemoved',
    'exported',
  ],
}

// =============================================================================
// Export all entities as a schema
// =============================================================================

/**
 * All spreadsheet entity types
 */
export const SpreadsheetEntities = {
  Spreadsheet,
  Sheet,
  Cell,
  Range,
  Chart,
  PivotTable,
}

/**
 * Entity categories for organization
 */
export const SpreadsheetCategories = {
  spreadsheets: ['Spreadsheet', 'Sheet', 'Cell', 'Range', 'Chart', 'PivotTable'],
} as const
