import { NextResponse } from 'next/server';
import { generateDataset } from '@/lib/syntheticData';

export async function POST() {
  try {
    const result = await generateDataset();
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
