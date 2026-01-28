# Contributing to AI Primitives

Thank you for your interest in contributing to AI Primitives! This guide will help you get started with development.

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **pnpm** >= 9.0.0 (package manager)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/primitives-org/primitives.org.ai.git
   cd primitives.org.ai
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build all packages:
   ```bash
   pnpm build
   ```

## Development Workflow

### Running Tests

Run all tests across the monorepo:
```bash
pnpm test
```

Run tests for a specific package:
```bash
cd packages/ai-core
pnpm test
```

Or use Turbo filtering:
```bash
pnpm test --filter=ai-functions
```

### Type Checking

Run type checking across all packages:
```bash
pnpm typecheck
```

### Linting

Run linting across all packages:
```bash
pnpm lint
```

### Development Mode

For packages with watch mode:
```bash
pnpm dev
```

## Project Structure

This is a monorepo managed with pnpm workspaces and Turborepo. All packages are located in the `packages/` directory:

### Core Packages

- **ai-core** - Core AI primitives and foundational types
- **ai-functions** - Function calling and tool definitions
- **ai-database** - Database integrations with AI capabilities
- **ai-workflows** - Workflow orchestration and task management
- **ai-tests** - Testing utilities for AI applications

### Provider Packages

- **ai-providers** - LLM provider integrations
- **language-models** - Language model abstractions

### Application Packages

- **digital-workers** - Digital worker implementations
- **digital-tasks** - Task primitives
- **digital-tools** - Tool definitions
- **digital-products** - Product primitives
- **autonomous-agents** - Autonomous agent patterns
- **human-in-the-loop** - HITL workflow patterns

### Supporting Packages

- **ai-props** - Property definitions
- **ai-evaluate** - Evaluation utilities
- **ai-experiments** - Experimentation framework
- **business-as-code** - Business logic primitives
- **services-as-software** - Service abstractions
- **types** - Shared TypeScript types
- **config** - Shared configuration (ESLint, TypeScript)
- **examples** - Example implementations

## Pull Request Process

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Write tests first** (TDD approach):
   - Create test files before implementation
   - Tests should describe expected behavior
   - Run tests to verify they fail initially

3. **Implement your changes**:
   - Follow the existing code patterns
   - Keep changes focused and atomic

4. **Ensure all checks pass**:
   ```bash
   pnpm typecheck
   pnpm lint
   pnpm test
   pnpm build
   ```

5. **Open a Pull Request**:
   - Provide a clear description of changes
   - Reference any related issues
   - Include test coverage for new features
   - Request review from maintainers

## Code Style

### TypeScript Guidelines

- **Strict mode enabled**: All packages use TypeScript strict mode
- **Avoid `any` types**: Use proper typing, generics, or `unknown` when type is truly unknown
- **Prefer interfaces**: Use interfaces for object types, types for unions/intersections
- **Export types explicitly**: Use `export type` for type-only exports

### Testing Guidelines

- **Write tests for all new features**: No feature is complete without tests
- **Use descriptive test names**: Tests should read like documentation
- **Test edge cases**: Include tests for error conditions and boundary cases
- **Keep tests focused**: Each test should verify one specific behavior

### General Guidelines

- **Keep functions small**: Prefer small, focused functions
- **Use meaningful names**: Variables and functions should be self-documenting
- **Document complex logic**: Add comments for non-obvious code
- **Handle errors gracefully**: Use proper error handling patterns

## Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(ai-functions): add retry support for function calls`
- `fix(ai-database): handle connection timeout errors`
- `docs: update contributing guidelines`

## Questions?

If you have questions or need help, please open an issue or start a discussion in the repository.
