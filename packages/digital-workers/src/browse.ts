/**
 * Browser automation functionality for digital workers
 *
 * IMPORTANT: Worker Routing vs Direct Browser Calls
 * -------------------------------------------------
 * This module provides worker-routed browser automation, enabling AI-assisted
 * browser control with human fallback capabilities.
 *
 * - `digital-workers.browse()` - Routes browser automation tasks to Workers
 *   (AI Agents or Humans) based on capability matching and complexity.
 *
 * Use digital-workers.browse when you need:
 * - AI-planned browser automation
 * - Human-in-the-loop for complex interactions
 * - Capability-based worker selection
 * - Screenshot and data extraction with fallback
 *
 * @module
 */

import { define } from 'ai-functions'

// ============================================================================
// Types
// ============================================================================

/**
 * Viewport dimensions for browser automation
 */
export interface Viewport {
  width: number
  height: number
}

/**
 * Options for browser automation
 */
export interface BrowseOptions {
  /** URL to navigate to */
  url: string
  /** Task or goal to accomplish in the browser */
  task: string
  /** Maximum time to wait for task completion (ms) */
  timeout?: number
  /** Run browser in headless mode */
  headless?: boolean
  /** Browser viewport dimensions */
  viewport?: Viewport
  /** Additional context for the task */
  context?: Record<string, unknown>
  /** Wait for specific selector before starting */
  waitFor?: string
  /** Cookies to set before navigation */
  cookies?: Array<{ name: string; value: string; domain?: string }>
  /** User agent string */
  userAgent?: string
  /** Enable human fallback for complex interactions */
  humanFallback?: boolean
  /** Worker to route to (defaults to automatic selection) */
  worker?: string
}

/**
 * Browser action types
 */
export type BrowseActionType =
  | 'navigate'
  | 'click'
  | 'type'
  | 'scroll'
  | 'wait'
  | 'screenshot'
  | 'extract'

/**
 * Individual browser action record
 */
export interface BrowseAction {
  /** Type of action performed */
  type: BrowseActionType
  /** Target selector or URL */
  target?: string
  /** Value used in the action (text typed, scroll amount, etc.) */
  value?: string
  /** Timestamp when action was performed */
  timestamp?: Date
  /** Whether action succeeded */
  success?: boolean
  /** Error message if action failed */
  error?: string
}

/**
 * Result of browser automation
 */
export interface BrowseResult {
  /** Whether the overall task succeeded */
  success: boolean
  /** Extracted data or task result */
  data?: unknown
  /** Screenshot as base64 string (if requested) */
  screenshot?: string
  /** List of actions performed */
  actions: BrowseAction[]
  /** Error message if task failed */
  error?: string
  /** Duration of task execution (ms) */
  duration?: number
  /** Final URL after navigation */
  finalUrl?: string
  /** Page title */
  title?: string
  /** Worker that executed the task */
  executedBy?: string
}

/**
 * Options for click action
 */
export interface ClickOptions {
  /** Wait for navigation after click */
  waitForNavigation?: boolean
  /** Click position offset from element center */
  offset?: { x: number; y: number }
  /** Number of clicks */
  clickCount?: number
  /** Mouse button */
  button?: 'left' | 'right' | 'middle'
}

/**
 * Options for type action
 */
export interface TypeOptions {
  /** Clear existing text before typing */
  clear?: boolean
  /** Delay between keystrokes (ms) */
  delay?: number
  /** Press Enter after typing */
  pressEnter?: boolean
}

/**
 * Options for scroll action
 */
export interface ScrollOptions {
  /** Scroll direction */
  direction: 'up' | 'down' | 'left' | 'right'
  /** Amount to scroll in pixels */
  amount?: number
  /** Scroll to specific element */
  toElement?: string
  /** Scroll smoothly */
  smooth?: boolean
}

/**
 * Options for screenshot action
 */
export interface ScreenshotOptions {
  /** Capture full page or viewport only */
  fullPage?: boolean
  /** Specific element to capture */
  selector?: string
  /** Image format */
  format?: 'png' | 'jpeg' | 'webp'
  /** Image quality (0-100) for jpeg/webp */
  quality?: number
}

/**
 * Options for extract action
 */
export interface ExtractOptions {
  /** Schema describing the data to extract */
  schema?: Record<string, unknown>
  /** CSS selector to scope extraction */
  selector?: string
  /** Extract multiple items */
  multiple?: boolean
  /** Include raw HTML */
  includeHtml?: boolean
}

// ============================================================================
// Main Browse Function
// ============================================================================

