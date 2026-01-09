# @org.ai/types

Shared type definitions for AI primitives packages.

## Installation

```bash
npm install @org.ai/types
```

## Usage

```typescript
import {
  AIFunction,
  EventHandler,
  WorkflowContext,
  RelationshipOperator,
  ParsedField,
} from '@org.ai/types'
```

## Types

### AIFunction<TOutput, TInput, TConfig>

Generic AI function type with output-first parameter order (like `Promise<T>`).

### EventHandler<TOutput, TInput>

Event handler type for workflow events.

### WorkflowContext

Interface for the `$` workflow context proxy.

### RelationshipOperator

Types for database relationship operators (`>>`, `=>`, `<>`, etc.).

### ParsedField

Parsed schema field with type information.

## License

MIT
