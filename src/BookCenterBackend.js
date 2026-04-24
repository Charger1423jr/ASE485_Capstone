// ── Helpers ───────────────────────────────────────────────────────────────────

function bcFormatNumber(n) {
    if (n == null || isNaN(n)) return '0';
    return Number(n).toLocaleString();
}

function bcStars(rating) {
    if (!rating || rating === 0) return '';
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    let s = '';
    for (let i = 0; i < full; i++) s += '★';
    if (half) s += '½';
    return `<span style="color:#f5c518;font-size:.8rem;">${s}</span>`;
}

// ── Guest view ────────────────────────────────────────────────────────────────

function bcShowGuest() {
    const actions = document.getElementById('bcHeroActions');
    if (actions) {
        actions.innerHTML = `
            <button class="bc-hero-btn-primary" onclick="window.authUI.openAuthModal()">
                Get Started — It's Free
            </button>
            <a href="#bc-features-anchor" class="bc-hero-btn-secondary">
                Explore the tools ↓
            </a>
        `;
    }

    const teaser = document.getElementById('bcLockedTeaser');
    const dash   = document.getElementById('bcDashboard');
    if (teaser) teaser.style.display = 'block';
    if (dash)   dash.style.display   = 'none';

    const features = document.querySelector('.bc-features');
    if (features) features.id = 'bc-features-anchor';
}

// ── Logged-in view ────────────────────────────────────────────────────────────

function bcShowLoggedIn(userData) {
    const user     = window.authUI.getCurrentUser();
    const username = user?.displayName || user?.email?.split('@')[0] || 'Reader';

    const actions = document.getElementById('bcHeroActions');
    if (actions) {
        actions.innerHTML = `
            <p class="bc-hero-greeting">Welcome back, <em>${username}</em>. Happy reading.</p>
        `;
    }

    const teaser = document.getElementById('bcLockedTeaser');
    const dash   = document.getElementById('bcDashboard');
    if (teaser) teaser.style.display = 'none';
    if (dash)   dash.style.display   = 'block';

    const bh    = userData?.bookhelp  || {};
    const be    = userData?.bookeep   || {};
    const bn    = userData?.booknotes || {};

    const books       = be.books        || [];
    const totalBooks  = books.length;
    const totalWords  = be.totalWords   || books.reduce((s, b) => s + (b.wordCount || 0), 0);
    const wpm         = bh.wpmSpeed;
    const compLast    = bh.lastComprehensionTest;
    const compPct     = compLast?.percentage != null ? compLast.percentage : null;

    const noteCount   = (bn.collections || []).reduce((s, c) => s + (c.notes?.length || 0), 0);

    const currentYear = new Date().getFullYear();
    const yearBooks   = books.filter(b => {
        const parts = (b.dateRead || '').split('-');
        return parts.length === 3 && parseInt(parts[2]) === currentYear;
    });
    const yearWords   = yearBooks.reduce((s, b) => s + (b.wordCount || 0), 0);

    const grid = document.getElementById('bcDashboardGrid');
    if (!grid) return;

    const statCards = [
        {
            icon: '📚',
            value: totalBooks,
            label: 'Books Logged'
        },
        {
            icon: '📝',
            value: bcFormatNumber(totalWords),
            label: 'Total Words Read'
        },
        {
            icon: '📅',
            value: bcFormatNumber(yearWords),
            label: `Words in ${currentYear}`
        },
        {
            icon: '⚡',
            value: wpm != null ? `${wpm} WPM` : '—',
            label: 'Reading Speed'
        },
        {
            icon: '🎯',
            value: compPct != null ? `${compPct}%` : '—',
            label: 'Last Comp. Score'
        },
        {
            icon: '🗒️',
            value: noteCount,
            label: 'Notes Created'
        },
        {
            icon: '📖',
            value: yearBooks.length,
            label: `Books in ${currentYear}`
        },
        {
            icon: '🏆',
            value: totalWords > 0 ? (totalWords / 10000).toFixed(1) : '0',
            label: 'Reading Points'
        },
    ];

    const recentBooks = [...books]
        .sort((a, b) => {
            const parseDate = d => {
                const p = (d || '').split('-');
                return p.length === 3 ? new Date(`${p[2]}-${p[0].padStart(2,'0')}-${p[1].padStart(2,'0')}`) : new Date(0);
            };
            return parseDate(b.dateRead) - parseDate(a.dateRead);
        })
        .slice(0, 5);

    const recentHtml = recentBooks.length > 0
        ? recentBooks.map(b => `
            <div class="bc-dash-book-row">
                <span class="bc-dash-book-title">${b.title}</span>
                <span class="bc-dash-book-meta">
                    ${bcStars(b.rating)}
                    ${b.dateRead ? `&nbsp;${b.dateRead}` : ''}
                    &nbsp;· ${bcFormatNumber(b.wordCount)} words
                </span>
            </div>`).join('')
        : '<div style="color:#888;font-size:.85rem;padding:8px 0;">No books logged yet — <a href="./Bookeep.html">add your first one</a>!</div>';

    grid.innerHTML =
        statCards.map(s => `
            <div class="bc-dash-stat">
                <div class="bc-dash-stat-icon">${s.icon}</div>
                <div class="bc-dash-stat-value">${s.value}</div>
                <div class="bc-dash-stat-label">${s.label}</div>
            </div>`).join('') +
        `<div class="bc-dash-recent">
            <div class="bc-dash-recent-title">Recent Books</div>
            ${recentHtml}
        </div>`;
}

// ── Entry points ──────────────────────────────────────────────────────────────

window.initBookCenter = function(userData) {
    bcShowLoggedIn(userData);
};

window.clearBookCenter = function() {
    bcShowGuest();
};

document.addEventListener('DOMContentLoaded', () => {
    bcShowGuest();
});