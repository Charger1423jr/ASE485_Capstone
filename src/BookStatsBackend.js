// ─── BookStatsBackend.js ──────────────────────────────────────────────────────

const STATS_BLUE      = '#224499';
const STATS_BLUE_LITE = 'rgba(34,68,153,0.15)';
const STATS_PALETTE   = ['#224499','#3a6ae0','#5599ff','#7aabff','#a0c4ff','#1a7a4a','#2db36f','#5dcaa5','#f5c518','#fd7e14','#dc3545','#6f42c1','#20c997','#e83e8c'];

const _charts = {};
function destroyChart(id) { if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; } }
function makeChart(id, config) {
    destroyChart(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;
    _charts[id] = new Chart(ctx, config);
}

// ─── Date / format helpers ────────────────────────────────────────────────────

function parseBookDate(s) {
    if (!s) return null;
    const p = s.split('-');
    if (p.length !== 3) return null;
    return new Date(+p[2], +p[0]-1, +p[1]);
}

const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtNum(n) { return Number(n).toLocaleString(); }
function fmtTime(sec) {
    const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function monthKey(d) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }

function last13Months() {
    const now = new Date(), res = [];
    for (let i=12; i>=0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
        res.push({ label: MON[d.getMonth()]+' \''+String(d.getFullYear()).slice(2), key: monthKey(d), d });
    }
    return res;
}

function setSummary(id, html) { const el=document.getElementById(id); if(el) el.innerHTML=html; }

function badge(label, value, color) {
    color = color || STATS_BLUE;
    return `<span class="stat-badge" style="border-color:${color}">
        <span class="stat-badge-label">${label}</span>
        <span class="stat-badge-value" style="color:${color}">${value}</span>
    </span>`;
}

// ─── Books Read ───────────────────────────────────────────────────────────────

function renderBooksRead(books) {
    const now = new Date();
    const yr1 = new Date(now.getFullYear()-1,0,1);
    const mo1 = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const inYr = books.filter(b => { const d=parseBookDate(b.dateRead); return d&&d>=yr1; });
    const inMo = books.filter(b => { const d=parseBookDate(b.dateRead); return d&&d>=mo1; });

    setSummary('booksReadSummary',
        badge('Total', fmtNum(books.length)) +
        badge('Last 12 Months', fmtNum(inYr.length)) +
        badge('Last Month', fmtNum(inMo.length))
    );

    const months = last13Months();
    makeChart('booksReadChart', {
        type:'bar',
        data:{ labels: months.map(m=>m.label), datasets:[{ label:'Books Read',
            data: months.map(m => books.filter(b=>{ const d=parseBookDate(b.dateRead); return d&&monthKey(d)===m.key; }).length),
            backgroundColor: STATS_BLUE, borderRadius:4 }]},
        options:{ responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,ticks:{stepSize:1}}} }
    });
}

// ─── Points ───────────────────────────────────────────────────────────────────

