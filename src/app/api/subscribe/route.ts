import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    // Check if already subscribed
    const existing = await db.subscriber.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'This email is already subscribed.' },
        { status: 409 }
      );
    }

    // Store in database
    await db.subscriber.create({ data: { email } });

    return NextResponse.json({
      success: true,
      message: `Welcome aboard! ${email} has been added to the Daily Briefing.`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
