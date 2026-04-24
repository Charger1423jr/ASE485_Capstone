function showAlert(message) {
    const modal = document.createElement('div');
    modal.className = 'modal';

    modal.innerHTML = `
        <div class="modal-content">
            <p>${message}</p>
            <button id="modalOkBtn">OK</button>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('modalOkBtn').onclick = () => {
        modal.remove();
    };
}

function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal';

        modal.innerHTML = `
            <div class="modal-content">
                <p>${message}</p>
                <button id="confirmYes">Yes</button>
                <button id="confirmNo">Cancel</button>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('confirmYes').onclick = () => {
            modal.remove();
            resolve(true);
        };

        document.getElementById('confirmNo').onclick = () => {
            modal.remove();
            resolve(false);
        };
    });
}

function showPrompt(message) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal';

        modal.innerHTML = `
            <div class="modal-content">
                <p>${message}</p>
                <input id="promptInput" type="text" />
                <button id="promptSubmit">Submit</button>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('promptSubmit').onclick = () => {
            const value = document.getElementById('promptInput').value;
            modal.remove();
            resolve(value);
        };
    });
}

// expose globally
window.showAlert = showAlert;
window.showConfirm = showConfirm;
window.showPrompt = showPrompt;