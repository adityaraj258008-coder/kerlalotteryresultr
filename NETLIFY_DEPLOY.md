# Netlify Deployment Guide

This project is pre-configured with `netlify.toml` and `netlify/functions/api.ts` so both the React frontend (`dist/`) and the Express `/api/*` backend run seamlessly on Netlify.

## 1. Build Settings (Auto-detected from `netlify.toml`)
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Functions directory**: `netlify/functions`
- **Node version**: `22`

## 2. Environment Variables to Set in Netlify
In **Netlify Dashboard → Site configuration → Environment variables**, add:

- `SUPABASE_URL` = `https://mhilrmauipkxdtrzbyvl.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY` = your Supabase publishable key
- `SESSION_SECRET` = any random 32+ character string (keeps admin sessions valid across serverless invocations)
- `ADMIN_USERNAME` = `Ankushraj` (or your preferred admin username)
- `ADMIN_PASSWORD` = your chosen admin password

## 3. Supabase Tables (Required for Persistent Cloud Storage on Netlify)
Serverless functions have ephemeral local `/tmp` storage, so **Supabase** stores your bookings, winner records, and prize categories persistently.
Make sure you run the SQL setup script shown under **Admin → Supabase DB** in your Supabase SQL Editor once before syncing.

## 4. Deploy Options
- **Git Deploy**: Connect your repository in Netlify — `netlify.toml` automatically configures the build, `/api/*` function proxy, and `/admin` SPA fallback.
- **Netlify CLI**:
  ```bash
  npm install -g netlify-cli
  netlify deploy --build --prod
  ```
