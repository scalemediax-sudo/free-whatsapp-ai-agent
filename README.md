# Free WhatsApp AI Agent

Clone this repo to launch a WhatsApp AI agent that:

- replies instantly to new WhatsApp leads
- asks your custom qualifying questions
- stores every lead and conversation
- follows up three times if the lead stops replying
- deploys to Railway
- gives you the Meta callback URL and verify token
- includes a dashboard for leads, status, conversations, and automation metrics

## What You Need

1. Node.js installed
2. A Meta Developer app with WhatsApp Cloud API enabled
3. A Meta WhatsApp test phone number
4. A Railway account and Railway API token
5. A knowledge-base PDF for your business

## Fast Setup

```bash
git clone YOUR_GITHUB_REPO_URL
cd free-whatsapp-ai-agent
npm install
npm run onboard
```

The onboarding command asks for:

- business name
- knowledge-base PDF path
- the qualifying questions your bot should ask
- final message after the lead answers everything
- Meta verify token
- Meta WhatsApp access token
- Meta phone number ID
- Railway API token

Then it:

- creates your private `.env`
- creates `data/agent-config.json`
- copies your PDF into `knowledge-base/`
- creates a Railway project
- creates a Railway service
- sets Railway variables
- deploys the app
- generates your public Railway URL

At the end, it prints:

```text
Dashboard URL: https://your-app.up.railway.app
Meta callback URL: https://your-app.up.railway.app/webhook/whatsapp
Meta verify token: your-token
```

## Meta Webhook Setup

In Meta Developer, paste:

```text
Callback URL: https://your-app.up.railway.app/webhook/whatsapp
Verify token: the token printed by onboarding
```

Click **Verify and save**.

Then subscribe to WhatsApp messages.

## Local Development

Run the API and dashboard locally:

```bash
npm run api
npm run dev
```

Dashboard:

```text
http://localhost:5173
```

API:

```text
http://localhost:8787
```

## Test The Bot

Send a WhatsApp message to your Meta test number.

The bot should reply with the first qualifying question.

If you are not getting a reply:

1. Check Railway Variables have `META_WHATSAPP_TOKEN`, `META_PHONE_NUMBER_ID`, and `META_VERIFY_TOKEN`.
2. Make sure your test recipient is added in Meta WhatsApp API setup.
3. Make sure the Meta access token has not expired.
4. Check Railway logs for `whatsapp.error`.

## Important Security Note

Never commit `.env`, real Meta tokens, real Railway tokens, or client PDFs.

This repo ignores:

- `.env`
- `data/*.json`
- `knowledge-base/*.pdf`
- build outputs
- `node_modules`
