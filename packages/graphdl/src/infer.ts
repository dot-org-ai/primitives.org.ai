import type { GraphInput, ParsedGraph } from './types.js'

declare const graphInputBrand: unique symbol

/** A parsed graph that retains its source schema for TypeScript inference. */
export type GraphOf<TInput extends GraphInput> = ParsedGraph & {
  readonly [graphInputBrand]?: TInput
}

/** Extract the original schema input from a branded graph returned by `Graph()`. */
export type GraphInputOf<TGraph> =
  TGraph extends { readonly [graphInputBrand]?: infer TInput extends GraphInput }
    ? TInput
    : TGraph extends GraphInput
      ? TGraph
      : never

/** URL-shaped document reference branded by graphdl type name. */
export type DocUrl<TType extends string = string> = string & {
  readonly __graphdlDocType?: TType
}

/** Fuzzy relationship query or unresolved semantic target for a graphdl type. */
export type FuzzyQuery<TType extends string = string> = string & {
  readonly __graphdlFuzzyTarget?: TType
}

export type GraphDepth = 0 | 1 | 2 | 3 | 4 | 5

type PreviousDepth<TDepth extends GraphDepth> = {
  0: 0
  1: 0
  2: 1
  3: 2
  4: 3
  5: 4
}[TDepth]

type EntityOf<TSchema extends GraphInput, TType extends keyof TSchema> = TSchema[TType]
type EntityObject<TSchema extends GraphInput, TType extends keyof TSchema> =
  EntityOf<TSchema, TType> extends string ? {} : EntityOf<TSchema, TType>

type StringKeys<T> = Extract<keyof T, string>
type EntityName<TSchema extends GraphInput> = Extract<keyof TSchema, string>

type IsDirectiveKey<TKey extends string> = TKey extends `$${string}` ? true : false

type FieldValue<TField> = TField extends readonly [infer TInner extends string]
  ? TInner
  : TField extends string
    ? TField
    : never

type IsTupleArray<TField> = TField extends readonly [string] ? true : false

type StripPrompt<T extends string> =
  T extends `${string}~>${infer TRest}` ? `~>${TRest}` :
  T extends `${string}<~${infer TRest}` ? `<~${TRest}` :
  T extends `${string}->${infer TRest}` ? `->${TRest}` :
  T extends `${string}<-${infer TRest}` ? `<-${TRest}` :
  T

type OperatorOf<T extends string> =
  StripPrompt<T> extends `~>${string}` ? '~>' :
  StripPrompt<T> extends `<~${string}` ? '<~' :
  StripPrompt<T> extends `->${string}` ? '->' :
  StripPrompt<T> extends `<-${string}` ? '<-' :
  never

type IsOperatorRelation<T extends string> = [OperatorOf<T>] extends [never] ? false : true

type IsPascalRelation<TSchema extends GraphInput, T extends string> =
  T extends EntityName<TSchema> ? true :
  T extends `${infer TEntity}.${string}`
    ? TEntity extends EntityName<TSchema> ? true : false
    : false

type IsRelation<TSchema extends GraphInput, TField> =
  FieldValue<TField> extends infer TDef extends string
    ? IsOperatorRelation<TDef> extends true
      ? true
      : IsPascalRelation<TSchema, StripPlainModifiers<TDef>>
    : false

type DirectionOf<TOperator extends string> =
  TOperator extends '->' | '~>' ? 'forward' :
  TOperator extends '<-' | '<~' ? 'backward' :
  'forward'

type MatchModeOf<TOperator extends string> =
  TOperator extends '~>' | '<~' ? 'fuzzy' : 'exact'

type StripOneModifier<T extends string> =
  T extends `${infer TRest}[]` ? TRest :
  T extends `${infer TRest}?` ? TRest :
  T extends `${infer TRest}!` ? TRest :
  T extends `${infer TRest}#` ? TRest :
  T

type StripPlainModifiers<T extends string> =
  StripOneModifier<T> extends T ? T : StripPlainModifiers<StripOneModifier<T>>

type StripThreshold<T extends string> =
  T extends `${infer TName}(${number})${infer TSuffix}` ? `${TName}${TSuffix}` : T

