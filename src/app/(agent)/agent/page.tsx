import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ClipboardList, CheckCircle, Clock } from 'lucide-react'

const MOCK_REQUESTS = [
  { id: '1', hospital: '강남 ABC 피부과', type: '블로그 포스트', status: 'pending', priority: 'high', created_at: '2시간 전' },
  { id: '2', hospital: '홍대 XYZ 치과', type: '광고 검수', status: 'in_progress', priority: 'medium', created_at: '4시간 전' },
  { id: '3', hospital: '이태원 DEF 성형외과', type: 'FAQ 생성', status: 'completed', priority: 'low', created_at: '1일 전' },
]

export default function AgentPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">에이전트 요청 큐</h1>
        <p className="text-sm text-muted-foreground">처리 대기 중인 요청을 확인하세요</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">2</p>
            <p className="text-xs text-muted-foreground">처리 대기</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">1</p>
            <p className="text-xs text-muted-foreground">진행 중</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">1</p>
            <p className="text-xs text-muted-foreground">완료</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-orange-600" />
            요청 목록
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {MOCK_REQUESTS.map((req) => (
            <div key={req.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                {req.status === 'completed'
                  ? <CheckCircle className="w-5 h-5 text-green-500" />
                  : req.status === 'in_progress'
                  ? <Clock className="w-5 h-5 text-blue-500 animate-pulse" />
                  : <Clock className="w-5 h-5 text-orange-500" />
                }
                <div>
                  <p className="text-sm font-medium">{req.hospital}</p>
                  <p className="text-xs text-muted-foreground">{req.type} · {req.created_at}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={req.priority === 'high' ? 'destructive' : req.priority === 'medium' ? 'default' : 'secondary'} className="text-xs">
                  {req.priority === 'high' ? '긴급' : req.priority === 'medium' ? '보통' : '낮음'}
                </Badge>
                {req.status !== 'completed' && (
                  <Button size="sm" variant="outline" className="text-xs h-7">처리</Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
