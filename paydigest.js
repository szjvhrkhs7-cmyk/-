const NEWS = window.PAYDIGEST_NEWS;
if (!Array.isArray(NEWS)) throw new Error('PayDigest data unavailable');

const REQUIRED_COUNTS={payments:10,ai:10,law:6};
const MIN_RUSSIA_PER_SECTION=6;
const sectionCounts=Object.fromEntries(Object.keys(REQUIRED_COUNTS).map(section=>[section,NEWS.filter(x=>x.section===section).length]));
const russianCounts={payments:NEWS.filter(x=>x.section==='payments'&&x.country==='Россия').length,ai:NEWS.filter(x=>x.section==='ai'&&x.country==='Россия').length};
const hasInvalidSection=Object.entries(REQUIRED_COUNTS).some(([section,count])=>sectionCounts[section]!==count);
if(NEWS.length!==26||hasInvalidSection||russianCounts.payments<MIN_RUSSIA_PER_SECTION||russianCounts.ai<MIN_RUSSIA_PER_SECTION){
  document.body.innerHTML='<main style="max-width:540px;margin:50px auto;color:white;font:16px system-ui"><h1>Редакционная ошибка</h1><p>Нарушены требования к составу выпуска PayDigest.</p></main>';
  throw new Error('PayDigest editorial policy violation');
}

