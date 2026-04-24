// ─── State ───────────────────────────────────────────────────────────────────

let bnCollections = [];
let bnActiveColIdx = null;

// ─── Persistence ─────────────────────────────────────────────────────────────

async function bnSave() {
    const currentUser  = window.authUI?.getCurrentUser();
    const userData     = window.authUI?.getCurrentUserData();
    if (currentUser) {
        if (userData) userData.booknotes = { collections: bnCollections };
        await window.firebaseAuth.updateBookNotesData(currentUser.uid, bnCollections);
    } else {
        localStorage.setItem('booknotes_collections', JSON.stringify(bnCollections));
    }
}

function bnLoad(userData) {
    if (userData?.booknotes?.collections) {
        bnCollections = userData.booknotes.collections;
    } else {
        const raw = localStorage.getItem('booknotes_collections');
        bnCollections = raw ? JSON.parse(raw) : [];
    }
}

function bnGenId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Entry point (called by authUI) ──────────────────────────────────────────

window.initBookNotes = function(userData) {
    bnLoad(userData);
    bnRenderGrid();
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (!window.authUI?.getCurrentUser()) {
            bnLoad(null);
            bnRenderGrid();
        }
    }, 900);
});

// ─── COLLECTION GRID VIEW ────────────────────────────────────────────────────

function bnRenderGrid() {
    bnActiveColIdx = null;
    const main = document.getElementById('bnMain');
    if (!main) return;

    const grid = bnCollections.map((col, i) => `
        <div class="bn-sticky-card" style="--sn-color:${col.color}" onclick="bnOpenCollection(${i})">
            <div class="bn-sticky-pin"></div>
            <div class="bn-sticky-title">${escBN(col.title)}</div>
            <div class="bn-sticky-count">${col.notes.length} note${col.notes.length !== 1 ? 's' : ''}</div>
        </div>
    `).join('');

    main.innerHTML = `
        <div class="bn-toolbar">
            <button class="btn btn-primary btn-sm" onclick="bnOpenAddCollection()">＋ Add Collection</button>
        </div>
        <div class="bn-grid">
            ${grid || '<div class="bn-empty">No collections yet. Click <strong>Add Collection</strong> to get started!</div>'}
        </div>
    `;
}

// ─── COLLECTION NOTES VIEW ───────────────────────────────────────────────────

function bnOpenCollection(colIdx) {
    bnActiveColIdx = colIdx;
    bnRenderNotes();
}

function bnRenderNotes() {
    const col  = bnCollections[bnActiveColIdx];
    const main = document.getElementById('bnMain');
    if (!main || !col) return;

    const noteCards = col.notes.map((note, ni) => bnNoteCard(note, ni)).join('');

    main.innerHTML = `
        <div class="bn-toolbar">
            <button class="btn btn-outline-secondary btn-sm" onclick="bnRenderGrid()">← Back to Collections</button>
            <span class="bn-col-heading" style="--sn-color:${col.color}">${escBN(col.title)}</span>
            <button class="btn btn-primary btn-sm" onclick="bnOpenAddNote()">＋ Add Note</button>
        </div>
        <div class="bn-grid" id="bnNotesGrid">
            ${noteCards || '<div class="bn-empty">No notes yet. Click <strong>Add Note</strong> to create one!</div>'}
        </div>
    `;
}

function bnNoteCard(note, ni) {
    const pg = note.pageNumber ? `<div class="bn-note-page">p. ${escBN(note.pageNumber)}</div>` : '';
    return `
        <div class="bn-note-card" style="--sn-color:${note.color}" id="bn-note-${ni}">
            <div class="bn-sticky-pin"></div>
            <div class="bn-note-title">${escBN(note.title)}</div>
            ${pg}
            <div class="bn-note-preview" id="bn-preview-${ni}">${escBN(truncBN(note.text, 80))}</div>
            <button class="bn-expand-btn" onclick="bnToggleExpand(${ni})">▼ Expand</button>
            <div class="bn-note-expanded" id="bn-expanded-${ni}" style="display:none;">
                <div class="bn-note-full-text">${escBN(note.text)}</div>
                <div class="bn-note-actions">
                    <button class="btn btn-sm btn-outline-primary" onclick="bnStartEdit(${ni})">✏️ Edit</button>
                    <button class="btn btn-sm btn-outline-danger"  onclick="bnDeleteNote(${ni})">🗑 Delete</button>
                </div>
            </div>
        </div>
    `;
}

