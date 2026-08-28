import { NextResponse } from 'next/server';
import { EvaluationService } from '@/services/EvaluationService';

export async function GET() {
  try {
    const metrics = await EvaluationService.getMetrics();
    return NextResponse.json(metrics);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
