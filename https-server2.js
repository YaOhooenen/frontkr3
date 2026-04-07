const https = require('https');
const fs = require('fs');
const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'notes-app')));

const options = {
  key: fs.readFileSync(path.join(__dirname, 'localhost+2-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'localhost+2.pem'))
};

// Используем порт 3002
https.createServer(options, app).listen(3002, () => {
  console.log('✓ HTTPS сервер запущен!');
  console.log('📱 Адрес: https://localhost:3002');
});