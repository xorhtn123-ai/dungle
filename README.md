# AI 윤리 딜레마 응답 웹사이트

Vite + JavaScript + Supabase 기반의 익명 응답 앱입니다. 응답자는 연령대·성별을 선택하고 3개 딜레마에 각각 A/B 선택과 이유를 작성합니다. 문항 내용은 Supabase `dilemmas` 테이블에서 불러오므로 코드 수정 없이 대시보드에서 편집할 수 있습니다.

## 파일 구조

```text
ai-ethics-dilemma/
├─ index.html
├─ package.json
├─ .env.example
├─ .gitignore
├─ README.md
├─ src/
│  ├─ main.js
│  └─ style.css
└─ supabase/
   └─ schema.sql
```

## 1. Supabase 설정

1. Supabase에서 새 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase/schema.sql` 전체를 실행합니다.
3. Table Editor의 `dilemmas` 테이블에서 문항을 수정하세요. `display_order`는 1, 2, 3으로 유지하고 활성 문항은 정확히 3개로 설정합니다.
4. Project Settings → API에서 Project URL과 publishable/anon key를 복사합니다.

### 응답 테이블

- `age_group`: 연령대
- `gender`: 성별(응답 거부 선택 포함)
- `answers`: 문항 UUID, A/B 선택, 선택 이유를 담은 JSON 배열
- `submitted_at`: 제출 시각

이름, 이메일, 전화번호는 받지 않습니다. 다만 응답 내용 자체에 식별 정보가 적히지 않도록 참여자에게 안내하세요. 미성년자 대상 조사라면 학교/기관의 승인 및 보호자 동의 등 적용되는 절차를 먼저 확인하세요.

## 2. 로컬 실행

```bash
npm install
cp .env.example .env
```

`.env`를 열고 값을 입력합니다.

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

그 다음 실행합니다.

```bash
npm run dev
```

## 3. 통계

현재 버전은 참가자 응답 화면을 제공합니다. 응답 통계는 Supabase Dashboard → SQL Editor에서 아래처럼 집계할 수 있습니다. `responses` 테이블에 공개 SELECT 정책을 만들지 않았으므로 브라우저에서 모든 응답을 읽을 수 없습니다.

```sql
-- 연령대/성별별 제출 수
select age_group, gender, count(*) as response_count
from public.responses
group by age_group, gender
order by age_group, gender;

-- 문항별 A/B 선택 집계 (문항 UUID와 선택은 answers JSON에 저장)
select
  answer->>'dilemma_id' as dilemma_id,
  answer->>'choice' as choice,
  count(*) as count
from public.responses r
cross join lateral jsonb_array_elements(r.answers) as answer
group by answer->>'dilemma_id', answer->>'choice'
order by dilemma_id, choice;

-- 연령대/성별 필터링이 가능한 선택 집계
select
  age_group, gender,
  answer->>'dilemma_id' as dilemma_id,
  answer->>'choice' as choice,
  count(*) as count
from public.responses r
cross join lateral jsonb_array_elements(r.answers) as answer
where age_group = '초등 4–6학년'
  and gender = '응답하지 않음'
group by age_group, gender, dilemma_id, choice;
```

운영용 대시보드를 웹에 추가할 경우, Supabase Auth 로그인과 관리자 권한 확인을 별도로 구현해야 합니다. 서비스 키를 프런트엔드에 넣거나 응답 SELECT를 익명 사용자에게 허용하지 마세요.

## 4. GitHub → Vercel 배포

1. 이 폴더를 GitHub 저장소에 올립니다.
2. Vercel에서 **Add New → Project**로 GitHub 저장소를 가져옵니다.
3. Framework Preset은 Vite(또는 Other), Build Command는 `npm run build`, Output Directory는 `dist`로 설정합니다.
4. Vercel Project → Settings → Environment Variables에 아래 두 값을 추가합니다.
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy를 실행합니다.

`VITE_`로 시작하는 값은 빌드된 브라우저 코드에 포함됩니다. Supabase publishable/anon key는 공개 클라이언트 키로 취급하고, 실제 접근 제어는 RLS 정책으로 하세요. `service_role` 키는 절대 넣지 마세요.

## 5. 개인정보·보안 주의

- 이름이나 연락처를 수집하지 않도록 설계했습니다.
- 연령대·성별과 자유서술 응답은 개인정보 또는 민감한 맥락이 될 수 있으므로 보관 기간, 목적, 동의 문구를 기관의 기준에 맞게 마련하세요.
- `responses`에는 INSERT 정책만 두었습니다. 공개 SELECT/UPDATE/DELETE 정책은 추가하지 마세요.
- 응답 입력 API는 익명 사용자가 접근할 수 있으므로 공개 배포 전 스팸 방지, 입력 제한, 개인정보 안내 등을 검토하세요.
