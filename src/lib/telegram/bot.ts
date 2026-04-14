import { Telegraf } from 'telegraf'
import { createClient as createSupabaseServiceClient } from '@supabase/supabase-js'
import { claude, CLAUDE_MODEL } from '@/lib/claude/client'

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!)

// Use service role client to bypass RLS for bot operations
const supabase = createSupabaseServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// /start command
bot.start(async (ctx) => {
  await ctx.reply(
    '안녕하세요! DNEW 병원 마케팅 플랫폼입니다. 등록된 이메일 주소를 입력해주세요:'
  )
})

// Text message handler
bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id
  const text = ctx.message.text.trim()

  // Check if this chat is already verified
  const { data: verifiedOrg } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('telegram_chat_id', chatId)
    .eq('telegram_verified', true)
    .single()

  if (verifiedOrg) {
    // Already verified — categorize with Claude and save request
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

  // Not yet verified — check if input is an email
  if (EMAIL_REGEX.test(text)) {
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('email', text)
      .single()

    if (!org) {
      await ctx.reply(
        '❌ 등록된 병원을 찾을 수 없습니다. dnew.co.kr에서 먼저 가입해주세요.'
      )
      return
    }

    await supabase
      .from('organizations')
      .update({ telegram_chat_id: chatId, telegram_verified: true })
      .eq('id', org.id)

    await ctx.reply('✅ 인증 완료! 이제 요청사항을 보내주세요.')
    return
  }

  // Not verified and not an email
  await ctx.reply('먼저 이메일 주소를 입력하여 병원을 인증해주세요.')
})

export default bot
