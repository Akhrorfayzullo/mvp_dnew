import { NextRequest, NextResponse } from 'next/server'
import bot from '@/lib/telegram/bot'

export async function POST(req: NextRequest) {
  try {
    const update = await req.json()
    await bot.handleUpdate(update)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Telegram webhook error:', err)
    // Always return 200 to prevent Telegram from retrying indefinitely
    return NextResponse.json({ ok: true })
  }
}
