# Hapoel Schedule

Next.js schedule management app for Hapoel Be'er Sheva.

## Stack

- Next.js 16
- React 19
- Drizzle ORM
- Netlify Database (managed PostgreSQL)
- Netlify

## Local development

1. Copy `.env.example` to `.env.local` and set a strong `ADMIN_PASSWORD` and `AUTH_SECRET`.
2. Run `npm install`.
3. Run `netlify dev` — it connects the app to a local Netlify Database automatically.

## Database

The schema lives in `db/schema.ts`. After changing it, run `npm run db:generate -- --name <change_name>`
to create a migration in `netlify/database/migrations/`. Netlify applies pending migrations automatically
on every deploy. The initial migrations create the tables and seed the club settings and team list.

`npm run db:seed` resets the database and loads demo schedule data (local development only).

## Netlify

This repository is configured for Netlify with `netlify.toml`. The database is provided by Netlify Database,
so no connection strings are needed. In the Netlify site settings, add these environment variables:

- `ADMIN_PASSWORD`
- `AUTH_SECRET`

Never commit production credentials.
