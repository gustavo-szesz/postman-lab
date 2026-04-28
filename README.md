# postman-lab 🧪

Laboratório completo para aprender **Postman do zero**, com uma API local propositalmente "quebrável" que simula cenários reais de suporte técnico.

[![Newman CI](https://github.com/gustavo-szesz/postman-lab/actions/workflows/newman.yml/badge.svg)](https://github.com/gustavo-szesz/postman-lab/actions/workflows/newman.yml)

---

## Sumário

- [Pré-requisitos](#pré-requisitos)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Como rodar a API](#como-rodar-a-api)
- [Como importar no Postman](#como-importar-no-postman)
- [Endpoints disponíveis](#endpoints-disponíveis)
- [Exercícios guiados](#exercícios-guiados)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Como rodar Newman](#como-rodar-newman)
- [GitHub Actions (CI)](#github-actions-ci)

---

## Pré-requisitos

| Ferramenta | Versão mínima | Como instalar |
|---|---|---|
| Node.js | 18+ | https://nodejs.org |
| npm | 9+ | Incluído no Node.js |
| Postman | qualquer versão recente | https://www.postman.com/downloads |

---

## Estrutura do projeto

```
postman-lab/
├── src/
│   └── index.js                   # API Express (todos os endpoints)
├── postman/
│   ├── postman-lab.postman_collection.json   # Coleção Postman
│   └── postman-lab.postman_environment.json  # Environment Postman
├── .github/
│   └── workflows/
│       └── newman.yml             # Pipeline CI com Newman
├── package.json
└── README.md
```

---

## Como rodar a API

```bash
# 1. Clone o repositório
git clone https://github.com/gustavo-szesz/postman-lab.git
cd postman-lab

# 2. Instale as dependências
npm install

# 3. Suba a API (porta padrão: 3000)
npm run dev
```

A API responderá em `http://localhost:3000`.

> **Variáveis de ambiente opcionais:**
> ```bash
> PORT=8080 npm run dev          # Muda a porta
> JWT_SECRET=meu-secret npm run dev   # Muda o secret do JWT
> ```

---

## Como importar no Postman

### 1. Importar a coleção

1. Abra o Postman
2. Clique em **Import** (canto superior esquerdo)
3. Arraste o arquivo `postman/postman-lab.postman_collection.json` ou clique em **Upload Files**
4. Clique em **Import**

### 2. Importar o environment

1. Clique em **Import** novamente
2. Importe o arquivo `postman/postman-lab.postman_environment.json`
3. No seletor de environments (canto superior direito), selecione **postman-lab — Local**

> ✅ Após importar, o environment já vem com `baseUrl = http://localhost:3000`. As variáveis `token` e `itemId` serão preenchidas automaticamente pelos testes.

---

## Endpoints disponíveis

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/health` | ❌ | Status da API |
| POST | `/auth/login` | ❌ | Login — retorna JWT |
| POST | `/items` | ✅ | Criar item |
| GET | `/items` | ✅ | Listar items (paginação + filtro) |
| GET | `/items/:id` | ✅ | Buscar item por id |
| PATCH | `/items/:id` | ✅ | Atualizar item (suporta If-Match) |
| DELETE | `/items/:id` | ✅ | Deletar item |
| GET | `/rate-limit` | ❌ | Endpoint com rate limit agressivo |
| GET | `/timeout` | ❌ | Resposta lenta intencional |
| GET | `/server-error` | ❌ | Sempre retorna 500 |

### Credenciais de login

| Username | Password | Role |
|---|---|---|
| `admin` | `password123` | admin |
| `user` | `password123` | user |

---

## Exercícios guiados

### 🔴 Exercício 1 — Provocar 401 (sem autenticação)

1. No Postman, abra a pasta **03 - Items (CRUD)**
2. Execute **POST /items — sem token**
3. Observe o `401 Unauthorized` no response
4. **Correção:** execute primeiro **POST /auth/login — sucesso** para obter o token

**O que aprender:** a diferença entre 401 (não autenticado) e 403 (autenticado mas sem permissão). O header `Authorization: Bearer {{token}}` é obrigatório.

---

### 🔴 Exercício 2 — Provocar 422 e corrigir o payload

1. Execute **POST /items — payload inválido**
2. Observe o `422 Unprocessable Entity` com a lista de erros de validação no campo `details`
3. **Correção:** abra o request **POST /items — criar item** (com `name` e `price` válidos) e execute

**O que aprender:** 422 significa que a API entendeu o request, mas os dados são semanticamente inválidos. A resposta deve listar exatamente quais campos estão errados.

---

### 🟡 Exercício 3 — Rate limit (429)

1. Execute **GET /rate-limit** 4 vezes em menos de 10 segundos
2. Na 4ª chamada, observe o `429 Too Many Requests`
3. Inspecione os headers `RateLimit-Limit`, `RateLimit-Remaining` e `RateLimit-Reset`

**O que aprender:** como identificar e interpretar headers de rate limiting. Em suporte, 429 costuma ser resolvido com backoff/retry ou revisão da quota de uso.

---

### 🟡 Exercício 4 — Timeout

1. Abra **GET /timeout** e altere o parâmetro `delay` para `8000` (8 segundos)
2. No Postman, vá em **Settings → Request timeout** e configure para `5000` ms
3. Execute e observe o erro de timeout no Postman
4. **Variação:** configure o timeout como 0 (ilimitado) e veja a resposta chegar depois de 8s

**O que aprender:** como configurar timeouts no Postman, a diferença entre "timeout do cliente" e "servidor lento", e como identificar esse padrão em suporte.

---

### 🟡 Exercício 5 — Conflito de versão (409)

1. Execute **POST /items — criar item** para ter um item na versão 1
2. Execute **PATCH /items/:id — atualizar item** (sem If-Match) — versão vai para 2
3. Execute **PATCH /items/:id — conflito de versão com If-Match** (envia `If-Match: 1`)
4. Observe o `409 Conflict` com `currentVersion: 2`

**O que aprender:** ETag/If-Match é um mecanismo de concorrência otimista. O servidor rejeita a atualização se a versão não bater, evitando sobrescrever mudanças concorrentes.

---

### 🔴 Exercício 6 — Erro 500

1. Execute **GET /server-error**
2. Observe o corpo padronizado com `error`, `message`, `requestId` e `timestamp`
3. Copie o `requestId` — é com ele que você buscaria o log no servidor

**O que aprender:** erros 500 bem formados sempre incluem um `requestId` / correlation-id para rastreamento. Em suporte, esse id é o que você pede ao cliente para localizar o problema nos logs.

---

### 🟢 Exercício 7 — Encadear requests (fluxo completo)

Execute na ordem:
1. **POST /auth/login** → token salvo automaticamente em `{{token}}`
2. **POST /items** → `itemId` salvo automaticamente em `{{itemId}}`
3. **GET /items/:id** → usa `{{itemId}}`
4. **PATCH /items/:id** → atualiza price
5. **DELETE /items/:id** → deleta
6. **GET /items/:id após DELETE** → confirma 404

**O que aprender:** como variáveis de ambiente encadeiam requests e eliminam a necessidade de copiar/colar ids manualmente.

---

### 🟢 Exercício 8 — Paginação e filtros

1. Crie 10 items diferentes usando **POST /items** (pode usar o Runner com um CSV)
2. Execute **GET /items?page=1&limit=3** e observe o campo `pagination`
3. Execute **GET /items?q=teclado** e veja o filtro em ação
4. Altere `page` e `limit` para navegar entre as páginas

**O que aprender:** paginação é padrão em APIs de produção. Campos `total`, `totalPages`, `hasNextPage` permitem montar UI ou lógica de fetch completo.

---

## Variáveis de ambiente

| Variável | Descrição | Preenchimento |
|---|---|---|
| `baseUrl` | URL base da API | Manual (`http://localhost:3000`) |
| `token` | JWT Bearer token | Automático (POST /auth/login) |
| `itemId` | ID do último item criado | Automático (POST /items) |
| `username` | Usuário para login | Manual (`admin`) |
| `password` | Senha para login | Manual (`password123`) |

---

## Como rodar Newman

Newman é o runner de coleções Postman para linha de comando/CI.

### Rodar localmente

```bash
# Certifique-se de que a API está rodando em outro terminal
npm run dev

# Em outro terminal, rode os testes
npm run test:postman
```

### Saída esperada

```
newman

postman-lab

❏ 01 - Health
↳ GET /health  [200 OK]
  ✓ Status 200
  ✓ Body tem status ok
  ...

┌─────────────────────────┬──────────┬──────────┐
│                         │ executed │   failed │
├─────────────────────────┼──────────┼──────────┤
│              requests   │       19 │        0 │
│              assertions │       59 │        0 │
└─────────────────────────┴──────────┴──────────┘
```

### Opções úteis do Newman

```bash
# Gerar relatório HTML
npx newman run postman/postman-lab.postman_collection.json \
  --environment postman/postman-lab.postman_environment.json \
  --reporters cli,htmlextra \
  --reporter-htmlextra-export report.html

# Definir timeout por request (em ms)
npx newman run postman/postman-lab.postman_collection.json \
  --environment postman/postman-lab.postman_environment.json \
  --timeout-request 5000
```

---

## GitHub Actions (CI)

O workflow `.github/workflows/newman.yml` executa automaticamente a cada push/PR:

1. Instala Node.js e dependências
2. Sobe a API em background
3. Aguarda a API estar disponível (health check)
4. Executa a coleção Newman
5. Encerra a API

### Como ver os resultados

1. Acesse a aba **Actions** no GitHub
2. Clique em **Newman CI**
3. Expanda o passo **Executar coleção Newman** para ver todos os testes

---

## Conceitos cobertos

| Conceito | Onde exercitar |
|---|---|
| Status codes (200/201/204/400/401/404/409/422/429/500) | Todos os endpoints |
| Bearer Token / JWT | POST /auth/login → rotas protegidas |
| Variáveis de environment | `{{token}}`, `{{itemId}}`, `{{baseUrl}}` |
| Pre-request scripts | Injeção automática de X-Request-Id |
| Test scripts (assertions) | Todos os requests da coleção |
| Encadeamento de requests | Fluxo login → create → read → update → delete |
| Paginação + filtros | GET /items |
| Rate limiting | GET /rate-limit |
| Timeouts | GET /timeout |
| Correlation-Id | Header X-Request-Id em todas as respostas |
| ETag / If-Match | PATCH /items com conflito de versão |
| Newman / CI | npm run test:postman + GitHub Actions |

---

## Licença

MIT — veja [LICENSE](LICENSE)
