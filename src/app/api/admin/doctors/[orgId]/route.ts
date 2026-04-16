import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const DOCTOR_SEEDS = [
  { suffix: '의사 A', short: 'A', color: '#2563EB', bg_color: '#EFF6FF', bdr_color: '#BFDBFE', sort_order: 0 },
  { suffix: '의사 B', short: 'B', color: '#059669', bg_color: '#F0FDF4', bdr_color: '#BBF7D0', sort_order: 1 },
  { suffix: '의사 C', short: 'C', color: '#B45309', bg_color: '#FFFBEB', bdr_color: '#FDE68A', sort_order: 2 },
  { suffix: '의사 D', short: 'D', color: '#7C3AED', bg_color: '#F5F3FF', bdr_color: '#DDD6FE', sort_order: 3 },
]

// GET /api/admin/doctors/[orgId]
// Returns doctors for a hospital. Auto-seeds 4 if none exist.
export async function GET(
  _req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const supabase = await createServiceClient()
  const { orgId } = params

  // eslint-disable-next-line prefer-const
  let { data: doctors, error: fetchError } = await supabase
    .from('hospital_doctors')
    .select('*')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true })

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  // Auto-seed 4 doctors if none exist
  if (!doctors || doctors.length === 0) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single()

    const hospitalName = org?.name ?? '병원'

    const seeds = DOCTOR_SEEDS.map((s) => ({
      org_id:           orgId,
      name:             `${hospitalName} ${s.suffix}`,
      short_name:       s.short,
      color:            s.color,
      bg_color:         s.bg_color,
      bdr_color:        s.bdr_color,
      sort_order:       s.sort_order,
      start_date:       '1900-01-01',
      end_date:         null,
      regular_off_days: '',
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('hospital_doctors')
      .insert(seeds)
      .select()

    if (insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })

    doctors = inserted
  }

  return NextResponse.json({ doctors })
}

// PUT /api/admin/doctors/[orgId]
// Body: { doctors: { id?, name, short_name, color, bg_color, bdr_color, sort_order, start_date, end_date, regular_off_days }[] }
export async function PUT(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const supabase = await createServiceClient()
  const { orgId } = params
  const body = await req.json()
  const incoming: {
    id?: string
    name: string
    short_name: string
    color: string
    bg_color: string
    bdr_color: string
    sort_order: number
    start_date: string
    end_date: string | null
    regular_off_days: string
  }[] = body.doctors ?? []

  if (incoming.length === 0)
    return NextResponse.json({ error: '의사 목록이 비어있습니다.' }, { status: 400 })

  // Get existing doctor IDs for this org
  const { data: existing } = await supabase
    .from('hospital_doctors')
    .select('id')
    .eq('org_id', orgId)

  const existingIds = new Set((existing ?? []).map((r: { id: string }) => r.id))
  const incomingIds = new Set(incoming.filter((d) => d.id).map((d) => d.id!))

  // Delete removed doctors (cascade deletes their slots too)
  const toDelete = Array.from(existingIds).filter((id) => !incomingIds.has(id))
  if (toDelete.length > 0) {
    await supabase.from('hospital_doctors').delete().in('id', toDelete)
  }

  // Upsert remaining doctors
  const rows = incoming.map((d, i) => ({
    ...(d.id ? { id: d.id } : {}),
    org_id:           orgId,
    name:             d.name,
    short_name:       d.short_name,
    color:            d.color,
    bg_color:         d.bg_color,
    bdr_color:        d.bdr_color,
    sort_order:       i,
    start_date:       d.start_date || '1900-01-01',
    end_date:         d.end_date || null,
    regular_off_days: d.regular_off_days || '',
  }))

  const { data: upserted, error } = await supabase
    .from('hospital_doctors')
    .upsert(rows, { onConflict: 'id' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Clean up slots that fall outside each doctor's active date range
  // (mirrors doctor_schedule_form_update.php cleanup logic)
  for (const d of incoming) {
    if (!d.id) continue
    const startDate = d.start_date || '1900-01-01'
    const endDate   = d.end_date || null

    if (endDate) {
      // Delete slots before start OR after end
      await supabase
        .from('hospital_doctor_slots')
        .delete()
        .eq('doctor_id', d.id)
        .or(`date.lt.${startDate},date.gt.${endDate}`)
    } else {
      // Delete slots before start only
      await supabase
        .from('hospital_doctor_slots')
        .delete()
        .eq('doctor_id', d.id)
        .lt('date', startDate)
    }
  }

  return NextResponse.json({ doctors: upserted })
}
