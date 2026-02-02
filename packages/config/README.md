# @org.ai/config

![Stability: Experimental](https://img.shields.io/badge/stability-experimental-red)

Shared TypeScript and ESLint configurations for the primitives.org.ai monorepo.

## TypeScript Configurations

### Base Configuration

```json
{
  "extends": "@org.ai/config/typescript/base"
}
```

Includes:
- ES2022 target
- ESNext modules with bundler resolution
- Strict mode with additional checks
- Declaration and source maps

### Library Configuration

```json
{
  "extends": "@org.ai/config/typescript/library"
}
```

Extends base with settings optimized for npm packages.

### React Configuration

```json
{
  "extends": "@org.ai/config/typescript/react"
}
```

Extends base with React-specific settings and DOM lib.

## ESLint Configurations

### Base Configuration

```javascript
// eslint.config.js
import config from '@org.ai/config/eslint'

export default config
```

Or import parts:

```javascript
import { base, ignores } from '@org.ai/config/eslint'

export default [
  ...base,
  // your overrides
]
```

### React Configuration

```javascript
import { react } from '@org.ai/config/eslint'

export default [
  ...react,
  // your overrides
]
```

## Included Rules

### TypeScript
- `@typescript-eslint/no-unused-vars` — Error with `_` prefix exceptions
- `@typescript-eslint/consistent-type-imports` — Prefer type imports
- `@typescript-eslint/no-explicit-any` — Warning

### Ignored Paths
- `dist/`
- `node_modules/`
- `.turbo/`
- `coverage/`
- `.next/`

## TypeScript Compiler Options

```json
{
  "target": "ES2022",
  "module": "ESNext",
  "moduleResolution": "bundler",
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "verbatimModuleSyntax": true
}
```

## Usage in Monorepo

Reference in any package's `tsconfig.json`:

```json
{
  "extends": "@org.ai/config/typescript/library",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

Reference in `eslint.config.js`:

```javascript
import config from '@org.ai/config/eslint'
export default config
```
