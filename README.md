# Hapoel Schedule

Next.js schedule management app for Hapoel Be'er Sheva.

## Stack

- Next.js 16
- React 19
- Prisma
- PostgreSQL
- Netlify

## Local development

1. Copy `.env.example` to `.env.local`.
2. Set the PostgreSQL connection strings and a strong `ADMIN_PASSWORD` and `AUTH_SECRET`.
3. Run `npm install`.
4. Run `npx prisma migrate deploy`.
5. Run `npm run dev`.

## Netlify

This repository is configured for Netlify with `netlify.toml`.

In the Netlify site settings, add these environment variables:

- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `ADMIN_PASSWORD`
- `AUTH_SECRET`

Netlify will run Prisma migrations and build the Next.js app automatically on deploy.

The app requires an external PostgreSQL database. Netlify does not provide the PostgreSQL database itself.

Never commit production credentials.
