// ============ ПОДКЛЮЧЕНИЕ К WEBSOCKET СЕРВЕРУ ============
const socket = io('http://localhost:3001');

// ============ РАБОТА С ЗАМЕТКАМИ ============
const noteInput = document.getElementById('note-input');
const addBtn = document.getElementById('add-btn');
const notesList = document.getElementById('notes-list');

// Загрузка заметок из localStorage
function loadNotes() {
  const notes = JSON.parse(localStorage.getItem('notes') || '[]');
  notesList.innerHTML = '';
  
  if (notes.length === 0) {
    notesList.innerHTML = '<li class="text-grey is-center">Нет заметок. Добавьте первую!</li>';
    return;
  }
  
  notes.reverse().forEach(note => {
    const li = document.createElement('li');
    li.className = 'note-item';
    li.innerHTML = `
      <div class="note-time">📅 ${note.datetime || new Date(note.id).toLocaleString()}</div>
      <div class="note-text">${escapeHtml(note.text)}</div>
    `;
    notesList.appendChild(li);
  });
}

// Функция для экранирования HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Добавление заметки
function addNote() {
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
  
  // Отправляем событие на сервер через WebSocket
  console.log('Отправка newTask:', newNote);
  socket.emit('newTask', { text: text, id: newNote.id });
  
  noteInput.value = '';
  loadNotes();
}

addBtn.addEventListener('click', addNote);
noteInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addNote();
});

// ============ ПОЛУЧЕНИЕ СОБЫТИЙ ОТ ДРУГИХ КЛИЕНТОВ ============
socket.on('taskAdded', (task) => {
  console.log('Получена задача от другого клиента:', task);
  
  // Показываем всплывающее уведомление в приложении
  const notification = document.createElement('div');
  notification.className = 'toast-notification';
  notification.innerHTML = `📝 <strong>Новая задача!</strong><br>${escapeHtml(task.text)}`;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
  
  // Обновляем список заметок
  loadNotes();
});

// ============ PUSH УВЕДОМЛЕНИЯ ============

// Конвертация base64 в Uint8Array (для VAPID ключа)
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

// ВАШ ПУБЛИЧНЫЙ VAPID КЛЮЧ (сгенерируйте свой через npx web-push generate-vapid-keys)
const VAPID_PUBLIC_KEY = 'BHJqcJ1yjrJPQS1mFy6iOjpO9BIdtECdcj7gDpY1LJCicgLUdXkqp3IzLvHBIW5LSjlQlsJrCnhQ3s5gSyV-ho4';

// Подписка на push-уведомления
async function subscribeToPush() {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker не поддерживается');
    return false;
  }
  
  if (!('PushManager' in window)) {
    console.log('Push уведомления не поддерживаются');
    alert('Ваш браузер не поддерживает push-уведомления');
    return false;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    console.log('SW готов для подписки');
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    
    console.log('Подписка создана:', subscription);
    
    const response = await fetch('http://localhost:3001/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });
    
    if (response.ok) {
      console.log('Подписка на push сохранена на сервере');
      return true;
    } else {
      console.error('Ошибка сохранения подписки:', await response.text());
      return false;
    }
  } catch (err) {
    console.error('Ошибка подписки на push:', err);
    return false;
  }
}

// Отписка от push-уведомлений
async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await fetch('http://localhost:3001/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });
      await subscription.unsubscribe();
      console.log('Отписка выполнена');
    }
  } catch (err) {
    console.error('Ошибка отписки:', err);
  }
}

// ============ РЕГИСТРАЦИЯ SERVICE WORKER ============
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker зарегистрирован:', registration);
      
      const enableBtn = document.getElementById('enable-push');
      const disableBtn = document.getElementById('disable-push');
      
      if (!enableBtn || !disableBtn) {
        console.error('Кнопки уведомлений не найдены!');
        return;
      }
      
      // Проверяем, есть ли уже активная подписка
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('Существующая подписка найдена');
        enableBtn.style.display = 'none';
        disableBtn.style.display = 'inline-block';
      }
      
      // Обработчик кнопки "Включить уведомления"
      enableBtn.addEventListener('click', async () => {
        console.log('Нажата кнопка "Включить уведомления"');
        
        // Проверяем разрешение на уведомления
        if (Notification.permission === 'denied') {
          alert('Уведомления запрещены в настройках браузера. Разрешите их и обновите страницу.');
          return;
        }
        
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            alert('Необходимо разрешить уведомления для работы этой функции.');
            return;
          }
        }
        
        const success = await subscribeToPush();
        if (success) {
          enableBtn.style.display = 'none';
          disableBtn.style.display = 'inline-block';
          alert('Уведомления включены! Теперь вы будете получать push-уведомления.');
        } else {
          alert('Не удалось включить уведомления. Проверьте консоль для деталей.');
        }
      });
      
      // Обработчик кнопки "Отключить уведомления"
      disableBtn.addEventListener('click', async () => {
        console.log('Нажата кнопка "Отключить уведомления"');
        await unsubscribeFromPush();
        disableBtn.style.display = 'none';
        enableBtn.style.display = 'inline-block';
        alert('Уведомления отключены.');
      });
      
    } catch (err) {
      console.error('Ошибка регистрации Service Worker:', err);
    }
  });
} else {
  console.log('Service Worker не поддерживается в этом браузере');
}

// Загружаем заметки при старте
loadNotes();