type RelationTargetRaw<T extends string> =
  StripPrompt<T> extends `~>${infer TRest}` ? TRest :
  StripPrompt<T> extends `<~${infer TRest}` ? TRest :
  StripPrompt<T> extends `->${infer TRest}` ? TRest :
  StripPrompt<T> extends `<-${infer TRest}` ? TRest :
  T

type RelationTargetClean<T extends string> =
  StripPlainModifiers<StripThreshold<RelationTargetRaw<T>>>

type BeforeDot<T extends string> = T extends `${infer THead}.${string}` ? THead : T
type SplitUnion<T extends string> = T extends `${infer THead}|${infer TTail}`
  ? BeforeDot<THead> | SplitUnion<TTail>
  : BeforeDot<T>

type RelationTarget<TSchema extends GraphInput, TField> =
  FieldValue<TField> extends infer TDef extends string
    ? IsOperatorRelation<TDef> extends true
      ? Extract<SplitUnion<RelationTargetClean<TDef>>, EntityName<TSchema>>
      : StripPlainModifiers<TDef> extends `${infer TEntity}.${string}`
        ? Extract<TEntity, EntityName<TSchema>>
        : Extract<StripPlainModifiers<TDef>, EntityName<TSchema>>
    : never

type HasModifier<T extends string, TModifier extends '?' | '!' | '#'> =
  StripPrompt<T> extends `${string}${TModifier}` ? true : false

type HasArrayModifier<T extends string> =
  StripPrompt<T> extends `${string}[]` ? true : false

type IsArrayField<TField> =
  IsTupleArray<TField> extends true
    ? true
    : FieldValue<TField> extends infer TDef extends string
      ? HasArrayModifier<TDef>
      : false

type RelationRequired<TField> =
  FieldValue<TField> extends infer TDef extends string
    ? HasModifier<TDef, '!'>
    : false

type NonRelationOptional<TField> =
  FieldValue<TField> extends infer TDef extends string
    ? HasModifier<TDef, '?'> extends true
      ? true
      : TDef extends `${string} = ${string}` ? true : false
    : false

type CardinalityOf<TField> = IsArrayField<TField> extends true ? 'many' : 'one'

type PrimitiveName<T extends string> = StripPlainModifiers<T> extends `${infer TName} = ${string}`
  ? StripPlainModifiers<TName>
  : StripPlainModifiers<T>

type ParseEnum<T extends string> = T extends `${infer THead} | ${infer TTail}`
  ? THead | ParseEnum<TTail>
  : T

type PrimitiveToTs<T extends string> =
  PrimitiveName<T> extends 'string' | 'text' | 'varchar' | 'char' | 'fixed' | 'markdown' | 'binary' | 'url' | 'email' | 'date' | 'datetime' | 'timestamp' | 'timestamptz' | 'time' | 'uuid'
    ? string
    : PrimitiveName<T> extends 'number' | 'float' | 'double' | 'decimal' | 'int' | 'long'
      ? number
      : PrimitiveName<T> extends 'bigint'
        ? number | string | bigint
        : PrimitiveName<T> extends 'boolean' | 'bool'
          ? boolean
          : PrimitiveName<T> extends `${string} | ${string}`
            ? ParseEnum<PrimitiveName<T>>
            : PrimitiveName<T> extends `map<${string}>` | `struct<${string}>` | `json`
              ? Record<string, unknown>
              : PrimitiveName<T> extends `list<${infer TInner}>`
                ? PrimitiveToTs<TInner>[]
                : unknown

type FieldTs<TField> = FieldValue<TField> extends infer TDef extends string
  ? IsArrayField<TField> extends true
    ? PrimitiveToTs<TDef>[]
    : PrimitiveToTs<TDef>
  : never

type OptionalKeys<TSchema extends GraphInput, TType extends EntityName<TSchema>> = {
  [K in StringKeys<EntityObject<TSchema, TType>>]:
    IsDirectiveKey<K> extends true
      ? never
      : IsRelation<TSchema, EntityObject<TSchema, TType>[K]> extends true
        ? never
        : NonRelationOptional<EntityObject<TSchema, TType>[K]> extends true ? K : never
}[StringKeys<EntityObject<TSchema, TType>>]

type RequiredKeys<TSchema extends GraphInput, TType extends EntityName<TSchema>> = {
  [K in StringKeys<EntityObject<TSchema, TType>>]:
    IsDirectiveKey<K> extends true
      ? never
      : IsRelation<TSchema, EntityObject<TSchema, TType>[K]> extends true
        ? never
        : NonRelationOptional<EntityObject<TSchema, TType>[K]> extends true ? never : K
}[StringKeys<EntityObject<TSchema, TType>>]

