# Agent Instructions

When a user asks you to clone this repository, do not stop after cloning.

Immediately continue with onboarding:

1. Run `npm install`.
2. Run `npm start`.
3. Do not ask all onboarding questions in one large message.
4. Let the script ask the user one thing at a time.
5. The first prompt must be only the knowledge-base PDF full path.
6. Then collect qualifying questions one by one.
7. When credentials are needed, do not ask the user to paste secrets into chat.
8. Tell the user to paste Meta and Railway values into the local `.env` file and save it.
9. The required `.env` keys are:
   - `META_VERIFY_TOKEN`
   - `META_WHATSAPP_TOKEN`
   - `META_PHONE_NUMBER_ID`
   - `RAILWAY_API_TOKEN`
10. After `.env` is saved, continue onboarding.
11. Then ask whether they want to connect Google Calendar.
12. Then collect follow-up timing and the three follow-up messages.
13. Let the onboarding script deploy to Railway.
14. Return the final dashboard URL, Meta callback URL, and verify token.

The desired user experience is:

```text
user says "clone it" -> clone repo -> npm install -> npm start -> ask PDF path first -> user saves credentials in .env -> deploy -> give callback URL
```

If WhatsApp replies do not arrive after deployment, check:

- Railway service variables
- Railway public domain port
- Meta webhook subscription
- Meta test recipient allowlist
- Meta token expiry
- Railway logs for `whatsapp.error`

Never print or commit real tokens, `.env`, copied PDFs, or generated lead data.
