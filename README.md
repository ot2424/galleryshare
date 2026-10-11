# Galleryshare

Vue/Vite frontend and Node.js/Express backend with SQLite, Cloudflare R2 and Bunny storage.

This repository contains a snapshot of the local project, including uncommitted work, uploaded on 2026-10-11. It does not establish the last deployed server version.

## Setup

Use Node.js 20 or newer. Run `npm ci` separately in `backend` and `frontend`. Copy `backend/.env.example` to `backend/.env` and fill in credentials, including `ADMIN_PASSWORD`. No default admin password is provided.

Start the backend from its directory with `node --env-file=.env index.js` so environment variables are available before imported storage modules initialize. Start the frontend with `npm run dev` from `frontend`. Vite proxies `/api` to port 3000. Build the frontend with `npm run build`.

The existing Linux paths `/root/PhotoShare/backend/temp` and `/tmp` are preserved and must be writable on the server. Media uploads and ZIP downloads require working R2 and Bunny accounts.

Local databases, uploaded media and environment files are excluded. SQLite creates an empty database on first start. Legacy backup source files are retained.

Known legacy issue: backend/indexBackup.js contains a pre-existing syntax error and is not the application entry point. Use backend/index.js.
