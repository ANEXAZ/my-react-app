# Project Instructions

This is a Vite + React (JSX) frontend for a local orders API at `http://localhost:8080`. Keep the UI as a single page that covers create, list, details, and delete. Do not add a router unless asked.

## Commands

- `npm run dev` — start Vite (proxies `/api` to `http://localhost:8080`)
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run preview` — preview the production build

The Spring (or other) orders API must already be running on port 8080. This repo is the UI only.

## Architecture

- Entry: `src/main.jsx` → `src/App.jsx`
- Orders live in React state; the backend is the source of truth
- Call the API with relative `/api/orders` paths so the Vite proxy works in dev
- Order payload: `{ customerName, productName, price, quantity }`
- Endpoints:
  - `GET /api/orders` — list
  - `POST /api/orders` — create
  - `GET /api/orders/:id` — details (if the API supports it; otherwise show the selected list item)
  - `DELETE /api/orders/:id` — delete

## Code Style

- Functional components and hooks only
- Keep this a one-page app; extract small presentational pieces in `src/` if `App.jsx` gets hard to read
- Prefer existing CSS variables in `src/index.css` over new CSS libraries
- Handle loading, empty, and error states for every API action
- After create or delete, refresh the list from the server

## Workflow

- After UI changes, run the app and verify create → list → details → delete in the browser
- Do not introduce TypeScript, routing, or extra packages unless asked