function renderPoints(books) {
    const now = new Date();
    const yearMap = {};
    books.forEach(b => { const d=parseBookDate(b.dateRead); if(!d) return; const yr=d.getFullYear(); yearMap[yr]=(yearMap[yr]||0)+b.wordCount; });
    const years = Object.keys(yearMap).sort();
    setSummary('pointsSummary',
        badge('This Year', ((yearMap[now.getFullYear()]||0)/10000).toFixed(2)+' pts') +
        badge('Calculation', 'Words ÷ 10,000')
    );
    makeChart('pointsChart', {
        type:'bar',
        data:{ labels:years, datasets:[{ label:'Points', data:years.map(yr=>(yearMap[yr]/10000).toFixed(2)), backgroundColor:'#3a6ae0', borderRadius:4 }]},
        options:{ responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
    });
}

// ─── Word Count ───────────────────────────────────────────────────────────────

function renderWordCount(books) {
    const now = new Date();
    const total = books.reduce((s,b)=>s+b.wordCount,0);
    const yearW = books.filter(b=>{ const d=parseBookDate(b.dateRead); return d&&d.getFullYear()===now.getFullYear(); }).reduce((s,b)=>s+b.wordCount,0);
    const mo1   = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const moW   = books.filter(b=>{ const d=parseBookDate(b.dateRead); return d&&d>=mo1; }).reduce((s,b)=>s+b.wordCount,0);

    setSummary('wordCountSummary',
        badge('Total', fmtNum(total)) +
        badge('This Year', fmtNum(yearW)) +
        badge('Last Month', fmtNum(moW))
    );

    const months = last13Months();
    makeChart('wordCountChart', {
        type:'line',
        data:{ labels:months.map(m=>m.label), datasets:[{ label:'Words Read',
            data: months.map(m => books.filter(b=>{ const d=parseBookDate(b.dateRead); return d&&monthKey(d)===m.key; }).reduce((s,b)=>s+b.wordCount,0)),
            borderColor:STATS_BLUE, backgroundColor:STATS_BLUE_LITE, fill:true, tension:.3, pointRadius:4 }]},
        options:{ responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
    });
}

// ─── Submissions ──────────────────────────────────────────────────────────────

function renderSubmissions(books) {
    const yearMap={}, monthMap={};
    books.forEach(b=>{
        const d=parseBookDate(b.dateRead); if(!d) return;
        const yr=d.getFullYear(), mo=d.getMonth();
        yearMap[yr]=(yearMap[yr]||0)+1;
        if(!monthMap[yr]) monthMap[yr]=Array(12).fill(0);
        monthMap[yr][mo]++;
    });
    const years=Object.keys(yearMap).sort();

    makeChart('submissionsYearChart', {
        type:'bar',
        data:{ labels:years, datasets:[{ label:'Books', data:years.map(yr=>yearMap[yr]), backgroundColor:'#5599ff', borderRadius:4 }]},
        options:{ responsive:true, plugins:{legend:{display:false},title:{display:true,text:'Submissions by Year'}}, scales:{y:{beginAtZero:true,ticks:{stepSize:1}}} }
    });

    makeChart('submissionsMonthChart', {
        type:'bar',
        data:{ labels:MON, datasets:Object.keys(monthMap).sort().map((yr,i)=>({ label:yr, data:monthMap[yr], backgroundColor:STATS_PALETTE[i%STATS_PALETTE.length], borderRadius:2 }))},
        options:{ responsive:true, plugins:{title:{display:true,text:'Submissions by Month (per Year)'}}, scales:{y:{beginAtZero:true,ticks:{stepSize:1}}} }
    });
}

// ─── Ratings ──────────────────────────────────────────────────────────────────

function renderRatings(books) {
    const buckets={1:0,2:0,3:0,4:0,5:0};
    const rated = books.filter(b=>b.rating&&b.rating>0);
    rated.forEach(b=>{ const bk=Math.floor(b.rating); if(bk>=1&&bk<=5) buckets[bk]++; });
    const avg = rated.length ? (rated.reduce((s,b)=>s+b.rating,0)/rated.length).toFixed(2) : 'N/A';

    setSummary('ratingsSummary',
        badge('Rated Books', fmtNum(rated.length)) +
        badge('Avg Rating', avg!=='N/A' ? avg+' / 5' : 'N/A')
    );
    makeChart('ratingsChart', {
        type:'bar',
        data:{ labels:['1 ★','2 ★','3 ★','4 ★','5 ★'], datasets:[{ label:'Books',
            data:[buckets[1],buckets[2],buckets[3],buckets[4],buckets[5]],
            backgroundColor:['#dc3545','#fd7e14','#f5c518','#5dcaa5','#224499'], borderRadius:4 }]},
        options:{ responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,ticks:{stepSize:1}}} }
    });
}

// ─── WPM ─────────────────────────────────────────────────────────────────────

