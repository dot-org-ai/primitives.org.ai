---
'business-as-code': minor
---

feat(business-as-code): canonical Offer noun + value-capture ladder (aip-cnks.7.1)

Adds the canonical schema.org **Offer** as a first-class noun, factoring pricing
out of the bare Product/Service capabilities and onto the thing that is actually
*sold*.

- New `src/offer.ts` value/type module exporting:
  - the `Offer` type + `Offer(spec)` plain-object validate-and-normalize factory
    (matching the `Business()` / `Product()` / `Goals()` idiom), with
    `itemOffered → Service | Product`, `gatingBasis`/`secondaryBasis`,
    `priceSpecification`, `fundingSource`, `promise`/`seller`, defaulting
    `gatingBasis` to `access`, `fundingSource` to `{ source: 'direct' }`, and
    deriving `$id` from `itemOffered` when omitted.
  - the value-capture ladder `PricingBasis = 'access' | 'effort' | 'usage' |
    'output' | 'outcome'` (closed union) + the ordered `PRICING_BASES` const
    array + `isPricingBasis` guard.
  - a `PriceSpecification` discriminated union
    (`SinglePrice | Tiered | UsageMeter | SuccessFee | Gainshare | CustomQuote`)
    that **composes** the `business-as-code/finance` `Pricing` building blocks
    (`Money`, `MeteredEntry`, `PercentOfBasis`) rather than duplicating the math,
    plus `basisToPricingKind()` aligning each rung to the canonical finance
    `Pricing.kind` (access→subscription, effort/usage→composite,
    output→per-invocation, outcome→outcome).
  - a `FundingSource` union (`direct | ad-supported | equity | barter |
    subsidized`).
- New `Offer` Noun in `src/entities/offerings.ts`, registered in
  `OfferingEntities` and `OfferingCategories.pricing`; re-exported from the
  package root as `OfferEntity`.
- **Non-breaking:** the inline pricing fields on the `Product` and `Service`
  nouns are retained for backward compatibility and annotated `@deprecated`,
  pointing at `Offer` as the canonical home for pricing.
