import Link from 'next/link';

const primitives = [
  { name: 'Function', href: '/function', description: 'The atomic unit of computation with four types: Code, Generative, Agentic, and Human.' },
  { name: 'Database', href: '/database', description: 'Persistent state for structured data and vector embeddings.' },
  { name: 'Workflow', href: '/workflow', description: 'Orchestrate complex processes with durable execution or state machines.' },
  { name: 'Task', href: '/task', description: 'Discrete units of work with assignment, tracking, and outcomes.' },
  { name: 'Agent', href: '/agent', description: 'Truly autonomous entities with real identity and long-term memory.' },
  { name: 'Human', href: '/human', description: 'Human-in-the-loop for approvals, reviews, and judgment calls.' },
  { name: 'Product', href: '/product', description: 'Compose primitives into complete products with declarative interfaces.' },
  { name: 'Service', href: '/service', description: 'Services-as-Software—AI delivering work traditionally done by humans.' },
  { name: 'Business', href: '/business', description: 'Business-as-Code—traditional processes manifested as code.' },
];

export default function Page() {
  return (
    <div className="min-h-screen bg-fd-background">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-4">Documentation</h1>
        <p className="text-xl text-fd-muted-foreground mb-12">
          The fundamental abstractions for building AI-native software
        </p>

        <p className="text-lg text-fd-muted-foreground mb-8">
          Primitives.org.ai provides the fundamental abstractions for building software where humans and AI work together seamlessly.
          These core primitives compose together to build anything—from simple functions to entire businesses.
        </p>

        <h2 className="text-2xl font-bold mb-6">Core Primitives</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-12">
          {primitives.map((primitive) => (
            <Link
              key={primitive.name}
              href={primitive.href}
              className="block p-4 rounded-lg border border-fd-border bg-fd-card hover:bg-fd-accent transition-colors"
            >
              <h3 className="font-semibold mb-2">{primitive.name}</h3>
              <p className="text-sm text-fd-muted-foreground">{primitive.description}</p>
            </Link>
          ))}
        </div>

        <h2 className="text-2xl font-bold mb-4">The Stack</h2>
        <pre className="p-4 rounded-lg bg-fd-secondary text-sm overflow-x-auto mb-8 font-mono">
{`┌─────────────────────────────────────────────────────────┐
│                       Business                          │
│            Business-as-Code organizations               │
├─────────────────────────────────────────────────────────┤
│                       Service                           │
│            Services-as-Software delivery                │
├─────────────────────────────────────────────────────────┤
│                       Product                           │
│            Composed products and interfaces             │
├─────────────────────────────────────────────────────────┤
│              Agent              │         Human         │
│      Autonomous entities        │   Human-in-the-loop   │
├─────────────────────────────────────────────────────────┤
│              Task               │       Workflow        │
│        Units of work            │    Orchestration      │
├─────────────────────────────────────────────────────────┤
│            Function             │       Database        │
│       Atomic computation        │   Persistent state    │
└─────────────────────────────────────────────────────────┘`}
        </pre>

        <h2 className="text-2xl font-bold mb-4">Philosophy</h2>
        <p className="mb-4">
          The age of AI requires new primitives. Traditional software abstractions assume deterministic execution and human-only workflows.
          Primitives.org.ai is built from first principles for a world where:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-fd-muted-foreground">
          <li><strong className="text-fd-foreground">Computation is heterogeneous</strong> — Code, AI models, autonomous agents, and humans all participate in the same workflows</li>
          <li><strong className="text-fd-foreground">Execution is uncertain</strong> — Generative and agentic functions produce variable outputs that require different handling patterns</li>
          <li><strong className="text-fd-foreground">State is distributed</strong> — Context flows across systems, conversations, and time horizons</li>
          <li><strong className="text-fd-foreground">Work is collaborative</strong> — AI and humans hand off tasks seamlessly, each contributing their strengths</li>
        </ul>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Documentation',
  description: 'The fundamental abstractions for building AI-native software',
};