const state={section:'payments',filter:null,screen:'home',articleId:null,favorites:new Set(JSON.parse(localStorage.getItem('paydigest-favorites')||'[]'))};
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sectionTitle=s=>({payments:'Платежи',ai:'ИИ',law:'Право'}[s]||s);
const iconFor=item=>item.icon||'✦';
const AI_TRENDS=[
  {
    "id": "ai-enterprise-signals",
    "title": "Корпоративный ИИ переходит от ответов к выполнению работы"
  },
  {
    "id": "ai-gigaagent",
    "title": "Автономные агенты становятся отдельным классом корпоративных систем"
  },
  {
    "id": "ai-data-readiness",
    "title": "Качество данных остаётся главным ограничением масштабирования"
  },
  {
    "id": "ai-finance-function",
    "title": "Финансовые функции перестраиваются вокруг непрерывных решений"
  },
  {
    "id": "ai-daybreak-cyber",
    "title": "Доступ к сильным кибермоделям строится как управляемый доверенный контур"
  }
];
const RUSSIAN_MONTHS={января:0,февраля:1,марта:2,апреля:3,мая:4,июня:5,июля:6,августа:7,сентября:8,октября:9,ноября:10,декабря:11};
function dateValue(value){const match=String(value).match(/^(\d{1,2})\s+([а-яё]+)\s+(\d{4})$/i);return match?Date.UTC(Number(match[3]),RUSSIAN_MONTHS[match[2].toLowerCase()],Number(match[1])):0}
function sectionItems(section=state.section){const items=NEWS.filter(x=>x.section===section);return section==='law'?items:items.sort((a,b)=>dateValue(b.date)-dateValue(a.date))}
function filteredItems(){return sectionItems().filter(x=>!state.filter||x.tags.includes(state.filter)||x.country===state.filter)}
function cardMarkup(item){return `<button class="news-card ${esc(item.section)}" data-open="${esc(item.id)}" type="button"><span class="news-icon">${esc(iconFor(item))}</span><span><span class="card-meta"><span class="category">${esc(item.category)}</span><span class="time"><i class="country-dot ${item.country==='Россия'?'':'world'}"></i> ${esc(item.country)}</span></span><h3>${esc(item.title)}</h3></span><span class="chevron">›</span></button>`}
function featuredMarkup(item){return `<div class="featured-top"><span class="category">${esc(item.category)}</span><span class="time">${esc(item.date)}</span></div><h1>${esc(item.title)}</h1><p>${esc(item.summary)}</p><div class="spark" aria-hidden="true"><svg viewBox="0 0 360 90" preserveAspectRatio="none"><path class="gridline" d="M0 22H360M0 45H360M0 68H360"/><path class="line-a" d="M0 67 L36 48 L72 29 L108 55 L144 69 L180 58 L216 73 L252 69 L288 48 L324 43 L360 31"/><path class="line-b" d="M0 72 L36 64 L72 70 L108 62 L144 61 L180 58 L216 52 L252 49 L288 32 L324 23 L360 17"/></svg></div><button class="featured-open" data-open="${esc(item.id)}" type="button" aria-label="Открыть новость">→</button>`}
function renderHome(){
  const pool=filteredItems();
  const featured=pool.find(x=>x.featured)||pool[0]||sectionItems()[0];
  $('#sectionLabel').innerHTML=`<b>${sectionTitle(state.section)}</b> · 10 материалов`;
  $('#sectionCount').textContent=`${pool.length} ${pool.length===1?'новость':'новостей'}`;
  $('#featuredCard').innerHTML=featuredMarkup(featured);
  $('#newsList').innerHTML=pool.filter(x=>x.id!==featured.id).map(cardMarkup).join('');
  document.querySelectorAll('.section-tab[data-section]').forEach(b=>b.classList.toggle('active',b.dataset.section===state.section&&!state.filter));
  document.querySelectorAll('.section-tab[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===state.filter));
}
function renderDigest(){
  $('#digestList').innerHTML=AI_TRENDS.map((trend,i)=>`<button class="digest-item" data-open="${esc(trend.id)}" type="button"><span class="digest-num">${i+1}</span><span>${esc(trend.title)}</span><b>›</b></button>`).join('');
  $('#aiNewsList').innerHTML=sectionItems('ai').map(cardMarkup).join('');
}
function renderLaw(){
  $('#lawNewsList').innerHTML=sectionItems('law').map(cardMarkup).join('');
}
function renderFavorites(){
  const items=NEWS.filter(x=>state.favorites.has(x.id));
  $('#favoritesCount').textContent=`${items.length} материалов`;
  $('#favoritesList').innerHTML=items.length?items.map(cardMarkup).join(''):'<div class="empty-state">Сохранённые новости появятся здесь. Откройте материал и нажмите на закладку.</div>';
}
function switchScreen(name){
  state.screen=name;
  ['home','digest','law','favorites','profile'].forEach(n=>$(`#${n}Screen`).classList.toggle('hidden',n!==name));
  document.querySelectorAll('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.screen===name));
  if(name==='favorites')renderFavorites();
  window.scrollTo({top:0,behavior:'smooth'});
}
function openArticle(id){
  const item=NEWS.find(x=>x.id===id);if(!item)return;state.articleId=id;
  const points=item.keyPoints.map(p=>`<div class="key-point"><span class="check">✓</span><span>${esc(p)}</span></div>`).join('');
  $('#articleContent').innerHTML=`<div class="article-meta" style="margin-top:22px"><span class="category">${esc(item.category)}</span><span class="time">${esc(item.date)} · ${esc(item.source)}</span></div><h1>${esc(item.title)}</h1><div class="ai-box"><b>✦ Ключевой вывод</b>${esc(item.impact)}</div><div class="article-body"><p>${esc(item.summary)}</p><p>${esc(item.impact)}</p></div><div class="key-box"><h3>Что важно знать</h3>${points}</div><a class="source-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Открыть первоисточник ↗</a>`;
  $('#favoriteArticleButton').classList.toggle('saved',state.favorites.has(id));
  $('#favoriteArticleButton').textContent=state.favorites.has(id)?'★':'☆';
  $('#articleView').classList.remove('hidden');document.body.style.overflow='hidden';
}
function closeArticle(){state.articleId=null;$('#articleView').classList.add('hidden');document.body.style.overflow=''}
function toggleFavorite(){if(!state.articleId)return;if(state.favorites.has(state.articleId))state.favorites.delete(state.articleId);else state.favorites.add(state.articleId);localStorage.setItem('paydigest-favorites',JSON.stringify([...state.favorites]));$('#favoriteArticleButton').classList.toggle('saved',state.favorites.has(state.articleId));$('#favoriteArticleButton').textContent=state.favorites.has(state.articleId)?'★':'☆';if(state.screen==='favorites')renderFavorites()}
function renderSearch(query=''){
  const q=query.trim().toLowerCase();const items=q?NEWS.filter(x=>[x.title,x.summary,x.impact,x.source,x.category,...x.tags].join(' ').toLowerCase().includes(q)):NEWS.slice(0,6);
  $('#searchResults').innerHTML=items.length?items.map(cardMarkup).join(''):'<div class="empty-state">Ничего не найдено.</div>';
}
document.addEventListener('click',e=>{const open=e.target.closest('[data-open]');if(open)openArticle(open.dataset.open)});
$('#sectionTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.section){state.section=b.dataset.section;state.filter=null}else if(b.dataset.filter){state.filter=state.filter===b.dataset.filter?null:b.dataset.filter}renderHome()});
$('#bottomNav').addEventListener('click',e=>{const b=e.target.closest('[data-screen]');if(b)switchScreen(b.dataset.screen)});
$('#searchButton').addEventListener('click',()=>{$('#searchPanel').classList.remove('hidden');$('#searchInput').focus();renderSearch()});
$('#closeSearchButton').addEventListener('click',()=>{$('#searchPanel').classList.add('hidden');$('#searchInput').value=''});
$('#searchInput').addEventListener('input',e=>renderSearch(e.target.value));
$('#closeArticleButton').addEventListener('click',closeArticle);
$('#favoriteArticleButton').addEventListener('click',toggleFavorite);
$('#shareArticleButton').addEventListener('click',async()=>{const x=NEWS.find(n=>n.id===state.articleId);if(!x)return;try{if(navigator.share)await navigator.share({title:x.title,text:x.summary,url:x.url});else await navigator.clipboard.writeText(x.url)}catch{}});
window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#articleView').classList.contains('hidden'))closeArticle();else $('#searchPanel').classList.add('hidden')}});
renderHome();renderDigest();renderLaw();renderFavorites();
