const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

// Necessário atrás de proxy reverso (OpenLiteSpeed) para enxergar o IP real
app.set('trust proxy', 1);

app.get('/', (req, res) => {
  res.send('Hello, World! 🚀');
});

// Mostra o que o Node recebe do proxy (útil para conferir a configuração)
app.get('/info', (req, res) => {
  res.json({
    host: req.headers.host,
    ip: req.ip,
    protocol: req.protocol,
    forwardedFor: req.headers['x-forwarded-for'] || null,
    forwardedProto: req.headers['x-forwarded-proto'] || null,
  });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Servidor rodando em http://${HOST}:${PORT}`);
});

// Maior que o Connection Keep-Alive Timeout do OpenLiteSpeed (60s),
// evitando 502 esporádicos por conexões reaproveitadas que o Node já fechou
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
