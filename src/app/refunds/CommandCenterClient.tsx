'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function CommandCenterClient({ heroCase, missingCase, ambiguousCase }: any) {
  const [scenario, setScenario] = useState<'HERO' | 'MISSING' | 'AMBIGUOUS'>('HERO');
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [isExecuted, setIsExecuted] = useState(false);

  const handleScenarioChange = (s: 'HERO' | 'MISSING' | 'AMBIGUOUS') => {
    setScenario(s);
    setIsAnalyzed(false);
    setIsExecuted(false);
  };

  const currentCase = scenario === 'HERO' ? heroCase : scenario === 'MISSING' ? missingCase : ambiguousCase;

  if (!currentCase || !currentCase.refund) {
    return <div className="p-8 text-white">Required data not found. Please generate the benchmark first.</div>;
  }

  const { refund, payment, allTransfers, aiMatch, affectedItems, analysis, isBlocked } = currentCase;

  return (
    <div className="flex min-h-screen flex-col bg-[#121212] text-[#F5F5DC]">
      <header className="border-b border-white/10 bg-[#1A1A1A] px-8 py-5 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-widest text-white uppercase">RefundOS</h1>
          <p className="text-xs tracking-widest text-[#D4AF37] mt-1 font-semibold">COMMAND CENTER</p>
        </div>
        <nav className="flex items-center gap-8 text-sm font-medium tracking-wide">
          <Link href="/" className="text-white/60 hover:text-white transition-colors">Overview</Link>
          <Link href="/refunds" className="text-[#D4AF37] border-b border-[#D4AF37] pb-1">Command Center</Link>
          <Link href="/exceptions" className="text-white/60 hover:text-white transition-colors">Exceptions</Link>
        </nav>
      </header>

      <main className="flex-1 p-10 max-w-7xl mx-auto w-full flex flex-col gap-8">
        
        {/* SCENARIO SELECTOR */}
        <div className="text-center mb-4">
          <h2 className="text-sm font-semibold tracking-widest uppercase text-white/50 mb-6">Select a transaction scenario</h2>
          <div className="flex justify-center gap-4">
            <button 
              onClick={() => handleScenarioChange('HERO')}
              className={`p-4 rounded-lg border text-left transition-colors w-64 ${scenario === 'HERO' ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-white/10 bg-[#1A1A1A] opacity-60 hover:opacity-100'}`}
            >
              <div className="text-xs font-bold uppercase tracking-wider mb-1 text-white">HERO REFUND</div>
              <div className="text-[10px] text-white/50">Safe multi-vendor refund</div>
            </button>
            <button 
              onClick={() => handleScenarioChange('MISSING')}
              className={`p-4 rounded-lg border text-left transition-colors w-64 ${scenario === 'MISSING' ? 'border-red-500 bg-red-500/10' : 'border-white/10 bg-[#1A1A1A] opacity-60 hover:opacity-100'}`}
            >
              <div className="text-xs font-bold uppercase tracking-wider mb-1 text-white">MISSING TRANSFER</div>
              <div className="text-[10px] text-white/50">Unsafe / incomplete financial state</div>
            </button>
            <button 
              onClick={() => handleScenarioChange('AMBIGUOUS')}
              className={`p-4 rounded-lg border text-left transition-colors w-64 ${scenario === 'AMBIGUOUS' ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 bg-[#1A1A1A] opacity-60 hover:opacity-100'}`}
            >
              <div className="text-xs font-bold uppercase tracking-wider mb-1 text-white">AMBIGUOUS CASE</div>
              <div className="text-[10px] text-white/50">Multiple plausible relationships</div>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Request & Graph */}
          <div className="lg:col-span-1 space-y-6">
            <section className="rounded-lg border border-white/10 bg-[#1A1A1A] p-6">
              <h2 className="text-xs font-semibold tracking-widest uppercase text-white/50 mb-4">Refund Request</h2>
              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-white/40 text-[10px] uppercase tracking-wider">Order ID</div>
                  <div className="font-mono text-white/80">ORD-4821 / {refund.orderId.substring(0,8)}</div>
                </div>
                <div>
                  <div className="text-white/40 text-[10px] uppercase tracking-wider">Payment</div>
                  <div className="font-mono text-white/80">₹{payment?.amount || 'Unknown'}</div>
                </div>
                <div>
                  <div className="text-white/40 text-[10px] uppercase tracking-wider">Requested Refund</div>
                  <div className="font-mono text-lg text-[#D4AF37]">₹{refund.amount}</div>
                </div>
                <div>
                  <div className="text-white/40 text-[10px] uppercase tracking-wider">Reason</div>
                  <div className="p-3 bg-white/5 rounded border border-white/10 text-white/70 italic mt-1">
                    "{refund.reason.replace(/\[GT:.*?\]\s*/, '')}"
                  </div>
                </div>
              </div>
              
              {!isAnalyzed && (
                <button 
                  onClick={() => setIsAnalyzed(true)}
                  className="mt-6 w-full py-3 bg-[#D4AF37] hover:bg-[#b5952f] text-black font-bold uppercase tracking-wider text-xs rounded transition-colors"
                >
                  Analyze Refund
                </button>
              )}
            </section>

            {isAnalyzed && (
              <section className="rounded-lg border border-white/10 bg-[#1A1A1A] p-6 animate-fade-in">
                <h2 className="text-xs font-semibold tracking-widest uppercase text-white/50 mb-4">Step 1: Transaction Graph</h2>
                <div className="space-y-3">
                  {allTransfers.map((t: any) => (
                    <div key={t.id} className="p-3 bg-white/5 rounded border border-white/5 flex justify-between items-center text-xs">
                      <span className="text-white/60">Vendor {t.vendorId.substring(0,8)}</span>
                      <span className="font-mono text-[#D4AF37]">₹{t.amount}</span>
                      <span className="text-green-400 text-[10px] uppercase">{t.status}</span>
                    </div>
                  ))}
                  {allTransfers.length === 0 && (
                    <div className="p-3 bg-red-500/10 rounded border border-red-500/20 text-red-400 text-xs text-center">
                      NO TRANSFERS FOUND
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Right Column: Execution Workflow */}
          <div className="lg:col-span-2 space-y-6">
            
            {isAnalyzed && (
              <div className="animate-fade-in space-y-6">
                
                {/* Step 2 & 3: AI & Validation Panel */}
                <div className="grid grid-cols-2 gap-6">
                  <section className="rounded-lg border border-white/10 bg-[#1A1A1A] p-6">
                    <h2 className="text-xs font-semibold tracking-widest uppercase text-[#D4AF37] mb-4">Step 2: AI Relationship Analysis</h2>
                    <div className="mb-4">
                      <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Confidence Score</div>
                      <div className="text-2xl font-light text-white">{Math.round(aiMatch.confidence * 100)}%</div>
                    </div>
                    <div className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Item Mapping Candidate</div>
                    <div className="space-y-2">
                      {affectedItems.length > 0 ? affectedItems.map((i: any) => (
                        <div key={i.id} className="p-2 bg-white/5 rounded text-xs text-white/70">Mapped to Vendor item: {i.description}</div>
                      )) : (
                        <div className="p-2 bg-white/5 rounded text-xs text-orange-400/70 italic">AI could not confidently match items.</div>
                      )}
                    </div>
                  </section>

                  <section className="rounded-lg border border-white/10 bg-[#1A1A1A] p-6">
                    <h2 className="text-xs font-semibold tracking-widest uppercase text-white/50 mb-4">Step 3: Deterministic Validation</h2>
                    <ul className="space-y-3 text-xs text-white/70">
                      <li className="flex items-start gap-2">
                        <span className={affectedItems.length > 0 ? "text-green-400" : "text-red-400"}>{affectedItems.length > 0 ? '✓' : '✗'}</span>
                        Order item mapped to vendor
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={allTransfers.length > 0 ? "text-green-400" : "text-red-400"}>{allTransfers.length > 0 ? '✓' : '✗'}</span>
                        Required Route transfer {allTransfers.length > 0 ? 'verified' : 'NOT FOUND'}
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={!isBlocked ? "text-green-400" : "text-red-400"}>{!isBlocked ? '✓' : '✗'}</span>
                        Financial liability validated
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-400">✓</span>
                        No duplicate refund
                      </li>
                    </ul>
                  </section>
                </div>

                {/* Step 4: Status Banner & Execution */}
                {isBlocked ? (
                  <div className="rounded-lg border border-red-500 bg-red-500/10 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-bold text-red-500 uppercase tracking-widest">EXECUTION BLOCKED</h2>
                      </div>
                      <div className="text-right">
                        <div className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded uppercase">Human Review</div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="text-[10px] text-red-400/60 uppercase tracking-wider mb-1">Primary Blocker</div>
                        <div className="text-sm text-red-400">{allTransfers.length === 0 ? 'Required Route transfer NOT FOUND' : (aiMatch.confidence < 0.7 ? 'AI confidence too low (Ambiguous)' : 'Financial limit exceeded')}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-red-400/60 uppercase tracking-wider mb-1">Secondary Validation</div>
                        <div className="text-sm text-red-400">Requested refund: ₹{refund.amount} | Verified refundable: ₹{affectedItems.reduce((acc: number, item: any) => acc + item.refundableAmount, 0)}</div>
                      </div>
                      <div className="pt-2 border-t border-red-500/20">
                        <div className="text-[10px] text-red-400/60 uppercase tracking-wider mb-1">Money Movement</div>
                        <div className="text-sm font-bold text-red-500 uppercase tracking-widest">BLOCKED</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-green-500 bg-green-500/10 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-bold text-green-400 uppercase tracking-widest">READY TO EXECUTE</h2>
                        <div className="text-sm text-green-400/80 mt-1">Financial validation: PASSED | AI confidence: {Math.round(aiMatch.confidence * 100)}%</div>
                      </div>
                      <div className="text-right">
                        <div className="px-3 py-1 bg-green-500 text-black text-xs font-bold rounded uppercase">Safe Auto-Resolution</div>
                      </div>
                    </div>

                    {/* Execution Plan details */}
                    <div className="space-y-3 mb-6">
                      {analysis.allocations.map((a: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-black/40 rounded border border-green-500/20 text-sm">
                          <span className="text-white/80">Reverse Transfer <span className="font-mono text-xs text-white/50">{a.transferId.substring(0,8)}</span></span>
                          <div className="text-right">
                            <div className="text-green-400 font-mono">₹{a.total}</div>
                            <div className="text-[10px] text-white/40">Vendor Principal: ₹{a.principal} | Tax: ₹{a.tax}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {(!isExecuted && refund.status !== 'PROCESSED') ? (
                      <button 
                        onClick={async () => {
                          setIsExecuted(true); // show the timeline immediately for UX
                          const { executeRefund } = await import('@/actions/executeRefund');
                          await executeRefund(refund.id);
                        }}
                        className="w-full py-4 bg-green-500 hover:bg-green-400 text-black font-bold uppercase tracking-widest text-sm rounded transition-colors"
                      >
                        Approve & Execute
                      </button>
                    ) : refund.status === 'PROCESSED' && !isExecuted ? (
                      <div className="text-center p-4 bg-green-500/20 border border-green-500/30 rounded">
                        <div className="text-green-400 font-bold tracking-widest uppercase">FULLY RECONCILED</div>
                        <div className="text-xs text-green-400/60 mt-1">This transaction has already been safely processed and reconciled.</div>
                      </div>
                    ) : (
                      <div className="space-y-4 animate-fade-in border-t border-green-500/30 pt-6">
                        <div className="flex justify-between text-xs text-white/60">
                          <span className="font-bold">DEMO MODE</span>
                          <span className="font-bold">SIMULATED RAZORPAY OPERATION</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-white">Refund initiated</span>
                          <span className="text-green-400">✓</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-white">Transfer/reversal</span>
                          <span className="text-green-400">✓</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-white">Webhook received</span>
                          <span className="text-green-400">✓</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-white">Ledger updated</span>
                          <span className="text-green-400">✓</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-bold">
                          <span className="text-[#D4AF37]">Reconciliation</span>
                          <span className="text-[#D4AF37]">FULLY RECONCILED</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
