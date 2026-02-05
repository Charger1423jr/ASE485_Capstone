const STORAGE_KEY = 'bookeep_books';
let books = [];
let editingBookId = null;
let deleteBookId = null;

document.addEventListener('DOMContentLoaded', () => {
    const currentYear = new Date().getFullYear();
    document.getElementById('currentYear').textContent = currentYear;
    document.getElementById('yearLabel').textContent = currentYear;
    document.getElementById('yearLabel2').textContent = currentYear;
    
    loadBooks();
    renderBooks();
    updateStats();
});

function loadBooks() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        books = JSON.parse(stored);
    }
}

function saveBooks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
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

function addBook() {
    const title = document.getElementById('bookTitle').value.trim();
    const wordCountStr = document.getElementById('wordCount').value.trim();
    const dateInput = document.getElementById('dateInput').value;

    if (!title || !wordCountStr || !dateInput) {
        showSnackbar('Please fill all fields');
        return;
    }

    const wordCount = parseInt(cleanNumber(wordCountStr));
    const date = new Date(dateInput + 'T00:00:00');
    const dateRead = `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`;

    const book = {
        id: Date.now().toString(),
        title,
        wordCount,
        dateRead
    };

    books.push(book);
    saveBooks();

    document.getElementById('bookTitle').value = '';
    document.getElementById('wordCount').value = '';
    document.getElementById('dateInput').value = '';
    document.getElementById('dateDisplay').value = 'No date selected';

    renderBooks();
    updateStats();
    showSnackbar('Book added successfully!');
}

function renderBooks() {
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();

    const sortedBooks = [...books].sort((a, b) => {
        const dateA = new Date(a.dateRead);
        const dateB = new Date(b.dateRead);
        return dateB - dateA;
    });

    const filteredBooks = sortedBooks.filter(book =>
        book.title.toLowerCase().includes(searchTerm)
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
}


function renderBookView(book) {
    return `
        <div class="d-flex justify-content-between align-items-center">
            <div class="book-info">
                <div class="book-title">${book.title}</div>
                <div class="book-details">Words: ${formatNumber(book.wordCount)} • Date: ${book.dateRead}</div>
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

function saveEdit(bookId) {
    const title = document.getElementById(`editTitle-${bookId}`).value.trim();
    const wordCountStr = document.getElementById(`editWordCount-${bookId}`).value.trim();
    const dateInput = document.getElementById(`editDateInput-${bookId}`).value;

    if (!title || !wordCountStr || !dateInput) {
        showSnackbar('Please fill all fields');
        return;
    }

    const wordCount = parseInt(cleanNumber(wordCountStr));
    const date = new Date(dateInput + 'T00:00:00');
    const dateRead = `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`;

    const bookIndex = books.findIndex(b => b.id === bookId);
    if (bookIndex !== -1) {
        books[bookIndex] = {
            ...books[bookIndex],
            title,
            wordCount,
            dateRead
        };
        saveBooks();
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
    if (modal) {
        modal.hide();
    }
    deleteBookId = null;
}

function confirmDelete() {
    if (deleteBookId) {
        books = books.filter(b => b.id !== deleteBookId);
        saveBooks();
        renderBooks();
        updateStats();
        closeDeleteModal();
        showSnackbar('Book deleted successfully!');
    }
}

function filterBooks() {
    renderBooks();
}

function updateStats() {
    const currentYear = new Date().getFullYear();
    
    const totalWords = books.reduce((sum, book) => sum + book.wordCount, 0);
    const yearBooks = books.filter(book => {
        const parts = book.dateRead.split('-');
        return parts.length === 3 && parseInt(parts[2]) === currentYear;
    });
    const yearWords = yearBooks.reduce((sum, book) => sum + book.wordCount, 0);
    const points = yearWords / 10000;

    document.getElementById('totalWords').textContent = formatNumber(totalWords);
    document.getElementById('yearWords').textContent = formatNumber(yearWords);
    document.getElementById('totalBooks').textContent = books.length;
    document.getElementById('points').textContent = points.toFixed(2);
}

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

function importData(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    if (file.type !== 'application/json') {
        showSnackbar('Please select a valid JSON file!');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
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
                books = importedData;
                saveBooks();
                renderBooks();
                updateStats();
                showSnackbar(`Successfully imported ${importedData.length} book(s)!`);
            }
        } catch (error) {
            showSnackbar('Error reading file: ' + error.message);
        }
    };

    reader.onerror = function() {
        showSnackbar('Error reading file!');
    };

    reader.readAsText(file);
    event.target.value = '';
}
