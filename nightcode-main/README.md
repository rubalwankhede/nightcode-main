# Nightcode

Nightcode is a React and TypeScript coding workspace with Monaco Editor, AI assistance, themes, coding statistics, snippets, and WebSocket collaboration.

## Requirements

- Node.js 18+
- npm

## Development

From the project directory:

```bash
cd nightcode-main
npm install
npm run dev
```

Open the local URL printed by Vite.

## Checks

```bash
npm run typecheck
npm run build
```

`npm run lint` currently runs the TypeScript check, and `npm test` runs the production build.

## Environment

Copy `.env.example` to `.env` when enabling the AI integration:

```bash
cp .env.example .env
```

Configure `AI_API_KEY` for the server-side AI provider. `AI_BASE_URL` and `AI_MODEL` are optional.

## Structure

```text
nightcode-main/
├── src/                  # React application and API clients
├── server/               # Vite server middleware and JSON data
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Branch workflow

- `main`: stable production code
- `develop`: active development
- `feature/*`: new features
- `fix/*`: bug fixes

Use one branch per feature or fix, merge through `develop`, then promote to `main`.
