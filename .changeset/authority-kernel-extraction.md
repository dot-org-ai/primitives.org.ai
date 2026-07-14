---
'@org.ai/authority': minor
---

@org.ai/authority: initial extraction of the five-axis authority kernel (ADR 0082 §B)

New zero-dependency, types-only package: the frozen ADR-0081 authority interface
(Register/Judgment/Authority factoring; `Passed` un-fused along competence x
correlation x principal x time x outcome-linkage), extracted semantically verbatim
from the atlas incubation reference (`app/_lib/sas/authority.ts` in
explore.startups.studio). The conformance suite travels with it: the seven
two-sided harness pairs under `harnesses/` plus the FC2 config canary
(`pnpm --filter @org.ai/authority canary`) and the NoInfer mutation self-test
(`canary:mutation`). Not yet published; the atlas CI canary stays authoritative
until this package is ratified (ADR 0082 §F).
