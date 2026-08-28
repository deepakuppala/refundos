import { NextResponse } from 'next/server';
import { resetDataset } from '@/lib/syntheticData';

export async function POST() {
  try {
    await resetDataset();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
