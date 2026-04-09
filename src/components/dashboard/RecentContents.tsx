'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Loader2 } from 'lucide-react'

interface Content {
  _id: string
  type: string
  title: string
  status: string
  created_at: string
}

const typeLabels: Record<string, string> = {
  blog: '블로그',
  faq: 'FAQ',
  sms: '메시지',
  compliance_check: '적합성 검사',
  instagram: '인스타그램',
  banner: '배너',
}

const statusConfig: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  approved: 'bg-green-100 text-green-700',
  published: 'bg-blue-100 text-blue-700',
}

const MOCK_CONTENTS: Content[] = [
  { _id: '1', type: 'blog', title: '피부과 여드름 치료, 레이저 vs 약물 비교', status: 'published', created_at: new Date().toISOString() },
  { _id: '2', type: 'faq', title: '보톡스 시술 관련 자주 묻는 질문', status: 'approved', created_at: new Date().toISOString() },
  { _id: '3', type: 'compliance_check', title: '리프팅 시술 광고 텍스트 검사', status: 'draft', created_at: new Date().toISOString() },
  { _id: '4', type: 'sms', title: 'VIP 고객 재방문 유도 메시지', status: 'published', created_at: new Date().toISOString() },
]

interface RecentContentsProps {
  orgId: string
}

export default function RecentContents({ orgId }: RecentContentsProps) {
  const [contents, setContents] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) {
      setContents(MOCK_CONTENTS)
      setLoading(false)
      return
    }

    fetch(`/api/org/contents?org_id=${orgId}&limit=5`)
      .then((r) => r.json())
      .then((data) => {
        setContents(data.length > 0 ? data : MOCK_CONTENTS)
      })
      .catch(() => setContents(MOCK_CONTENTS))
      .finally(() => setLoading(false))
  }, [orgId])

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#0F6E56]" />
          최근 생성 콘텐츠
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#0F6E56]" />
          </div>
        ) : contents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">아직 생성된 콘텐츠가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-0 divide-y divide-gray-100">
            {contents.map((item) => (
              <div key={item._id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {typeLabels[item.type] || item.type} · {new Date(item.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </div>
                <Badge className={`text-xs ${statusConfig[item.status] || statusConfig.draft}`} variant="outline">
                  {item.status === 'draft' ? '초안' : item.status === 'approved' ? '승인됨' : '발행됨'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