function renderWpm(wpmHistory) {
    const now = new Date();
    const yr1 = new Date(now.getFullYear()-1,0,1);
    const mo1 = new Date(now.getFullYear(),now.getMonth()-1,1);
    const inYr = wpmHistory.filter(r=>new Date(r.date)>=yr1);
    const inMo = wpmHistory.filter(r=>new Date(r.date)>=mo1);
    const avg  = wpmHistory.length ? Math.round(wpmHistory.reduce((s,r)=>s+r.wpm,0)/wpmHistory.length) : 'N/A';

    setSummary('wpmCountSummary',
        badge('Total Tests', fmtNum(wpmHistory.length)) +
        badge('Last 12 Months', fmtNum(inYr.length)) +
        badge('Last Month', fmtNum(inMo.length)) +
        badge('Avg WPM', avg)
    );

    makeChart('wpmResultsChart', {
        type:'line',
        data:{ labels:wpmHistory.map((_,i)=>'Test '+(i+1)), datasets:[{ label:'WPM',
            data:wpmHistory.map(r=>r.wpm), borderColor:'#3a6ae0', backgroundColor:'rgba(58,106,224,.15)',
            fill:true, tension:.3, pointRadius:5 }]},
        options:{ responsive:true, plugins:{legend:{display:false}},
            scales:{ y:{beginAtZero:false,title:{display:true,text:'Words Per Minute'}}, x:{title:{display:true,text:'Test Number'}} } }
    });
}

// ─── Comprehension ────────────────────────────────────────────────────────────

function renderComprehension(compHistory) {
    const now = new Date();
    const yr1 = new Date(now.getFullYear()-1,0,1);
    const mo1 = new Date(now.getFullYear(),now.getMonth()-1,1);
    const inYr = compHistory.filter(r=>new Date(r.date)>=yr1);
    const inMo = compHistory.filter(r=>new Date(r.date)>=mo1);
    const avg  = compHistory.length ? Math.round(compHistory.reduce((s,r)=>s+r.percentage,0)/compHistory.length) : 'N/A';

    setSummary('compCountSummary',
        badge('Total Tests', fmtNum(compHistory.length)) +
        badge('Last 12 Months', fmtNum(inYr.length)) +
        badge('Last Month', fmtNum(inMo.length)) +
        badge('Avg Score', avg!=='N/A' ? avg+'%' : 'N/A')
    );

    const scores = compHistory.map(r=>r.score);
    makeChart('compResultsChart', {
        type:'bar',
        data:{ labels:compHistory.map((_,i)=>'Test '+(i+1)), datasets:[
            { label:'Correct (0–4)', data:scores, yAxisID:'yScore', borderRadius:4,
              backgroundColor:scores.map(s=>s>=4?'#224499':s>=3?'#3a6ae0':s>=2?'#f5c518':'#dc3545') },
            { label:'Score %', data:compHistory.map(r=>r.percentage), type:'line', yAxisID:'yPct',
              borderColor:'#5dcaa5', backgroundColor:'transparent', tension:.3, pointRadius:4 }
        ]},
        options:{ responsive:true, plugins:{legend:{position:'top'}},
            scales:{
                yScore:{ beginAtZero:true, max:4, ticks:{stepSize:1}, title:{display:true,text:'Correct'}, position:'left' },
                yPct:{   beginAtZero:true, max:100, title:{display:true,text:'Score %'}, position:'right', grid:{drawOnChartArea:false} },
                x:{ title:{display:true,text:'Test Number'} }
            }}
    });
}

// ─── Reading Time ─────────────────────────────────────────────────────────────

function renderReadingTime(bookHelpData) {
    const now = new Date();
    const total   = (bookHelpData&&bookHelpData.totalReadingTime) || 0;
    const byMonth = (bookHelpData&&bookHelpData.readingTimeByMonth) || {};
    let yrSec=0, moSec=0;
    for (let i=0;i<12;i++) {
        const d=new Date(now.getFullYear(),now.getMonth()-i,1);
        yrSec += (byMonth[monthKey(d)]||0);
        if(i===0) moSec = (byMonth[monthKey(d)]||0);
    }
    setSummary('timeSummary',
        badge('Total', fmtTime(total),'#1a7a4a') +
        badge('Last 12 Months', fmtTime(yrSec),'#1a7a4a') +
        badge('Last Month', fmtTime(moSec),'#1a7a4a')
    );
    const months = last13Months();
    makeChart('readingTimeChart', {
        type:'bar',
        data:{ labels:months.map(m=>m.label), datasets:[{ label:'Minutes Read',
            data:months.map(m=>Math.round((byMonth[m.key]||0)/60)), backgroundColor:'#1a7a4a', borderRadius:4 }]},
        options:{ responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,title:{display:true,text:'Minutes'}}} }
    });
}

// ─── BookNotes stats ──────────────────────────────────────────────────────────

