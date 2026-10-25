# Schoolites CRM — Deployment

This is the production setup for the Next.js app in this folder. The school PHP ERP is a separate application. Do not deploy this app as files under the PHP document root.

## Push changes to Vercel

Production is the Vercel project `leads`. Day-to-day deploys come from the `main` branch of `TeamFriends/schoolites-leads` on Bitbucket. Vercel starts a new production deployment when that branch moves.

Do this from this directory:

1. Keep secrets out of git. `.env.local` is ignored. Never `git add` it.
2. See what will ship:

```bash
git status
git diff
```

3. Commit, then push `main`:

```bash
git add <the files you changed>
git commit -m "Why this change is needed"
git push origin main
```

4. Open the Vercel project **leads** → **Deployments**. Wait until the new deployment for that commit says **Ready**. The site keeps serving the previous deployment until then.
5. Open the production URL and sign in with `admin@schoolites.com`. A code should arrive from Brevo.

Changing only an environment variable does not redeploy. In **Settings → Environment Variables**, update **Production**, then open **Deployments** and redeploy the latest production deployment.

If `git push` cannot authenticate, deploy the current directory with the Vercel CLI from a machine that is already logged in and linked (`.vercel/project.json` is present):

```bash
npx vercel deploy --prod --yes
```

That upload does not update Bitbucket. Push `main` as well when credentials are available, so the next Git deploy is not an older commit.

## Requirements

- Node.js 20 or newer
- A PostgreSQL database. The app uses Neon via `DATABASE_URL`.
- HTTPS on the public URL
- Outbound email, or nobody can log in

`next start` sets `NODE_ENV=production`. In that mode the login route refuses to run until email is configured, and the session cookie is marked `Secure`.

## Environment

Copy `.env.example` to the host environment. Do not commit `.env.local`. Vercel does not upload `.env.local`. Add the same variables under Project Settings → Environment Variables for Production, then redeploy. The build no longer needs `DATABASE_URL`, but every login and API call fails until it is set on the project.

### Required

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Include `sslmode=require` for Neon. The process exits if this is missing. |
| `BREVO_API_KEY` | Brevo API key. Login codes are sent with Brevo's HTTP API. |
| `MAIL_FROM` | From address, for example `Schoolites <noreply@yourdomain.com>`. That address must be a verified sender in Brevo. |

### Required for marketing uploads

Skip these only if nobody will upload brochures or images.

| Variable | Purpose |
|---|---|
| `AWS_ENDPOINT_URL_S3` | S3-compatible endpoint (Neon object storage, Cloudflare R2, or AWS S3). |
| `AWS_ACCESS_KEY_ID` | Access key. |
| `AWS_SECRET_ACCESS_KEY` | Secret key. |
| `AWS_REGION` | Optional. Defaults to `ap-southeast-1`. |
| `AWS_BUCKET_NAME` | Optional. Defaults to `storage-bucket`. |

### Optional

| Variable | Purpose |
|---|---|
| `GOOGLE_PLACES_API_KEY` | Admin Places search only. Put a billing quota on the key in Google Cloud. The rest of the CRM works without it. |

### Ignored

These names appear in older docs. The application does not read them:

`JWT_SECRET`, `AUTH_SECRET`, `DEV_AUTO_OTP`, `NEXT_PUBLIC_APP_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `RESEND_API_KEY`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`.

Sessions are random tokens stored in the `sessions` table. There is no signed JWT.

## First deploy

From this directory:

```bash
npm ci
npm run db:init
npm run build
npm start
```

`npm run db:init` applies `src/lib/schema.sql` and seeds form fields, default commission rates, and the first admin if none exists. It is safe to run again. Re-running it rewrites the default form-field rows and the default commission rates for each role.

The dev server listens on port 3000. `npm start` does the same unless `PORT` is set.

Confirm:

- `https://your-domain/login` loads
- An existing user receives a 6-digit code by email
- An admin can open `/admin/users`
- An asset upload succeeds if object storage is configured

Local development without `BREVO_API_KEY` still shows the code on the login screen. Production does not.

## Where to run it

**Managed Node host (smallest change).** Vercel, Railway, Render, or Fly.io. Keep Neon for `DATABASE_URL` and the current S3-compatible bucket. Set the variables above in the host's environment. Point a subdomain such as `leads.yourdomain.com` at the app.

**Same Linux server as the PHP ERP.**

1. Install Node.js 20.
2. Build as above.
3. Run `npm start` under systemd on an internal port (`PORT=3000`).
4. Proxy the subdomain to that port with nginx and TLS.

Postgres can stay on Neon. If you move off Neon, use PostgreSQL 16 and replace `@neondatabase/serverless` with the `pg` driver. That is a code change, not an environment change. Do not point this app at MySQL.

## After it is up

- Cap Google Places billing. Each admin search is a paid API call.
- Keep `.env.local` off git. `.gitignore` already ignores `.env*`.
- Back up the Neon database. Object storage is separate from that backup.
