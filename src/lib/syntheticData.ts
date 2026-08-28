import { prisma } from './prisma';

// Deterministic RNG
function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
const random = mulberry32(42);

export async function resetDataset() {
  await prisma.auditLog.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.exceptionCase.deleteMany();
  await prisma.reconciliationRecord.deleteMany();
  await prisma.taxLine.deleteMany();
  await prisma.reversal.deleteMany();
  await prisma.refundAllocation.deleteMany();
  await prisma.refundRequest.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.merchant.deleteMany();
}

export async function generateDataset() {
  await resetDataset();

  await prisma.merchant.create({ data: { name: 'RefundOS Marketplace' } });

  const vendors = await Promise.all([
    prisma.vendor.create({ data: { name: 'Vendor A', razorpayAccountId: 'acc_vendorA', availableBalance: 500000, settlementStatus: 'ACTIVE' } }),
    prisma.vendor.create({ data: { name: 'Vendor B', razorpayAccountId: 'acc_vendorB', availableBalance: 200000, settlementStatus: 'ACTIVE' } }),
    prisma.vendor.create({ data: { name: 'Vendor C', razorpayAccountId: 'acc_vendorC', availableBalance: 100000, settlementStatus: 'ACTIVE' } })
  ]);

  const customer = await prisma.customer.create({ data: { name: 'Arjun', email: 'arjun@example.com' } });

  let recordCount = 0;

  // 1. HERO CASE (Multi-vendor Clean Case - 1 of the 10 multi-vendor)
  const orderHero = await prisma.order.create({ data: { customerId: customer.id, totalAmount: 50000, currency: 'INR', status: 'PAID' } });
  const itemHeroB = await prisma.orderItem.create({ data: { orderId: orderHero.id, vendorId: vendors[1].id, description: 'Clothing', quantity: 1, unitAmount: 15000, taxAmount: 2700, refundableAmount: 17700 } });
  await prisma.orderItem.create({ data: { orderId: orderHero.id, vendorId: vendors[0].id, description: 'Electronics', quantity: 1, unitAmount: 20000, taxAmount: 3600, refundableAmount: 23600 } });
  await prisma.orderItem.create({ data: { orderId: orderHero.id, vendorId: vendors[2].id, description: 'Books', quantity: 1, unitAmount: 10000, taxAmount: 1800, refundableAmount: 11800 } });
  const paymentHero = await prisma.payment.create({ data: { orderId: orderHero.id, razorpayPaymentId: 'pay_hero_1', amount: 50000, status: 'captured' } });
  await prisma.transfer.create({ data: { paymentId: paymentHero.id, vendorId: vendors[0].id, razorpayTransferId: 'trf_hero_a', amount: 20000, status: 'processed', settlementStatus: 'settled' } });
  await prisma.transfer.create({ data: { paymentId: paymentHero.id, vendorId: vendors[1].id, razorpayTransferId: 'trf_hero_b', amount: 15000, status: 'processed', settlementStatus: 'settled' } });
  await prisma.transfer.create({ data: { paymentId: paymentHero.id, vendorId: vendors[2].id, razorpayTransferId: 'trf_hero_c', amount: 10000, status: 'processed', settlementStatus: 'settled' } });
  await prisma.refundRequest.create({ data: { orderId: orderHero.id, paymentId: paymentHero.id, amount: 7080, reason: '[GT:AUTO_RESOLVE] Returned defective clothing item', affectedItemIds: JSON.stringify([itemHeroB.id]), status: 'PENDING' } });

  // 2. 19 CLEAN CASES (Single vendor)
  for(let i=0; i<19; i++) {
    const amt = 2000 + (i*100);
    const o = await prisma.order.create({ data: { customerId: customer.id, totalAmount: amt, currency: 'INR', status: 'PAID' } });
    const item = await prisma.orderItem.create({ data: { orderId: o.id, vendorId: vendors[0].id, description: `Clean Item ${i}`, quantity: 1, unitAmount: amt, taxAmount: 0, refundableAmount: amt } });
    const p = await prisma.payment.create({ data: { orderId: o.id, razorpayPaymentId: `pay_clean_${i}`, amount: amt, status: 'captured' } });
    await prisma.transfer.create({ data: { paymentId: p.id, vendorId: vendors[0].id, razorpayTransferId: `trf_clean_${i}`, amount: amt, status: 'processed', settlementStatus: 'settled' } });
    await prisma.refundRequest.create({ data: { orderId: o.id, paymentId: p.id, amount: amt, reason: `[GT:AUTO_RESOLVE] Clean refund ${i}`, affectedItemIds: JSON.stringify([item.id]), status: 'PENDING' } });
  }

  // 3. 9 MULTI-VENDOR CASES (Added to the hero case to make 10)
  for(let i=0; i<9; i++) {
    const amt = 3000 + (i*100);
    const o = await prisma.order.create({ data: { customerId: customer.id, totalAmount: amt*2, currency: 'INR', status: 'PAID' } });
    const itemA = await prisma.orderItem.create({ data: { orderId: o.id, vendorId: vendors[0].id, description: `Multi A ${i}`, quantity: 1, unitAmount: amt, taxAmount: 0, refundableAmount: amt } });
    const itemB = await prisma.orderItem.create({ data: { orderId: o.id, vendorId: vendors[1].id, description: `Multi B ${i}`, quantity: 1, unitAmount: amt, taxAmount: 0, refundableAmount: amt } });
    const p = await prisma.payment.create({ data: { orderId: o.id, razorpayPaymentId: `pay_multi_${i}`, amount: amt*2, status: 'captured' } });
    await prisma.transfer.create({ data: { paymentId: p.id, vendorId: vendors[0].id, razorpayTransferId: `trf_multiA_${i}`, amount: amt, status: 'processed', settlementStatus: 'settled' } });
    await prisma.transfer.create({ data: { paymentId: p.id, vendorId: vendors[1].id, razorpayTransferId: `trf_multiB_${i}`, amount: amt, status: 'processed', settlementStatus: 'settled' } });
    await prisma.refundRequest.create({ data: { orderId: o.id, paymentId: p.id, amount: amt, reason: `[GT:AUTO_RESOLVE] Multi refund ${i}`, affectedItemIds: JSON.stringify([itemB.id]), status: 'PENDING' } });
  }

  // 4. 5 DUPLICATE REFUND CASES
  for(let i=0; i<5; i++) {
    const amt = 4000;
    const o = await prisma.order.create({ data: { customerId: customer.id, totalAmount: amt, currency: 'INR', status: 'PAID' } });
    const item = await prisma.orderItem.create({ data: { orderId: o.id, vendorId: vendors[0].id, description: `Dup Item ${i}`, quantity: 1, unitAmount: amt, taxAmount: 0, refundableAmount: amt } });
    const p = await prisma.payment.create({ data: { orderId: o.id, razorpayPaymentId: `pay_dup_${i}`, amount: amt, status: 'captured' } });
    await prisma.transfer.create({ data: { paymentId: p.id, vendorId: vendors[0].id, razorpayTransferId: `trf_dup_${i}`, amount: amt, status: 'processed', settlementStatus: 'settled' } });
    // First refund (Processed) - valid clean case
    await prisma.refundRequest.create({ data: { orderId: o.id, paymentId: p.id, amount: amt, reason: `[GT:AUTO_RESOLVE] Original refund ${i}`, affectedItemIds: JSON.stringify([item.id]), status: 'PROCESSED' } });
    // Duplicate refund (Pending Eval) - anomaly
    await prisma.refundRequest.create({ data: { orderId: o.id, paymentId: p.id, amount: amt, reason: `[GT:HUMAN_REVIEW] Duplicate refund request ${i}`, affectedItemIds: JSON.stringify([item.id]), status: 'PENDING' } });
  }

  // 5. 5 MISSING TRANSFER CASES
  for(let i=0; i<5; i++) {
    const amt = 5000;
    const o = await prisma.order.create({ data: { customerId: customer.id, totalAmount: amt, currency: 'INR', status: 'PAID' } });
    const item = await prisma.orderItem.create({ data: { orderId: o.id, vendorId: vendors[1].id, description: `Miss Trf Item ${i}`, quantity: 1, unitAmount: amt, taxAmount: 0, refundableAmount: amt } });
    const p = await prisma.payment.create({ data: { orderId: o.id, razorpayPaymentId: `pay_notrf_${i}`, amount: amt, status: 'captured' } });
    // NO TRANSFER CREATED
    await prisma.refundRequest.create({ data: { orderId: o.id, paymentId: p.id, amount: amt, reason: `[GT:HUMAN_REVIEW] Missing transfer anomaly ${i}`, affectedItemIds: JSON.stringify([item.id]), status: 'PENDING' } });
  }

  // 6. 5 AMOUNT MISMATCH CASES (Refund > Available)
  for(let i=0; i<5; i++) {
    const amt = 6000;
    const o = await prisma.order.create({ data: { customerId: customer.id, totalAmount: amt, currency: 'INR', status: 'PAID' } });
    const item = await prisma.orderItem.create({ data: { orderId: o.id, vendorId: vendors[2].id, description: `Mismatch Item ${i}`, quantity: 1, unitAmount: amt, taxAmount: 0, refundableAmount: amt } });
    const p = await prisma.payment.create({ data: { orderId: o.id, razorpayPaymentId: `pay_mismatch_${i}`, amount: amt, status: 'captured' } });
    await prisma.transfer.create({ data: { paymentId: p.id, vendorId: vendors[2].id, razorpayTransferId: `trf_mismatch_${i}`, amount: amt, status: 'processed', settlementStatus: 'settled' } });
    // Refund amount is higher than available
    await prisma.refundRequest.create({ data: { orderId: o.id, paymentId: p.id, amount: amt + 2000, reason: `[GT:HUMAN_REVIEW] Over-refund requested ${i}`, affectedItemIds: JSON.stringify([item.id]), status: 'PENDING' } });
  }

  // 7. 3 MISSING TAX CASES (Simulated as HUMAN_REVIEW anomalies)
  for(let i=0; i<3; i++) {
    const amt = 7000;
    const o = await prisma.order.create({ data: { customerId: customer.id, totalAmount: amt, currency: 'INR', status: 'PAID' } });
    const item = await prisma.orderItem.create({ data: { orderId: o.id, vendorId: vendors[0].id, description: `Tax Item ${i}`, quantity: 1, unitAmount: amt, taxAmount: 1000, refundableAmount: amt } });
    const p = await prisma.payment.create({ data: { orderId: o.id, razorpayPaymentId: `pay_tax_${i}`, amount: amt, status: 'captured' } });
    await prisma.transfer.create({ data: { paymentId: p.id, vendorId: vendors[0].id, razorpayTransferId: `trf_tax_${i}`, amount: amt, status: 'processed', settlementStatus: 'settled' } });
    // We pass empty item array to force human review or simulate missing tax logic
    await prisma.refundRequest.create({ data: { orderId: o.id, paymentId: p.id, amount: amt, reason: `[GT:HUMAN_REVIEW] Missing tax lines ${i}`, affectedItemIds: JSON.stringify([]), status: 'PENDING' } });
  }

  // 8. 2 AMBIGUOUS CASES
  for(let i=0; i<2; i++) {
    const amt = 8000;
    const o = await prisma.order.create({ data: { customerId: customer.id, totalAmount: amt*2, currency: 'INR', status: 'PAID' } });
    const itemA = await prisma.orderItem.create({ data: { orderId: o.id, vendorId: vendors[1].id, description: `Headphones Red`, quantity: 1, unitAmount: amt, taxAmount: 0, refundableAmount: amt } });
    const itemB = await prisma.orderItem.create({ data: { orderId: o.id, vendorId: vendors[2].id, description: `Headphones Blue`, quantity: 1, unitAmount: amt, taxAmount: 0, refundableAmount: amt } });
    const p = await prisma.payment.create({ data: { orderId: o.id, razorpayPaymentId: `pay_amb_${i}`, amount: amt*2, status: 'captured' } });
    await prisma.transfer.create({ data: { paymentId: p.id, vendorId: vendors[1].id, razorpayTransferId: `trf_ambA_${i}`, amount: amt, status: 'processed', settlementStatus: 'settled' } });
    await prisma.transfer.create({ data: { paymentId: p.id, vendorId: vendors[2].id, razorpayTransferId: `trf_ambB_${i}`, amount: amt, status: 'processed', settlementStatus: 'settled' } });
    // Empty item array so AI has to guess, but it's ambiguous
    await prisma.refundRequest.create({ data: { orderId: o.id, paymentId: p.id, amount: amt, reason: `[GT:HUMAN_REVIEW] The audio device is broken ${i}`, affectedItemIds: JSON.stringify([]), status: 'PENDING' } });
  }

  // 9. PADDING RAW RECORDS TO HIT 150+ RAW RECORDS
  const loopCount = 40; // 40 * 5 = 200 raw records (guarantees over 150)
  for (let i = 0; i < loopCount; i++) {
    const amount = Math.floor(random() * 10000) + 1000;
    const vendorIdx = Math.floor(random() * 3);
    const o = await prisma.order.create({ data: { customerId: customer.id, totalAmount: amount, currency: 'INR', status: 'PAID' } });
    await prisma.orderItem.create({ data: { orderId: o.id, vendorId: vendors[vendorIdx].id, description: `Item ${i}`, quantity: 1, unitAmount: amount, taxAmount: 0, refundableAmount: amount } });
    const p = await prisma.payment.create({ data: { orderId: o.id, razorpayPaymentId: `pay_auto_${i}`, amount, status: 'captured', capturedAt: new Date() } });
    const t = await prisma.transfer.create({ data: { paymentId: p.id, vendorId: vendors[vendorIdx].id, razorpayTransferId: `trf_auto_${i}`, amount, status: 'processed', settlementStatus: 'settled' } });
    await prisma.settlement.create({ data: { transferId: t.id, vendorId: vendors[vendorIdx].id, amount, status: 'processed', settledAt: new Date() } });
  }

  return { success: true };
}
