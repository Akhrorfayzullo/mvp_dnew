import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import bot from '@/lib/telegram/bot'

const STATUS_MESSAGES: Record<string, string> = {
  in_progress: '🔄 요청이 진행 중입니다.',
  completed: '✅ 요청이 완료되었습니다. 감사합니다!',
  pending: '⏳ 요청이 대기 중으로 변경되었습니다.',
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { status, assigned_to } = body

  if (!status) {
    return NextResponse.json({ error: 'status is required' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  const updates: Record<string, string> = { status }
  if (assigned_to !== undefined) updates.assigned_to = assigned_to

  const { data: request, error } = await supabase
    .from('requests')
    .update(updates)
    .eq('id', id)
    .select('telegram_chat_id, message, category')
    .single()

  if (error || !request) {
    return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 })
  }

  // Send Telegram notification if the hospital has a chat_id
  if (request.telegram_chat_id) {
    const text = STATUS_MESSAGES[status] ?? `상태가 "${status}"로 변경되었습니다.`
    try {
      await bot.telegram.sendMessage(
        request.telegram_chat_id,
        `${text}\n\n요청 내용: ${request.message}`
      )
    } catch (err) {
      // Log but don't fail — DB update already succeeded
      console.error('Telegram notification failed:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