/**
 * Execute browser automation by routing to an appropriate Worker (AI Agent or Human).
 *
 * This function uses AI to plan and execute browser actions to accomplish
 * a given task. It supports human fallback for complex interactions that
 * require human judgment.
 *
 * @param url - URL to navigate to
 * @param task - Description of the task to accomplish
 * @param options - Additional options for browser automation
 * @returns Promise resolving to browse result with execution details
 *
 * @example
 * ```ts
 * // Simple navigation and extraction
 * const result = await browse('https://example.com', 'Find the contact email')
 *
 * if (result.success) {
 *   console.log('Email:', result.data)
 * }
 * ```
 *
 * @example
 * ```ts
 * // Form submission
 * const result = await browse('https://example.com/login', 'Log in with test credentials', {
 *   context: {
 *     username: 'testuser',
 *     password: 'testpass123',
 *   },
 *   timeout: 30000,
 * })
 * ```
 *
 * @example
 * ```ts
 * // Complex interaction with human fallback
 * const result = await browse('https://example.com/checkout', 'Complete the purchase', {
 *   humanFallback: true,
 *   timeout: 60000,
 * })
 * ```
 */
export async function browse(
  url: string,
  task: string,
  options: Partial<BrowseOptions> = {}
): Promise<BrowseResult> {
  const {
    timeout = 30000,
    headless = true,
    viewport = { width: 1280, height: 720 },
    context,
    waitFor,
    humanFallback = false,
  } = options

  const startTime = Date.now()
  const actions: BrowseAction[] = []

  // Record initial navigation
  actions.push({
    type: 'navigate',
    target: url,
    timestamp: new Date(),
    success: true,
  })

  // Use agentic function for browser automation planning
  const browserFn = define.agentic({
    name: 'browserAutomation',
    description: 'Plan and execute browser actions to accomplish a task',
    args: {
      url: 'The URL to navigate to',
      task: 'The task to accomplish',
      contextInfo: 'Additional context and parameters',
      viewportSize: 'Browser viewport dimensions',
    },
    returnType: {
      success: 'Whether the task was completed successfully',
      data: 'Extracted data or task result',
      actions: ['List of browser actions taken'],
      finalUrl: 'The final URL after all actions',
      title: 'The page title',
      error: 'Error message if task failed',
    },
    instructions: `You are a browser automation agent. Plan and execute browser actions to accomplish the task.

URL: ${url}
Task: ${task}
Viewport: ${viewport.width}x${viewport.height}
${context ? `Context: ${JSON.stringify(context, null, 2)}` : ''}
${waitFor ? `Wait for selector: ${waitFor}` : ''}

Available actions:
- navigate(url): Go to a URL
- click(selector): Click an element
- type(selector, text): Type text into an input
- scroll(direction, amount): Scroll the page
- wait(ms): Wait for a duration
- waitForSelector(selector): Wait for element to appear
- screenshot(): Take a screenshot
- extract(schema): Extract data from the page

Plan your actions step by step to accomplish the task efficiently.`,
    maxIterations: 10,
    tools: [], // Browser tools would be provided by the execution environment
  })

  try {
    const response = (await Promise.race([
      browserFn.call({
        url,
        task,
        contextInfo: context ? JSON.stringify(context) : '',
        viewportSize: `${viewport.width}x${viewport.height}`,
      }),
      timeout
        ? new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Browser automation timeout')), timeout)
          )
        : new Promise(() => {}),
    ])) as {
      success: boolean
      data?: unknown
      actions?: Array<{ type: string; target?: string; value?: string }>
      finalUrl?: string
      title?: string
      error?: string
    }

    // Record actions from response
    if (response.actions) {
      actions.push(
        ...response.actions.map((action) => {
          const browseAction: BrowseAction = {
            type: action.type as BrowseActionType,
            timestamp: new Date(),
            success: true,
          }
          if (action.target !== undefined) {
            browseAction.target = action.target
          }
          if (action.value !== undefined) {
            browseAction.value = action.value
          }
          return browseAction
        })
      )
    }

    const duration = Date.now() - startTime

    const result: BrowseResult = {
      success: response.success,
      actions,
      duration,
      finalUrl: response.finalUrl || url,
    }
    if (response.data !== undefined) {
      result.data = response.data
    }
    if (response.error !== undefined) {
      result.error = response.error
    }
    if (response.title !== undefined) {
      result.title = response.title
    }
    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // If human fallback is enabled and AI fails, route to human
    if (humanFallback) {
      return {
        success: false,
        actions,
        error: `AI automation failed, human fallback requested: ${errorMessage}`,
        duration: Date.now() - startTime,
        executedBy: 'pending-human-fallback',
      }
    }

    return {
      success: false,
      actions,
      error: errorMessage,
      duration: Date.now() - startTime,
    }
  }
}

// ============================================================================
// Helper Methods
// ============================================================================

/**
 * Click an element on a page
 *
 * @param url - URL of the page
 * @param selector - CSS selector of the element to click
 * @param options - Click options
 * @returns Promise resolving to browse result
 *
 * @example
 * ```ts
 * const result = await browse.click('https://example.com', '#submit-button')
 * ```
 */
browse.click = async (
  url: string,
  selector: string,
  options: ClickOptions = {}
): Promise<BrowseResult> => {
  const { waitForNavigation = false, clickCount = 1 } = options

  return browse(url, `Click the element matching selector "${selector}"`, {
    context: {
      action: 'click',
      selector,
      waitForNavigation,
      clickCount,
    },
  })
}

