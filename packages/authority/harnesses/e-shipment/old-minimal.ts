// =====================================================================================
// OLD-MINIMAL (pre-factoring authority primitive) — the "before" for Correction E.
// Passed<D> has NO correlation brand; commitThroughSoftware is SYNCHRONOUS-ONLY and returns
// Commitment<R>. Command-time == outcome-time == one frame. The physical-shipment LIES that
// V2 makes type errors here all compile SILENTLY (EXIT 0, no guards).
// =====================================================================================
declare const PASS: unique symbol
declare const COMMIT: unique symbol
type Domain = 'dispatch' | 'delivery'
interface Passed<D extends Domain> { readonly [PASS]: D }        // no Corr, no principal, no time
interface Commitment<R> { readonly [COMMIT]: R }
interface Escalation { readonly escalatedTo: string }

interface WorkOrder { readonly id: string }
declare const field: { dispatch(wo: WorkOrder): void; ingestProof(wo: WorkOrder): { pod: boolean }; emit(n: string, d: object): void }

declare function gate<D extends Domain>(d: D): Passed<D>
// The ONLY commit shape: synchronous, asserts terminal success at the moment of call.
declare function commitThroughSoftware<D extends Domain, R>(pass: Passed<D>, effect: () => R): Commitment<R>

declare const wo: WorkOrder

// LIE #1 (E2/E4): dispatch command "committed" — the type CLAIMS the delivery outcome happened
// at command-release time. There is no Pending; the truck just rolled but this reads as done.
const dispatchDone: Commitment<void> = commitThroughSoftware(gate('dispatch'), () => field.dispatch(wo))

// LIE #2 (E1/E3): command-auth and outcome-auth are structurally UNRELATED. A completely
// unrelated delivery pass "closes" the dispatch — no correlation id ties them; nothing checks
// that the delivery whose outcome I verify is the dispatch I authorized.
const deliveryPass: Passed<'delivery'> = gate('delivery')
const deliveryDone: Commitment<void> = commitThroughSoftware(deliveryPass, () => field.emit('delivered', {}))

// LIE #3 (E1): even the WRONG shipment's delivery pass is accepted — Corr does not exist to reject it.
const someOtherShipmentPass: Passed<'delivery'> = gate('delivery')
const closedWithWrongShipment: Commitment<void> =
  commitThroughSoftware(someOtherShipmentPass, () => field.emit('delivered', { wo: 'a-DIFFERENT-wo' }))

void dispatchDone; void deliveryDone; void closedWithWrongShipment
