# ZaUI Food Backend

Backend production-style for food delivery app, built with:

- Node.js + Express + TypeScript
- PostgreSQL + Prisma ORM
- JWT access/refresh auth
- Zod request validation

## 1) Start PostgreSQL

From repository root:

```bash
docker compose up -d postgres
```

Optional DB UI:

```bash
docker compose up -d pgadmin
```

- PgAdmin: http://localhost:5050
- Email: `admin@zauifood.local`
- Password: `admin1234`

## 2) Configure env

```bash
cd backend
cp .env.example .env
```

Update secrets in `.env` before production deployment.

## 3) Install and migrate

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
```

## 4) Run API

```bash
npm run dev
```

Server base URL: `http://localhost:8081/api/v1`
Landing web URL: `http://localhost:8081/`
Admin web URL: `http://localhost:8081/admin`
Store Manager web URL: `http://localhost:8081/partner`
Customer web URL: `http://localhost:8081/customer`
Driver web URL: `http://localhost:8081/driver`

## Main endpoints

- `GET /health`
- `POST /auth/register`
- `POST /auth/register/customer`
- `POST /auth/register/store`
- `POST /auth/register/driver`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /categories`
- `GET /stores`
- `GET /products`
- `GET /products/:id`
- `GET /cart` (auth)
- `POST /cart/items` (auth)
- `PATCH /cart/items/:itemId` (auth)
- `DELETE /cart/items/:itemId` (auth)
- `DELETE /cart` (auth)
- `POST /orders` (auth)
- `GET /orders` (auth)
- `GET /orders/:orderId` (auth)
- `PATCH /orders/:orderId/status` (admin)
- `GET /admin/overview` (admin)
- `POST /products` (store manager)
- `PATCH /products/:id` (store manager)
- `POST /stores` (admin)
- `PATCH /stores/:storeId` (admin)
- `GET /stores/managed/me` (store manager)
- `GET /products/managed/my` (store manager)
- `GET /drivers/me` (driver)
- `PATCH /drivers/availability` (driver)
- `GET /drivers/orders/available` (driver)
- `GET /drivers/orders/mine` (driver)
- `POST /drivers/orders/:orderId/claim` (driver)
- `POST /drivers/orders/:orderId/complete` (driver)

## Notes for production

- Put API behind reverse proxy (Nginx/Traefik) with TLS.
- Rotate JWT secrets periodically.
- Move secrets to a secret manager.
- Add Redis for rate limiting / caching and queue worker for order workflow.
- Add integration tests and OpenAPI contract.
