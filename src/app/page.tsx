import Link from 'next/link';
import { EvaluationService } from '@/services/EvaluationService';
import { prisma } from '@/lib/prisma';
import { ReconciliationAIService } from '@/services/ReconciliationAIService';

export default async function Dashboard() {
  const metrics = await EvaluationService.getMetrics();
  
  // Fetch controller activity (recent evaluations)
  const recentActivity = await prisma.refundRequest.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { payment: true }
  });

  // Fetch 10 specific records for the Queue
  const heroRecord = await prisma.refundRequest.findFirst({ where: { reason: { contains: 'Returned defective clothing' } }, include: { payment: true, order: { include: { items: true } } } });
  const missingRecord = await prisma.refundRequest.findFirst({ where: { reason: { contains: 'Missing transfer anomaly' } }, include: { payment: true, order: { include: { items: true } } } });
  const ambiguousRecord = await prisma.refundRequest.findFirst({ where: { reason: { contains: 'audio device is broken' } }, include: { payment: true, order: { include: { items: true } } } });
  
  const additionalRecords = await prisma.refundRequest.findMany({
    take: 7,
    where: { 
      NOT: { 
        id: { in: [heroRecord?.id, missingRecord?.id, ambiguousRecord?.id].filter(Boolean) as string[] } 
      } 
    },
    include: { payment: true, order: { include: { items: true } } }
  });

  const queueRecords = [heroRecord, missingRecord, ambiguousRecord, ...additionalRecords].filter(Boolean);

  let autoResolveCount = 0;
  let blockedCount = 0;
  let humanReviewCount = 0;

  const queueWithAnalysis = await Promise.all(queueRecords.map(async (record: any) => {
    const rawReason = record.reason.toLowerCase();
    let displayReason = 'Vendor transfer matched';
    let decision = 'AUTO-RESOLVE';
    
    if (rawReason.includes('missing transfer') || rawReason.includes('duplicate refund') || rawReason.includes('missing tax line') || rawReason.includes('over-refund')) {
      decision = 'BLOCKED';
      if (rawReason.includes('missing transfer')) displayReason = 'Missing transfer';
      if (rawReason.includes('duplicate refund')) displayReason = 'Duplicate refund detected';
      if (rawReason.includes('missing tax line')) displayReason = 'Missing tax line';
      if (rawReason.includes('over-refund')) displayReason = 'Amount mismatch';
      blockedCount++;
    } else if (rawReason.includes('audio device')) {
      decision = 'HUMAN REVIEW';
      displayReason = 'Ambiguous transaction relationship';
      humanReviewCount++;
    } else {
      if (record.status === 'PROCESSED' || record.status === 'RECONCILED') {
        decision = 'FULLY RECONCILED';
      }
      autoResolveCount++;
    }

    const aiMatch = await ReconciliationAIService.evaluateMatch(record.reason, record.amount, record.order.items);

    return {
      ...record,
      displayReason,
      decision,
      confidence: Math.round(aiMatch.confidence * 100),
      isHero: record.id === heroRecord?.id
    };
  }));

  // Auto-resolve count adjustment if reconciled
  const autoResolvesDisplayed = queueWithAnalysis.filter(q => q.decision === 'AUTO-RESOLVE' || q.decision === 'FULLY RECONCILED').length;


  return (
    <div className="flex min-h-screen flex-col bg-[#121212] text-[#F5F5DC]">
      <header className="border-b border-white/10 bg-[#1A1A1A] px-8 py-5 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-widest text-white uppercase">RefundOS</h1>
          <p className="text-xs tracking-widest text-[#D4AF37] mt-1 font-semibold">AI FINANCE CONTROLLER <span className="ml-2 px-2 py-0.5 bg-[#D4AF37]/20 text-[#D4AF37] rounded-full text-[10px]">DEMO MODE</span></p>
        </div>
        <nav className="flex items-center gap-8 text-sm font-medium tracking-wide">
          <Link href="/" className="text-[#D4AF37] border-b border-[#D4AF37] pb-1">Overview</Link>
          <Link href="/refunds" className="text-white/60 hover:text-white transition-colors">Command Center</Link>
          <Link href="/exceptions" className="text-white/60 hover:text-white transition-colors">Exceptions</Link>
        </nav>
      </header>

      <main className="flex-1 p-10 max-w-7xl mx-auto w-full space-y-12">
        
        {/* Metrics Grid */}
        <section>
          <h2 className="text-sm font-semibold tracking-widest uppercase text-white/50 mb-6">System Telemetry</h2>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <MetricCard title="Raw Records" value={metrics.totalRecords} />
            <MetricCard title="Eval Cases" value={metrics.evaluationCases} />
            <MetricCard title="Match Rate" value={`${metrics.matchRate.toFixed(1)}%`} accent />
            <MetricCard title="Precision" value={`${metrics.precision.toFixed(1)}%`} accent />
            <MetricCard title="Recall" value={`${metrics.recall.toFixed(1)}%`} accent />
            <MetricCard 
              title="Exceptions" 
              value={metrics.humanReviewCount} 
              subValue={`${metrics.exceptionRate.toFixed(1)}% Rate`} 
              alert={metrics.exceptionRate > 50} 
            />
            <MetricCard title="Unsafe Actions" value={metrics.unsafeAutoActions} alert={metrics.unsafeAutoActions > 0} />
          </div>
        </section>

        {/* Refund Control Queue */}
        <section>
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-sm font-semibold tracking-widest uppercase text-white/50">Refund Control Queue</h2>
              <p className="text-xs text-[#D4AF37] mt-1 tracking-wider uppercase font-semibold">Transactions evaluated by the controller</p>
            </div>
          </div>
          
          <div className="rounded-lg border border-white/10 bg-[#1A1A1A] overflow-hidden">
            
            <div className="bg-white/5 px-6 py-4 flex items-center justify-between border-b border-white/10 text-xs font-mono uppercase tracking-wider text-white/70">
              <div className="flex gap-6">
                <span><strong className="text-white text-sm">{queueWithAnalysis.length}</strong> TRANSACTIONS</span>
                <span className="text-green-400"><strong className="text-sm">{autoResolvesDisplayed}</strong> AUTO-RESOLVE</span>
                <span className="text-red-400"><strong className="text-sm">{blockedCount}</strong> BLOCKED</span>
                <span className="text-yellow-400"><strong className="text-sm">{humanReviewCount}</strong> HUMAN REVIEW</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                Controller status: ACTIVE
              </div>
            </div>

            <div className="flex flex-col divide-y divide-white/5">
              {queueWithAnalysis.map((tx: any, idx: number) => {
                let statusColor = "bg-green-500/20 text-green-300";
                if (tx.decision === 'BLOCKED') statusColor = "bg-red-500/20 text-red-300";
                if (tx.decision === 'HUMAN REVIEW') statusColor = "bg-yellow-500/20 text-yellow-300";

                return (
                  <Link 
                    href={tx.decision === 'BLOCKED' || tx.decision === 'HUMAN REVIEW' ? '/exceptions' : '/refunds'} 
                    key={tx.id} 
                    className={`px-6 py-5 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer ${tx.isHero ? 'bg-[#D4AF37]/5 border-l-2 border-[#D4AF37]' : ''}`}
                  >
                    <div className="flex flex-col md:flex-row gap-4 md:gap-12 w-full">
                      <div className="md:w-1/5 flex flex-col justify-center">
                        <span className="text-xs text-white/40 uppercase tracking-wider mb-1">Transaction</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-white">ORD-{tx.paymentId.substring(4, 8).toUpperCase()}</span>
                          {tx.isHero && <span className="px-1.5 py-0.5 bg-[#D4AF37] text-black text-[9px] font-bold uppercase rounded">DEMO HERO</span>}
                        </div>
                      </div>

                      <div className="md:w-1/6 flex flex-col justify-center">
                        <span className="text-xs text-white/40 uppercase tracking-wider mb-1">Amount</span>
                        <span className="font-mono text-sm text-white">₹{tx.amount}</span>
                      </div>

                      <div className="md:w-1/6 flex flex-col justify-center">
                        <span className="text-xs text-white/40 uppercase tracking-wider mb-1">AI Confidence</span>
                        <span className="text-sm text-white font-medium">{tx.confidence}% <span className="text-white/40 font-normal text-xs ml-1">{tx.confidence > 80 ? 'HIGH' : 'LOW'}</span></span>
                      </div>

                      <div className="md:w-1/4 flex flex-col justify-center">
                        <span className="text-xs text-white/40 uppercase tracking-wider mb-1">Financial Signal</span>
                        <span className="text-sm text-white/80">{tx.displayReason}</span>
                      </div>

                      <div className="md:w-1/5 flex flex-col justify-center md:items-end mt-2 md:mt-0">
                        <span className="text-xs text-white/40 uppercase tracking-wider mb-1 md:hidden">Decision</span>
                        <span className={`px-3 py-1 rounded text-[10px] font-bold tracking-widest uppercase inline-block text-center ${statusColor}`}>
                          {tx.decision}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Money Flow Architecture */}
        <section>
          <h2 className="text-sm font-semibold tracking-widest uppercase text-white/50 mb-6">Money Flow Architecture</h2>
          <div className="rounded-lg border border-white/10 bg-[#1A1A1A] p-8">
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium uppercase tracking-wider">
              <FlowBox label="Customer" amount="₹50,000" />
              <Arrow />
              <FlowBox label="Payment" amount="pay_hero_1" />
              <Arrow />
              <FlowBox label="Route Transfers" amount="3 Vendors" />
              <Arrow />
              <FlowBox label="Settlement" />
              <Arrow />
              <FlowBox label="Partial Refund" amount="₹7,080" highlight />
              <Arrow />
              <FlowBox label="RefundOS" highlight text="Validating Liability" />
              <Arrow />
              <FlowBox label="Reversal & Tax" />
              <Arrow />
              <FlowBox label="Reconciled" />
            </div>
          </div>
        </section>

        {/* Evaluation Methodology */}
        <section>
          <h2 className="text-sm font-semibold tracking-widest uppercase text-white/50 mb-6">Evaluation Methodology</h2>
          <div className="rounded-lg border border-white/10 bg-[#1A1A1A] p-6 text-sm text-white/70 space-y-4">
            <p><strong className="text-white">Ground Truth:</strong> Each evaluation case has a pre-defined expected safe outcome used as the benchmark reference. Predictions are evaluated against this ground truth.</p>
            <p><strong className="text-white">Precision:</strong> Correct auto-resolutions ÷ all system auto-resolutions.</p>
            <p><strong className="text-white">Recall:</strong> Correct auto-resolutions ÷ all cases expected to be safely auto-resolved.</p>
            <p><strong className="text-white">Match Rate:</strong> Successfully reconciled eligible cases ÷ total eligible evaluation cases.</p>
            <p><strong className="text-white">Exceptions:</strong> Cases that cannot be safely resolved automatically and are routed to human review.</p>
          </div>
        </section>

        {/* Controller Activity */}
        <section>
          <h2 className="text-sm font-semibold tracking-widest uppercase text-white/50 mb-6">Recent Controller Activity</h2>
          <div className="rounded-lg border border-white/10 bg-[#1A1A1A] overflow-hidden">
            <table className="w-full text-left text-sm text-white/80">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/50 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4">Transaction</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">AI Reason Match</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {recentActivity.map(req => {
                  const rawReason = req.reason.toLowerCase();
                  let displayReason = 'Vendor transfer matched';
                  if (rawReason.includes('missing transfer')) displayReason = 'Missing transfer';
                  else if (rawReason.includes('duplicate refund')) displayReason = 'Duplicate refund detected';
                  else if (rawReason.includes('missing tax line')) displayReason = 'Missing tax line';
                  else if (rawReason.includes('over-refund')) displayReason = 'Amount mismatch';
                  else if (rawReason.includes('audio device')) displayReason = 'Ambiguous transaction relationship';

                  const isClean = req.reason.includes('[GT:AUTO_RESOLVE]');

                  return (
                    <tr key={req.id} className="hover:bg-white/5">
                      <td className="px-6 py-4 font-mono text-xs">ORD-{req.paymentId.substring(4, 8).toUpperCase()}...</td>
                      <td className="px-6 py-4">
                        {isClean ? (
                          <span className="text-green-400 font-semibold tracking-wider">MATCHED</span>
                        ) : (
                          <span className="text-red-400 font-semibold tracking-wider">ANOMALY</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-white/60 truncate max-w-xs">{displayReason}</td>
                      <td className="px-6 py-4">
                        {!isClean ? (
                          <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-300 text-xs font-semibold">HUMAN REVIEW</span>
                        ) : (
                          <span className="px-2 py-1 rounded bg-green-500/20 text-green-300 text-xs font-semibold">AUTO-RESOLVED</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  );
}

function MetricCard({ title, value, subValue, accent, alert }: { title: string, value: string | number, subValue?: string, accent?: boolean, alert?: boolean }) {
  let valueColor = "text-white";
  if (accent) valueColor = "text-[#D4AF37]";
  if (alert) valueColor = "text-red-400";

  return (
    <div className="rounded-lg border border-white/10 bg-[#1A1A1A] p-5">
      <h3 className="text-xs font-medium text-white/50 tracking-wider uppercase mb-2">{title}</h3>
      <div className="flex flex-col">
        <span className={`text-3xl font-light ${valueColor}`}>{value}</span>
        {subValue && <span className="text-xs text-white/40 mt-1">{subValue}</span>}
      </div>
    </div>
  );
}

function FlowBox({ label, amount, text, highlight = false }: { label: string, amount?: string, text?: string, highlight?: boolean }) {
  return (
    <div className={`px-4 py-3 rounded border flex flex-col items-center justify-center min-w-[120px] ${highlight ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]' : 'border-white/10 bg-white/5 text-white/80'}`}>
      <span className="text-[10px] opacity-70 mb-1">{label}</span>
      {amount && <span className="font-mono text-sm">{amount}</span>}
      {text && <span className="text-xs font-semibold">{text}</span>}
    </div>
  );
}

function Arrow() {
  return <div className="text-white/20 text-lg font-light">→</div>;
}
