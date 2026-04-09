import { NextRequest, NextResponse } from 'next/server'
import { claude, CLAUDE_MODEL } from '@/lib/claude/client'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { review, hospitalName } = await req.json()
    if (!review) return NextResponse.json({ error: 'Review is required' }, { status: 400 })

    const response = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `당신은 ${hospitalName || '병원'} 원장입니다. 다음 부정적인 리뷰에 대해 공감적이고 전문적인 답변을 한국어로 작성해주세요. 200자 이내로 작성하세요.\n\n리뷰: "${review}"\n\n답변만 작성하세요 (설명 없이).`,
      }],
    })

    const content = response.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    return NextResponse.json({ reply: content.text })
  } catch (error) {
    console.error('Reply generation error:', error)
    return NextResponse.json({ error: '답변 생성 중 오류가 발생했습니다' }, { status: 500 })
  }
}
