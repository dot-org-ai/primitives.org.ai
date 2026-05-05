import { defineGraph } from './graph.js'
import type {
  DocUrl,
  FuzzyQuery,
  InferDoc,
  InferGraphResult,
  InferOutgoing,
  InferPayload,
  InferRelationships,
  InferWrite,
} from './infer.js'

const cascade = defineGraph({
  StudioThesis: {
    $type: 'https://schema.org.ai/StudioThesis',
    name: 'string',
  },
  WorkContextCell: {
    $type: 'https://schema.org.ai/WorkContextCell',
    label: 'string',
    thesis: '->StudioThesis!',
  },
  Company: {
    $type: 'https://schema.org.ai/Company',
    name: 'string',
    website: 'url?',
  },
  FoundingHypothesis: {
    $type: 'https://schema.org.ai/FoundingHypothesis',
    customer: 'string',
    problem: 'string',
    approach: 'markdown',
    studioThesis: '->StudioThesis!#',
    cell: '->WorkContextCell!',
    competitors: ['~>Company'],
    unmetRequirements: ['<-UnmetRequirement.foundingHypothesis'],
  },
  UnmetRequirement: {
    $type: 'https://schema.org.ai/UnmetRequirement',
    requirement: 'string',
    status: 'open | resolved | waived',
    foundingHypothesis: '->FoundingHypothesis!',
  },
} as const)

type FoundingHypothesisPayload = InferPayload<typeof cascade, 'FoundingHypothesis'>
const payloadOk: FoundingHypothesisPayload = {
  customer: 'operators',
  problem: 'manual reconciliation',
  approach: 'attested workflow',
}

type FH = InferDoc<typeof cascade, 'FoundingHypothesis'>
type FHEdges = InferOutgoing<typeof cascade, 'FoundingHypothesis'>

type FoundingHypothesisWrite = InferWrite<typeof cascade, 'FoundingHypothesis'>
const writeOk: FoundingHypothesisWrite = {
  ...payloadOk,
  studioThesis: 'https://api.sb/studio-theses/t-ais' as DocUrl<'StudioThesis'>,
  cell: 'https://api.sb/work-context-cells/cell-1' as DocUrl<'WorkContextCell'>,
  competitors: [
    'https://api.sb/companies/acme' as DocUrl<'Company'>,
    'semantic competitor query' as FuzzyQuery<'Company'>,
  ],
}

// @ts-expect-error backward edges are read relationships, not write inputs.
writeOk.unmetRequirements = ['https://api.sb/unmet-requirements/ur-1' as DocUrl<'UnmetRequirement'>]

type FoundingHypothesisRelationships = InferRelationships<typeof cascade, 'FoundingHypothesis'>
type CompetitorRelationship = FoundingHypothesisRelationships['competitors']
type StudioThesisEdge = FHEdges['studioThesis']

const studioThesisEdgeOk: StudioThesisEdge = {
  direction: 'forward',
  matchMode: 'exact',
  cardinality: 'one',
  target: 'StudioThesis',
  ref: 'https://api.sb/studio-theses/t-ais' as DocUrl<'StudioThesis'>,
}

const competitorRelationshipOk: CompetitorRelationship = {
  direction: 'forward',
  matchMode: 'fuzzy',
  cardinality: 'many',
  target: 'Company',
  ref: ['https://api.sb/companies/acme' as DocUrl<'Company'>],
}

type FoundingHypothesisFlat = InferGraphResult<typeof cascade, 'FoundingHypothesis'>
const flatOk: FoundingHypothesisFlat = {
  $context: 'https://api.sb/$context',
  $type: 'https://schema.org.ai/FoundingHypothesis',
  $id: 'https://api.sb/founding-hypotheses/fh-1' as DocUrl<'FoundingHypothesis'>,
  foundingHypothesis: payloadOk,
  relationships: {
    studioThesis: 'https://api.sb/studio-theses/t-ais' as DocUrl<'StudioThesis'>,
    cell: 'https://api.sb/work-context-cells/cell-1' as DocUrl<'WorkContextCell'>,
    competitors: ['https://api.sb/companies/acme' as DocUrl<'Company'>],
    unmetRequirements: ['https://api.sb/unmet-requirements/ur-1' as DocUrl<'UnmetRequirement'>],
  },
  meta: {
    createdAt: '2026-05-05T00:00:00.000Z',
    updatedAt: '2026-05-05T00:00:00.000Z',
  },
}

const docAliasOk: FH = flatOk

// @ts-expect-error flat results do not hydrate references by default.
flatOk.references

type FoundingHypothesisDepth1 = InferGraphResult<typeof cascade, 'FoundingHypothesis', 1>
declare const expanded: FoundingHypothesisDepth1

expanded.references.cell.workContextCell.label satisfies string
expanded.references.cell.relationships.thesis satisfies DocUrl<'StudioThesis'>

// @ts-expect-error depth 1 hydrates direct refs only; nested refs stay flat.
expanded.references.cell.references.thesis

type FoundingHypothesisDepth2 = InferGraphResult<typeof cascade, 'FoundingHypothesis', 2>
declare const expanded2: FoundingHypothesisDepth2

expanded2.references.cell.references.thesis.studioThesis.name satisfies string

export {}
