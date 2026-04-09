import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import { Organization } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!userData) redirect('/login')

  let org: Organization | null = null
  if (userData.org_id) {
    const { data } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', userData.org_id)
      .single()
    org = data
  }

  const creditBalance = org?.credit_balance ?? 0

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar org={org} creditBalance={creditBalance} role={userData.role} />
      <main className="ml-64 min-h-screen">
        {children}
      </main>
    </div>
  )
}
