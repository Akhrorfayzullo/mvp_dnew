import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role === 'superadmin') redirect('/admin')
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F6E56] via-[#0d5e48] to-[#0a4a38] flex items-center justify-center p-4">
      {children}
    </div>
  )
}
