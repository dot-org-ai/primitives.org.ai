/**
 * Spreadsheet Providers
 *
 * @packageDocumentation
 */

export { xlsxInfo, xlsxProvider, createXlsxProvider } from './xlsx.js'
export { googleSheetsInfo, googleSheetsProvider, createGoogleSheetsProvider } from './google-sheets.js'

import { xlsxProvider } from './xlsx.js'
import { googleSheetsProvider } from './google-sheets.js'

/**
 * Register all spreadsheet providers
 */
export function registerSpreadsheetProviders(): void {
  xlsxProvider.register()
  googleSheetsProvider.register()
}

/**
 * All spreadsheet providers
 */
export const spreadsheetProviders = [xlsxProvider, googleSheetsProvider]