function bnToggleExpand(ni) {
    const expanded = document.getElementById(`bn-expanded-${ni}`);
    const btn      = document.querySelector(`#bn-note-${ni} .bn-expand-btn`);
    if (!expanded) return;
    const isOpen = expanded.style.display !== 'none';
    expanded.style.display = isOpen ? 'none' : 'block';
    btn.textContent = isOpen ? '▼ Expand' : '▲ Collapse';
}

// ─── INLINE EDIT on note card ─────────────────────────────────────────────────

function bnStartEdit(ni) {
    const col  = bnCollections[bnActiveColIdx];
    const note = col.notes[ni];
    const card = document.getElementById(`bn-note-${ni}`);
    if (!card) return;

    card.innerHTML = `
        <div class="bn-sticky-pin"></div>
        <div class="bn-edit-form" style="--sn-color:${note.color}">
            <input  class="bn-field-title" id="bnEditTitle-${ni}"  value="${escAttr(note.title)}" placeholder="Title">
            <input  class="bn-field-page"  id="bnEditPage-${ni}"   value="${escAttr(note.pageNumber || '')}" placeholder="Page #" type="number" min="1">
            <textarea class="bn-field-text" id="bnEditText-${ni}"  rows="5" placeholder="Your note…">${escBN(note.text)}</textarea>
            <div class="bn-color-row">
                <label>Color:</label>
                <input type="color" id="bnEditColor-${ni}" value="${note.color}"
                    oninput="document.getElementById('bn-note-${ni}').style.setProperty('--sn-color', this.value)">
            </div>
            <div class="bn-edit-actions">
                <button class="btn btn-sm btn-success" onclick="bnSaveEdit(${ni})">Save</button>
                <button class="btn btn-sm btn-secondary" onclick="bnRenderNotes()">Cancel</button>
            </div>
        </div>
    `;
}

async function bnSaveEdit(ni) {
    const col  = bnCollections[bnActiveColIdx];
    const note = col.notes[ni];

    const title = document.getElementById(`bnEditTitle-${ni}`)?.value.trim();
    const page  = document.getElementById(`bnEditPage-${ni}`)?.value.trim();
    const text  = document.getElementById(`bnEditText-${ni}`)?.value.trim();
    const color = document.getElementById(`bnEditColor-${ni}`)?.value;

    if (!title) { alert('Please enter a title.'); return; }

    note.title      = title;
    note.pageNumber = page;
    note.text       = text;
    note.color      = color;
    note.updatedAt  = new Date().toISOString();

    await bnSave();
    bnRenderNotes();
}

async function bnDeleteNote(ni) {
    if (!confirm('Delete this note?')) return;
    bnCollections[bnActiveColIdx].notes.splice(ni, 1);
    await bnSave();
    bnRenderNotes();
}

// ─── ADD COLLECTION OVERLAY ───────────────────────────────────────────────────

function bnOpenAddCollection() {
    bnRemoveOverlay();
    const overlay = document.createElement('div');
    overlay.id = 'bnOverlay';
    overlay.className = 'bn-overlay';
    overlay.innerHTML = `
        <div class="bn-dialog">
            <h5 class="bn-dialog-title">New Collection</h5>
            <div class="mb-3">
                <label class="form-label">Book / Collection Title</label>
                <input type="text" class="form-control" id="bnColTitle" placeholder="e.g. The Great Gatsby">
            </div>
            <div class="mb-3">
                <label class="form-label">Color</label>
                <input type="color" class="form-control form-control-color" id="bnColColor" value="#f9e04b">
            </div>
            <div class="d-flex gap-2 justify-content-end">
                <button class="btn btn-secondary" onclick="bnRemoveOverlay()">Cancel</button>
                <button class="btn btn-primary"   onclick="bnCreateCollection()">Create</button>
            </div>
        </div>
    `;
    overlay.addEventListener('click', e => { if (e.target === overlay) bnRemoveOverlay(); });
    document.body.appendChild(overlay);
    document.getElementById('bnColTitle').focus();
}

