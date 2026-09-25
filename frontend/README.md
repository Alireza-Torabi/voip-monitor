# Frontend workspace

React/TypeScript/Vite first-admin setup, login, and PBX onboarding UI with English/Persian RTL/LTR support. It calls the same-origin backend API and stores only language preference in localStorage; credentials remain in form state only until submission. No PBX connection or monitoring dashboard exists.

From the repository root, run the backend on port 3000 with `APP_ENV=development`, then `npm run dev -w frontend`. The Vite proxy forwards `/setup`, `/auth`, and `/api` to that local backend while preserving browser Origin and Host for the backend CSRF check. Run `npm run test -w frontend` or `npm run build -w frontend` for checks.
