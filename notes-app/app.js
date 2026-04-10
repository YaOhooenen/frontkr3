const socket = io('http://localhost:3001');

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function loadNotes() {
  const notesList = document.getElementById('notes-list');
  if (!notesList) return;
  
  const notes = JSON.parse(localStorage.getItem('notes') || '[]');
  notesList.innerHTML = '';
  
  if (notes.length === 0) {
    notesList.innerHTML = '<li class="text-grey is-center">Нет заметок. Добавьте первую!</li>';
    return;
  }
  
  notes.reverse().forEach(note => {
    const li = document.createElement('li');
    li.className = 'note-item';
    let reminderInfo = '';
    if (note.reminder) {
      const date = new Date(note.reminder);
      reminderInfo = `<br><small>Напоминание: ${date.toLocaleString()}</small>`;
    }
    li.innerHTML = `
      <div class="note-time">${note.datetime || new Date(note.id).toLocaleString()}</div>
      <div class="note-text">${escapeHtml(note.text)}</div>
      ${reminderInfo}
    `;
    notesList.appendChild(li);
  });
}

function addNote() {
  const noteInput = document.getElementById('note-input');
  if (!noteInput) return;
  
  const text = noteInput.value.trim();
  if (!text) {
    alert('Введите текст заметки');
    return;
  }
  
  const notes = JSON.parse(localStorage.getItem('notes') || '[]');
  const newNote = {
    id: Date.now(),
    text: text,
    datetime: new Date().toLocaleString()
  };
  notes.push(newNote);
  localStorage.setItem('notes', JSON.stringify(notes));
  
  socket.emit('newTask', { text: text, id: newNote.id });
  
  noteInput.value = '';
  loadNotes();
}

document.getElementById('note-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  addNote();
});

document.getElementById('reminder-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const reminderText = document.getElementById('reminder-text');
  const reminderTime = document.getElementById('reminder-time');
  
  const text = reminderText.value.trim();
  const reminderTimeValue = reminderTime.value;
  
  if (!text || !reminderTimeValue) return;
  
  const reminderTimestamp = new Date(reminderTimeValue).getTime();
  const now = Date.now();
  
  if (reminderTimestamp <= now) {
    alert('Время напоминания должно быть в будущем!');
    return;
  }
  
  const notes = JSON.parse(localStorage.getItem('notes') || '[]');
  const newNote = {
    id: Date.now(),
    text: text,
    datetime: new Date().toLocaleString(),
    reminder: reminderTimestamp
  };
  notes.push(newNote);
  localStorage.setItem('notes', JSON.stringify(notes));
  
  socket.emit('newReminder', {
    id: newNote.id,
    text: text,
    reminderTime: reminderTimestamp
  });
  
  reminderText.value = '';
  reminderTime.value = '';
  loadNotes();
  
  alert(`Напоминание установлено на ${new Date(reminderTimestamp).toLocaleString()}`);
});

socket.on('taskAdded', (task) => {
  const notification = document.createElement('div');
  notification.className = 'toast-notification';
  notification.innerHTML = `Новая задача!<br>${escapeHtml(task.text)}`;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
  loadNotes();
});

socket.on('reminderSnoozed', (data) => {
  const notification = document.createElement('div');
  notification.className = 'toast-notification';
  notification.innerHTML = `Напоминание отложено!<br>${escapeHtml(data.text)}<br>Новое время: ${new Date(data.newReminderTime).toLocaleString()}`;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 5000);
  loadNotes();
});

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const VAPID_PUBLIC_KEY = 'BF4oC-zKkZNTvHaAiP4qoUYbKyi1iSVT595lJa9SRDNFw7LkNlc55jWXVZ-PnGOIFhAn8AWo2R0czIZvhS7fyAs';

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    
    const response = await fetch('http://localhost:3001/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });
    
    return response.ok;
  } catch (err) {
    console.error('Ошибка подписки:', err);
    return false;
  }
}

async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  
  if (subscription) {
    await fetch('http://localhost:3001/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint })
    });
    await subscription.unsubscribe();
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker зарегистрирован');
      
      const enableBtn = document.getElementById('enable-push');
      const disableBtn = document.getElementById('disable-push');
      
      if (enableBtn && disableBtn) {
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          enableBtn.style.display = 'none';
          disableBtn.style.display = 'inline-block';
        }
        
        enableBtn.onclick = async () => {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            alert('Необходимо разрешить уведомления');
            return;
          }
          
          const success = await subscribeToPush();
          if (success) {
            enableBtn.style.display = 'none';
            disableBtn.style.display = 'inline-block';
            alert('Уведомления включены');
          } else {
            alert('Ошибка при включении уведомлений');
          }
        };
        
        disableBtn.onclick = async () => {
          await unsubscribeFromPush();
          disableBtn.style.display = 'none';
          enableBtn.style.display = 'inline-block';
          alert('Уведомления отключены');
        };
      }
    } catch (err) {
      console.log('Ошибка регистрации SW:', err);
    }
  });
}

loadNotes();