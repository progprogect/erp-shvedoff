const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Проксируем только API запросы, исключая websocket
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5001',
      changeOrigin: true,
      ws: false, // Отключаем websocket proxy
    })
  );
}; 