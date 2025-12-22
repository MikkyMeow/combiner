# Combiner

## Requirements
- Node.js 22.12.0 or newer (see `.nvmrc`)
- pnpm 9 or newer

## Setup
1. `pnpm i`
2. `pnpm dev` (runs both `pnpm dev:api` and `pnpm dev:web`)

## Available scripts
- `pnpm dev:api` — starts Fastify backend on port 3000
- `pnpm dev:web` — runs Vite/Solid frontend (default port 5173)

## What success looks like
- Frontend available at `http://localhost:5173`
- Page shows the message returned from `GET /hello` (`{ message: "Hello from backend" }`)
- Console logs confirm both servers started without errors
