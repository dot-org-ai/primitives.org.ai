declare const TEN: unique symbol
interface Principal<Id extends string = string> { readonly [TEN]: Id }
type Domain = 'attestation'
declare const PASS: unique symbol
interface Passed<D extends Domain, Corr extends string, Prin extends Principal> { readonly [PASS]: D; readonly corr: Corr; readonly principal: Prin }
interface DecisionRecord<D extends Domain, Prin extends Principal> { readonly seat: string; readonly domain: D; readonly principal: Prin; readonly credentialProof: string; readonly at: number; readonly approved: boolean }
interface SerializedPassed<D extends Domain, Corr extends string, Prin extends Principal> { readonly wire: 'passed'; readonly domain: D; readonly corr: Corr; readonly principal: Prin; readonly record: DecisionRecord<D, Prin> }
declare const parkedA: SerializedPassed<'attestation', 'soc2-2026', Principal<'A'>>
// the universal TS escape hatch — no type system forbids it:
const forged = parkedA as unknown as Passed<'attestation', 'soc2-2026', Principal<'A'>>
