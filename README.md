This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Scripts

> Run `nvm use` first (Node 24 — see `.nvmrc`). Prisma 7 requires Node ≥ 20.19.

```bash
npm run dev      # start the dev server (http://localhost:3000)
npm run build    # production build — runs `prisma generate` then `next build` (what Vercel runs)
npm run start    # serve the production build locally
npm run lint     # run ESLint
npx prisma generate   # regenerate the Prisma client only (output: src/generated/prisma)
```

Before pushing, run `npm run build` — it mirrors the Vercel build (including Prisma
client generation) and catches deploy-time errors locally.

## Environment

Copy `.env.example` to `.env` and fill in real values (never commit `.env`).
Set the same variables in Vercel → Settings → Environment Variables:

- `DATABASE_URL` — Neon PostgreSQL connection string
- `BETTER_AUTH_SECRET` — generate with `openssl rand -base64 32`
- `BETTER_AUTH_URL` — the app URL (production URL on Vercel, **not** `localhost`)
- `BLOB_READ_WRITE_TOKEN` — Vercel → Storage → Blob store read/write token

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
