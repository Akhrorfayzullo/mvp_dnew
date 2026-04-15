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
- Next.js Middleware — 세션 자동 갱신 (탭 간 로그인 유지)

## 데이터베이스 테이블
- organizations — 병원 계정 (email, phone, address, telegram_chat_id, telegram_verified)
- users — 사용자 계정 및 역할 (role: owner | superadmin)
- contents — AI 생성 콘텐츠
- monitoring_alerts — 자동화 알림
- credit_transactions — 크레딧 내역
- requests — 텔레그램 봇 요청 (source, category, priority, status, assigned_to)
- telegram_sessions — 봇 대화 상태 (step, email, email_attempts, password_attempts)

## AI 및 외부 API
- Anthropic Claude API (claude-sonnet-4-20250514) — 콘텐츠 생성, 광고법 검수, 요청 분류
- Telegraf — 텔레그램 봇 프레임워크
- Telegram Bot API — 병원 요청 관리

## 인프라
- Vercel — 호스팅 및 배포
- GitHub — 버전 관리
- Supabase — 데이터베이스 및 인증 호스팅

## 구현된 기능

### Super Admin 패널 (/admin)
- 병원 관리 (CRUD) — 생성, 수정, 삭제, 실시간 테이블 업데이트
- 병원 수정: 병원명, 진료과목, 이메일, 플랜, 크레딧 변경 + 확인 단계
- 요청 관리 — 병원별 아코디언 그룹, 상태 변경, 담당자 지정
- 요청 출처 표시 (Telegram / KakaoTalk / WeChat / Instagram)
- 병원 행에 요청 상태 배지 (대기중 / 진행중 / 완료) — 클릭 시 해당 병원 요청 필터
- 로그아웃 버튼

### 병원 대시보드 (/dashboard)
- 의료광고법 적합성 검사
- 블로그 포스팅 생성
- FAQ 생성
- 환자 메시지 생성 (카카오톡 + SMS)
- 경쟁사 분석
- 모니터링 대시보드

### 텔레그램 봇
- 회사 소개 인트로 메시지
- 이메일 + 비밀번호 인증 (각 3회 시도 제한)
- 실패 시 인라인 버튼: 다시 시도 / 담당자 문의
- 미등록 사용자에게 웹사이트 안내 (dnew.co.kr)
- 담당자 연락처 제공 (@akhrorfayzullo)
- Claude AI 기반 요청 분류 (카테고리, 우선순위, 예상시간)
- Supabase telegram_sessions 테이블로 상태 관리 (Vercel 서버리스 호환)
- 상태 변경 시 텔레그램 알림 발송
