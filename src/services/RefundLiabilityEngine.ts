import { Order, OrderItem, Payment, Transfer, Settlement, TaxLine, RefundRequest } from '@prisma/client';

export interface RefundAllocationResult {
  vendorId: string;
  principal: number;
  tax: number;
  total: number;
  transferId: string;
}

export interface LiabilityEngineOutput {
  refundAmount: number;
  allocations: RefundAllocationResult[];
  platformExposure: number;
  duplicateRefund: boolean;
  confidence: number;
  decision: 'AUTO_RESOLVE' | 'HUMAN_REVIEW';
  explanation: string;
}

export class RefundLiabilityEngine {
  static calculate(
    order: Order,
    items: OrderItem[],
    payment: Payment,
    transfers: Transfer[],
    settlements: Settlement[],
    existingRefunds: RefundRequest[],
    taxLines: TaxLine[],
    refundRequest: RefundRequest
  ): LiabilityEngineOutput {
    let confidence = 1.0;
    const explanations: string[] = [];
    let decision: 'AUTO_RESOLVE' | 'HUMAN_REVIEW' = 'AUTO_RESOLVE';
    let duplicateRefund = false;

    // 1. Check for Duplicate Refunds
    const similarRefund = existingRefunds.find(
      (r) => r.amount === refundRequest.amount && r.id !== refundRequest.id && r.status !== 'FAILED'
    );

    if (similarRefund) {
      duplicateRefund = true;
      confidence = 0.0;
      decision = 'HUMAN_REVIEW';
      explanations.push(`Duplicate refund detected: overlaps with refund ${similarRefund.id}.`);
    }

    // 2. Identify Affected Items
    let affectedItemIds: string[] = [];
    try {
      affectedItemIds = JSON.parse(refundRequest.affectedItemIds);
    } catch {
      // ignore parse error
    }

    const allocations: RefundAllocationResult[] = [];
    let remainingRefundAmount = refundRequest.amount;

    if (affectedItemIds.length === 0) {
      confidence = 0.2;
      decision = 'HUMAN_REVIEW';
      explanations.push('No specific items were associated with this refund request.');
    } else {
      for (const itemId of affectedItemIds) {
        const item = items.find((i) => i.id === itemId);
        if (!item) continue;

        const transfer = transfers.find((t) => t.vendorId === item.vendorId);
        
        if (!transfer) {
          confidence = 0.0;
          decision = 'HUMAN_REVIEW';
          explanations.push(`Refund maps to Vendor ${item.vendorId} but the expected Route transfer is missing.`);
          continue;
        }

        const allocationAmount = Math.min(item.refundableAmount, remainingRefundAmount);
        
        if (allocationAmount > 0) {
          allocations.push({
            vendorId: item.vendorId,
            principal: allocationAmount - item.taxAmount,
            tax: item.taxAmount,
            total: allocationAmount,
            transferId: transfer.id
          });
          remainingRefundAmount -= allocationAmount;
        }
      }
    }

    // 3. Check for excess refund
    if (remainingRefundAmount > 0 && affectedItemIds.length > 0) {
      confidence = 0.0;
      decision = 'HUMAN_REVIEW';
      explanations.push(`Requested refund exceeds the total refundable amount for the specified items by ${remainingRefundAmount}.`);
    }

    if (payment.status !== 'captured') {
      confidence = 0.0;
      decision = 'HUMAN_REVIEW';
      explanations.push('Payment is not fully captured.');
    }

    if (allocations.length > 0 && decision === 'AUTO_RESOLVE') {
      explanations.push(`Successfully mapped refund to ${allocations.length} vendor transfer(s).`);
      confidence = 0.984; // example high confidence score
    }

    return {
      refundAmount: refundRequest.amount,
      allocations,
      platformExposure: remainingRefundAmount > 0 ? remainingRefundAmount : 0, // platform covers remainder if forced
      duplicateRefund,
      confidence,
      decision,
      explanation: explanations.join(' ')
    };
  }
}