type Simplify<T> = { [K in keyof T]: T[K] } & {}

/** Infer only the typed scalar payload for a graphdl entity. */
export type InferPayload<TGraph, TType extends EntityName<GraphInputOf<TGraph>>> = Simplify<
  {
    [K in RequiredKeys<GraphInputOf<TGraph>, TType>]: FieldTs<EntityObject<GraphInputOf<TGraph>, TType>[K]>
  } & {
    [K in OptionalKeys<GraphInputOf<TGraph>, TType>]?: FieldTs<EntityObject<GraphInputOf<TGraph>, TType>[K]>
  }
>

type RelationKeys<TSchema extends GraphInput, TType extends EntityName<TSchema>> = {
  [K in StringKeys<EntityObject<TSchema, TType>>]:
    IsDirectiveKey<K> extends true
      ? never
      : IsRelation<TSchema, EntityObject<TSchema, TType>[K]> extends true ? K : never
}[StringKeys<EntityObject<TSchema, TType>>]

type RelationOperator<TField> = FieldValue<TField> extends infer TDef extends string
  ? OperatorOf<TDef> extends infer TOp extends string
    ? [TOp] extends [never]
      ? '->'
      : TOp
    : '->'
  : '->'

type RelationshipRef<TTarget extends string, TCardinality extends 'one' | 'many'> =
  TCardinality extends 'many' ? DocUrl<TTarget>[] : DocUrl<TTarget>

type RelationshipWriteValue<
  TTarget extends string,
  TCardinality extends 'one' | 'many',
  TMatchMode extends 'exact' | 'fuzzy',
> = TCardinality extends 'many'
  ? Array<TMatchMode extends 'fuzzy' ? DocUrl<TTarget> | FuzzyQuery<TTarget> : DocUrl<TTarget>>
  : TMatchMode extends 'fuzzy'
    ? DocUrl<TTarget> | FuzzyQuery<TTarget>
    : DocUrl<TTarget>

type RelationshipInfo<TSchema extends GraphInput, TField> =
  RelationOperator<TField> extends infer TOperator extends string
    ? {
        direction: DirectionOf<TOperator>
        matchMode: MatchModeOf<TOperator>
        cardinality: CardinalityOf<TField>
        target: RelationTarget<TSchema, TField>
        ref: RelationshipRef<RelationTarget<TSchema, TField>, CardinalityOf<TField>>
      }
    : never

/** Infer direct relationship metadata and flat ref shapes for an entity. */
export type InferRelationships<TGraph, TType extends EntityName<GraphInputOf<TGraph>>> = Simplify<{
  [K in RelationKeys<GraphInputOf<TGraph>, TType>]:
    RelationshipInfo<GraphInputOf<TGraph>, EntityObject<GraphInputOf<TGraph>, TType>[K]>
}>

type ForwardRelationKeys<TSchema extends GraphInput, TType extends EntityName<TSchema>> = {
  [K in RelationKeys<TSchema, TType>]:
    RelationshipInfo<TSchema, EntityObject<TSchema, TType>[K]>['direction'] extends 'forward' ? K : never
}[RelationKeys<TSchema, TType>]

/** Infer only forward/outgoing relationships for an entity. */
export type InferOutgoing<TGraph, TType extends EntityName<GraphInputOf<TGraph>>> = Simplify<{
  [K in ForwardRelationKeys<GraphInputOf<TGraph>, TType>]:
    RelationshipInfo<GraphInputOf<TGraph>, EntityObject<GraphInputOf<TGraph>, TType>[K]>
}>

type BackwardRelationKeys<TSchema extends GraphInput, TType extends EntityName<TSchema>> = {
  [K in RelationKeys<TSchema, TType>]:
    RelationshipInfo<TSchema, EntityObject<TSchema, TType>[K]>['direction'] extends 'backward' ? K : never
}[RelationKeys<TSchema, TType>]

/** Infer only backward/incoming relationships for an entity. */
export type InferIncoming<TGraph, TType extends EntityName<GraphInputOf<TGraph>>> = Simplify<{
  [K in BackwardRelationKeys<GraphInputOf<TGraph>, TType>]:
    RelationshipInfo<GraphInputOf<TGraph>, EntityObject<GraphInputOf<TGraph>, TType>[K]>
}>

