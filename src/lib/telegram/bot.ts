import { Telegraf } from 'telegraf'
import { createClient as createSupabaseServiceClient } from '@supabase/supabase-js'
import { claude, CLAUDE_MODEL } from '@/lib/claude/client'

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!)

// Service role client for DB writes (bypasses RLS)
const supabase = createSupabaseServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Anon client for auth.signInWithPassword (service role skips auth)
const supabaseAuth = createSupabaseServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// In-memory conversation state per chat_id
const conversationState = new Map<number, { step: string; email?: string }>()

// /start command
bot.start(async (ctx) => {
  conversationState.delete(ctx.chat.id)
  await ctx.reply(
    '안녕하세요! DNEW 병원 마케팅 플랫폼입니다. 등록된 이메일 주소를 입력해주세요:'
  )
})

// Text message handler
bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id
  const text = ctx.message.text.trim()

  // ── Already verified: handle requests ──────────────────────────────────────
  const { data: verifiedOrg } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('telegram_chat_id', chatId)
    .eq('telegram_verified', true)
    .single()

  if (verifiedOrg) {
    try {
      const response = await claude.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: `다음 병원 마케팅 요청을 분석하고 JSON으로만 응답하세요 (다른 텍스트 없이):
{"category": "카테고리", "priority": "높음|보통|낮음", "estimated_time": "예상시간"}

카테고리 목록: 블로그, SNS콘텐츠, 광고, FAQ, 문자/카카오, 경쟁분석, 기타

요청: ${text}`,
          },
        ],
      })

      const raw = response.content[0].type === 'text' ? response.content[0].text : ''
      let category = '기타'
      let priority = '보통'
      let estimatedTime = '1-2일'

      try {
        const parsed = JSON.parse(raw)
        category = parsed.category ?? category
        priority = parsed.priority ?? priority
        estimatedTime = parsed.estimated_time ?? estimatedTime
      } catch {
        // keep defaults if parsing fails
      }

      await supabase.from('requests').insert({
        org_id: verifiedOrg.id,
        telegram_chat_id: chatId,
        message: text,
        category,
        priority,
        estimated_time: estimatedTime,
        status: 'pending',
      })

      await ctx.reply(
        `✅ 요청이 접수되었습니다!\n카테고리: ${category}\n우선순위: ${priority}\n예상 소요시간: ${estimatedTime}`
      )
    } catch (err) {
      console.error('Telegram bot request handling error:', err)
      await ctx.reply('요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    }
    return
  }

  // ── Step 2: awaiting password ───────────────────────────────────────────────
  const state = conversationState.get(chatId)

  if (state?.step === 'awaiting_password' && state.email) {
    const { error } = await supabaseAuth.auth.signInWithPassword({
      email: state.email,
      password: text,
    })

    if (error) {
      await ctx.reply('❌ 비밀번호가 올바르지 않습니다. 다시 시도해주세요.')
      return
    }

    // Password correct — find org and save telegram info
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('email', state.email)
      .single()

    if (org) {
      await supabase
        .from('organizations')
        .update({ telegram_chat_id: chatId, telegram_verified: true })
        .eq('id', org.id)
    }

    conversationState.delete(chatId)
    await ctx.reply('✅ 인증 완료! 이제 요청사항을 보내주세요.')
    return
  }

  // ── Step 1: expecting email ─────────────────────────────────────────────────
  if (EMAIL_REGEX.test(text)) {
    const { data: org } = await supabase
      .from('organizations')
      .select('id, email')
      .eq('email', text)
      .single()

    if (!org) {
      await ctx.reply(
        '❌ 등록된 병원을 찾을 수 없습니다. dnew.co.kr에서 먼저 가입해주세요.'
      )
      return
    }

    conversationState.set(chatId, { step: 'awaiting_password', email: text })
    await ctx.reply('✅ 이메일이 확인되었습니다. 비밀번호를 입력해주세요:')
    return
  }

  // ── Fallback ────────────────────────────────────────────────────────────────
  await ctx.reply('먼저 이메일 주소를 입력하여 병원을 인증해주세요.')
})

export default bot
