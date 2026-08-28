export interface RefundPayload {
  paymentId: string;
  amount: number;
  notes?: Record<string, string>;
  receipt?: string;
}

export interface ReversalPayload {
  transferId: string;
  amount: number;
  notes?: Record<string, string>;
}

export class RazorpayService {
  static get isDemoMode(): boolean {
    return process.env.DEMO_MODE === 'true';
  }

  static async createRefund(_payload: RefundPayload): Promise<{ id: string; status: string }> {
    if (this.isDemoMode) {
      return { id: `rfnd_mock_${Date.now()}`, status: 'processed' };
    }

    // In a live integration, use node-fetch or Razorpay SDK here
    // const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
    // ...
    throw new Error('Live Razorpay credentials not configured');
  }

  static async createTransferReversal(_payload: ReversalPayload): Promise<{ id: string; status: string }> {
    if (this.isDemoMode) {
      return { id: `rev_mock_${Date.now()}`, status: 'processed' };
    }

    // Live mode implementation
    throw new Error('Live Razorpay credentials not configured');
  }

  static async fetchPayment(paymentId: string): Promise<unknown> {
    if (this.isDemoMode) {
      return { id: paymentId, status: 'captured', amount: 50000 };
    }
    throw new Error('Not implemented');
  }
}
