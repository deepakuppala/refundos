import { prisma } from '@/lib/prisma';
import { RefundLiabilityEngine } from '@/services/RefundLiabilityEngine';
import { ReconciliationAIService } from '@/services/ReconciliationAIService';
import CommandCenterClient from './CommandCenterClient';

async function buildCasePayload(refund: any, allRefunds: any[]) {
  if (!refund) return null;

  const payment = refund.order.payments.find((p: any) => p.id === refund.paymentId);
  const allTransfers = refund.order.payments.flatMap((p: any) => p.transfers);
  
  const aiMatch = await ReconciliationAIService.evaluateMatch(refund.reason, refund.amount, refund.order.items);
  const affectedItems = aiMatch.matchedItemIds.length > 0 
    ? refund.order.items.filter((i: any) => aiMatch.matchedItemIds.includes(i.id))
    : [];

  const existingRefunds = allRefunds.filter(r => r.orderId === refund.orderId && r.id !== refund.id && r.status === 'PROCESSED');

  const analysis = RefundLiabilityEngine.calculate(
    refund.order,
    affectedItems,
    payment!,
    allTransfers,
    allTransfers.flatMap((t: any) => t.settlements),
    existingRefunds,
    [],
    refund
  );

  return {
    refund,
    payment,
    allTransfers,
    aiMatch,
    affectedItems,
    analysis,
    isBlocked: analysis.decision === 'HUMAN_REVIEW'
  };
}

export default async function CommandCenter() {
  const includeQuery = {
    order: {
      include: { 
        items: true, 
        payments: { include: { transfers: { include: { vendor: true, settlements: true, reversals: true } } } } 
      }
    }
  };

  // Fetch the 3 explicitly requested cases
  const heroRefund = await prisma.refundRequest.findFirst({
    where: { reason: { contains: 'Returned defective clothing item' } },
    include: includeQuery
  });

  const missingRefund = await prisma.refundRequest.findFirst({
    where: { reason: { contains: 'Missing transfer anomaly' } },
    include: includeQuery
  });

  const ambiguousRefund = await prisma.refundRequest.findFirst({
    where: { reason: { contains: 'The audio device is broken' } },
    include: includeQuery
  });

  const allRefunds = await prisma.refundRequest.findMany();

  const heroCase = await buildCasePayload(heroRefund, allRefunds);
  const missingCase = await buildCasePayload(missingRefund, allRefunds);
  const ambiguousCase = await buildCasePayload(ambiguousRefund, allRefunds);

  return <CommandCenterClient heroCase={heroCase} missingCase={missingCase} ambiguousCase={ambiguousCase} />;
}
