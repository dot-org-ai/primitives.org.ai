/**
 * ai4 - AI primitives for autonomous agents and humans in the loop
 *
 * @example
 * ```ts
 * import { Agents, Humans } from 'ai4'
 *
 * // Create an autonomous agent
 * const agent = Agents.Agent({
 *   name: 'ProductAgent',
 *   mode: 'autonomous',
 * })
 *
 * // Create a human-in-the-loop manager
 * const human = Humans.Human({
 *   defaultTimeout: 3600000,
 * })
 *
 * // Request approval from human
 * const approval = await Humans.approve({
 *   title: 'Deploy to production',
 *   assignee: 'tech-lead@example.com',
 * })
 * ```
 */

import * as Agents from 'autonomous-agents'
import * as Humans from 'human-in-the-loop'

export { Agents, Humans }
