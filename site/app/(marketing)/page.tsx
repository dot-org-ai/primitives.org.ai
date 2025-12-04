import Link from 'next/link';
import { Code, Database, GitBranch, Bot, Package, Briefcase, Building2, ArrowRight, CheckSquare, UserCircle } from 'lucide-react';
import { CodeTabs } from './code-tabs';

const primitiveDescriptions: Record<string, string> = {
  business: 'Organizations as executable code',
  service: 'AI delivering human-quality work',
  product: 'Compose primitives into products',
  agent: 'Autonomous entities with real identity',
  human: 'Approvals, reviews, and judgment calls',
  task: 'Work units with assignment and tracking',
  workflow: 'Durable execution and state machines',
  database: 'Schema-driven with vector embeddings',
  function: 'Code, Generative, Agentic, Human—unified interface',
};

const primitiveIcons: Record<string, typeof Code> = {
  business: Building2,
  service: Briefcase,
  product: Package,
  agent: Bot,
  human: UserCircle,
  task: CheckSquare,
  workflow: GitBranch,
  database: Database,
  function: Code,
};

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="px-6 pt-16 pb-8 text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-6">
          The Building Blocks of<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F97583] to-[#B392F0]">
            AI-Native Software
          </span>
        </h1>
        <p className="text-xl text-fd-muted-foreground max-w-3xl mx-auto mb-8">
          Primitives for building software where humans and AI work together seamlessly.
          From functions to businesses, every layer is designed for the age of AI.
        </p>
        <div className="flex gap-4 justify-center mb-12">
          <Link
            href="/function"
            className="inline-flex items-center gap-2 px-6 py-3 bg-fd-primary text-fd-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="https://github.com/dot-org"
            className="inline-flex items-center gap-2 px-6 py-3 border border-fd-border rounded-lg font-medium hover:bg-fd-accent transition-colors"
          >
            View on GitHub
          </Link>
        </div>
      </section>

      {/* Code Window */}
      <section className="px-6 pb-16">
        <div className="max-w-5xl mx-auto">
          <CodeTabs />
        </div>
      </section>

      {/* Primitive Cards */}
      <section className="px-6 py-16 border-t border-fd-border bg-fd-accent/20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Nine Primitives</h2>
          <p className="text-fd-muted-foreground text-center max-w-2xl mx-auto mb-12">
            Each primitive solves a fundamental problem. Together, they compose into anything.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {Object.entries(primitiveDescriptions).map(([key, description]) => {
              const Icon = primitiveIcons[key];
              return (
                <Link
                  key={key}
                  href={`/${key}`}
                  className="group p-5 border border-fd-border rounded-xl bg-fd-background hover:border-fd-primary/50 hover:shadow-lg transition-all"
                >
                  <Icon className="w-8 h-8 mb-3 text-fd-primary" />
                  <h3 className="text-lg font-semibold mb-1 group-hover:text-fd-primary transition-colors capitalize">
                    {key}
                  </h3>
                  <p className="text-fd-muted-foreground text-sm">
                    {description}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="px-6 py-16 border-t border-fd-border">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Built for the AI Era</h2>
          <div className="grid md:grid-cols-2 gap-6 text-left">
            <div className="p-6 border border-fd-border rounded-xl">
              <h3 className="font-semibold mb-2">Heterogeneous Computation</h3>
              <p className="text-fd-muted-foreground text-sm">
                Code, AI models, autonomous agents, and humans all participate in the same
                workflows with the same interfaces.
              </p>
            </div>
            <div className="p-6 border border-fd-border rounded-xl">
              <h3 className="font-semibold mb-2">Uncertain Execution</h3>
              <p className="text-fd-muted-foreground text-sm">
                Generative and agentic functions produce variable outputs. The primitives
                handle retries, validation, and fallbacks transparently.
              </p>
            </div>
            <div className="p-6 border border-fd-border rounded-xl">
              <h3 className="font-semibold mb-2">Distributed State</h3>
              <p className="text-fd-muted-foreground text-sm">
                Context flows across systems, conversations, and time horizons. Vector
                embeddings enable semantic understanding.
              </p>
            </div>
            <div className="p-6 border border-fd-border rounded-xl">
              <h3 className="font-semibold mb-2">Collaborative Work</h3>
              <p className="text-fd-muted-foreground text-sm">
                AI and humans hand off tasks seamlessly. Each contributes their strengths
                with clear escalation paths.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 text-center bg-fd-accent/30">
        <h2 className="text-3xl font-bold mb-4">Start Building</h2>
        <p className="text-fd-muted-foreground max-w-2xl mx-auto mb-8">
          Install the packages and start composing primitives into AI-native software.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <code className="px-4 py-2 bg-fd-background border border-fd-border rounded-lg font-mono text-sm">
            npm install ai-functions
          </code>
          <Link
            href="/function"
            className="inline-flex items-center gap-2 px-6 py-3 bg-fd-primary text-fd-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Read the Docs
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
