import { prisma } from '@/lib/prisma';

export interface GraphNode {
  id: string;
  type: 'ORDER' | 'PAYMENT' | 'TRANSFER' | 'SETTLEMENT' | 'REFUND' | 'REVERSAL' | 'TAX';
  label: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export interface TransactionGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export class TransactionGraphService {
  static async buildFromOrderId(orderId: string): Promise<TransactionGraph> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payments: {
          include: {
            transfers: {
              include: {
                vendor: true,
                settlements: true,
                reversals: true
              }
            },
            refundReqs: {
              include: {
                allocations: { include: { vendor: true } },
                exceptions: true
              }
            }
          }
        }
      }
    });

    if (!order) throw new Error('Order not found');

    // Add Order node
    nodes.push({ id: order.id, type: 'ORDER', label: `ORDER ${order.id}`, amount: order.totalAmount });

    for (const payment of order.payments) {
      nodes.push({ id: payment.id, type: 'PAYMENT', label: `PAYMENT ${payment.razorpayPaymentId}`, amount: payment.amount });
      edges.push({ source: order.id, target: payment.id, label: 'has payment' });

      for (const transfer of payment.transfers) {
        nodes.push({ 
          id: transfer.id, 
          type: 'TRANSFER', 
          label: `TRANSFER ${transfer.razorpayTransferId} (Vendor: ${transfer.vendor.name})`, 
          amount: transfer.amount 
        });
        edges.push({ source: payment.id, target: transfer.id, label: 'split to' });

        for (const settlement of transfer.settlements) {
          nodes.push({ id: settlement.id, type: 'SETTLEMENT', label: 'SETTLEMENT', amount: settlement.amount });
          edges.push({ source: transfer.id, target: settlement.id, label: 'settled via' });
        }
        
        for (const reversal of transfer.reversals) {
          nodes.push({ id: reversal.id, type: 'REVERSAL', label: `REVERSAL ${reversal.razorpayReversalId || 'pending'}`, amount: reversal.amount });
          edges.push({ source: transfer.id, target: reversal.id, label: 'reversed' });
        }
      }

      for (const refund of payment.refundReqs) {
        nodes.push({ id: refund.id, type: 'REFUND', label: `REFUND (${refund.status})`, amount: refund.amount });
        edges.push({ source: payment.id, target: refund.id, label: 'refunds' });
        
        for (const allocation of refund.allocations) {
          nodes.push({ id: allocation.id, type: 'TAX', label: `TAX ADJ / ALLOCATION (Vendor: ${allocation.vendor.name})`, amount: allocation.totalAmount });
          edges.push({ source: refund.id, target: allocation.id, label: 'allocated to' });
        }
      }
    }

    return { nodes, edges };
  }
}