async function bnCreateCollection() {
    const title = document.getElementById('bnColTitle')?.value.trim();
    const color = document.getElementById('bnColColor')?.value || '#f9e04b';
    if (!title) { alert('Please enter a title.'); return; }

    bnCollections.push({ id: bnGenId(), title, color, createdAt: new Date().toISOString(), notes: [] });
    await bnSave();
    bnRemoveOverlay();
    bnRenderGrid();
}

// ─── ADD NOTE OVERLAY ─────────────────────────-────────────────────────────────────────

function bnOpenAddNote() {
    bnRemoveOverlay();
    const defaultColor = bnCollections[bnActiveColIdx]?.color || '#f9e04b';

    const overlay = document.createElement('div');
    overlay.id = 'bnOverlay';
    overlay.className = 'bn-overlay';
    overlay.innerHTML = `
        <div class="bn-note-preview-wrap">
            <!-- Live sticky note preview -->
            <div class="bn-sticky-preview" id="bnNotePreview" style="--sn-color:${defaultColor}">
                <div class="bn-sticky-pin"></div>
                <div class="bn-preview-title"  id="bnPrevTitle">Title</div>
                <div class="bn-preview-page"   id="bnPrevPage"></div>
                <div class="bn-preview-text"   id="bnPrevText">Your note will appear here…</div>
            </div>
            <!-- Form panel -->
            <div class="bn-note-form-panel">
                <h5 class="bn-dialog-title">New Note</h5>
                <div class="mb-2">
                    <label class="form-label">Title</label>
                    <input type="text" class="form-control" id="bnNoteTitle" placeholder="Note title"
                        oninput="document.getElementById('bnPrevTitle').textContent = this.value || 'Title'">
                </div>
                <div class="mb-2">
                    <label class="form-label">Page Number</label>
                    <input type="number" min="1" class="form-control" id="bnNotePage" placeholder="Optional"
                        oninput="document.getElementById('bnPrevPage').textContent = this.value ? 'p. ' + this.value : ''">
                </div>
                <div class="mb-2">
                    <label class="form-label">Note</label>
                    <textarea class="form-control" id="bnNoteText" rows="4" placeholder="Write your note…"
                        oninput="document.getElementById('bnPrevText').textContent = this.value || 'Your note will appear here…'"></textarea>
                </div>
                <div class="mb-3">
                    <label class="form-label">Color</label>
                    <input type="color" class="form-control form-control-color" id="bnNoteColor" value="${defaultColor}"
                        oninput="document.getElementById('bnNotePreview').style.setProperty('--sn-color', this.value)">
                </div>
                <div class="d-flex gap-2 justify-content-end">
                    <button class="btn btn-secondary" onclick="bnRemoveOverlay()">Cancel</button>
                    <button class="btn btn-primary"   onclick="bnCreateNote()">Create</button>
                </div>
            </div>
        </div>
    `;
    overlay.addEventListener('click', e => { if (e.target === overlay) bnRemoveOverlay(); });
    document.body.appendChild(overlay);
    document.getElementById('bnNoteTitle').focus();
}

async function bnCreateNote() {
    const title = document.getElementById('bnNoteTitle')?.value.trim();
    const page  = document.getElementById('bnNotePage')?.value.trim();
    const text  = document.getElementById('bnNoteText')?.value.trim();
    const color = document.getElementById('bnNoteColor')?.value || '#f9e04b';

    if (!title) { alert('Please enter a title.'); return; }

    const note = { id: bnGenId(), title, color, pageNumber: page, text: text || '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    bnCollections[bnActiveColIdx].notes.push(note);
    await bnSave();
    bnRemoveOverlay();
    bnRenderNotes();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bnRemoveOverlay() {
    const el = document.getElementById('bnOverlay');
    if (el) el.remove();
}

function escBN(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
}

function escAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function truncBN(str, len) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '…' : str;
}