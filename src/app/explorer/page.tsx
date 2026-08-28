import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { TransactionGraphService } from '@/services/TransactionGraphService';

export default async function ExplorerPage({ searchParams }: { searchParams: { orderId?: string } }) {
  // Await searchParams in Next.js 15+ if needed, but Next.js 13/14 it's sync. Assuming Next.js App Router async component pattern.
  let graph = null;
  const resolvedParams = await searchParams;
  const orderId = resolvedParams.orderId;

  if (orderId) {
    try {
      graph = await TransactionGraphService.buildFromOrderId(orderId);
    } catch {
      // ignore
    }
  } else {
    // just get the first order as demo if not provided
    const firstOrder = await prisma.order.findFirst();
    if (firstOrder) {
      try {
        graph = await TransactionGraphService.buildFromOrderId(firstOrder.id);
      } catch {
        // ignore
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground dark">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">RefundOS</h1>
        </div>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link href="/" className="text-muted-foreground hover:text-primary">Overview</Link>
          <Link href="/refunds" className="text-muted-foreground hover:text-primary">Command Center</Link>
          <Link href="/exceptions" className="text-muted-foreground hover:text-primary">Exceptions</Link>
          <Link href="/explorer" className="text-primary hover:text-accent-foreground">Explorer</Link>
        </nav>
      </header>

      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Transaction Explorer</h2>
          <form className="flex gap-2" action="/explorer">
            <input 
              name="orderId" 
              placeholder="Search Order ID..." 
              className="px-3 py-2 bg-secondary border border-border rounded-md text-sm w-64"
            />
            <button type="submit" className="px-4 py-2 bg-white text-black font-medium rounded-md text-sm">
              Search
            </button>
          </form>
        </div>

        {!graph ? (
          <div className="text-muted-foreground text-center py-20">Enter a valid Order ID to visualize its transaction graph.</div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 overflow-auto">
            <h3 className="font-medium text-lg mb-4">Financial Graph</h3>
            
            <div className="space-y-4 font-mono text-sm">
              {graph.nodes.map(node => (
                <div key={node.id} className="p-3 border border-border rounded-md bg-secondary/50 flex justify-between">
                  <div>
                    <span className="font-bold text-blue-400 mr-2">[{node.type}]</span>
                    {node.label}
                  </div>
                  {node.amount !== undefined && (
                    <span className={node.type === 'REFUND' || node.type === 'REVERSAL' ? 'text-destructive' : 'text-green-500'}>
                      {node.type === 'REFUND' || node.type === 'REVERSAL' ? '-' : '+'}₹{node.amount / 100}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8">
              <h4 className="font-medium mb-2 text-muted-foreground">Edges</h4>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {graph.edges.map((edge, i) => (
                  <li key={i}>
                    {edge.source} <span className="text-muted-foreground mx-1">--({edge.label})--&gt;</span> {edge.target}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
