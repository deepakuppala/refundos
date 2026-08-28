import { prisma } from '../lib/prisma';
import { RefundLiabilityEngine } from './RefundLiabilityEngine';
import { ReconciliationAIService } from './ReconciliationAIService';

export class EvaluationService {
  static async getMetrics() {
    // 1. Total deterministic raw records in system
    const totalOrders = await prisma.order.count();
    const totalPayments = await prisma.payment.count();
    const totalTransfers = await prisma.transfer.count();
    const totalRecords = totalOrders + totalPayments + totalTransfers;

    // 2. Fetch all refunds to evaluate (these are the Evaluation Cases)
    const allRefunds = await prisma.refundRequest.findMany({
      include: {
        order: {
          include: { 
            items: true, 
            payments: { include: { transfers: { include: { vendor: true, settlements: true, reversals: true } } } } 
          }
        }
      }
    });

    let autoResolvedCount = 0;
    let humanReviewCount = 0;
    
    // For Precision/Recall
    let correctPositiveAutoMatches = 0; // The system auto-resolved, and GT was AUTO_RESOLVE
    let incorrectPositiveAutoMatches = 0; // The system auto-resolved, but GT was HUMAN_REVIEW (Unsafe)
    let groundTruthPositives = 0; // The GT was AUTO_RESOLVE

    const evaluationCases = allRefunds.length;
    
    for (const refund of allRefunds) {
      const payment = refund.order.payments.find(p => p.id === refund.paymentId);
      if (!payment) continue;

      const allTransfers = refund.order.payments.flatMap(p => p.transfers);
      const allSettlements = allTransfers.flatMap(t => t.settlements);
      
      // Parse Ground Truth
      const isGtAuto = refund.reason.includes('[GT:AUTO_RESOLVE]');
      const isGtHuman = refund.reason.includes('[GT:HUMAN_REVIEW]');
      if (isGtAuto) groundTruthPositives++;

      // Simulate AI Matching Step
      const aiMatch = await ReconciliationAIService.evaluateMatch(refund.reason, refund.amount, refund.order.items);
      const affectedItems = aiMatch.matchedItemIds.length > 0 
        ? refund.order.items.filter(i => aiMatch.matchedItemIds.includes(i.id))
        : [];

      const existingRefunds = allRefunds.filter(r => r.orderId === refund.orderId && r.id !== refund.id && r.status === 'PROCESSED');

      // Deterministic Validation Step
      const analysis = RefundLiabilityEngine.calculate(
        refund.order,
        affectedItems,
        payment,
        allTransfers,
        allSettlements,
        existingRefunds, // pass actual existing refunds
        [], // tax lines
        refund
      );

      if (analysis.decision === 'AUTO_RESOLVE') {
        autoResolvedCount++;
        if (isGtAuto) {
          correctPositiveAutoMatches++;
        } else if (isGtHuman) {
          incorrectPositiveAutoMatches++;
        }
      } else {
        humanReviewCount++;
      }
    }

    // Mathematical Definitions as per Priority 1:
    // Precision: Correct positive automatic matches / all automatic positive matches
    const allAutoMatches = correctPositiveAutoMatches + incorrectPositiveAutoMatches;
    const precision = allAutoMatches > 0 ? (correctPositiveAutoMatches / allAutoMatches) * 100 : (groundTruthPositives === 0 ? 100 : 0);
    
    // Recall: Correct positive automatic matches / all ground-truth positive matches
    const recall = groundTruthPositives > 0 ? (correctPositiveAutoMatches / groundTruthPositives) * 100 : 100;
    
    // Match Rate: Successfully reconciled eligible records / total eligible records
    const matchRate = evaluationCases > 0 ? (autoResolvedCount / evaluationCases) * 100 : 0;
    
    // Exception Rate: Records requiring human review / total eligible records
    const exceptionRate = evaluationCases > 0 ? (humanReviewCount / evaluationCases) * 100 : 0;

    return {
      totalRecords, // Raw rows
      evaluationCases, // Eligible records
      autoResolvedCount,
      humanReviewCount,
      matchRate,
      exceptionRate,
      precision,
      recall,
      unsafeAutoActions: incorrectPositiveAutoMatches
    };
  }
}
