// Positive consumer for the Correction-D good path — the honest brand-delivery flow must be
// usable end-to-end (Commitment<void> | Escalation), narrowable, with no laundering.
import { runBrandDelivery, acceptOnConsumption } from './corrected'
const r = runBrandDelivery()   // Commitment<void> | Escalation
const c = acceptOnConsumption()
if (r.kind === 'committed') { void r }
void c
