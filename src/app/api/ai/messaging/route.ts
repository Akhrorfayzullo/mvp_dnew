import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { connectToDatabase } from '@/lib/mongodb/client'
import { Content } from '@/lib/mongodb/models'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a Korean hospital patient messaging expert. Write compliant KakaoTalk messages.

Return ONLY this exact JSON, no markdown:
{
  "kakao": "<KakaoTalk message in Korean, 2-4 sentences, friendly, includes 수신거부 at end>",
  "sms": "<SMS in Korean, under 90 chars>",
  "compliance": "<1 Korean sentence confirming compliance>"
}

Message type guidelines:
- VIP 리콜: 감사 인사 + 재방문 유도 (가격 직접 언급 금지)
- 이탈환자 윈백: 부드러운 안부 + 근황 확인
- 시술 후 주의사항: 회복 안내 + 주의사항
- 이벤트 안내: 정보성 위주 (과장 금지)
- 예약 리마인더: 간결하고 명확한 정보`

function parseJSON(text: string) {
  const stripped = text.trim()
  const block = stripped.match(/```(?:json)?\s*([\s\S]*?)```/)
  return JSON.parse(block ? block[1].trim() : stripped)
}

const TYPE_LABELS: Record<string, string> = {
  vip_recall: 'VIP 리콜',
  win_back: '이탈환자 윈백',
  post_procedure: '시술 후 주의사항',
  event: '이벤트 안내',
  reminder: '예약 리마인더',
}

export async function POST(req: NextRequest) {
  const { type, treatment, hospital_name, org_id } = await req.json()

  if (!type || !treatment?.trim()) {
    return NextResponse.json({ error: '메시지 유형과 시술명을 입력해주세요' }, { status: 400 })
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `병원명: ${hospital_name || '병원'}\n메시지 유형: ${TYPE_LABELS[type] || type}\n시술/서비스: ${treatment}\n\n환자 메시지를 작성해주세요.`,
    }],
  })

  const raw = message.content[0]
  if (raw.type !== 'text') return NextResponse.json({ error: 'Unexpected Claude response' }, { status: 500 })
  const result = parseJSON(raw.text)

  // MongoDB (non-blocking)
  if (org_id) {
    try {
      await connectToDatabase()
      await Content.create({
        org_id, type: 'sms',
        title: `${TYPE_LABELS[type]} - ${treatment}`,
        body: result.kakao, status: 'draft',
        metadata: { type, treatment, sms: result.sms },
      })
    } catch (err) { console.error('[messaging] MongoDB failed (non-fatal):', err) }
  }

  // Credits (non-blocking)
  let newCreditBalance: number | null = null
  if (org_id) {
    try {
      const supabase = await createClient()
      const { data: org } = await supabase.from('organizations').select('credit_balance').eq('id', org_id).single()
      if (org && org.credit_balance >= 5) {
        const bal = org.credit_balance - 5
        await supabase.from('organizations').update({ credit_balance: bal }).eq('id', org_id)
        await supabase.from('credit_transactions').insert({ org_id, amount: -5, type: 'usage', description: '환자 메시지 생성' })
        newCreditBalance = bal
      }
    } catch (err) { console.error('[messaging] Credits failed (non-fatal):', err) }
  }

  return NextResponse.json({ ...result, ...(newCreditBalance !== null ? { newCreditBalance } : {}) })
}
