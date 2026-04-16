'use client'

import { usePathname } from 'next/navigation'
import { LayoutDashboard, Building2, MessageSquare, CalendarDays } from 'lucide-react'

const NAV = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard, exact: true },
  { href: '/admin/hospitals', label: '병원 관리', icon: Building2, exact: false },
  { href: '/admin/requests', label: '요청 관리', icon: MessageSquare, exact: false },
  { href: '/admin/schedule', label: '진료일정 관리', icon: CalendarDays, exact: false },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="space-y-0.5">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <a
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              active
                ? 'bg-white/15 text-white'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </a>
        )
      })}
    </nav>
  )
}
