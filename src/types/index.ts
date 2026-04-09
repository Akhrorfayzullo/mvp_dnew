export type UserRole = 'superadmin' | 'owner' | 'admin' | 'member' | 'agent'
export type PlanType = 'lite' | 'pro' | 'enterprise'
export type DesignStyle = 'modern' | 'luxury' | 'friendly' | 'professional' | 'trendy'

export interface Organization {
  id: string
  name: string
  specialty: string
  treatments: string[]
  website_url: string | null
  phone: string | null
  address: string | null
  plan_type: PlanType
  credit_balance: number
  design_style: DesignStyle | null
  brand_color: string | null
  created_at: string
}

export interface User {
  id: string
  org_id: string | null
  email: string
  role: UserRole
  created_at: string
}

export interface MonitoringAlert {
  id: string
  org_id: string
  type: 'rank_drop' | 'negative_review' | 'ad_budget' | 'popup_expired'
  severity: 'info' | 'warning' | 'critical'
  message: string
  is_read: boolean
  created_at: string
}

export interface CreditTransaction {
  id: string
  org_id: string
  amount: number
  type: 'purchase' | 'usage' | 'monthly_grant'
  description: string
  created_at: string
}

export interface Content {
  _id: string
  org_id: string
  type: 'blog' | 'instagram' | 'banner' | 'faq' | 'sms' | 'compliance_check'
  title?: string
  body?: string
  images?: string[]
  tags?: string[]
  compliance_score?: number
  status: 'draft' | 'approved' | 'published'
  metadata?: Record<string, unknown>
  created_at: string
}

export interface ComplianceResult {
  score: number
  verdict: 'PASS' | 'FAIL'
  violations: Array<{
    text: string
    severity: 'HIGH' | 'MID' | 'LOW'
    reason: string
    suggestion: string
  }>
  corrections: string
}

export interface BlogResult {
  title: string
  body: string
  tags: string[]
  compliance_note: string
}

export interface FaqResult {
  faqs: Array<{ question: string; answer: string }>
  json_ld: string
}

export interface CompetitorResult {
  competitors: Array<{
    name: string
    rank: number
    rating: number
    reviews: number
    strength: string
    weakness: string
    insight: string
    opportunity: string
  }>
  summary: string
}

export interface MessagingResult {
  kakao_message: string
  sms_message: string
  compliance_note: string
}
