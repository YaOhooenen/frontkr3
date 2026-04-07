const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

// ============ ВАШИ НОВЫЕ VAPID КЛЮЧИ ============
const vapidKeys = {
  publicKey: 'BHJqcJ1yjrJPQS1mFy6iOjpO9BIdtECdcj7gDpY1LJCicgLUdXkqp3IzLvHBIW5LSjlQlsJrCnhQ3s5gSyV-ho4',
  privateKey: '-tw1iLUMdUijJZFjL7zZ2YK-79EkDuI7No04MBmETVU'
};

// ============ НАСТРОЙКА WEB-PUSH ============
webpush.setVapidDetails(
  'mailto:your-email@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// ============ СОЗДАНИЕ APP ============
const app = express();

// ============ MIDDLEWARE ============
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../notes-app')));

// ============ ХРАНИЛИЩЕ ПОДПИСОК ============
let subscriptions = [];

// ============ СОЗДАНИЕ HTTP СЕРВЕРА ============
const server = http.createServer(app);

// ============ НАСТРОЙКА SOCKET.IO ============
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ============ WEBSOCKET СОБЫТИЯ ============
io.on('connection', (socket) => {
  console.log('✅ Клиент подключён:', socket.id);

  socket.on('newTask', (task) => {
    console.log('📝 Новая задача:', task);
    
    io.emit('taskAdded', task);
    
    const payload = JSON.stringify({
      title: '📝 Новая задача',
      body: task.text,
      icon: '/icons/favicon-128x128.png',
      badge: '/icons/favicon-48x48.png'
    });
    
    console.log(`📨 Отправка push ${subscriptions.length} подписчикам`);
    
    subscriptions.forEach((sub, index) => {
      webpush.sendNotification(sub, payload)
        .then(() => {
          console.log(`✅ Push отправлен подписчику ${index + 1}`);
        })
        .catch(err => {
          console.error(`❌ Ошибка push для подписчика ${index + 1}:`, err.message);
          if (err.statusCode === 410) {
            subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
          }
        });
    });
  });

  socket.on('disconnect', () => {
    console.log('❌ Клиент отключён:', socket.id);
  });
});

// ============ HTTP ЭНДПОИНТЫ ============
app.post('/subscribe', (req, res) => {
  const subscription = req.body;
  subscriptions.push(subscription);
  console.log(`💾 Новая подписка сохранена. Всего: ${subscriptions.length}`);
  res.status(201).json({ message: 'Подписка сохранена' });
});

app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
  console.log(`🗑 Подписка удалена. Осталось: ${subscriptions.length}`);
  res.status(200).json({ message: 'Подписка удалена' });
});

// ============ ЗАПУСК СЕРВЕРА ============
const PORT = 3001;
server.listen(PORT, () => {
  console.log('\n==================================================');
  console.log('🚀 WebSocket + Push сервер запущен!');
  console.log('==================================================');
  console.log(`📡 Адрес: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: активен`);
  console.log(`🔔 Push уведомления: активны`);
  console.log('==================================================\n');
});