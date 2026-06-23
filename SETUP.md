# Life OS — Setup Guide

## What this is
A personal dashboard for goals across 8 life spheres, with Ali Abdaal's Feel Good Productivity framework baked in, Google Calendar integration, Claude-generated daily briefs, and email delivery.

## Step 1 — Google Calendar API (5 min)

1. Go to https://console.cloud.google.com
2. Create a new project (name it "Life OS")
3. Search "Google Calendar API" → Enable it
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorised redirect URI: `http://localhost:3000/api/auth/google/callback`
7. Copy the **Client ID** and **Client Secret**

## Step 2 — Resend email (2 min)

1. Sign up at https://resend.com (free — 100 emails/day)
2. Dashboard → **API Keys** → Create key
3. Either verify your own domain or use `onboarding@resend.dev` as the from address for testing

## Step 3 — Fill in .env.local

Open `.env.local` in this folder and fill in:

```
GOOGLE_CLIENT_ID=        # from Step 1
GOOGLE_CLIENT_SECRET=    # from Step 1
ANTHROPIC_API_KEY=       # from console.anthropic.com
RESEND_API_KEY=          # from Step 2
USER_EMAIL=suketubatra@gmail.com
USER_NAME=Suketu
```

## Step 4 — Run the app

```bash
cd "Life admin/life-os"
npm run dev
```

Open http://localhost:3000

## Step 5 — Connect Google Calendar

Click **🔗 Connect Calendar** in the top right. Sign in with Google and grant access. You'll be redirected back with a success banner.

## Step 6 — Add your first goal

Click **+ New goal**. Fill in the Abdaal pillars:
- **Energizer**: What makes this feel good (Play / Power / People / Adventure / Challenge)
- **Blocker**: What gets in your way (Fear / Uncertainty / Inertia / Overwhelm)
- **Burnout signal**: What tells you you're overdoing it
- **Energy level**: High (morning) / Medium / Low (evenings ok)

## Step 7 — Generate your first brief

Click ☀️ **Morning** or 🌙 **Evening** to get your first Claude-generated brief. It will also be emailed to you.

## Step 8 — Build your Ideal Week (optional)

Once you have a few goals, click **📅 Ideal Week**. This adds recurring deep work blocks, a Sunday review, and recharge time to your Google Calendar.

## Step 9 — Automate daily briefs

In a separate terminal, keep the cron runner going:

```bash
npm run cron
```

This sends morning briefs at **8am** and evening check-ins at **9pm** (IST). Keep this terminal open (or add it to your login items).
