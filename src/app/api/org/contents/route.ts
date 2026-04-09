import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb/client'
import { Content } from '@/lib/mongodb/models'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get('org_id')
    const limit = parseInt(searchParams.get('limit') || '10')
    const type = searchParams.get('type')

    if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

    await connectToDatabase()
    const query: Record<string, unknown> = { org_id: orgId }
    if (type) query.type = type

    const contents = await Content.find(query)
      .sort({ created_at: -1 })
      .limit(limit)
      .lean()

    return NextResponse.json(contents.map(c => ({ ...c, _id: String(c._id) })))
  } catch (error) {
    console.error('Contents fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch contents' }, { status: 500 })
  }
}
