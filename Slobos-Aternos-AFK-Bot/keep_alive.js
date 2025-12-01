const express = require('express');
const http = require('http');

function startKeepAlive() {
  const app = express();
  
  // صفحة رئيسية
  app.get('/', (req, res) => {
    res.status(200).send('Bot is running and alive!');
  });

  // صفحة Health Check
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  const server = http.createServer(app);
  
  const PORT = process.env.PORT || 3000;

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Keep-Alive] Server running on port ${PORT}`);
  });

  return server;
}

module.exports = { startKeepAlive };
