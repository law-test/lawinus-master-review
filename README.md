# 신현하의 석사논문 검토실

고려대학교 교육대학원 · 평생교육전공

노인학습자의 문화예술교육 참여경험에 관한 사례연구 — 시니어 발레단의 가능한 자기 인식을 중심으로

## 운영 구조

GitHub Pages가 화면을 제공하고 Supabase가 원본 자료와 검토 메모를 저장합니다. GPT·ChatGPT·OpenAI API·Sites 서비스에 대한 런타임 의존성이 없습니다.

- 사이트: https://master.lawinus.org
- 소스: main 브랜치
- 배포: gh-pages 브랜치, / (root)
- 자료: 첨부 논문 PDF 44쪽, 발표 PDF 14쪽, 발표 PPTX 14장
- 자료 저장소: master-review-documents
- 데이터 구분: master-20261024-attached
- 데이터베이스: master_review_private 전용 스키마, public.master_review_* API

기존 paper 사이트와 Supabase 프로젝트는 공유하지만 테이블·저장소·메모 API를 분리했습니다. 비공개 메모는 브라우저의 익명 로그인에 연결되며, 공유 메모만 다른 방문자에게 보입니다.

## 개발 및 배포

Node.js 22.13 이상에서 npm ci, npm run build를 실행합니다. 생성된 dist/의 **내용**을 gh-pages 브랜치 최상위에 게시합니다. GitHub Settings → Pages에서 Deploy from a branch → gh-pages → /(root), Custom domain master.lawinus.org를 지정합니다. 인증서가 발급되면 Enforce HTTPS를 켭니다.

public/config.json에는 브라우저 공개용 publishable 키만 있습니다. 관리자 키·서비스 역할 키는 넣지 않습니다. Supabase 스키마의 최초 설치 파일은 supabase/002_master_review.sql입니다. tests/fixtures/paper-baseline.sql은 기존 사이트 보존을 확인하는 테스트 전용이며 운영 서버에 실행하지 않습니다.

## 검증

npm run build 및 node --test tests/*.test.mjs로 타입·번들·목차·메모 접근 제어를 확인합니다. 실제 운영 메모 CRUD와 원본 5파일 해시 대조, 데스크톱·모바일 두 PDF 표시를 별도 확인했습니다. 첨부 문서 원문은 수정하지 않았으며 개별 참고문헌 원전 연결은 포함하지 않습니다.

## 교육대학원 로고 출처

사용자의 요청에 따라 고려대학교 교육대학원 공식 홈페이지 헤더의 로고 원본을 사용합니다. 2026-10-23에 공식 HTML과 CSS에서 경로를 확인했으며, SVG 원본을 변경 없이 저장했습니다.

- 공식 홈페이지: https://edugrad.korea.ac.kr/edugrad/index.do
- 헤더 CSS: https://edugrad.korea.ac.kr/_res/edugrad/_css/layout.css (`#wrap .head_inner h1`의 배경 이미지)
- 원본 SVG: https://edugrad.korea.ac.kr/_res/edugrad/etc/logo_edugrad.svg
- 저장 위치: `public/brand/korea-education-graduate-logo.svg`
- 원본 크기: 287.277 × 71.212 (SVG viewBox)
- SHA-256: `0dbc2e3c3af92cf2250726027d36fe7b671bd46489166c0ca2ee99aca3e0a908`

PC와 모바일에서 원본 종횡비로 표시하고 별도의 평생교육전공 표기를 유지합니다. 로고 링크는 공식 홈페이지를 새 창으로 엽니다.
