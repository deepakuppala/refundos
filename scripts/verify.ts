import { prisma } from '../src/lib/prisma';
import { generateDataset } from '../src/lib/syntheticData';
import { RefundLiabilityEngine } from '../src/services/RefundLiabilityEngine';
import { EvaluationService } from '../src/services/EvaluationService';
import { TransactionGraphService } from '../src/services/TransactionGraphService';
import { ReconciliationAIService } from '../src/services/ReconciliationAIService';

async function verify() {
  console.log("=== STARTING VERIFICATION ===");
  
  try {
    // 1. Generate Data
    console.log("1. Generating Demo Data...");
    await generateDataset();
    const metrics = await EvaluationService.getMetrics();
    console.log("Generated Records:", metrics.totalRecords);
    
    // 2. Fetch Hero Refund (Order: ORD-4821 equivalent)
    // The synthetic data generator creates a clean case as the first order with Vendor A (20k), Vendor B (15k), Vendor C (10k).
    // Platform exposure is implicit (Total 50k, vendors = 45k, platform = 5k)
    // Refund request is 7080 for Vendor B items.
    
    console.log("2. Testing Hero Refund...");
    const heroRefund = await prisma.refundRequest.findFirst({
      where: { reason: { contains: 'Returned defective clothing item' } },
      include: {
        order: {
          include: {
            items: true,
            payments: { include: { transfers: { include: { vendor: true, settlements: true } } } }
          }
        }
      }
    });

    if (heroRefund) {
      const payment = heroRefund.order.payments[0];
      const transfers = payment?.transfers || [];
      const settlements = transfers.flatMap(t => t.settlements) || [];
      
      const aiMatch = await ReconciliationAIService.evaluateMatch(heroRefund.reason, heroRefund.amount, heroRefund.order.items);
      const affectedItems = heroRefund.order.items.filter(i => aiMatch.matchedItemIds.includes(i.id));

      const analysis = RefundLiabilityEngine.calculate(
        heroRefund.order, affectedItems, payment, transfers, settlements, [], [], heroRefund
      );
      
      console.log(`Hero Analysis Decision: ${analysis.decision}`);
      console.log(`Hero Confidence: ${analysis.confidence}`);
      console.log(`Allocations: ${JSON.stringify(analysis.allocations)}`);
    } else {
      console.log("Hero refund not found.");
    }
    
    // 3. Test Failure Case (Missing transfer)
    console.log("3. Testing Failure Case (Missing Transfer)...");
    const anomalyRefund = await prisma.refundRequest.findFirst({
      where: { reason: { contains: 'Missing transfer anomaly' } },
      include: {
        order: {
          include: {
            items: true,
            payments: { include: { transfers: { include: { vendor: true, settlements: true, reversals: true } } } }
          }
        }
      }
    });
    
    if (anomalyRefund) {
      const payment = anomalyRefund.order.payments.find(p => p.id === anomalyRefund.paymentId)!;
      const allTransfers = anomalyRefund.order.payments.flatMap(p => p.transfers);
      const allSettlements = allTransfers.flatMap(t => t.settlements);
      
      const analysisAnomaly = RefundLiabilityEngine.calculate(
        anomalyRefund.order,
        anomalyRefund.order.items,
        payment,
        allTransfers,
        allSettlements,
        [], // existing refunds
        [], // tax lines
        anomalyRefund
      );
      
      console.log("Anomaly Decision:", analysisAnomaly.decision);
      console.log("Anomaly Explanation:", analysisAnomaly.explanation);
    } else {
      console.log("Anomaly not found.");
    }
    
    // 4. Print overall evaluation metrics
    console.log("4. Overall Metrics:", JSON.stringify(metrics));
    
  } catch(e: any) {
    console.error("Verification failed:", e.message);
  } finally {
    console.log("=== END VERIFICATION ===");
  }
}

verify();
