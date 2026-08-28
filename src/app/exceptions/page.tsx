import { prisma } from '@/lib/prisma';

import Link from 'next/link';

export default async function ExceptionsPage() {
  const exceptions = await prisma.exceptionCase.findMany({
    include: { refundRequest: true }
  });

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground dark">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">RefundOS</h1>
        </div>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link href="/" className="text-muted-foreground hover:text-primary">Overview</Link>
          <Link href="/refunds" className="text-muted-foreground hover:text-primary">Command Center</Link>
          <Link href="/exceptions" className="text-primary hover:text-accent-foreground">Exceptions</Link>
          <Link href="/explorer" className="text-muted-foreground hover:text-primary">Explorer</Link>
        </nav>
      </header>

      <main className="flex-1 p-8">
        <h2 className="text-2xl font-semibold mb-6 text-red-500">Action Required: Blocked Operations</h2>
        
        {exceptions.length === 0 ? (
          <div className="text-muted-foreground">No active exceptions.</div>
        ) : (
          <div className="space-y-4">
            {exceptions.map((ex) => (
              <div key={ex.id} className="rounded-xl border border-red-900 bg-red-950/20 p-6 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-red-500/20 text-red-500 text-xs font-bold px-2 py-1 rounded">
                      {ex.severity}
                    </span>
                    <span className="text-muted-foreground text-sm font-mono">{ex.refundRequest?.orderId}</span>
                  </div>
                  <h3 className="text-lg font-medium">{ex.reason}</h3>
                  <p className="text-sm text-muted-foreground mt-2">Recommended: {ex.recommendedAction}</p>
                </div>
                <button className="bg-white text-black font-semibold py-2 px-4 rounded-md hover:bg-gray-200 transition-colors">
                  Review Case
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
