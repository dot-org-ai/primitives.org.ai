// =====================================================================================
// BEFORE — the pre-factoring authority primitive (V1-era Passed<D>, decide:boolean).
// The SAME Correction-G forges are restated here UNGUARDED. They all compile SILENTLY,
// EXIT 0 — establishing the before/after delta the two-sided proof needs.
// =====================================================================================
type Domain = 'money' | 'attestation'

// Pre-factoring: Passed carries ONLY competence D. No corr, no principal, no record, no
// serialized form, no re-mint. Authority is an ephemeral brand, not durable provenance.
declare const PASS: unique symbol
interface Passed<D extends Domain> { readonly [PASS]: D }

// Pre-factoring gate: decide takes a BARE BOOLEAN — the deciding seat is erased at the door.
interface Gate<D extends Domain> {
  decide(approved: boolean): Passed<D> | null
}
declare function gate<D extends Domain>(domain: D): Gate<D>

interface Stack { emit(name: string, data: Record<string, unknown>): void }
declare const stack: Stack
declare function commit<D extends Domain, R>(pass: Passed<D>, effect: () => R): R

const soc2 = gate('attestation')

// (before-G1) decide(boolean): the seat is never recorded — compiles fine.
const pass = soc2.decide(true)

// (before-G) there is no durable form at all, so "parking" is just holding the ephemeral
// brand across the boundary. If you serialize it yourself and re-hydrate, NOTHING re-verifies:
interface Wire { readonly domain: Domain }              // a hand-rolled "serialized" blob
declare const wire: Wire

// (before-G2/G3) forge a live Passed from an inert blob — a single `as` cast is accepted,
// because with no [PASS]-branded token family the shapes are close enough / erasable.
const forgedFromWire = wire as unknown as Passed<'attestation'>   // silent
const forgedDirect = { [PASS]: 'attestation' } as Passed<'attestation'>  // literal forge, silent

// (before-G5) feed the forged token straight into a commit — no re-mint, no re-verify.
if (forgedFromWire) commit(forgedFromWire, () => stack.emit('attested', {}))
commit(forgedDirect, () => stack.emit('attested', {}))
if (pass) commit(pass, () => stack.emit('ok', {}))
