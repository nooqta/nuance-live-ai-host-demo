# Nuance Live AI host demo (noqta.tn)

A live video AI host for a business website, built on the Nuance Live API (`@nuancelabs/js-sdk`).
The host greets the visitor, shows the matching service card, and hands over prefilled contact options.

Tutorial: https://noqta.tn/en/tutorials/nuance-live-ai-video-host-website-javascript-2026

## Run

```bash
printf 'NUANCE_API_KEY=%s\n' "nk_your_key" > .env && chmod 600 .env
node server.mjs   # Node 18+, no dependencies
# open http://localhost:5177
```

Limits seen on 20 Nov 2026: English only, three faces (sam, sonia, mira), 60 credits/day, one call at a time.