/**
 * Type text into an input element
 *
 * @param url - URL of the page
 * @param selector - CSS selector of the input element
 * @param text - Text to type
 * @param options - Type options
 * @returns Promise resolving to browse result
 *
 * @example
 * ```ts
 * const result = await browse.type('https://example.com', '#search-input', 'hello world')
 * ```
 */
browse.type = async (
  url: string,
  selector: string,
  text: string,
  options: TypeOptions = {}
): Promise<BrowseResult> => {
  const { clear = false, delay = 0, pressEnter = false } = options

  return browse(url, `Type "${text}" into the element matching selector "${selector}"`, {
    context: {
      action: 'type',
      selector,
      text,
      clear,
      delay,
      pressEnter,
    },
  })
}

/**
 * Scroll the page
 *
 * @param url - URL of the page
 * @param direction - Scroll direction
 * @param amount - Amount to scroll in pixels (default: 500)
 * @param options - Additional scroll options
 * @returns Promise resolving to browse result
 *
 * @example
 * ```ts
 * const result = await browse.scroll('https://example.com', 'down', 500)
 * ```
 */
browse.scroll = async (
  url: string,
  direction: 'up' | 'down' | 'left' | 'right',
  amount: number = 500,
  options: Partial<ScrollOptions> = {}
): Promise<BrowseResult> => {
  const { toElement, smooth = true } = options

  return browse(url, `Scroll ${direction} by ${amount} pixels`, {
    context: {
      action: 'scroll',
      direction,
      amount,
      toElement,
      smooth,
    },
  })
}

/**
 * Take a screenshot of the page
 *
 * @param url - URL of the page
 * @param options - Screenshot options
 * @returns Promise resolving to browse result with screenshot
 *
 * @example
 * ```ts
 * const result = await browse.screenshot('https://example.com')
 * if (result.screenshot) {
 *   // Save or process the base64 screenshot
 * }
 * ```
 */
browse.screenshot = async (url: string, options: ScreenshotOptions = {}): Promise<BrowseResult> => {
  const { fullPage = false, selector, format = 'png', quality } = options

  return browse(url, 'Take a screenshot of the page', {
    context: {
      action: 'screenshot',
      fullPage,
      selector,
      format,
      quality,
    },
  })
}

/**
 * Extract structured data from a page
 *
 * @param url - URL of the page
 * @param schema - Schema describing the data to extract
 * @param options - Extract options
 * @returns Promise resolving to browse result with extracted data
 *
 * @example
 * ```ts
 * const result = await browse.extract('https://example.com/products', {
 *   products: [{
 *     name: 'Product name',
 *     price: 'Product price as number',
 *     description: 'Product description',
 *   }],
 * })
 *
 * if (result.success) {
 *   console.log('Products:', result.data)
 * }
 * ```
 */
browse.extract = async (
  url: string,
  schema: Record<string, unknown>,
  options: ExtractOptions = {}
): Promise<BrowseResult> => {
  const { selector, multiple = false, includeHtml = false } = options

  return browse(url, 'Extract structured data from the page according to the schema', {
    context: {
      action: 'extract',
      schema,
      selector,
      multiple,
      includeHtml,
    },
  })
}

/**
 * Wait for an element to appear on the page
 *
 * @param url - URL of the page
 * @param selector - CSS selector to wait for
 * @param timeout - Maximum time to wait (ms)
 * @returns Promise resolving to browse result
 *
 * @example
 * ```ts
 * const result = await browse.waitFor('https://example.com', '.loaded-content', 5000)
 * ```
 */
browse.waitFor = async (
  url: string,
  selector: string,
  timeout: number = 30000
): Promise<BrowseResult> => {
  return browse(url, `Wait for element matching selector "${selector}" to appear`, {
    waitFor: selector,
    timeout,
  })
}

/**
 * Fill out a form with multiple fields
 *
 * @param url - URL of the page with the form
 * @param formData - Object mapping selectors to values
 * @param submitSelector - Optional selector for the submit button
 * @returns Promise resolving to browse result
 *
 * @example
 * ```ts
 * const result = await browse.fill('https://example.com/contact', {
 *   '#name': 'John Doe',
 *   '#email': 'john@example.com',
 *   '#message': 'Hello!',
 * }, '#submit')
 * ```
 */
browse.fill = async (
  url: string,
  formData: Record<string, string>,
  submitSelector?: string
): Promise<BrowseResult> => {
  return browse(url, 'Fill out the form with the provided data and submit if requested', {
    context: {
      action: 'fill',
      formData,
      submitSelector,
    },
  })
}

/**
 * Navigate through multiple pages
 *
 * @param urls - Array of URLs to visit
 * @param taskPerPage - Task to perform on each page
 * @returns Promise resolving to array of browse results
 *
 * @example
 * ```ts
 * const results = await browse.crawl(
 *   ['https://example.com/page1', 'https://example.com/page2'],
 *   'Extract the page title'
 * )
 * ```
 */
browse.crawl = async (urls: string[], taskPerPage: string): Promise<BrowseResult[]> => {
  return Promise.all(urls.map((url) => browse(url, taskPerPage)))
}

// Export as default as well
export default browse
