/* ===================== 数据与工具 ===================== */
var EMBEDDED = JSON.parse(document.getElementById('lesson-data').textContent);
var DATA = EMBEDDED;
try {
  var ov = JSON.parse(localStorage.getItem('efe_data_override') || 'null');
  if (ov && (ov.rev || 0) > (EMBEDDED.rev || 0)) DATA = ov;
} catch (e) {}

var INTERVALS = [1, 2, 4, 7, 15, 30, 60]; // 艾宾浩斯间隔(天);到达最后一档并答对 = 熟知,退出复习
var MASTER_STAGE = 6;

function ls(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
function lsSet(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
var srs = ls('efe_srs', {});
function saveSrs() { lsSet('efe_srs', srs); }
var wrongBook = ls('efe_wrong', {});
function saveWrong() { lsSet('efe_wrong', wrongBook); }

function todayStr(offset) {
  var d = new Date(); d.setDate(d.getDate() + (offset || 0));
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fmtRich(s) { return esc(s).replace(/\[img:([^\]\s]+)\]/g, function (m, u) { return imgTag(u); }); }
function imgTag(src) { return '<img src="' + esc(src) + '" class="wimg" onclick="event.stopPropagation();window.open(this.src)" onerror="imgFail(this)" alt="图片">'; }
function imgFail(img) {
  var d = document.createElement('div'); d.className = 'img-err';
  d.textContent = '⚠️ 图片加载失败:请使用图片直链(建议把图片上传到 GitHub 仓库,链接填 images/文件名.jpg)';
  img.replaceWith(d);
}
function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function pick(arr, n, exclude) { return shuffle(arr.filter(function (x) { return x !== exclude; })).slice(0, n); }
function jstr(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;') + "'"; }

function allWords() {
  var out = [];
  DATA.lessons.forEach(function (l) { (l.words || []).forEach(function (w) { out.push(Object.assign({ lessonId: l.id }, w)); }); });
  return out;
}
function wkey(w) { return w.en.toLowerCase().trim(); }
/* 状态: 待学📌 / 忘记😵 / 认识🙂 / 熟知😎(退出复习) */
function wordStatus(w) {
  var r = srs[wkey(w)];
  if (!r) return { label: '待学', emoji: '📌', key: 'todo', due: true, next: '今天' };
  if (r.stage >= MASTER_STAGE) return { label: '熟知', emoji: '😎', key: 'master', due: false, next: '—' };
  var due = r.next <= todayStr();
  if (r.stage === 0 || wrongBook[wkey(w)]) return { label: '忘记', emoji: '😵', key: 'forgot', due: due, next: due ? '今天' : r.next };
  return { label: '认识', emoji: '🙂', key: 'known', due: due, next: due ? '今天' : r.next };
}
function dueWords() { return allWords().filter(function (w) { return wordStatus(w).due; }); }
function masteredCount() { return allWords().filter(function (w) { return wordStatus(w).key === 'master'; }).length; }
function updateSrs(w, correct) {
  var k = wkey(w), r = srs[k], isNew = !r;
  r = r || { stage: -1 };
  if (correct) {
    r.stage = Math.min((r.stage < 0 ? -1 : r.stage) + 1, MASTER_STAGE);
    r.next = todayStr(INTERVALS[Math.min(r.stage, INTERVALS.length - 1)]);
  } else {
    r.stage = 0;
    r.next = todayStr(1);
  }
  r.last = todayStr();
  srs[k] = r; saveSrs();
  if (isNew) {
    var stats = ls('efe_stats', {}), t = todayStr();
    stats[t] = stats[t] || { a: 0, c: 0, n: 0 }; stats[t].n = (stats[t].n || 0) + 1;
    lsSet('efe_stats', stats);
  }
}
function markPracticed() {
  var days = ls('efe_days', []);
  if (days.indexOf(todayStr()) < 0) { days.push(todayStr()); lsSet('efe_days', days); }
}
function streak() {
  var days = ls('efe_days', []), n = 0, i = 1;
  if (days.indexOf(todayStr()) >= 0) n = 1;
  while (days.indexOf(todayStr(-i)) >= 0) { n++; i++; }
  return n;
}
/* 每日快照:用于统计页历史曲线 */
function snapshot() {
  var h = ls('efe_history', {}), t = todayStr();
  var total = 0, p10 = 0, p30 = 0, m = 0;
  allWords().forEach(function (w) {
    var r = srs[wkey(w)]; if (!r) return;
    total++;
    var iv = INTERVALS[Math.max(0, Math.min(r.stage, INTERVALS.length - 1))];
    if (r.stage >= MASTER_STAGE) m++;
    if (iv >= 10 || r.stage >= MASTER_STAGE) p10++;
    if (iv >= 30 || r.stage >= MASTER_STAGE) p30++;
  });
  h[t] = { total: total, p10: p10, p30: p30, m: m };
  lsSet('efe_history', h);
}

/* ===================== 发音 ===================== */
var enVoice = null;
function loadVoices() {
  var vs = speechSynthesis.getVoices();
  enVoice = vs.find(function (v) { return /^en(-|_)?US/i.test(v.lang); }) || vs.find(function (v) { return /en/i.test(v.lang); }) || null;
}
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function speak(text) {
  if (!('speechSynthesis' in window)) { alert('当前浏览器不支持语音朗读'); return; }
  speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; u.rate = 0.85;
  if (enVoice) u.voice = enVoice;
  speechSynthesis.speak(u);
}

/* ===================== 导航与目录 ===================== */
var state = { tab: 'home', teacher: false, openLessons: {}, openPdf: {}, quiz: null, editing: null, statFilter: 'all' };
var TABS = [
  { id: 'home', label: '今日' },
  { id: 'words', label: '单词本' },
  { id: 'grammar', label: '语法' },
  { id: 'pdf', label: '课件' },
  { id: 'quiz', label: '练习' },
  { id: 'stats', label: '统计' }
];
var TOC_TABS = { words: 1, grammar: 1, pdf: 1 };
function renderNav() {
  var tabs = TABS.slice();
  if (state.teacher) tabs.push({ id: 'teacher', label: '✏️ 教师' });
  document.getElementById('nav').innerHTML = tabs.map(function (t) {
    return '<button class="' + (state.tab === t.id ? 'active' : '') + '" onclick="go(\'' + t.id + '\')">' + t.label + '</button>';
  }).join('');
}
function dispLessons() {
  var arr = DATA.lessons.slice();
  return ls('efe_sort', 'desc') === 'desc' ? arr.reverse() : arr;
}
function toggleSort() {
  lsSet('efe_sort', ls('efe_sort', 'desc') === 'desc' ? 'asc' : 'desc');
  state.animate = true;
  render();
}
function go(tab) {
  state.tab = tab;
  if (tab === 'quiz') state.quiz = null;
  state.animate = true;
  render();
  window.scrollTo(0, 0);
}
function render() {
  renderNav();
  var st = streak();
  var hb = document.getElementById('hbadge');
  hb.style.display = st > 0 ? 'inline-block' : 'none';
  hb.textContent = '🔥 连续 ' + st + ' 天';
  var v = document.getElementById('view');
  v.className = state.animate ? 'anim' : '';
  state.animate = false;
  if (state.tab === 'home') v.innerHTML = viewHome();
  else if (state.tab === 'words') v.innerHTML = viewWords();
  else if (state.tab === 'grammar') v.innerHTML = viewGrammar();
  else if (state.tab === 'pdf') v.innerHTML = viewPdfs();
  else if (state.tab === 'quiz') v.innerHTML = viewQuiz();
  else if (state.tab === 'stats') v.innerHTML = viewStats();
  else if (state.tab === 'teacher') v.innerHTML = viewTeacher();
  buildToc();
}
function tocLinks() {
  var lbl = ls('efe_sort', 'desc') === 'desc' ? '⇅ 最新在前' : '⇅ 最早在前';
  return '<span class="sort-chip" onclick="toggleSort()">' + lbl + '</span>'
    + dispLessons().map(function (l) {
      return '<a data-id="' + l.id + '" onclick="jumpTo(\'' + l.id + '\')">' + esc(l.title) + '</a>';
    }).join('');
}
function spy() {
  if (!TOC_TABS[state.tab] || window.innerWidth < 900) return;
  var curId = null;
  dispLessons().forEach(function (l) {
    var e = document.getElementById(state.tab + '-' + l.id);
    if (e && e.getBoundingClientRect().top <= 100) curId = l.id;
  });
  var links = document.querySelectorAll('#toc a');
  for (var i = 0; i < links.length; i++) {
    links[i].className = (curId && links[i].getAttribute('data-id') === curId) ? 'cur' : '';
  }
}
window.addEventListener('scroll', spy, { passive: true });
function buildToc() {
  var has = TOC_TABS[state.tab] && DATA.lessons.length > 1 && !state.quiz && state.editing === null;
  document.getElementById('toc').innerHTML = has ? '<div class="toc-title">📑 目录</div>' + tocLinks() : '';
  document.getElementById('toc-fab').style.display = (has && window.innerWidth < 900) ? 'block' : 'none';
}
function toggleTocPanel(show) {
  if (show) document.getElementById('toc-panel-list').innerHTML = tocLinks();
  document.getElementById('toc-panel').style.display = show ? 'block' : 'none';
}
function jumpTo(id) {
  toggleTocPanel(false);
  if (state.tab === 'words') state.openLessons[id] = true;
  if (state.tab === 'pdf') state.openPdf[id] = true;
  render();
  var el = document.getElementById(state.tab + '-' + id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ===================== 今日 ===================== */
function viewHome() {
  var all = allWords();
  var due = dueWords();
  var newCount = due.filter(function (w) { return !srs[wkey(w)]; }).length;
  var reviewCount = due.length - newCount;
  var mastered = masteredCount();
  var tomorrow = 0, later = {};
  all.forEach(function (w) {
    var r = srs[wkey(w)];
    if (!r || r.stage >= MASTER_STAGE) return;
    if (r.next === todayStr(1)) tomorrow++;
    else if (r.next > todayStr(1)) later[r.next] = (later[r.next] || 0) + 1;
  });
  var laterKeys = Object.keys(later).sort().slice(0, 4);
  // 今日完成度 = 今天已复习的单词 / (今天已复习 + 仍到期)。不依赖预存基准,永远自洽。
  var done = 0;
  all.forEach(function (w) { var r = srs[wkey(w)]; if (r && r.last === todayStr()) done++; });
  var planned = done + due.length;
  var pct = planned ? Math.min(100, Math.round(done / planned * 100)) : 100;
  var tStats = ls('efe_stats', {})[todayStr()] || { a: 0 };
  var h = '<div class="card center">'
    + '<div style="font-size:14px;color:var(--muted)">' + todayStr() + ' · ' + esc(DATA.config.book || '') + '</div>'
    + '<div style="display:flex;align-items:center;justify-content:center;gap:14px;margin:8px 0">'
    + ringSvg(pct)
    + '<div style="text-align:left"><div style="font-size:17px;font-weight:700">' + esc(DATA.config.student || '') + ',欢迎回来!</div>'
    + '<div style="font-size:13px;color:var(--muted)">今日完成度 ' + pct + '%' + (due.length ? ' · 还剩 ' + due.length + ' 个词' : ' · 全部完成 🎉') + (tStats.a ? '<br>今日已答 ' + tStats.a + ' 题' : '') + '</div></div></div>'
    + '<div class="stat-row">'
    + '<div class="stat"><div class="num">' + newCount + '</div><div class="lbl">📌 待学新词</div></div>'
    + '<div class="stat"><div class="num">' + reviewCount + '</div><div class="lbl">⏰ 今日待复习</div></div>'
    + '<div class="stat"><div class="num">' + mastered + '</div><div class="lbl">😎 熟知</div></div>'
    + '</div><div class="spacer"></div>';
  if (due.length > 0) {
    h += '<button class="btn" onclick="startSmartQuiz()">▶ 开始今日复习(' + due.length + ' 个单词)</button>';
    if (due.length > 15) h += '<div class="hint">积压较多,会优先安排逾期最久的单词,每轮 15 个,做完可以再来一轮。</div>';
  } else {
    h += '<div class="feedback ok">🎉 今天的复习任务已全部完成!</div>';
  }
  h += '</div>';
  h += '<div class="card"><h3>📅 复习计划</h3>';
  h += '<div class="sched-row"><span>明天</span><b>' + tomorrow + ' 个单词</b></div>';
  laterKeys.forEach(function (k) {
    h += '<div class="sched-row"><span>' + k + '</span><b>' + later[k] + ' 个单词</b></div>';
  });
  if (tomorrow === 0 && laterKeys.length === 0) h += '<div class="hint">完成练习后,这里会显示未来的复习安排。答对的单词按 1、2、4、7、15、30、60 天的间隔复习,全部通过后成为「熟知」,不再出现。</div>';
  h += '</div>';
  var latest = DATA.lessons[DATA.lessons.length - 1];
  if (latest) {
    h += '<div class="card"><h3>📖 最新课程</h3><div><span class="tag">' + esc(latest.date) + '</span>' + esc(latest.title) + '</div>'
      + '<div class="spacer"></div><button class="btn secondary small" onclick="state.openLessons[\'' + latest.id + '\']=true;go(\'words\')">查看单词</button> '
      + '<button class="btn secondary small" onclick="startLessonQuiz(\'' + latest.id + '\')">练本课单词</button> '
      + ((latest.questions || []).length ? '<button class="btn secondary small" onclick="startGrammarQuiz(\'' + latest.id + '\')">练本课语法</button>' : '') + '</div>';
  }
  h += '<div class="card"><h3>⏰ 每日提醒</h3>'
    + '<p style="font-size:13px;color:var(--muted)">选一个每天固定的复习时间,点「加入日历」,手机日历会每天弹通知提醒你,点通知直达本页。再把本页添加到主屏幕,一点就能进来。</p>'
    + '<div style="display:flex;gap:10px;align-items:center"><input type="time" id="remind-time" class="mini-input" value="12:30">'
    + '<button class="btn small" onclick="downloadIcs()">📅 加入日历</button></div>'
    + '<div class="hint">想改时间,在日历 App 里改即可。</div><div class="spacer"></div>'
    + '<button class="btn secondary small" onclick="makeReport()">📊 生成学习周报发老师</button></div>';
  h += '<div class="card"><h3>💾 学习进度</h3>'
    + '<p style="font-size:13px;color:var(--muted)">进度保存在本机浏览器里,关机、关页面都不会丢。建议偶尔点「备份进度」,换手机或误清数据时用「恢复进度」找回(备份包含复习进度、错词本和全部统计数据)。</p><div class="spacer"></div>'
    + '<button class="btn secondary small" onclick="exportProgress()">备份进度</button> '
    + '<button class="btn secondary small" onclick="document.getElementById(\'import-progress\').click()">恢复进度</button>'
    + '<input type="file" id="import-progress" accept=".json" style="display:none" onchange="importProgress(this)"></div>';
  return h;
}
function makeReport() {
  var all = allWords(), stats = ls('efe_stats', {});
  var a = 0, c = 0, days7 = 0;
  for (var i = 0; i < 7; i++) { var d = todayStr(-i); if (stats[d]) { days7++; a += stats[d].a; c += stats[d].c; } }
  var m = 0, known = 0, forgot = 0, todo = 0;
  all.forEach(function (w) {
    var k = wordStatus(w).key;
    if (k === 'master') m++; else if (k === 'known') known++; else if (k === 'forgot') forgot++; else todo++;
  });
  var txt = '📊 ' + (DATA.config.student || '') + ' 英语学习周报(' + todayStr() + ')\n'
    + '🔥 连续学习 ' + streak() + ' 天,最近7天练习 ' + days7 + ' 天\n'
    + '✍️ 近7天答题 ' + a + ' 题,正确率 ' + (a ? Math.round(c / a * 100) : 0) + '%\n'
    + '📚 词汇共 ' + all.length + ' 个:😎熟知 ' + m + ' · 🙂认识 ' + known + ' · 😵忘记 ' + forgot + ' · 📌待学 ' + todo + '\n'
    + '⏳ 当前待复习 ' + dueWords().length + ' 个,错词本 ' + Object.keys(wrongBook).length + ' 个';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function () { alert('周报已复制,去 WhatsApp 粘贴发给老师吧!\n\n' + txt); }, function () { prompt('长按全选复制:', txt); });
  } else { prompt('长按全选复制:', txt); }
}
function downloadIcs() {
  var el = document.getElementById('remind-time');
  var t = ((el && el.value) || '12:30').split(':');
  var d = new Date();
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var dt = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' + pad(t[0]) + pad(t[1]) + '00';
  var url = /^https?:/.test(location.href) ? location.href : (DATA.config.siteUrl || '').trim();
  var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EFE Review//CN', 'BEGIN:VEVENT',
    'UID:efe-review-' + Date.now() + '@efe',
    'DTSTAMP:' + dt, 'DTSTART:' + dt, 'DURATION:PT15M', 'RRULE:FREQ=DAILY',
    'SUMMARY:📖 英语复习时间到!',
    'DESCRIPTION:打开复习网页\\,完成今天的复习任务。' + (url ? '\\n' + url : ''),
    url ? 'URL:' + url : '',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:英语复习时间到!', 'TRIGGER:PT0S', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  downloadFile('每日英语复习提醒.ics', ics, 'text/calendar');
  alert('已下载日历文件,打开它并确认「添加到日历」,手机每天 ' + t.join(':') + ' 会提醒你复习。');
}
function exportProgress() {
  downloadFile('学习进度备份.json', JSON.stringify({
    type: 'efe_progress', srs: srs, days: ls('efe_days', []),
    stats: ls('efe_stats', {}), wrong: wrongBook, history: ls('efe_history', {}), gstats: ls('efe_gstats', {}), plan: ls('efe_plan', {})
  }), 'application/json');
}
function importProgress(input) {
  var f = input.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function () {
    try {
      var d = JSON.parse(r.result);
      if (d.type !== 'efe_progress') throw new Error();
      srs = d.srs || {}; saveSrs();
      lsSet('efe_days', d.days || []);
      if (d.stats) lsSet('efe_stats', d.stats);
      if (d.wrong) { wrongBook = d.wrong; saveWrong(); }
      if (d.history) lsSet('efe_history', d.history);
      if (d.gstats) lsSet('efe_gstats', d.gstats);
      if (d.plan) lsSet('efe_plan', d.plan);
      render(); alert('进度恢复成功!');
    } catch (e) { alert('这不是有效的进度备份文件'); }
  };
  r.readAsText(f);
  input.value = '';
}
function ringSvg(pct) {
  var r = 24, c = 2 * Math.PI * r;
  return '<svg width="58" height="58" viewBox="0 0 58 58"><circle cx="29" cy="29" r="' + r + '" fill="none" stroke="#e8f2f9" stroke-width="6"/>'
    + '<circle cx="29" cy="29" r="' + r + '" fill="none" stroke="#0ea5e9" stroke-width="6" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - pct / 100)).toFixed(1) + '" transform="rotate(-90 29 29)" style="transition:stroke-dashoffset .6s ease"/>'
    + '<text x="29" y="34" text-anchor="middle" font-size="14" font-weight="700" fill="#0369a1">' + pct + '%</text></svg>';
}
function downloadFile(name, content, type) {
  var blob = new Blob([content], { type: type + ';charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ===================== 单词本 ===================== */
function viewWords() {
  var h = '<div class="hint" style="margin-bottom:10px">💡 点击单词或例句可以听发音,点图片可放大</div>';
  dispLessons().forEach(function (l) {
    var open = state.openLessons[l.id];
    h += '<div class="card" id="words-' + l.id + '">'
      + '<div class="lesson-head" onclick="toggleLesson(\'' + l.id + '\')">'
      + '<div><b>' + esc(l.title) + '</b><div class="date">' + esc(l.date) + ' · ' + (l.words || []).length + ' 个单词</div></div>'
      + '<span class="arrow ' + (open ? 'open' : '') + '">▶</span></div>';
    if (open) {
      (l.words || []).forEach(function (w) {
        var s = wordStatus(w);
        h += '<div class="word-row">'
          + '<div class="w-left">'
          + '<span class="word-en speak" onclick="speak(' + jstr(w.en) + ')">🔊 ' + esc(w.en) + '</span>'
          + '<div class="w-zh">' + esc(w.zh) + '</div>'
          + (w.img ? imgTag(w.img) : '')
          + '</div>'
          + '<div class="w-ex' + (w.example ? ' speak" onclick="speak(' + jstr(w.example) + ')' : '') + '">'
          + (w.example ? esc(w.example) + (w.exampleZh ? '<br><span class="ex-zh">' + esc(w.exampleZh) + '</span>' : '') : '')
          + '</div>'
          + '<span class="badge">' + s.emoji + ' ' + s.label + (s.next !== '今天' && s.next !== '—' ? '<br>' + s.next.slice(5) : '') + '</span></div>';
      });
      h += '<div class="spacer"></div><button class="btn secondary small" onclick="startLessonQuiz(\'' + l.id + '\')">🔤 练本课单词</button>';
    }
    h += '</div>';
  });
  if (!DATA.lessons.length) h += '<div class="card">还没有课程内容。</div>';
  return h;
}
function toggleLesson(id) { state.openLessons[id] = !state.openLessons[id]; render(); }

/* ===================== 语法 ===================== */
function viewGrammar() {
  var h = '<div class="hint" style="margin-bottom:10px">💡 点击例句可以听发音</div>';
  var any = false;
  dispLessons().forEach(function (l) {
    if (!(l.grammar || []).length) return;
    any = true;
    h += '<div class="card" id="grammar-' + l.id + '"><span class="tag">' + esc(l.date) + '</span><b>' + esc(l.title) + '</b>';
    (l.grammar || []).forEach(function (g) {
      h += '<div class="gpoint"><div class="gtitle">📌 ' + esc(g.title) + '</div>'
        + '<div class="grammar-body">' + esc(g.body) + '</div>';
      (g.examples || []).forEach(function (ex) {
        h += '<div class="gex speak" onclick="speak(' + jstr(ex.en) + ')"><span class="en">🔊 ' + esc(ex.en) + '</span><div class="zh">' + esc(ex.zh || '') + '</div></div>';
      });
      h += '</div>';
    });
    if ((l.questions || []).length) h += '<div class="spacer"></div><button class="btn secondary small" onclick="startGrammarQuiz(\'' + l.id + '\')">📐 练本课语法</button>';
    h += '</div>';
  });
  if (!any) h += '<div class="card">还没有语法笔记。</div>';
  return h;
}

/* ===================== 课件 ===================== */
function viewPdfs() {
  var h = '<div class="hint" style="margin-bottom:10px">📂 每节课的课件,点击展开预览</div>';
  var any = false;
  dispLessons().forEach(function (l) {
    h += '<div class="card" id="pdf-' + l.id + '">'
      + '<div class="lesson-head" onclick="togglePdf(\'' + l.id + '\')">'
      + '<div><b>' + esc(l.title) + '</b><div class="date">' + esc(l.date) + (l.pdf ? '' : ' · 暂无课件') + '</div></div>'
      + '<span class="arrow ' + (state.openPdf[l.id] ? 'open' : '') + '">▶</span></div>';
    if (state.openPdf[l.id]) {
      if (l.pdf) {
        any = true;
        h += '<iframe class="pdf-frame" src="' + esc(l.pdf) + '"></iframe>'
          + '<div class="spacer"></div><a class="btn secondary small" href="' + esc(l.pdf) + '" target="_blank">↗ 新窗口打开</a>';
      } else {
        h += '<div class="hint">老师还没有上传这节课的课件。</div>';
      }
    }
    h += '</div>';
  });
  if (!DATA.lessons.length) h += '<div class="card">还没有课程。</div>';
  return h;
}
function togglePdf(id) { state.openPdf[id] = !state.openPdf[id]; render(); }

/* ===================== 练习 ===================== */
function viewQuiz() {
  if (state.quiz) return viewQuizQuestion();
  var due = dueWords();
  var h = '<div class="card"><h3>🧠 智能复习</h3><p style="font-size:14px;color:var(--muted)">按照艾宾浩斯记忆曲线,只练今天到期的单词。答对间隔拉长,答错明天重来;通过 60 天关卡的词成为「熟知」,不再出现。</p><div class="spacer"></div>';
  h += due.length ? '<button class="btn" onclick="startSmartQuiz()">开始(' + due.length + ' 个单词)</button>'
    : '<div class="feedback ok">今日复习已完成 🎉</div>';
  h += '</div><div class="card"><h3>🔤 单词专练</h3><p style="font-size:14px;color:var(--muted)">按课练习单词。答对当天到期的词也会推进复习进度,答错不影响原计划。</p><div class="spacer"></div>';
  dispLessons().forEach(function (l) {
    if (!(l.words || []).length) return;
    h += '<button class="btn secondary small" style="margin:0 8px 8px 0" onclick="startLessonQuiz(\'' + l.id + '\')">' + esc(l.title) + '</button>';
  });
  h += '</div><div class="card"><h3>📐 语法专练</h3><p style="font-size:14px;color:var(--muted)">按课练习语法题(含听力题),正确率会更新到统计页的语法表。</p><div class="spacer"></div>';
  var anyGQ = false;
  dispLessons().forEach(function (l) {
    if (!(l.questions || []).length) return;
    anyGQ = true;
    h += '<button class="btn secondary small" style="margin:0 8px 8px 0" onclick="startGrammarQuiz(\'' + l.id + '\')">' + esc(l.title) + '</button>';
  });
  if (!anyGQ) h += '<div class="hint">还没有语法练习题。</div>';
  h += '</div>';
  var wk = Object.keys(wrongBook);
  h += '<div class="card"><h3>📕 错词本(' + wk.length + ')</h3>';
  if (wk.length) {
    h += '<p style="font-size:14px;color:var(--muted)">答错过的词自动收进来,在错词练习中答对一次就自动移出。</p><div style="margin:8px 0">';
    wk.forEach(function (k) {
      h += '<span class="tag speak" style="margin-bottom:6px;cursor:pointer" onclick="speak(' + jstr(wrongBook[k].en) + ')">🔊 ' + esc(wrongBook[k].en) + ' ' + esc(wrongBook[k].zh || '') + '</span>';
    });
    h += '</div><button class="btn green" onclick="startWrongQuiz()">专攻错词</button>';
  } else {
    h += '<p class="hint">目前没有错词,太棒了!</p>';
  }
  h += '</div>';
  return h;
}
function buildWordQuestions(words, affectSrs) {
  var pool = allWords();
  var qs = [];
  words.forEach(function (w) {
    var types = ['e2z', 'z2e', 'listen'];
    if (w.example && w.example.toLowerCase().indexOf(w.en.toLowerCase()) >= 0) types.push('fill');
    var r = srs[wkey(w)];
    if (r && r.stage >= 2) types.push('spell');
    var t = types[Math.floor(Math.random() * types.length)];
    var q = { word: w, type: t, affectSrs: affectSrs };
    if (t === 'e2z') {
      q.prompt = '“' + w.en + '” 的意思是?';
      q.speakText = w.en;
      q.options = shuffle([w.zh].concat(pick(pool.map(function (x) { return x.zh; }).filter(function (z, i, arr) { return arr.indexOf(z) === i; }), 3, w.zh)));
      q.answer = w.zh;
    } else if (t === 'z2e') {
      q.prompt = '“' + w.zh + '” 的英文是?';
      q.options = shuffle([w.en].concat(pick(pool.map(function (x) { return x.en; }).filter(function (z, i, arr) { return arr.indexOf(z) === i; }), 3, w.en)));
      q.answer = w.en;
    } else if (t === 'listen') {
      q.prompt = '听发音,选出你听到的单词';
      q.speakText = w.en; q.autoSpeak = true;
      q.options = shuffle([w.en].concat(pick(pool.map(function (x) { return x.en; }).filter(function (z, i, arr) { return arr.indexOf(z) === i; }), 3, w.en)));
      q.answer = w.en;
    } else if (t === 'spell') {
      q.prompt = '听发音,拼写这个单词(中文意思:' + w.zh + ')';
      q.speakText = w.en; q.autoSpeak = true;
      q.input = true; q.answer = w.en;
    } else if (t === 'fill') {
      var re = new RegExp(w.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.prompt = '填空:' + w.example.replace(re, '______') + (w.exampleZh ? '\n(' + w.exampleZh + ')' : '');
      q.input = true; q.answer = w.en;
    }
    qs.push(q);
  });
  return qs;
}
function buildCustomQuestions(lessons) {
  var qs = [];
  lessons.forEach(function (l) {
    (l.questions || []).forEach(function (cq) {
      var q = { type: 'custom', lessonId: l.id, prompt: cq.q, answer: cq.answer, explain: cq.explain, affectSrs: false };
      if (cq.passage) { q.passage = cq.passage; q.speakText = cq.passage; q.autoSpeak = true; }
      if (cq.type === 'choice') q.options = shuffle((cq.options || []).slice());
      else q.input = true;
      qs.push(q);
    });
  });
  return qs;
}
function startSmartQuiz() {
  var due = dueWords().slice().sort(function (a, b) {
    var ra = srs[wkey(a)], rb = srs[wkey(b)];
    var na = ra ? ra.next : '9999', nb = rb ? rb.next : '9999';
    return na < nb ? -1 : na > nb ? 1 : 0;
  }).slice(0, 15);
  if (!due.length) return;
  var lessonIds = {};
  due.forEach(function (w) { lessonIds[w.lessonId] = true; });
  var customs = shuffle(buildCustomQuestions(DATA.lessons.filter(function (l) { return lessonIds[l.id]; }))).slice(0, 5);
  var qs = shuffle(buildWordQuestions(due, true).concat(customs));
  state.quiz = { qs: qs, idx: 0, score: 0, answered: false, title: '智能复习' };
  state.tab = 'quiz'; render(); autoSpeakCurrent();
}
function startLessonQuiz(lessonId) {
  var l = DATA.lessons.find(function (x) { return x.id === lessonId; });
  if (!l) return;
  var words = (l.words || []).map(function (w) { return Object.assign({ lessonId: l.id }, w); });
  var qs = shuffle(buildWordQuestions(words, 'gentle'));
  if (!qs.length) { alert('这一课还没有单词'); return; }
  state.quiz = { qs: qs, idx: 0, score: 0, answered: false, title: l.title + ' · 单词' };
  state.tab = 'quiz'; render(); autoSpeakCurrent();
}
function startGrammarQuiz(lessonId) {
  var l = DATA.lessons.find(function (x) { return x.id === lessonId; });
  if (!l) return;
  var qs = shuffle(buildCustomQuestions([l]));
  if (!qs.length) { alert('这一课还没有练习题'); return; }
  state.quiz = { qs: qs, idx: 0, score: 0, answered: false, title: l.title + ' · 语法' };
  state.tab = 'quiz'; render(); autoSpeakCurrent();
}
function startWrongQuiz() {
  var map = {}; allWords().forEach(function (w) { map[wkey(w)] = w; });
  var words = Object.keys(wrongBook).map(function (k) { return map[k] || { en: wrongBook[k].en, zh: wrongBook[k].zh || '' }; });
  if (!words.length) return;
  var qs = shuffle(buildWordQuestions(shuffle(words).slice(0, 15), false));
  state.quiz = { qs: qs, idx: 0, score: 0, answered: false, title: '错词本', isWrongBook: true };
  state.tab = 'quiz'; render(); autoSpeakCurrent();
}
function autoSpeakCurrent() {
  var quiz = state.quiz;
  if (quiz && quiz.idx < quiz.qs.length && quiz.qs[quiz.idx].autoSpeak) {
    var q = quiz.qs[quiz.idx];
    setTimeout(function () {
      if (state.quiz === quiz && quiz.qs[quiz.idx] === q) speak(q.speakText);
    }, 350);
  }
}
function viewQuizQuestion() {
  var quiz = state.quiz;
  if (quiz.idx >= quiz.qs.length) {
    markPracticed(); snapshot();
    var pct = Math.round(quiz.score / quiz.qs.length * 100);
    return '<div class="card center"><h3>练习完成!</h3>'
      + '<div style="font-size:44px;font-weight:800;color:var(--primary-dark);margin:10px 0">' + quiz.score + ' / ' + quiz.qs.length + '</div>'
      + '<div class="feedback ' + (pct >= 80 ? 'ok' : 'no') + '">' + (pct >= 80 ? '非常棒!继续保持 💪' : '再接再厉,答错的单词明天会再次出现 📖') + '</div>'
      + '<div class="hint">复习计划已更新,明天记得回来看看「今日」页哦。</div><div class="spacer"></div>'
      + '<button class="btn" onclick="go(\'home\')">返回首页</button></div>';
  }
  var q = quiz.qs[quiz.idx];
  var h = '<div class="card">'
    + '<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--muted)"><span>' + esc(quiz.title) + '</span><span>' + (quiz.idx + 1) + ' / ' + quiz.qs.length + '</span></div>'
    + '<div class="progress-bar"><div style="width:' + (quiz.idx / quiz.qs.length * 100) + '%"></div></div>';
  if (q.passage) h += '<div class="hint">🎧 听力题:点喇叭听短文(可反复听),然后回答问题</div>';
  h += '<div class="quiz-q" style="white-space:pre-wrap">' + fmtRich(q.prompt) + '</div>';
  if (q.word && q.word.img && q.type !== 'listen') h += imgTag(q.word.img);
  if (q.speakText) h += '<button class="big-speak" onclick="speak(' + jstr(q.speakText) + ')">' + (q.passage ? '🎧' : '🔊') + '</button>';
  if (q.options) {
    q.options.forEach(function (o, i) {
      var cls = '';
      if (quiz.answered) {
        if (o === q.answer) cls = 'correct';
        else if (o === quiz.picked) cls = 'wrong';
      }
      h += '<button class="opt ' + cls + '" ' + (quiz.answered ? 'disabled' : '') + ' onclick="answerChoice(' + i + ')">' + esc(o) + '</button>';
    });
  } else if (q.input) {
    if (!quiz.answered) {
      h += '<input type="text" id="quiz-input" autocomplete="off" autocapitalize="off" placeholder="输入答案" onkeydown="if(event.key===\'Enter\')answerInput()">'
        + '<div class="spacer"></div><button class="btn" onclick="answerInput()">提交</button>';
    }
  }
  if (quiz.answered) {
    var ok = quiz.correct;
    h += '<div class="feedback ' + (ok ? 'ok' : 'no') + '">' + (ok ? '✅ 回答正确!' : '❌ 正确答案:' + esc(q.answer)) + (q.explain ? '<br>💡 ' + esc(q.explain) : '') + (q.passage ? '<br>📄 原文:' + esc(q.passage) : '') + '</div>';
    if (q.word && !ok) h += '<div class="hint">这个单词会在明天重新出现。</div>';
    h += '<button class="btn" onclick="nextQuestion()">下一题 →</button>';
  }
  h += '</div>';
  return h;
}
function finishAnswer(correct, picked) {
  var quiz = state.quiz, q = quiz.qs[quiz.idx];
  quiz.answered = true; quiz.correct = correct; quiz.picked = picked;
  if (correct) quiz.score++;
  if (q.word && q.affectSrs) {
    if (q.affectSrs === 'gentle') {
      // 专练宽松模式:答对当天到期的词也推进记忆曲线,答错不惩罚
      if (correct && wordStatus(q.word).due) updateSrs(q.word, true);
    } else {
      updateSrs(q.word, correct);
    }
  }
  var stats = ls('efe_stats', {}), t = todayStr();
  stats[t] = stats[t] || { a: 0, c: 0, n: 0 }; stats[t].a++; if (correct) stats[t].c++;
  lsSet('efe_stats', stats);
  if (q.lessonId) {
    var g = ls('efe_gstats', {});
    g[q.lessonId] = g[q.lessonId] || { a: 0, c: 0 };
    g[q.lessonId].a++; if (correct) g[q.lessonId].c++;
    g[q.lessonId].last = t;
    lsSet('efe_gstats', g);
  }
  if (q.word) {
    var k = wkey(q.word);
    if (!correct) {
      wrongBook[k] = { en: q.word.en, zh: q.word.zh, n: (wrongBook[k] ? wrongBook[k].n : 0) + 1 };
      saveWrong(); speak(q.word.en);
    } else if (quiz.isWrongBook && wrongBook[k]) {
      delete wrongBook[k]; saveWrong();
    }
  }
  render();
}
function answerChoice(i) {
  var quiz = state.quiz, q = quiz.qs[quiz.idx];
  if (quiz.answered) return;
  var picked = q.options[i];
  finishAnswer(picked === q.answer, picked);
}
function answerInput() {
  var quiz = state.quiz, q = quiz.qs[quiz.idx];
  if (quiz.answered) return;
  var v = (document.getElementById('quiz-input').value || '').trim().toLowerCase();
  if (!v) return;
  finishAnswer(v === String(q.answer).trim().toLowerCase(), v);
}
function nextQuestion() {
  state.quiz.idx++; state.quiz.answered = false; state.quiz.picked = null;
  render(); autoSpeakCurrent();
}

/* ===================== 统计 ===================== */
function viewStats() {
  var all = allWords();
  var counts = { todo: 0, forgot: 0, known: 0, master: 0 };
  all.forEach(function (w) { counts[wordStatus(w).key]++; });
  var histAll = ls('efe_history', {});
  var dsAll = Object.keys(histAll).sort();
  var msg = '🌱 从今天开始积累你的记忆曲线吧!';
  if (dsAll.length >= 2) {
    var cur = histAll[dsAll[dsAll.length - 1]], prev = histAll[dsAll[dsAll.length - 2]];
    var dm = (cur.m || 0) - (prev.m || 0), dt = (cur.total || 0) - (prev.total || 0);
    if (dm > 0) msg = '🎉 比上次多了 ' + dm + ' 个熟知单词,继续保持!';
    else if (dt > 0) msg = '📈 已学单词比上次增加了 ' + dt + ' 个!';
    else msg = '☀️ 坚持就是胜利,今天也来练一练吧!';
  }
  var h = '<div class="card"><h3>🧠 记忆总览</h3><div class="hint" style="margin-bottom:8px">' + msg + '</div><div class="stat-row">'
    + '<div class="stat"><div class="num">' + counts.master + '</div><div class="lbl">😎 熟知</div></div>'
    + '<div class="stat"><div class="num">' + counts.known + '</div><div class="lbl">🙂 认识</div></div>'
    + '<div class="stat"><div class="num">' + counts.forgot + '</div><div class="lbl">😵 忘记</div></div>'
    + '<div class="stat"><div class="num">' + counts.todo + '</div><div class="lbl">📌 待学</div></div>'
    + '</div></div>';
  // 记忆持久度历史曲线
  var hist = ls('efe_history', {});
  var dates = Object.keys(hist).sort().slice(-30);
  h += '<div class="card"><h3>📈 记忆持久度</h3>';
  if (dates.length >= 2) {
    var series = [
      { key: 'total', color: '#0ea5e9', name: '已学单词' },
      { key: 'p10', color: '#f59e0b', name: '持久度≥10天' },
      { key: 'p30', color: '#10b981', name: '持久度≥30天' },
      { key: 'm', color: '#065f46', name: '熟知' }
    ];
    h += lineChart(dates.map(function (d) { return hist[d]; }), dates, series);
    h += '<div class="legend">' + series.map(function (s) { return '<i style="background:' + s.color + '"></i>' + s.name + '(' + (hist[dates[dates.length - 1]][s.key] || 0) + ')'; }).join('') + '</div>';
  } else {
    h += '<div class="hint">从今天开始记录。坚持练习几天后,这里会画出你的记忆增长曲线:已学单词数、记忆持久度≥10天/≥30天的词汇量、熟知词汇量。</div>';
  }
  h += '</div>';
  // 每日学习情况
  var stats = ls('efe_stats', {});
  var days = []; for (var i = 13; i >= 0; i--) days.push(todayStr(-i));
  var hasAny = days.some(function (d) { return stats[d]; });
  h += '<div class="card"><h3>📊 最近14天学习情况</h3>';
  if (hasAny) {
    h += barChart(days, stats);
    h += '<div class="legend"><i style="background:#0ea5e9"></i>答对<i style="background:#fca5a5"></i>答错<i style="background:#fbbf24"></i>新学</div>';
  } else {
    h += '<div class="hint">还没有练习记录,完成一次练习后这里会显示每天的答题情况。</div>';
  }
  h += '</div>';
  // 单词表
  h += '<div class="card"><h3>📚 单词表</h3><div>';
  [['all', '全部 ' + all.length], ['todo', '📌 待学 ' + counts.todo], ['forgot', '😵 忘记 ' + counts.forgot], ['known', '🙂 认识 ' + counts.known], ['master', '😎 熟知 ' + counts.master]].forEach(function (f) {
    h += '<span class="chip ' + (state.statFilter === f[0] ? 'on' : '') + '" onclick="state.statFilter=\'' + f[0] + '\';render()">' + f[1] + '</span>';
  });
  h += '</div><table class="stat-table"><tr><th>单词</th><th>状态</th><th>下次复习</th></tr>';
  var shown = 0;
  all.forEach(function (w) {
    var s = wordStatus(w);
    if (state.statFilter !== 'all' && s.key !== state.statFilter) return;
    shown++;
    h += '<tr><td><span class="speak" style="font-weight:600;color:var(--primary-dark)" onclick="speak(' + jstr(w.en) + ')">' + esc(w.en) + '</span> <span style="color:var(--muted);font-size:12px">' + esc(w.zh) + '</span></td>'
      + '<td>' + s.emoji + ' ' + s.label + '</td><td style="font-size:13px;color:var(--muted)">' + s.next + '</td></tr>';
  });
  if (!shown) h += '<tr><td colspan="3" class="hint">这个分类下没有单词</td></tr>';
  h += '</table></div>';
  // 语法表
  var g = ls('efe_gstats', {});
  h += '<div class="card"><h3>📐 语法表</h3><table class="stat-table"><tr><th>语法点</th><th>所属课</th><th>练习情况</th></tr>';
  var anyG = false;
  DATA.lessons.forEach(function (l) {
    (l.grammar || []).forEach(function (gp) {
      anyG = true;
      var st = g[l.id];
      var info = st && st.a ? Math.round(st.c / st.a * 100) + '% (' + st.a + '题) · ' + (st.last || '').slice(5) : '未练习';
      var em = !st || !st.a ? '📌' : (st.c / st.a >= 0.8 ? '😎' : st.c / st.a >= 0.5 ? '🙂' : '😵');
      h += '<tr><td>' + esc(gp.title) + '</td><td style="font-size:12px;color:var(--muted)">' + esc(l.title) + '</td><td style="font-size:13px">' + em + ' ' + info + '</td></tr>';
    });
  });
  if (!anyG) h += '<tr><td colspan="3" class="hint">还没有语法内容</td></tr>';
  h += '</table><div class="hint">语法掌握度按该课练习题的正确率统计:😎 ≥80% · 🙂 ≥50% · 😵 <50% · 📌 未练习</div></div>';
  return h;
}
function lineChart(rows, dates, series) {
  var W = 320, H = 150, P = 6;
  var max = 1;
  rows.forEach(function (r) { series.forEach(function (s) { if ((r[s.key] || 0) > max) max = r[s.key]; }); });
  var x = function (i) { return P + i * (W - 2 * P) / Math.max(1, rows.length - 1); };
  var y = function (v) { return H - P - v * (H - 2 * P) / max; };
  var svg = '<svg viewBox="0 0 ' + W + ' ' + (H + 16) + '" style="width:100%">';
  [0.25, 0.5, 0.75, 1].forEach(function (f) {
    svg += '<line x1="' + P + '" y1="' + y(max * f) + '" x2="' + (W - P) + '" y2="' + y(max * f) + '" stroke="#f1f5f9" stroke-width="1"/>'
      + '<text x="' + P + '" y="' + (y(max * f) - 2) + '" font-size="8" fill="#cbd5e1">' + Math.round(max * f) + '</text>';
  });
  series.forEach(function (s) {
    var pts = rows.map(function (r, i) { return x(i) + ',' + y(r[s.key] || 0); }).join(' ');
    svg += '<polyline points="' + pts + '" fill="none" stroke="' + s.color + '" stroke-width="2"/>';
    rows.forEach(function (r, i) { svg += '<circle cx="' + x(i) + '" cy="' + y(r[s.key] || 0) + '" r="2.5" fill="' + s.color + '"/>'; });
  });
  svg += '<text x="' + P + '" y="' + (H + 12) + '" font-size="9" fill="#94a3b8">' + dates[0].slice(5) + '</text>'
    + '<text x="' + (W - P) + '" y="' + (H + 12) + '" font-size="9" fill="#94a3b8" text-anchor="end">' + dates[dates.length - 1].slice(5) + '</text></svg>';
  return svg;
}
function barChart(days, stats) {
  var W = 320, H = 140, P = 6;
  var max = 1;
  days.forEach(function (d) { var s = stats[d]; if (s && s.a > max) max = s.a; });
  var bw = (W - 2 * P) / days.length - 3;
  var svg = '<svg viewBox="0 0 ' + W + ' ' + (H + 16) + '" style="width:100%">';
  days.forEach(function (d, i) {
    var s = stats[d] || { a: 0, c: 0, n: 0 };
    var x = P + i * ((W - 2 * P) / days.length);
    var hC = s.c / max * (H - 2 * P), hW = (s.a - s.c) / max * (H - 2 * P), hN = Math.min(s.n || 0, s.a) ? 3 : 0;
    var yBase = H - P;
    if (s.c) svg += '<rect x="' + x + '" y="' + (yBase - hC) + '" width="' + bw + '" height="' + hC + '" rx="1.5" fill="#0ea5e9"/>';
    if (s.a - s.c) svg += '<rect x="' + x + '" y="' + (yBase - hC - hW) + '" width="' + bw + '" height="' + hW + '" rx="1.5" fill="#fca5a5"/>';
    if (s.n) svg += '<rect x="' + x + '" y="' + (yBase - hC - hW - 4) + '" width="' + bw + '" height="3" rx="1.5" fill="#fbbf24"/>';
    if (i % 3 === 0 || i === days.length - 1) svg += '<text x="' + (x + bw / 2) + '" y="' + (H + 12) + '" font-size="8" fill="#94a3b8" text-anchor="middle">' + d.slice(5) + '</text>';
  });
  svg += '</svg>';
  return svg;
}

/* ===================== 教师区 ===================== */
document.getElementById('teacher-link').onclick = function (e) {
  e.preventDefault();
  if (state.teacher) { state.teacher = false; if (state.tab === 'teacher') state.tab = 'home'; render(); return; }
  var pin = prompt('请输入教师密码:');
  if (pin === (DATA.config.pin || '8888')) { state.teacher = true; state.tab = 'teacher'; render(); }
  else if (pin !== null) alert('密码不正确');
};
function wordsToText(words) {
  return (words || []).map(function (w) {
    var parts = [w.en, w.zh, w.example || '', w.exampleZh || '', w.img || ''];
    while (parts.length && !parts[parts.length - 1]) parts.pop();
    return parts.join(' | ');
  }).join('\n');
}
function grammarToText(gs) {
  return (gs || []).map(function (g) {
    var lines = ['## ' + g.title, g.body];
    (g.examples || []).forEach(function (ex) { lines.push('- ' + ex.en + ' | ' + (ex.zh || '')); });
    return lines.join('\n');
  }).join('\n\n');
}
function questionsToText(qs) {
  return (qs || []).map(function (q) {
    if (q.passage) return [(q.type === 'choice' ? '听力选择' : '听力填空'), q.passage, q.q, (q.options || []).join(';'), q.answer, q.explain || ''].join(' | ');
    return [(q.type === 'choice' ? '选择' : '填空'), q.q, (q.options || []).join(';'), q.answer, q.explain || ''].join(' | ');
  }).join('\n');
}
function parseWords(text) {
  return text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
    var p = l.split('|').map(function (x) { return x.trim(); });
    return { en: p[0] || '', zh: p[1] || '', example: p[2] || '', exampleZh: p[3] || '', img: p[4] || '' };
  }).filter(function (w) { return w.en && w.zh; });
}
function parseGrammar(text) {
  var gs = [], cur = null;
  text.split('\n').forEach(function (line) {
    if (line.trim().startsWith('## ')) {
      if (cur) gs.push(cur);
      cur = { title: line.trim().slice(3), body: '', examples: [] };
    } else if (cur && line.trim().startsWith('- ')) {
      var p = line.trim().slice(2).split('|').map(function (x) { return x.trim(); });
      cur.examples.push({ en: p[0] || '', zh: p[1] || '' });
    } else if (cur) {
      cur.body += (cur.body ? '\n' : '') + line;
    }
  });
  if (cur) gs.push(cur);
  gs.forEach(function (g) { g.body = g.body.trim(); });
  return gs;
}
function parseQuestions(text) {
  return text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
    var p = l.split('|').map(function (x) { return x.trim(); });
    var q;
    if (p[0].indexOf('听力') === 0) {
      var type = p[0].indexOf('选择') >= 0 ? 'choice' : 'fill';
      q = { type: type, passage: p[1] || '', q: p[2] || '', answer: p[4] || '', explain: p[5] || '' };
      if (type === 'choice') q.options = (p[3] || '').split(/[;;]/).map(function (x) { return x.trim(); }).filter(Boolean);
    } else {
      var type2 = p[0] === '选择' ? 'choice' : 'fill';
      q = { type: type2, q: p[1] || '', answer: p[3] || '', explain: p[4] || '' };
      if (type2 === 'choice') q.options = (p[2] || '').split(/[;;]/).map(function (x) { return x.trim(); }).filter(Boolean);
    }
    return q;
  }).filter(function (q) { return q.q && q.answer; });
}
function viewTeacher() {
  var h = '';
  if (state.editing !== null) return viewLessonEditor();
  h += '<div class="card"><h3>📋 课程管理</h3><div class="hint" style="margin-bottom:8px">这里按教学顺序排列(第一课在最上面),↑↓ 可调整。学生页面默认「最新在前」倒序显示,目录顶部可切换正序/倒序。</div>';
  DATA.lessons.forEach(function (l, i) {
    h += '<div class="word-row"><div style="flex:1;min-width:0"><b>' + esc(l.title) + '</b><div class="hint">' + esc(l.date) + ' · ' + (l.words || []).length + ' 词 · ' + (l.grammar || []).length + ' 语法 · ' + (l.questions || []).length + ' 题' + (l.pdf ? ' · 📂课件' : '') + '</div></div>'
      + '<button class="btn secondary small" ' + (i === 0 ? 'disabled' : '') + ' onclick="moveLesson(\'' + l.id + '\',-1)">↑</button>&nbsp;'
      + '<button class="btn secondary small" ' + (i === DATA.lessons.length - 1 ? 'disabled' : '') + ' onclick="moveLesson(\'' + l.id + '\',1)">↓</button>&nbsp;'
      + '<button class="btn secondary small" onclick="editLesson(\'' + l.id + '\')">编辑</button>&nbsp;'
      + '<button class="btn danger small" onclick="deleteLesson(\'' + l.id + '\')">删除</button></div>';
  });
  h += '<div class="spacer"></div><button class="btn green" onclick="editLesson(null)">➕ 添加新课</button></div>';
  h += '<div class="card"><h3>📤 发布更新</h3>'
    + '<p style="font-size:14px;color:var(--muted)">编辑内容会先保存在本机浏览器里。要让学生看到更新,请导出新的网页文件并重新上传到 GitHub。</p><div class="spacer"></div>'
    + '<button class="btn" onclick="exportHtml()">⬇️ 导出更新后的网页文件</button><div class="spacer"></div>'
    + '<button class="btn secondary small" onclick="exportJson()">备份内容(JSON)</button> '
    + '<button class="btn secondary small" onclick="document.getElementById(\'import-json\').click()">导入备份</button>'
    + '<input type="file" id="import-json" accept=".json" style="display:none" onchange="importJson(this)">'
    + '</div>';
  h += '<div class="card"><h3>❓ 使用说明</h3><div style="font-size:14px;color:var(--muted);line-height:1.8">'
    + '1️⃣ 每次上完课(不必每天),在「添加新课」里录入当天的单词、语法和题目,新课会出现在列表最上面,可用 ↑↓ 调整顺序。<br>'
    + '2️⃣ 图片和课件 PDF 都建议传到你的 GitHub 仓库:仓库里建 images 和 pdfs 文件夹,上传文件后,链接直接填相对路径,如 images/farm.jpg、pdfs/unit4.pdf。注意必须是图片/PDF 文件本身,不能是网盘分享页或搜索结果页的链接。<br>'
    + '3️⃣ 点「导出更新后的网页文件」得到 index.html,到仓库页面 Add file → Upload files 覆盖上传 → Commit。等一两分钟生效,<b>链接永远不变</b>,学生进度保留。<br>'
    + '4️⃣ 复习按「到期制」工作:学生哪天打开,首页就列出所有已到期(含逾期)的单词,晚复习不会丢;答对后按 1/2/4/7/15/30/60 天拉长间隔,通过 60 天关卡后成为「熟知」,不再复习。上课不规律、学生不每天打开都没关系。<br>'
    + '5️⃣ 学生进度和统计数据存在他手机浏览器里,关机不丢;换设备、清数据会丢,iPhone 长期(约一周以上)不打开也可能被系统清理。提醒他把链接加到主屏幕,偶尔在首页点「备份进度」。<br>'
    + '6️⃣ 你的编辑内容同样存在你当前浏览器里。换电脑编辑前,先在旧设备「备份内容(JSON)」,新设备上「导入备份」;每次编辑后务必导出并重新发布。<br>'
    + '当前教师密码:' + esc(DATA.config.pin || '8888') + '(可在编辑课程页面下方修改)</div></div>';
  return h;
}
function moveLesson(id, dir) {
  var i = DATA.lessons.findIndex(function (l) { return l.id === id; });
  var j = i + dir;
  if (i < 0 || j < 0 || j >= DATA.lessons.length) return;
  var t = DATA.lessons[i]; DATA.lessons[i] = DATA.lessons[j]; DATA.lessons[j] = t;
  persistData(); render();
}
function editLesson(id) {
  if (id === null) {
    state.editing = { id: 'L' + Date.now(), date: todayStr(), title: '', words: [], grammar: [], questions: [], pdf: '', isNew: true };
  } else {
    var l = DATA.lessons.find(function (x) { return x.id === id; });
    state.editing = JSON.parse(JSON.stringify(l)); state.editing.isNew = false;
  }
  render();
}
function deleteLesson(id) {
  if (!confirm('确定删除这一课吗?')) return;
  DATA.lessons = DATA.lessons.filter(function (l) { return l.id !== id; });
  persistData(); render();
}
function viewLessonEditor() {
  var l = state.editing;
  return '<div class="card"><h3>' + (l.isNew ? '➕ 添加新课' : '✏️ 编辑课程') + '</h3>'
    + '<div class="field"><label>日期</label><input type="date" id="f-date" value="' + esc(l.date) + '"></div>'
    + '<div class="field"><label>课程标题</label><input type="text" id="f-title" value="' + esc(l.title) + '" placeholder="例如:Unit 11 · 日常活动"></div>'
    + '<div class="field"><label>单词(每行一个)</label><textarea id="f-words" style="min-height:130px" placeholder="apple | 苹果 | I eat an apple. | 我吃一个苹果。 | images/apple.jpg">' + esc(wordsToText(l.words)) + '</textarea>'
    + '<div class="fmt">格式:英文 | 中文 | 例句(可选) | 例句翻译(可选) | 图片链接(可选)</div></div>'
    + '<div class="field"><label>语法笔记</label><textarea id="f-grammar" style="min-height:130px" placeholder="## 语法点标题&#10;说明文字...&#10;- 例句 | 例句翻译">' + esc(grammarToText(l.grammar)) + '</textarea>'
    + '<div class="fmt">格式:\n## 语法点标题\n说明文字(可多行)\n- This is an example. | 这是一个例句。</div></div>'
    + '<div class="field"><label>自定义练习题(每行一题)</label><textarea id="f-questions" style="min-height:110px" placeholder="选择 | She ____ happy. | am;is;are | is | 第三人称单数用 is">' + esc(questionsToText(l.questions)) + '</textarea>'
    + '<div class="fmt">格式:\n选择 | 题目 | 选项1;选项2;选项3 | 正确答案 | 解析(可选)\n填空 | 题目(空格处写____) | (留空) | 正确答案 | 解析(可选)\n听力选择 | 朗读的短文 | 题目 | 选项1;选项2 | 正确答案 | 解析(可选)\n听力填空 | 朗读的短文 | 题目 | (留空) | 正确答案 | 解析(可选)\n题目里可插入图片:[img:images/图片.jpg]</div></div>'
    + '<div class="field"><label>课件 PDF 链接(可选)</label><input type="text" id="f-pdf" value="' + esc(l.pdf || '') + '" placeholder="pdfs/unit4.pdf"></div>'
    + '<div class="field"><label>网站链接(部署后填,提醒和主屏幕用)</label><input type="text" id="f-site" value="' + esc(DATA.config.siteUrl || '') + '" placeholder="https://你的用户名.github.io/仓库名/"></div>'
    + '<div class="field"><label>教师密码(可修改)</label><input type="text" id="f-pin" value="' + esc(DATA.config.pin || '8888') + '"></div>'
    + '<button class="btn green" onclick="saveLesson()">💾 保存</button> '
    + '<button class="btn secondary" onclick="state.editing=null;render()">取消</button></div>';
}
function saveLesson() {
  var l = state.editing;
  l.date = document.getElementById('f-date').value || todayStr();
  l.title = document.getElementById('f-title').value.trim() || ('课程 ' + l.date);
  l.words = parseWords(document.getElementById('f-words').value);
  l.grammar = parseGrammar(document.getElementById('f-grammar').value);
  l.questions = parseQuestions(document.getElementById('f-questions').value);
  l.pdf = document.getElementById('f-pdf').value.trim();
  DATA.config.pin = document.getElementById('f-pin').value.trim() || '8888';
  DATA.config.siteUrl = document.getElementById('f-site').value.trim();
  var isNew = l.isNew;
  delete l.isNew;
  var idx = DATA.lessons.findIndex(function (x) { return x.id === l.id; });
  if (idx >= 0) DATA.lessons[idx] = l; else DATA.lessons.push(l);
  state.editing = null;
  persistData(); render();
  alert('已保存!' + (isNew ? '新课已加入教学顺序末尾(倒序显示时在最上面)。' : '') + '别忘了在「发布更新」里导出文件并重新上传,学生才能看到。');
}
function persistData() {
  DATA.rev = (DATA.rev || 0) + 1;
  lsSet('efe_data_override', DATA);
}
function exportHtml() {
  var json = JSON.stringify(DATA, null, 2).replace(/</g, '\\u003c');
  var out = window.__PRISTINE__.replace(/(<script id="lesson-data"[^>]*>)[\s\S]*?(<\/script)/, function (m, p1, p2) {
    return p1 + '\n' + json + '\n' + p2;
  });
  downloadFile('index.html', out, 'text/html');
}
function exportJson() {
  downloadFile('英语复习内容备份.json', JSON.stringify(DATA, null, 2), 'application/json');
}
function importJson(input) {
  var f = input.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function () {
    try {
      var d = JSON.parse(r.result);
      if (!d.lessons) throw new Error();
      DATA = d; persistData(); render(); alert('导入成功!');
    } catch (e) { alert('文件格式不正确'); }
  };
  r.readAsText(f);
  input.value = '';
}

function init() {
  document.getElementById('app-title').textContent = DATA.config.title || '每日英语复习';
  document.getElementById('app-sub').textContent = (DATA.config.book || '') + ' · 跟着艾宾浩斯曲线记单词';
  snapshot();
  render();
}
window.addEventListener('resize', buildToc);
