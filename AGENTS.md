# Agent Instructions

When a user asks you to clone or set up this repository, do not stop after cloning.

Immediately continue with onboarding:

1. Run `npm install`.
2. Run `npm run onboard`.
3. Ask the user for each onboarding answer as the script requests it.
4. Help them find their knowledge-base PDF path if needed.
5. Help them collect Meta WhatsApp values:
   - `META_VERIFY_TOKEN`
   - `META_WHATSAPP_TOKEN`
   - `META_PHONE_NUMBER_ID`
6. Ask for their Railway API token.
7. Let the onboarding script deploy to Railway.
8. Return the final dashboard URL, Meta callback URL, and verify token.

The desired user experience is:

```text
clone repo -> install dependencies -> start onboarding -> deploy -> give callback URL
```

If WhatsApp replies do not arrive after deployment, check:

- Railway service variables
- Railway public domain port
- Meta webhook subscription
- Meta test recipient allowlist
- Meta token expiry
- Railway logs for `whatsapp.error`

Never print or commit real tokens, `.env`, copied PDFs, or generated lead data.
