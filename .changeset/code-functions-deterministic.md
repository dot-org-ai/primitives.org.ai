---
"ai-functions": minor
---

Make `kind: 'code'` deterministic.

Previously `defineFunction({ type: 'code' })` LLM-**generated** code at call time. A `CodeFunctionDefinition` now carries a deterministic `handler: (input) => output` (or an inline `code` string body), and `executeCodeFunction` runs it with **no model in the call path**. This aligns `Code` with the documented "Code = deterministic" contract (a fetch/transform/rule handler), keeping `Generative` / `Agentic` / `Human` semantics intact.

The code-**authoring** behavior (have a model write code) is preserved but moved to an explicit, opt-in path so the change is not silent:

- New `generateCode(definition, args)` export — returns generated source as a string.
- New `CodeGenerationDefinition` type for that path.
- `define.code(...)` now defines a deterministic handler function.
- Auto-define (`define(name, args)`) authors a self-contained body once at define time and carries it as an inline `code` body, so the resulting function is deterministic on every call.
- The `generate('code', prompt)` primitive is unchanged (a string-prompt code-authoring helper, distinct from the `FunctionDefinition` union).

`CodeFunctionDefinition` drops `includeTests` / `includeExamples` (relocated to `CodeGenerationDefinition`). The four `*FunctionDefinition` shapes and the `FunctionDefinition` union remain source-compatible for consumers binding to the type surface.