type RequiredForwardRelationKeys<TSchema extends GraphInput, TType extends EntityName<TSchema>> = {
  [K in ForwardRelationKeys<TSchema, TType>]:
    RelationRequired<EntityObject<TSchema, TType>[K]> extends true ? K : never
}[ForwardRelationKeys<TSchema, TType>]

type OptionalForwardRelationKeys<TSchema extends GraphInput, TType extends EntityName<TSchema>> =
  Exclude<ForwardRelationKeys<TSchema, TType>, RequiredForwardRelationKeys<TSchema, TType>>

type RelationshipWrite<TSchema extends GraphInput, TField> =
  RelationshipInfo<TSchema, TField> extends infer TRel extends {
    target: string
    cardinality: 'one' | 'many'
    matchMode: 'exact' | 'fuzzy'
  }
    ? RelationshipWriteValue<TRel['target'], TRel['cardinality'], TRel['matchMode']>
    : never

/** Infer the accepted write payload for an entity. Backward edges are omitted. */
export type InferWrite<TGraph, TType extends EntityName<GraphInputOf<TGraph>>> = Simplify<
  InferPayload<TGraph, TType> &
  {
    [K in RequiredForwardRelationKeys<GraphInputOf<TGraph>, TType>]:
      RelationshipWrite<GraphInputOf<TGraph>, EntityObject<GraphInputOf<TGraph>, TType>[K]>
  } &
  {
    [K in OptionalForwardRelationKeys<GraphInputOf<TGraph>, TType>]?:
      RelationshipWrite<GraphInputOf<TGraph>, EntityObject<GraphInputOf<TGraph>, TType>[K]>
  }
>

type RelationshipRefs<TGraph, TType extends EntityName<GraphInputOf<TGraph>>> = Simplify<{
  [K in keyof InferRelationships<TGraph, TType>]: InferRelationships<TGraph, TType>[K] extends { ref: infer TRef }
    ? TRef
    : never
}>

type ReferenceValue<TGraph, TInfo, TDepth extends GraphDepth> =
  TInfo extends {
    target: infer TTarget extends EntityName<GraphInputOf<TGraph>>
    cardinality: infer TCardinality extends 'one' | 'many'
  }
    ? TCardinality extends 'many'
      ? InferGraphResult<TGraph, TTarget, PreviousDepth<TDepth>>[]
      : InferGraphResult<TGraph, TTarget, PreviousDepth<TDepth>>
    : never

type References<TGraph, TType extends EntityName<GraphInputOf<TGraph>>, TDepth extends GraphDepth> = Simplify<{
  [K in keyof InferRelationships<TGraph, TType>]:
    ReferenceValue<TGraph, InferRelationships<TGraph, TType>[K], TDepth>
}>

type TypeUri<TGraph, TType extends EntityName<GraphInputOf<TGraph>>> =
  EntityOf<GraphInputOf<TGraph>, TType> extends { readonly $type?: infer TUri extends string }
    ? TUri
    : TType

type PayloadSlot<TType extends string, TPayload> = {
  [K in Uncapitalize<TType>]: TPayload
}

type GraphResultBase<TGraph, TType extends EntityName<GraphInputOf<TGraph>>> = {
  $context: string
  $type: TypeUri<TGraph, TType>
  $id: DocUrl<TType>
  relationships: RelationshipRefs<TGraph, TType>
  meta: {
    createdAt: string
    updatedAt: string
    version?: string
    source?: string
    [key: string]: unknown
  }
}

/** Infer the flat or depth-expanded graph read envelope for an entity. */
export type InferGraphResult<
  TGraph,
  TType extends EntityName<GraphInputOf<TGraph>>,
  TDepth extends GraphDepth = 0,
> = Simplify<
  GraphResultBase<TGraph, TType> &
  PayloadSlot<TType, InferPayload<TGraph, TType>> &
  (TDepth extends 0 ? {} : { references: References<TGraph, TType, TDepth> })
>

/** Backwards-friendly alias for the default flat graph result. */
export type InferDoc<TGraph, TType extends EntityName<GraphInputOf<TGraph>>> =
  InferGraphResult<TGraph, TType, 0>
