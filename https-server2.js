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

const server = https.createServer(options, app);

const PORT = 3002;

server.listen(PORT, () => {
  console.log(`HTTPS сервер запущен на https://localhost:${PORT}`);
});