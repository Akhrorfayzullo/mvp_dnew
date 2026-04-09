import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { connectToDatabase } from '@/lib/mongodb/client'
import { Content } from '@/lib/mongodb/models'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You are a Korean medical advertising compliance expert specializing in 의료법 제56조 (Medical Law Article 56). Analyze the given Korean hospital ad text for violations.

Respond ONLY in this exact JSON format, no markdown:
{
  "score": <0-100 compliance score>,
  "verdict": "<PASS or FAIL>",
  "violations": [
    {
      "severity": "<HIGH or MID or LOW>",
      "issue": "<Korean: what the violation is, 1 sentence>",
      "fix": "<Korean: suggested correction, 1 sentence>"
    }
  ],
  "summary": "<Korean: 1-2 sentence overall assessment>"
}

HIGH violations: 치료 효과 보장, 부작용 없음, 무료 시술, 타 병원 비교
MID violations: 최상급 표현, 할인 조건 미명시
LOW violations: 주의사항 누락, 개인차 미언급
If no violations return empty array and score 90-100.`

export async function POST(req: NextRequest) {
  const { text, org_id } = await req.json()

  if (!text?.trim()) {
    return NextResponse.json({ error: '광고 텍스트를 입력해주세요' }, { status: 400 })
  }

  // 1. Call Claude — this must succeed or we return 500
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `다음 의료 광고 텍스트를 분석해주세요:\n\n${text}` }],
  })

  const raw = message.content[0]
  if (raw.type !== 'text') {
    return NextResponse.json({ error: 'Claude returned unexpected response type' }, { status: 500 })
  }

  const stripped = raw.text.trim()
  const codeBlock = stripped.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr = codeBlock ? codeBlock[1].trim() : stripped
  const result = JSON.parse(jsonStr) as {
    score: number
    verdict: 'PASS' | 'FAIL'
    violations: Array<{ severity: string; issue: string; fix: string }>
    summary: string
  }

  // 2. Save to MongoDB — non-blocking
  let savedId: string | null = null
  if (org_id) {
    try {
      await connectToDatabase()
      const saved = await Content.create({
        org_id,
        type: 'compliance_check',
        title: text.substring(0, 60) + (text.length > 60 ? '...' : ''),
        body: text,
        compliance_score: result.score,
        status: result.verdict === 'PASS' ? 'approved' : 'draft',
        metadata: result,
      })
      savedId = String(saved._id)
    } catch (err) {
      console.error('[compliance] MongoDB save failed (non-fatal):', err)
    }
  }

  // 3. Deduct 3 credits — non-blocking
  let newCreditBalance: number | null = null
  if (org_id) {
    try {
      const supabase = await createClient()
      const { data: org } = await supabase
        .from('organizations')
        .select('credit_balance')
        .eq('id', org_id)
        .single()

      if (org && org.credit_balance >= 3) {
        const newBalance = org.credit_balance - 3
        await supabase
          .from('organizations')
          .update({ credit_balance: newBalance })
          .eq('id', org_id)

        await supabase.from('credit_transactions').insert({
          org_id,
          amount: -3,
          type: 'usage',
          description: '광고 적합성 검사',
        })

        newCreditBalance = newBalance
      }
    } catch (err) {
      console.error('[compliance] Credit deduction failed (non-fatal):', err)
    }
  }

  return NextResponse.json({
    ...result,
    ...(savedId ? { id: savedId } : {}),
    ...(newCreditBalance !== null ? { newCreditBalance } : {}),
  })
}
