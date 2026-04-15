# DNEW AI 병원 마케팅 플랫폼 — 기술 스택

## 프론트엔드
- Next.js 14 (App Router)
- TypeScript
- TailwindCSS
- shadcn/ui

## 백엔드
- Next.js API Routes (서버리스)
- Supabase (PostgreSQL) — 메인 데이터베이스
- Supabase Auth — 인증

## 데이터베이스 테이블
- organizations — 병원 계정
- users — 사용자 계정 및 역할
- contents — AI 생성 콘텐츠
- monitoring_alerts — 자동화 알림
- credit_transactions — 크레딧 내역
- requests — 텔레그램 봇 요청
- telegram_sessions — 봇 대화 상태

## AI 및 외부 API
- Anthropic Claude API (claude-sonnet-4-20250514) — 콘텐츠 생성, 광고법 검수, 요청 분류
- Telegraf — 텔레그램 봇 프레임워크
- Telegram Bot API — 병원 요청 관리

## 인프라
- Vercel — 호스팅 및 배포
- GitHub — 버전 관리
- Supabase — 데이터베이스 및 인증 호스팅

## 구현된 기능
- 의료광고법 적합성 검사
- 블로그 포스팅 생성
- FAQ 생성
- 환자 메시지 생성 (카카오톡 + SMS)
- 경쟁사 분석
- 모니터링 대시보드
- 텔레그램 봇 — 병원 요청 관리
- Super Admin — 병원 관리 + 요청 관리
