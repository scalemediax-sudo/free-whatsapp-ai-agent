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

If you are using an AI coding agent, tell it:

```text
Clone this repo.
```

The repo includes `AGENTS.md`, so an AI coding agent should automatically continue into onboarding after clone instead of stopping there.

The first onboarding question is only:

```text
Knowledge-base PDF full path:
```

Then it asks the rest one by one.

Under the hood, the agent runs:

```bash
git clone YOUR_GITHUB_REPO_URL
cd free-whatsapp-ai-agent
npm install
npm start
```

Note: GitHub repositories cannot safely auto-run code the moment they are cloned. Onboarding starts when `npm start` or `npm run onboard` is run after cloning.

The onboarding command asks for:

- knowledge-base PDF path
- qualifying questions, one by one
- Meta values in one prompt: verify token, access token, phone number ID
- Railway API token
- whether you want Google Calendar connection instructions
- follow-up delay and three follow-up messages

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
