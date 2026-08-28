'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function executeRefund(refundId: string) {
  // Database execution boundary ensuring idempotency
  const result = await prisma.$transaction(async (tx) => {
    // 1. Check existing status
    const refund = await tx.refundRequest.findUnique({
      where: { id: refundId },
      include: {
        order: true,
        allocations: true
      }
    });

    if (!refund) {
      return { success: false, message: 'Refund not found', alreadyProcessed: false };
    }

    if (refund.status === 'PROCESSED' || refund.status === 'RECONCILED' || refund.status === 'EXECUTING') {
      return { success: false, message: 'REFUND ALREADY RECONCILED', alreadyProcessed: true };
    }

    // 2. Mark as executing to block concurrent requests
    await tx.refundRequest.update({
      where: { id: refundId },
      data: { status: 'EXECUTING' }
    });

    // 3. Simulate Razorpay operation
    // For demo purposes, we automatically record the reversal
    for (const alloc of refund.allocations) {
      await tx.reversal.create({
        data: {
          refundRequestId: refundId,
          transferId: alloc.transferId,
          amount: alloc.totalAmount,
          status: 'PROCESSED',
          razorpayReversalId: 'sim_rev_' + Math.random().toString(36).substring(7)
        }
      });
    }

    // 4. Simulate Webhook Reception & Ledger Update
    await tx.webhookEvent.create({
      data: {
        razorpayEventId: 'evt_' + Math.random().toString(36).substring(7),
        eventType: 'refund.processed',
        payload: JSON.stringify({ refundId }),
        processed: true
      }
    });

    // 5. Final Reconciliation
    await tx.refundRequest.update({
      where: { id: refundId },
      data: { status: 'PROCESSED' } // or RECONCILED depending on terminology
    });

    return { success: true, message: 'EXECUTION COMPLETE', alreadyProcessed: false };
  });

  revalidatePath('/refunds');
  
  return result;
}
