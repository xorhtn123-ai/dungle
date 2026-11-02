import './style.css';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
const app = document.querySelector('#app');

let dilemmas = [];
let answers = [];
let step = 0;
let demographics = { age_group: '', gender: '' };
let busy = false;

const ageOptions = ['초등 1–3학년', '초등 4–6학년', '중학생', '고등학생', '만 19세 이상'];
const genderOptions = ['여성', '남성', '기타', '응답하지 않음'];

function shell(content) {
  app.innerHTML = `<main class="wrap"><header><span class="brand">AI 윤리 탐구</span><span class="small">익명 참여</span></header>${content}<footer>이름이나 연락처는 입력하지 않습니다. 응답은 연구·교육 목적에 맞게 관리해 주세요.</footer></main>`;
}
function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function selectOptions(items, value) {
  return items.map(x => `<option value="${escapeHtml(x)}" ${x===value?'selected':''}>${escapeHtml(x)}</option>`).join('');
}
function intro() {
  shell(`<section class="panel"><p class="eyebrow">3개의 상황 · 약 5분</p><h1>AI 윤리 딜레마에<br>나의 생각을 들려주세요.</h1><p class="lead">정답을 찾는 활동이 아닙니다. 각 상황에서 어떤 선택을 하는지, 그 이유는 무엇인지 자유롭게 적어 주세요.</p><div class="notice">참여 전 안내: 이름·연락처 등 직접 식별 정보는 수집하지 않습니다. 참여는 자발적이며, 언제든 중단할 수 있습니다.</div><button id="start" class="primary">시작하기</button></section>`);
  document.querySelector('#start').onclick = loadDilemmas;
}
function profile() {
  shell(`<section class="panel"><p class="eyebrow">시작 전</p><h1>간단한 정보를 입력해 주세요.</h1><p class="lead">통계 분석에만 사용됩니다.</p><form id="profile-form"><label>연령대<select name="age" required><option value="">선택해 주세요</option>${selectOptions(ageOptions, demographics.age_group)}</select></label><label>성별<select name="gender" required><option value="">선택해 주세요</option>${selectOptions(genderOptions, demographics.gender)}</select></label><button class="primary" type="submit">문항 시작</button></form><button class="text-button" id="back">처음으로</button></section>`);
  document.querySelector('#back').onclick = intro;
  document.querySelector('#profile-form').onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    demographics = { age_group: fd.get('age'), gender: fd.get('gender') };
    answers = dilemmas.map(d => ({ dilemma_id: d.id, choice: '', reason: '' }));
    step = 0; renderQuestion();
  };
}
async function loadDilemmas() {
  if (!supabase) return showError('Supabase 설정이 없습니다. .env 파일에 프로젝트 URL과 키를 입력해 주세요.');
  shell(`<section class="panel"><p class="eyebrow">불러오는 중</p><h1>문항을 준비하고 있어요…</h1></section>`);
  const { data, error } = await supabase.from('dilemmas').select('id, title, scenario, option_a, option_b, display_order').eq('is_active', true).order('display_order');
  if (error) return showError(`문항을 불러오지 못했습니다: ${error.message}`);
  if (!data || data.length !== 3) return showError('활성화된 문항이 정확히 3개여야 합니다. Supabase 대시보드에서 문항을 확인해 주세요.');
  dilemmas = data;
  profile();
}
function renderQuestion() {
  const d = dilemmas[step], a = answers[step];
  const progress = Math.round(((step+1)/dilemmas.length)*100);
  shell(`<section class="panel"><div class="progress-meta"><span>딜레마 ${step+1} / ${dilemmas.length}</span><span>${progress}%</span></div><div class="progress"><span style="width:${progress}%"></span></div><p class="eyebrow">상황을 읽고 선택해 주세요</p><h1>${escapeHtml(d.title)}</h1><p class="scenario">${escapeHtml(d.scenario)}</p><form id="answer-form"><fieldset><legend>어떤 선택을 하겠습니까?</legend><label class="choice"><input type="radio" name="choice" value="A" ${a.choice==='A'?'checked':''} required><span><b>A</b>${escapeHtml(d.option_a)}</span></label><label class="choice"><input type="radio" name="choice" value="B" ${a.choice==='B'?'checked':''} required><span><b>B</b>${escapeHtml(d.option_b)}</span></label></fieldset><label class="reason-label">선택한 이유를 적어 주세요.<textarea name="reason" rows="4" maxlength="1500" placeholder="나의 생각과 이유를 자유롭게 적어 주세요." required>${escapeHtml(a.reason)}</textarea><small>최대 1,500자</small></label><div class="actions">${step>0?'<button type="button" class="secondary" id="prev">이전</button>':''}<button class="primary" type="submit">${step===2?'응답 제출':'다음 문항'}</button></div></form></section>`);
  if (step>0) document.querySelector('#prev').onclick=()=>{step--;renderQuestion();};
  document.querySelector('#answer-form').onsubmit=e=>{
    e.preventDefault();
    const fd=new FormData(e.currentTarget);
    answers[step]={dilemma_id:d.id,choice:fd.get('choice'),reason:fd.get('reason').trim()};
    if(!answers[step].reason) return;
    if(step<2){step++;renderQuestion();} else submitAnswers();
  };
}
async function submitAnswers() {
  if(busy) return; busy=true;
  shell(`<section class="panel"><h1>응답을 저장하고 있어요…</h1></section>`);
  const payload={age_group:demographics.age_group,gender:demographics.gender,answers,submitted_at:new Date().toISOString()};
  const {error}=await supabase.from('responses').insert(payload);
  busy=false;
  if(error) return showError(`응답 저장에 실패했습니다: ${error.message}`);
  shell(`<section class="panel center"><div class="success-mark">✓</div><p class="eyebrow">참여 완료</p><h1>소중한 생각을 나눠 주셔서 감사합니다.</h1><p class="lead">응답이 익명으로 저장되었습니다.</p><button class="primary" id="again">처음으로</button></section>`);
  document.querySelector('#again').onclick=()=>{demographics={age_group:'',gender:''};answers=[];step=0;intro();};
}
function showError(message) {
  shell(`<section class="panel"><p class="eyebrow">확인 필요</p><h1>진행할 수 없습니다.</h1><p class="lead">${escapeHtml(message)}</p><button class="primary" id="retry">다시 시도</button></section>`);
  document.querySelector('#retry').onclick=intro;
}
intro();