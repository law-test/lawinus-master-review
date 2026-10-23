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

npm run build 및 node --test tests/*.test.mjs로 타입·번들·목차·메모 접근 제어를 확인합니다. 실제 운영 메모 CRUD와 원본 5파일 해시 대조, 데스크톱·모바일 두 PDF 표시를 별도 확인했습니다. 첨부 문서 원문은 수정하지 않았습니다. 참고문헌 77개와 본문 인용 141곳을 연결하여 저자·연도 인용을 클릭하면 오른쪽에 확인된 원전 PDF를 표시하고, 원전 PDF가 없으면 논문의 참고문헌 지면을 표시합니다. 확인된 공식 자료 페이지가 있는 항목은 해당 링크도 제공합니다.

첫 화면은 논문 본문 첫 쪽(PDF 4쪽)과 첫 인용의 행정안전부 보도자료를 나란히 표시합니다. 저자·연도뿐 아니라 인용이 포함된 134개 문장 전체(355개 줄 영역)를 클릭할 수 있습니다. 문장에 여러 문헌이 있으면 모두 선택할 수 있으며, 저자·연도를 직접 누르면 그 인용의 문헌만 표시합니다. 페이지를 넘는 문장도 연결합니다.

자료 목록에서는 참고문헌 77개를 검색하고 열 수 있습니다. 현재 64개 참고문헌에 63개 원전 PDF가 연결되어 있습니다. 행정안전부 2024년 12월 24일 보도자료 3쪽은 사용자 첨부본과 기존 수납본의 SHA-256 일치를 확인해 연결했습니다.

134개 문장의 인용 취지는 논문 본문에서 해당 문헌을 사용하는 맥락을 정리한 정적 해설입니다. 문헌별 역할이 구별되는 8문장에는 선택 문헌에 따른 설명 22개를 제공하고, 재인용 6곳은 출처 관계를 명시했습니다. 원전 전체를 새로 검증했다는 의미는 아닙니다. 자료 목록에서 각 문헌의 인용 취지를 읽고 해당 본문으로 돌아갈 수 있으며, 본문 인용 위치 141곳을 문장·저자·자료명으로 검색할 수 있습니다.

PDF가 없는 문헌의 확인된 HTTPS 자료 페이지는 오른쪽 창 안에서 열립니다. 외부 사이트가 프레임 표시를 허용하지 않을 때는 새 창 링크를 이용할 수 있습니다. 원전 PDF에는 쪽·위치 메모와 저장된 메모 핀을 제공하며, 발췌 4종은 검증된 대응표에 따라 발췌본 쪽과 원본 PDF 쪽을 함께 표시합니다.

## 교육대학원 로고 출처

사용자의 요청에 따라 고려대학교 교육대학원 공식 홈페이지 헤더의 로고 원본을 사용합니다. 2026-10-23에 공식 HTML과 CSS에서 경로를 확인했으며, SVG 원본을 변경 없이 저장했습니다.

- 공식 홈페이지: https://edugrad.korea.ac.kr/edugrad/index.do
- 헤더 CSS: https://edugrad.korea.ac.kr/_res/edugrad/_css/layout.css (`#wrap .head_inner h1`의 배경 이미지)
- 원본 SVG: https://edugrad.korea.ac.kr/_res/edugrad/etc/logo_edugrad.svg
- 저장 위치: `public/brand/korea-education-graduate-logo.svg`
- 원본 크기: 287.277 × 71.212 (SVG viewBox)
- SHA-256: `0dbc2e3c3af92cf2250726027d36fe7b671bd46489166c0ca2ee99aca3e0a908`

PC와 모바일에서 원본 종횡비로 표시하고 별도의 평생교육전공 표기를 유지합니다. 로고 링크는 공식 홈페이지를 새 창으로 엽니다.
