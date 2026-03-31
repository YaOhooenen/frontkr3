const form = document.getElementById('noteForm');
const input = document.getElementById('noteInput');
const list = document.getElementById('notesList');

function loadNotes() {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    list.innerHTML = notes.map((note, i) => `<li>${note} <button onclick="deleteNote(${i})">Удалить</button></li>`).join('');
}

function addNote(text) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    notes.push(text);
    localStorage.setItem('notes', JSON.stringify(notes));
    loadNotes();
}

window.deleteNote = function(i) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    notes.splice(i, 1);
    localStorage.setItem('notes', JSON.stringify(notes));
    loadNotes();
};

form.onsubmit = (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) {
        addNote(text);
        input.value = '';
    }
};

loadNotes();

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
}