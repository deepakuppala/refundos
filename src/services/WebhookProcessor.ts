import { prisma } from '@/lib/prisma';

export class WebhookProcessor {
  static async process(eventId: string, eventType: string, payload: unknown) {
    // 1. Deduplicate
    const existing = await prisma.webhookEvent.findUnique({ where: { razorpayEventId: eventId } });
    if (existing) {
      return { status: 'already_processed' };
    }

    // 2. Store raw event
    const event = await prisma.webhookEvent.create({
      data: {
        razorpayEventId: eventId,
        eventType,
        payload: JSON.stringify(payload)
      }
    });

    try {
      // 3. Process based on event type
      switch (eventType) {
        case 'refund.processed':
          await this.handleRefundProcessed(payload);
          break;
        case 'transfer.processed':
          // ... handle transfer processed
          break;
        default:
          break;
      }

      // Mark processed
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { processed: true }
      });

      // 4. Append audit log
      await prisma.auditLog.create({
        data: {
          actor: 'WebhookProcessor',
          action: 'PROCESS_WEBHOOK',
          entityType: 'WebhookEvent',
          entityId: event.id,
          beforeState: '{}',
          afterState: JSON.stringify({ processed: true }),
          explanation: `Successfully processed ${eventType}`
        }
      });

      return { status: 'success' };
    } catch (e: unknown) {
      // If it fails, we keep processed=false
      throw e;
    }
  }

  private static async handleRefundProcessed(payload: unknown) {
    if (typeof payload === 'object' && payload !== null && 'entity' in payload) {
      const p = payload as { entity?: { id?: string } };
      const _refundId = p.entity?.id;
    }
  }
}
