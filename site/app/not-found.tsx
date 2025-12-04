import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-fd-background flex items-center justify-center">
      <div className="text-center px-6">
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-4">Page Not Found</h2>
        <p className="text-fd-muted-foreground mb-8 max-w-md">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-fd-primary text-fd-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Go Home
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 px-6 py-3 border border-fd-border rounded-lg font-medium hover:bg-fd-accent transition-colors"
          >
            Documentation
          </Link>
        </div>
      </div>
    </div>
  );
}
