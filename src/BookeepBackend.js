let books = [];
let editingBookId = null;
let deleteBookId = null;

let pointsMode = 'words';

let useManualEntry = false;

document.addEventListener('DOMContentLoaded', () => {
    const currentYear = new Date().getFullYear();
    document.getElementById('currentYear').textContent = currentYear;
    document.getElementById('yearLabel').textContent = currentYear;
    document.getElementById('yearLabel2').textContent = currentYear;

    updatePointsLabel();
    // Books are loaded by authUI via window.initBookeep() once Firebase resolves.
    // Render empty state immediately so the page isn't blank.
    renderBooks();
    updateStats();
});

// Points

function setPointsMode(mode) {
    pointsMode = mode;
    updatePointsLabel();
    updateStats();
}

function updatePointsLabel() {
    const label = pointsMode === 'words' ? 'Words / 10k' : 'Books Read';
    const el = document.getElementById('pointsModeLabel');
    if (el) el.textContent = label;
}

// OpenLibrary Search

let searchResultsCache = [];

async function searchOpenLibrary() {
    const query = document.getElementById('bookSearchInput').value.trim();
    if (!query) return;

    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '<p class="text-center text-muted">Searching…</p>';
    searchResultsCache = [];

    try {
        const resp = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8&fields=key,title,author_name,first_publish_year`);
        const data = await resp.json();

        if (!data.docs || data.docs.length === 0) {
            resultsDiv.innerHTML = '<p class="text-center text-muted">No results found.</p>';
            return;
        }

        resultsDiv.innerHTML = '';
        data.docs.forEach((doc, idx) => {
            const title = doc.title || 'Unknown Title';
            const author = (doc.author_name && doc.author_name[0]) || '';
            const year = doc.first_publish_year || '';

            searchResultsCache[idx] = { title, author };

            const item = document.createElement('div');
            item.className = 'search-result-item';

            const info = document.createElement('div');
            info.className = 'search-result-info';
            info.innerHTML = `
                <div class="search-result-title">${title}</div>
                <div class="search-result-meta">${author}${year ? ' · ' + year : ''}</div>
            `;

            const btn = document.createElement('button');
            btn.className = 'btn btn-sm btn-primary';
            btn.textContent = 'Select';
            btn.addEventListener('click', () => selectSearchResult(idx));

            item.appendChild(info);
            item.appendChild(btn);
            resultsDiv.appendChild(item);
        });
    } catch (err) {
        resultsDiv.innerHTML = '<p class="text-center text-danger">Error searching. Please try again.</p>';
    }
}

function selectSearchResult(idx) {
    const result = searchResultsCache[idx];
    if (!result) return;

    document.getElementById('bookTitle').value = result.title;
    document.getElementById('bookAuthor').value = result.author;
    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('bookSearchInput').value = '';
    searchResultsCache = [];
    document.getElementById('wordCount').focus();
    showSnackbar('Book selected! Please enter the word count.');
}

function toggleSearchMode() {
    useManualEntry = !useManualEntry;

    const searchSection = document.getElementById('searchSection');
    const manualSection = document.getElementById('manualSection');
    const toggleBtn = document.getElementById('toggleEntryBtn');

    if (useManualEntry) {
        searchSection.style.display = 'none';
        manualSection.style.display = 'block';
        toggleBtn.textContent = 'Find Your Book';
    } else {
        searchSection.style.display = 'block';
        manualSection.style.display = 'none';
        toggleBtn.textContent = "Can't Find Your Book?";
        document.getElementById('bookTitle').value = '';
        document.getElementById('bookAuthor').value = '';
    }
}

// Rating 

function renderStarRating(containerId, currentRating, bookId, isEdit) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const full = document.createElement('span');
        full.className = 'star-half';
        full.dataset.value = i - 0.5;
        full.innerHTML = '&#9733;';
        full.style.cssText = `font-size:24px; cursor:pointer; color: ${currentRating >= (i - 0.5) ? '#f5c518' : '#ccc'}; clip-path: polygon(0 0, 50% 0, 50% 100%, 0 100%);`;

        const right = document.createElement('span');
        right.className = 'star-half';
        right.dataset.value = i;
        right.innerHTML = '&#9733;';
        right.style.cssText = `font-size:24px; cursor:pointer; color: ${currentRating >= i ? '#f5c518' : '#ccc'}; clip-path: polygon(50% 0, 100% 0, 100% 100%, 50% 100%); margin-left:-0.6em;`;

        [full, right].forEach(half => {
            half.addEventListener('click', () => {
                const val = parseFloat(half.dataset.value);
                if (isEdit) {
                    updateEditRating(bookId, val);
                } else {
                    updateNewBookRating(val);
                }
            });
            half.addEventListener('mouseover', () => highlightStars(containerId, parseFloat(half.dataset.value)));
            half.addEventListener('mouseleave', () => {
                const stored = isEdit
                    ? parseFloat(document.getElementById(containerId).dataset.rating || 0)
                    : parseFloat(document.getElementById(containerId).dataset.rating || 0);
                highlightStars(containerId, stored);
            });
        });

        const wrapper = document.createElement('span');
        wrapper.style.cssText = 'display:inline-block; position:relative;';
        wrapper.appendChild(full);
        wrapper.appendChild(right);
        container.appendChild(wrapper);
    }

    container.dataset.rating = currentRating || 0;

    const ratingLabel = document.createElement('span');
    ratingLabel.id = containerId + '_label';
    ratingLabel.style.cssText = 'margin-left:8px; font-size:14px; color:#666;';
    ratingLabel.textContent = currentRating > 0 ? `${currentRating} / 5` : 'No rating';
    container.appendChild(ratingLabel);
}

function highlightStars(containerId, rating) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const halves = container.querySelectorAll('.star-half');
    halves.forEach(h => {
        h.style.color = parseFloat(h.dataset.value) <= rating ? '#f5c518' : '#ccc';
    });
}

function updateNewBookRating(val) {
    const container = document.getElementById('newBookRating');
    container.dataset.rating = val;
    highlightStars('newBookRating', val);
    const label = document.getElementById('newBookRating_label');
    if (label) label.textContent = `${val} / 5`;
}

function updateEditRating(bookId, val) {
    const containerId = `editRating-${bookId}`;
    const container = document.getElementById(containerId);
    if (container) {
        container.dataset.rating = val;
        highlightStars(containerId, val);
        const label = document.getElementById(containerId + '_label');
        if (label) label.textContent = `${val} / 5`;
    }
}

function loadBooks() {
    const currentUserData = window.authUI ? window.authUI.getCurrentUserData() : null;
    if (currentUserData && currentUserData.bookeep && currentUserData.bookeep.books) {
        books = currentUserData.bookeep.books.map(b => ({
            rating: 0,
            author: '',
            ...b
        }));
    } else {
        books = [];
    }
}

async function saveBooks() {
    const currentUser = window.authUI ? window.authUI.getCurrentUser() : null;
    if (currentUser) {
        await window.firebaseAuth.updateBookeepData(currentUser.uid, books);
        const userData = window.authUI.getCurrentUserData();
        if (userData) {
            if (!userData.bookeep) userData.bookeep = {};
            userData.bookeep.books = books;
        }
    }
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function cleanNumber(str) {
    return str.replace(/,/g, '');
}

const wordCountInput = document.getElementById('wordCount');
if (wordCountInput) {
    wordCountInput.addEventListener('input', (e) => {
        const cleaned = cleanNumber(e.target.value);
        if (cleaned && !isNaN(cleaned)) {
            e.target.value = formatNumber(cleaned);
        }
    });
}

function updateDateDisplay() {
    const dateInput = document.getElementById('dateInput');
    const dateDisplay = document.getElementById('dateDisplay');
    if (dateInput.value) {
        const date = new Date(dateInput.value + 'T00:00:00');
        dateDisplay.value = `Finished: ${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`;
    }
}

// Add Book 

async function addBook() {
    const title = document.getElementById('bookTitle').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    const wordCountStr = document.getElementById('wordCount').value.trim();
    const dateInput = document.getElementById('dateInput').value;

    if (!title || !wordCountStr || !dateInput) {
        showSnackbar('Please fill all required fields (title, word count, date)');
        return;
    }

    const wordCount = parseInt(cleanNumber(wordCountStr));
    const date = new Date(dateInput + 'T00:00:00');
    const dateRead = `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`;

    const ratingContainer = document.getElementById('newBookRating');
    const rating = ratingContainer ? parseFloat(ratingContainer.dataset.rating || 0) : 0;

    const book = {
        id: Date.now().toString(),
        title,
        author,
        wordCount,
        dateRead,
        rating
    };

    books.push(book);
    await saveBooks();

    document.getElementById('bookTitle').value = '';
    document.getElementById('bookAuthor').value = '';
    document.getElementById('wordCount').value = '';
    document.getElementById('dateInput').value = '';
    document.getElementById('dateDisplay').value = 'No date selected';
    document.getElementById('bookSearchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';

    if (ratingContainer) {
        ratingContainer.dataset.rating = 0;
        renderStarRating('newBookRating', 0, null, false);
    }

    renderBooks();
    updateStats();
    showSnackbar('Book added successfully!');
}

// Render Books 

function renderBooks() {
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();

    const sortedBooks = [...books].sort((a, b) => {
        const dateA = new Date(a.dateRead);
        const dateB = new Date(b.dateRead);
        return dateB - dateA;
    });

    const filteredBooks = sortedBooks.filter(book =>
        book.title.toLowerCase().includes(searchTerm) ||
        (book.author && book.author.toLowerCase().includes(searchTerm))
    );

    const bookList = document.getElementById('bookList');
    bookList.innerHTML = '';

    if (filteredBooks.length === 0) {
        bookList.innerHTML = '<p class="text-center">No books found</p>';
        return;
    }

    filteredBooks.forEach(book => {
        const bookDiv = document.createElement('div');
        bookDiv.className = 'book-item';
        bookDiv.id = `book-${book.id}`;

        if (editingBookId === book.id) {
            bookDiv.innerHTML = renderEditForm(book);
        } else {
            bookDiv.innerHTML = renderBookView(book);
        }

        bookList.appendChild(bookDiv);
    });
    if (editingBookId) {
        const editBook = books.find(b => b.id === editingBookId);
        if (editBook) {
            renderStarRating(`editRating-${editingBookId}`, editBook.rating || 0, editingBookId, true);
        }
    }
}

function starsDisplay(rating) {
    if (!rating || rating === 0) return '<span style="color:#ccc; font-size:13px;">No rating</span>';
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (rating >= i) {
            stars += '<span style="color:#f5c518;">★</span>';
        } else if (rating >= i - 0.5) {
            stars += '<span style="color:#f5c518; font-size:12px;">⯨</span>';
        } else {
            stars += '<span style="color:#ccc;">★</span>';
        }
    }
    return `<span>${stars} <span style="font-size:12px; color:#888;">${rating}/5</span></span>`;
}

function renderBookView(book) {
    return `
        <div class="d-flex justify-content-between align-items-center">
            <div class="book-info">
                <div class="book-title">${book.title}</div>
                ${book.author ? `<div class="book-author">by ${book.author}</div>` : ''}
                <div class="book-details">Words: ${formatNumber(book.wordCount)} · Date: ${book.dateRead}</div>
                <div style="margin-top:3px;">${starsDisplay(book.rating || 0)}</div>
            </div>
            <div class="book-actions">
                <button class="btn btn-sm btn-warning" onclick="startEdit('${book.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="showDeleteModal('${book.id}')">Delete</button>
            </div>
        </div>
    `;
}

function renderEditForm(book) {
    return `
        <div class="edit-form">
            <div class="mb-2">
                <input type="text" class="form-control" id="editTitle-${book.id}" value="${book.title}" placeholder="Edit Title">
            </div>
            <div class="mb-2">
                <input type="text" class="form-control" id="editAuthor-${book.id}" value="${book.author || ''}" placeholder="Edit Author">
            </div>
            <div class="mb-2">
                <input type="text" class="form-control" id="editWordCount-${book.id}" value="${formatNumber(book.wordCount)}" placeholder="Edit Word Count">
            </div>
            <div class="mb-2">
                <div class="input-group">
                    <input type="text" class="form-control" id="editDateDisplay-${book.id}" value="Finished: ${book.dateRead}" readonly>
                    <button class="btn btn-outline-secondary" type="button" onclick="document.getElementById('editDateInput-${book.id}').showPicker()">Pick Date</button>
                    <input type="date" id="editDateInput-${book.id}" value="${convertToDateInput(book.dateRead)}" style="display: none;"
                        onchange="updateEditDateDisplay('${book.id}')">
                </div>
            </div>
            <div class="mb-2">
                <label class="form-label" style="font-size:14px; font-weight:600;">Rating</label>
                <div id="editRating-${book.id}" style="display:flex; align-items:center; flex-wrap:wrap; gap:2px;"></div>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-success flex-fill" onclick="saveEdit('${book.id}')">Save</button>
                <button class="btn btn-secondary flex-fill" onclick="cancelEdit()">Cancel</button>
            </div>
        </div>
    `;
}

function convertToDateInput(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
    }
    return '';
}

function updateEditDateDisplay(bookId) {
    const dateInput = document.getElementById(`editDateInput-${bookId}`);
    const dateDisplay = document.getElementById(`editDateDisplay-${bookId}`);
    if (dateInput.value) {
        const date = new Date(dateInput.value + 'T00:00:00');
        dateDisplay.value = `Finished: ${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`;
    }
}

function startEdit(bookId) {
    editingBookId = bookId;
    renderBooks();

    const editBook = books.find(b => b.id === bookId);
    if (editBook) {
        renderStarRating(`editRating-${bookId}`, editBook.rating || 0, bookId, true);
    }

    const editWordCountInput = document.getElementById(`editWordCount-${bookId}`);
    if (editWordCountInput) {
        editWordCountInput.addEventListener('input', (e) => {
            const cleaned = cleanNumber(e.target.value);
            if (cleaned && !isNaN(cleaned)) {
                e.target.value = formatNumber(cleaned);
            }
        });
    }
}

async function saveEdit(bookId) {
    const title = document.getElementById(`editTitle-${bookId}`).value.trim();
    const author = document.getElementById(`editAuthor-${bookId}`).value.trim();
    const wordCountStr = document.getElementById(`editWordCount-${bookId}`).value.trim();
    const dateInput = document.getElementById(`editDateInput-${bookId}`).value;

    if (!title || !wordCountStr || !dateInput) {
        showSnackbar('Please fill all required fields');
        return;
    }

    const wordCount = parseInt(cleanNumber(wordCountStr));
    const date = new Date(dateInput + 'T00:00:00');
    const dateRead = `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`;

    const ratingContainer = document.getElementById(`editRating-${bookId}`);
    const rating = ratingContainer ? parseFloat(ratingContainer.dataset.rating || 0) : 0;

    const bookIndex = books.findIndex(b => b.id === bookId);
    if (bookIndex !== -1) {
        books[bookIndex] = {
            ...books[bookIndex],
            title,
            author,
            wordCount,
            dateRead,
            rating
        };
        await saveBooks();
        editingBookId = null;
        renderBooks();
        updateStats();
        showSnackbar('Book updated successfully!');
    }
}

function cancelEdit() {
    editingBookId = null;
    renderBooks();
}

// Delete

function showDeleteModal(bookId) {
    deleteBookId = bookId;
    const book = books.find(b => b.id === bookId);
    if (book) {
        document.getElementById('deleteModalText').textContent =
            `Are you sure you want to delete '${book.title}'?`;
        const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
        modal.show();
    }
}

function closeDeleteModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
    if (modal) modal.hide();
    deleteBookId = null;
}

async function confirmDelete() {
    if (deleteBookId) {
        books = books.filter(b => b.id !== deleteBookId);
        await saveBooks();
        renderBooks();
        updateStats();
        closeDeleteModal();
        showSnackbar('Book deleted successfully!');
    }
}

function filterBooks() {
    renderBooks();
}

// Stats 

function updateStats() {
    const currentYear = new Date().getFullYear();

    const totalWords = books.reduce((sum, book) => sum + book.wordCount, 0);
    const yearBooks = books.filter(book => {
        const parts = book.dateRead.split('-');
        return parts.length === 3 && parseInt(parts[2]) === currentYear;
    });
    const yearWords = yearBooks.reduce((sum, book) => sum + book.wordCount, 0);

    let pointsValue;
    if (pointsMode === 'words') {
        pointsValue = (yearWords / 10000).toFixed(2);
    } else {
        pointsValue = yearBooks.length;
    }

    document.getElementById('totalWords').textContent = formatNumber(totalWords);
    document.getElementById('yearWords').textContent = formatNumber(yearWords);
    document.getElementById('totalBooks').textContent = books.length;
    document.getElementById('points').textContent = pointsValue;
}

// Wrapped

function showWrapped() {
    const currentYear = new Date().getFullYear();

    const yearBooks = books.filter(book => {
        const parts = book.dateRead.split('-');
        return parts.length === 3 && parseInt(parts[2]) === currentYear;
    });

    const totalBooks = yearBooks.length;
    const totalWords = yearBooks.reduce((sum, book) => sum + book.wordCount, 0);
    const points = (totalWords / 10000).toFixed(2);

    const topBooks = [...yearBooks]
        .sort((a, b) => b.wordCount - a.wordCount)
        .slice(0, 2);

    const topRated = [...yearBooks]
        .filter(b => b.rating > 0)
        .sort((a, b) => b.rating - a.rating)[0];

    let wrappedHTML = `
        <div class="wrapped-year">📚 Bookeep ${currentYear}</div>
        <div class="wrapped-title">WRAPPED</div>

        <div class="wrapped-stat">
            <div class="wrapped-stat-label">Books Read</div>
            <div class="wrapped-stat-value">${totalBooks}</div>
        </div>

        <div class="wrapped-stat">
            <div class="wrapped-stat-label">Total Words</div>
            <div class="wrapped-stat-value">${formatNumber(totalWords)}</div>
        </div>

        <div class="wrapped-stat">
            <div class="wrapped-stat-label">Points Earned</div>
            <div class="wrapped-stat-value">${points}</div>
        </div>
    `;

    if (topBooks.length > 0) {
        wrappedHTML += `<div class="wrapped-section-title">TOP READS</div>`;
        topBooks.forEach(book => {
            wrappedHTML += `
                <div class="top-book">
                    <div class="top-book-title">${book.title}</div>
                    <div class="top-book-words">${formatNumber(book.wordCount)} words</div>
                </div>
            `;
        });
    }

    if (topRated) {
        wrappedHTML += `
            <div class="wrapped-section-title">HIGHEST RATED</div>
            <div class="top-book">
                <div class="top-book-title">${topRated.title}</div>
                <div class="top-book-words">⭐ ${topRated.rating} / 5</div>
            </div>
        `;
    }

    document.getElementById('wrappedContent').innerHTML = wrappedHTML;
    const modal = new bootstrap.Modal(document.getElementById('wrappedModal'));
    modal.show();
}

function showSnackbar(message) {
    const snackbarText = document.getElementById('snackbarText');
    const snackbarEl = document.getElementById('snackbar');
    snackbarText.textContent = message;
    const toast = new bootstrap.Toast(snackbarEl);
    toast.show();
}

// Export / Import 

function exportData() {
    if (books.length === 0) {
        showSnackbar('No data to export!');
        return;
    }

    const dataStr = JSON.stringify(books, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bookeep-data-${new Date().toISOString().split('T')[0]}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    showSnackbar('Data exported successfully!');
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/json') {
        showSnackbar('Please select a valid JSON file!');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const importedData = JSON.parse(e.target.result);

            if (!Array.isArray(importedData)) {
                showSnackbar('Invalid data format!');
                return;
            }

            const isValid = importedData.every(book =>
                book.hasOwnProperty('id') &&
                book.hasOwnProperty('title') &&
                book.hasOwnProperty('wordCount') &&
                book.hasOwnProperty('dateRead')
            );

            if (!isValid) {
                showSnackbar('Invalid book data format!');
                return;
            }

            const confirmReplace = confirm(
                `This will replace your current ${books.length} book(s) with ${importedData.length} book(s) from the file. Continue?`
            );

            if (confirmReplace) {
                // Normalize: give default rating/author to any missing fields
                books = importedData.map(b => ({
                    rating: 0,
                    author: '',
                    ...b
                }));
                await saveBooks();
                renderBooks();
                updateStats();
                showSnackbar(`Successfully imported ${importedData.length} book(s)!`);
            }
        } catch (error) {
            showSnackbar('Error reading file: ' + error.message);
        }
    };

    reader.onerror = function () {
        showSnackbar('Error reading file!');
    };

    reader.readAsText(file);
    event.target.value = '';
}

// Called by authUI.js when a user signs in — loads that user's books from Firebase.
window.initBookeep = function(userData) {
    if (userData && userData.bookeep && userData.bookeep.books) {
        books = userData.bookeep.books.map(b => ({
            rating: 0,
            author: '',
            ...b
        }));
    } else {
        books = [];
    }
    renderBooks();
    updateStats();
};

// Called by authUI.js when a user signs out — clears the book list.
window.clearBookeep = function() {
    books = [];
    renderBooks();
    updateStats();
};

window.addEventListener('load', () => {
    renderStarRating('newBookRating', 0, null, false);
});