function renderNotesStats(collections) {
    const now = new Date();
    const yr1 = new Date(now.getFullYear()-1,0,1);
    const mo1 = new Date(now.getFullYear(),now.getMonth()-1,1);

    // Flatten all notes from all collections
    const allNotes = collections.flatMap(c => c.notes || []);
    const totalNotes = allNotes.length;
    const inYr = allNotes.filter(n => new Date(n.createdAt) >= yr1).length;
    const inMo = allNotes.filter(n => new Date(n.createdAt) >= mo1).length;

    setSummary('notesSummary',
        badge('Total Notes', fmtNum(totalNotes), '#6f42c1') +
        badge('Last 12 Months', fmtNum(inYr), '#6f42c1') +
        badge('Last Month', fmtNum(inMo), '#6f42c1') +
        badge('Collections', fmtNum(collections.length), '#6f42c1')
    );

    // Notes per month (last 13 months)
    const months = last13Months();
    makeChart('notesMonthChart', {
        type:'bar',
        data:{ labels:months.map(m=>m.label), datasets:[{ label:'Notes Created',
            data:months.map(m => allNotes.filter(n=>{ const d=new Date(n.createdAt); return monthKey(d)===m.key; }).length),
            backgroundColor:'#6f42c1', borderRadius:4 }]},
        options:{ responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,ticks:{stepSize:1}}} }
    });

    // Notes per collection (bar)
    const colLabels = collections.map(c=>c.title.length>18?c.title.slice(0,16)+'…':c.title);
    const colCounts = collections.map(c=>(c.notes||[]).length);
    makeChart('notesColChart', {
        type:'bar',
        data:{ labels:colLabels, datasets:[{ label:'Notes',
            data:colCounts,
            backgroundColor:collections.map((_,i)=>STATS_PALETTE[i%STATS_PALETTE.length]), borderRadius:4 }]},
        options:{ responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,ticks:{stepSize:1}}} }
    });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function loadStatsData(userData) {
    const loadingEl  = document.getElementById('statsLoading');
    const container  = document.getElementById('statsContainer');
    const emptyEl    = document.getElementById('statsEmpty');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (container) container.style.display = 'none';
    if (emptyEl)   emptyEl.style.display   = 'none';

    let books=[], bookHelpData=null, wpmHistory=[], compHistory=[], collections=[];

    if (userData) {
        books        = (userData.bookeep&&userData.bookeep.books) || [];
        bookHelpData = userData.bookhelp || null;
        wpmHistory   = (userData.bookhelp&&userData.bookhelp.wpmHistory) || [];
        compHistory  = (userData.bookhelp&&userData.bookhelp.comprehensionHistory) || [];
        collections  = (userData.booknotes&&userData.booknotes.collections) || [];
    } else {
        const s = localStorage.getItem('bookeep_books');
        books = s ? JSON.parse(s) : [];
        const ws = localStorage.getItem('wpmHistory');
        wpmHistory = ws ? JSON.parse(ws) : [];
        const cs = localStorage.getItem('comprehensionHistory');
        compHistory = cs ? JSON.parse(cs) : [];
        const ns = localStorage.getItem('booknotes_collections');
        collections = ns ? JSON.parse(ns) : [];
        const total = parseInt(localStorage.getItem('totalReadingTime')||'0');
        const rbm   = localStorage.getItem('readingTimeByMonth');
        bookHelpData = { totalReadingTime: total, readingTimeByMonth: rbm ? JSON.parse(rbm) : {} };
    }

    if (loadingEl) loadingEl.style.display = 'none';

    const hasData = books.length>0 || wpmHistory.length>0 || compHistory.length>0 ||
        (bookHelpData&&bookHelpData.totalReadingTime>0) || collections.length>0;

    if (!hasData) { if(emptyEl) emptyEl.style.display='block'; return; }
    if (container) container.style.display = 'block';

    renderBooksRead(books);
    renderPoints(books);
    renderWordCount(books);
    renderSubmissions(books);
    renderRatings(books);
    renderWpm(wpmHistory);
    renderComprehension(compHistory);
    renderReadingTime(bookHelpData);
    renderNotesStats(collections);
}

// Entry point called by authUI
window.initBookStats = function(userData) { loadStatsData(userData); };

// Guest fallback
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (!window.authUI?.getCurrentUser()) loadStatsData(null);
    }, 900);
});