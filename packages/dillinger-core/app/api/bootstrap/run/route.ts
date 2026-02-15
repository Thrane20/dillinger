import { NextResponse } from 'next/server';

import { ensureDillingerCoreScaffold } from '@/lib/services/bootstrap';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await ensureDillingerCoreScaffold();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
