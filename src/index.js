'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'postman-lab-secret-2024';

// In-memory store
let items = [];
let nextId = 1;

// ─── Middleware ──────────────────────────────────────────────────────────────

// Parse JSON bodies
app.use(express.json());

// X-Request-Id correlation-id middleware
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

// Basic request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${res.statusCode} (${ms}ms) [${req.requestId}]`);
  });
  next();
});

// ─── Auth Middleware ─────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Header Authorization: Bearer <token> é obrigatório.',
      requestId: req.requestId,
    });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Token expirado. Faça login novamente.'
        : 'Token inválido.';
    return res.status(401).json({
      error: 'Unauthorized',
      message,
      requestId: req.requestId,
    });
  }
}

// ─── Rate Limiter ────────────────────────────────────────────────────────────

const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: (req) => ({
    error: 'TooManyRequests',
    message: 'Muitas requisições. Aguarde e tente novamente.',
    requestId: req.requestId,
  }),
});

const rateLimitEndpointLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 segundos
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: (req) => ({
    error: 'TooManyRequests',
    message: 'Limite de requisições atingido para este endpoint.',
    requestId: req.requestId,
  }),
});

// Apply global limiter to all routes
app.use(globalLimiter);

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /health
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// POST /auth/login
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      error: 'BadRequest',
      message: 'Campos obrigatórios: username, password.',
      requestId: req.requestId,
    });
  }

  // Credenciais válidas: admin/password123 ou user/password123
  const validUsers = {
    admin: 'password123',
    user: 'password123',
  };

  if (!validUsers[username] || validUsers[username] !== password) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Credenciais inválidas.',
      requestId: req.requestId,
    });
  }

  const expiresIn = 3600; // 1 hora
  const token = jwt.sign(
    { sub: username, role: username === 'admin' ? 'admin' : 'user' },
    JWT_SECRET,
    { expiresIn }
  );

  res.status(200).json({
    token,
    tokenType: 'Bearer',
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  });
});

// POST /items
app.post('/items', requireAuth, (req, res) => {
  const { name, description, price, category } = req.body || {};
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.push({ field: 'name', message: 'Campo obrigatório e deve ser string não vazia.' });
  }
  if (price === undefined || price === null) {
    errors.push({ field: 'price', message: 'Campo obrigatório.' });
  } else if (typeof price !== 'number' || price < 0) {
    errors.push({ field: 'price', message: 'Deve ser um número >= 0.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      error: 'UnprocessableEntity',
      message: 'Payload inválido.',
      details: errors,
      requestId: req.requestId,
    });
  }

  const item = {
    id: nextId++,
    name: name.trim(),
    description: description || null,
    price,
    category: category || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  items.push(item);

  res.status(201).json(item);
});

// GET /items
app.get('/items', requireAuth, (req, res) => {
  let { page = '1', limit = '10', q } = req.query;
  page = parseInt(page, 10);
  limit = parseInt(limit, 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > 100) limit = 100;

  let filtered = [...items];

  if (q) {
    const search = q.toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.name.toLowerCase().includes(search) ||
        (item.description && item.description.toLowerCase().includes(search))
    );
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;
  const data = filtered.slice(offset, offset + limit);

  res.status(200).json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
});

// GET /items/:id
app.get('/items/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = items.find((i) => i.id === id);

  if (!item) {
    return res.status(404).json({
      error: 'NotFound',
      message: `Item com id ${id} não encontrado.`,
      requestId: req.requestId,
    });
  }

  res.status(200).json(item);
});

// PATCH /items/:id  — suporta ETag / If-Match simples
app.patch('/items/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = items.find((i) => i.id === id);

  if (!item) {
    return res.status(404).json({
      error: 'NotFound',
      message: `Item com id ${id} não encontrado.`,
      requestId: req.requestId,
    });
  }

  // Verificação opcional de ETag / If-Match para simular conflito de versão
  const ifMatch = req.headers['if-match'];
  if (ifMatch !== undefined) {
    const clientVersion = parseInt(ifMatch, 10);
    if (isNaN(clientVersion) || clientVersion !== item.version) {
      return res.status(409).json({
        error: 'Conflict',
        message: `Conflito de versão. Versão atual: ${item.version}, versão enviada: ${ifMatch}.`,
        currentVersion: item.version,
        requestId: req.requestId,
      });
    }
  }

  const { name, description, price, category } = req.body || {};
  const errors = [];

  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    errors.push({ field: 'name', message: 'Deve ser string não vazia.' });
  }
  if (price !== undefined && (typeof price !== 'number' || price < 0)) {
    errors.push({ field: 'price', message: 'Deve ser um número >= 0.' });
  }

  if (errors.length > 0) {
    return res.status(422).json({
      error: 'UnprocessableEntity',
      message: 'Payload inválido.',
      details: errors,
      requestId: req.requestId,
    });
  }

  if (name !== undefined) item.name = name.trim();
  if (description !== undefined) item.description = description;
  if (price !== undefined) item.price = price;
  if (category !== undefined) item.category = category;
  item.updatedAt = new Date().toISOString();
  item.version += 1;

  res.status(200).json(item);
});

// DELETE /items/:id
app.delete('/items/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = items.findIndex((i) => i.id === id);

  if (index === -1) {
    return res.status(404).json({
      error: 'NotFound',
      message: `Item com id ${id} não encontrado.`,
      requestId: req.requestId,
    });
  }

  items.splice(index, 1);
  res.status(204).send();
});

// GET /rate-limit  — endpoint com rate limit agressivo (3 req / 10s)
app.get('/rate-limit', rateLimitEndpointLimiter, (req, res) => {
  res.status(200).json({
    message: 'Requisição aceita! Tente 4 vezes em 10 segundos para ver o 429.',
    requestId: req.requestId,
  });
});

// GET /timeout  — demora 7 segundos propositalmente
app.get('/timeout', (req, res) => {
  const MAX_DELAY = 30000;
  const requestedDelay = parseInt(req.query.delay || '7000', 10);
  const delay = isNaN(requestedDelay) || requestedDelay < 0 ? 7000 : Math.min(requestedDelay, MAX_DELAY);
  setTimeout(() => {
    res.status(200).json({
      message: `Resposta chegou depois de ${delay}ms.`,
      requestId: req.requestId,
    });
  }, delay);
});

// GET /server-error  — sempre retorna 500
app.get('/server-error', (req, res) => {
  res.status(500).json({
    error: 'InternalServerError',
    message: 'Algo deu errado no servidor. Tente novamente mais tarde.',
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 catchall ────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    error: 'NotFound',
    message: `Rota ${req.method} ${req.path} não existe.`,
    requestId: req.requestId,
  });
});

// ─── Error handler ───────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: 'InternalServerError',
    message: 'Erro inesperado no servidor.',
    requestId: req.requestId,
  });
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[postman-lab] API rodando em http://localhost:${PORT}`);
});

module.exports = app;
