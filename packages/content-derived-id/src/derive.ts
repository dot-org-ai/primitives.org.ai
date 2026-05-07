/**
 * RED stub — implementation lands in the GREEN commit.
 */
export type Prefix = 12 | 16

export interface DeriveOpts {
  prefix?: Prefix
}

export function deriveContentId(_type: string, _input: unknown, _opts: DeriveOpts = {}): string {
  throw new Error('deriveContentId: not implemented (RED)')
}

export function deriveContentHash(_input: unknown, _opts: DeriveOpts = {}): string {
  throw new Error('deriveContentHash: not implemented (RED)')
}
