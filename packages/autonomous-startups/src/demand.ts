// =====================================================================================
// The demand register — a composable SLOT (type-level placeholder).
//
// Amendment 3 of ADR 0001 asks for "demand as a composable register". The five canonical
// primitives model SUPPLY — what the startup is, sells, wields, and who performs the work.
// Demand is the missing counterpart: the problems it addresses and the markets it serves.
// The constitution's standing question promotes `problems.org.ai` as the G2 demand
// register; this slot is where that register binds into the capstone.
//
// This is a TYPE-LEVEL PLACEHOLDER ONLY. There is no implementation: the shapes below are
// markers so a profile can declare the slot and a construct can carry it, without pinning a
// contract that would entrench pre-1.0 (ADR 0001 fixation gate). The concrete Problem /
// Market shapes arrive when `problems.org.ai` and a markets register are ratified.
// =====================================================================================

/**
 * A problem the startup addresses. PLACEHOLDER — the concrete shape binds to
 * `problems.org.ai` once that demand register is ratified. Not yet modeled.
 */
export type Problem = unknown

/**
 * A market the startup serves. PLACEHOLDER — the concrete shape binds to a markets
 * register once ratified. Not yet modeled.
 */
export type Market = unknown

/**
 * The demand register: the composable counterpart to the five supply primitives.
 * Both slots are optional placeholders; nothing here is entrenched (ADR 0001 fixation
 * gate). Present so `compose` can bind demand and `validateStartup` can see it, with no
 * implementation behind it yet.
 */
export interface DemandRegister {
  /** Problems this startup addresses (problems.org.ai — placeholder). */
  readonly problems?: readonly Problem[]
  /** Markets this startup serves (markets register — placeholder). */
  readonly markets?: readonly Market[]
}
