# JanVaani (जनवाणी)

**Speak once, in your own words. The government form fills itself, and you leave with a CSC Ready Slip.**

**[Live demo](https://quick-marble-9ye8oc5.vercel.app/)**

JanVaani is a voice assistant for Indian citizens who qualify for welfare schemes but cannot get through the forms. A farmer says *"Main Kolar se hoon, do acre tamatar ugata hoon, umar pentalees, pitaji bahattar saal ke hain"* and, while they are still talking, the screen fills in `District: Kolar`, `Land: 2 acres (0.81 ha)`, `Occupation: farmer`, `Family member 70+: yes`, lists PM-KISAN, Ayushman Bharat, Vay Vandana and crop insurance with the reason for each, asks the three questions that cause most CSC rejections, and prints a one-page slip the CSC operator can type from.

Built for the **SLNG** track of Ignite With Bangalore. Every voice component runs on SLNG's India gateway, and the hosted conversational agent is declared as an **Unmute** package.

## Why this problem

- A 2025 BITS Hyderabad study of myScheme found only 2 of 15 low-income workers could finish the eligibility form unaided. The blockers were vocabulary (`Area type`, `Sector: organised/unorganised`, `BPL`), not literacy. By voice the same task took 49 s instead of 118 s.
- ActionAid and Dvara Research (2024) put CSC rejection rates near 30%, mostly from Aadhaar / ration-card name mismatches, unlinked mobiles and unseeded bank accounts. A rejected trip costs a day's wages.
- Hindi, Kannada, Telugu and Tamil speakers are a majority of beneficiaries, and the portals are English-first dropdowns.

JanVaani attacks both halves: it translates speech into the form's own vocabulary, and it audits the three document checks *before* the trip.

## What is in the box

| Pane | What it does |
| --- | --- |
| **Conversation** | Push-to-talk (hold the mic) or type. Auto-detects Hindi / Kannada / Telugu / Tamil / Marathi / English, including code-mixing. Replies are spoken back in the same language. |
| **Citizen profile** | 27 form fields fill live, with a *heard* chip that shows the exact phrase each value came from. Jargon chips explain `Rural`, `Unorganised`, `AAY`. Every value is editable by hand. |
| **Schemes for you** | 10 schemes (central + Karnataka) scored by a **deterministic rule engine**, grouped as *qualify / very likely / need one answer / not for you*, each with the reason and the missing field. |
| **CSC Ready Slip** | Printable one-pager: schemes to apply for, form values in portal vocabulary, document checklist, the three pre-CSC audit results, and a red "fix this first" box. |
| **Live telemetry** | Per-turn STT / LLM / TTS latency, which model answered (incl. Context Router cache hits), and an estimated cost from SLNG's per-minute rate. |
| **Models** | Swap ears (Saaras v3, Nova 3 Hindi, Soniox), voice (Bulbul v3 with 10 voices, Aura 2), language pin, LLM on/off; no code changes. |
| **Live Call** | Full-duplex WebRTC call with the SLNG-hosted JanVaani agent (interruptible), with live captions. |

## How it runs on SLNG

```
browser mic ──PCM16/16k──▶ /api/stt ──▶ wss://in.api.slng.ai/v1/bridges/unmute/stt/sarvam/saaras:v3
                                                                   (or slng/deepgram/nova:3-hi over HTTP, or soniox)
transcript ──▶ /api/turn ──▶ rule extractor (0 ms, 55 Indic-aware regexes)
                          └▶ https://in.context-router.slng.ai/v1/chat/completions   (slng/auto, JSON mode)
                          └▶ merge → derive → match 10 scheme rules → pick the next question
reply text ──▶ /api/tts ──▶ wss://in.api.slng.ai/v1/bridges/unmute/tts/sarvam/bulbul:v3  (or deepgram/aura:2)
Live Call  ──▶ /api/session ──▶ POST https://api.agents.slng.ai/v1/agents/{id}/web-sessions ──▶ livekit-client
```

Design choices worth knowing:

- **Rules first, model second.** Eligibility is never decided by an LLM. The scheme rules are code (`lib/schemes/catalog.ts`), so a hallucinated "you qualify" cannot happen. The LLM only maps speech to fields, and a deterministic extractor runs on every turn regardless, so the app stays useful with the LLM switched off or unreachable.
- **Unified Unmute bridge protocol.** STT and TTS both speak SLNG's `init / text / flush / audio_end` protocol, so swapping Sarvam for Deepgram or Soniox is a model-string change.
- **Context Router.** The brain is `slng/auto` through the project's router with stable `slng_agent_id` / `slng_session_id`, so repeated turns hit the cache and the metrics bar shows `cache hit`. Drop `LLM_BYOK_URL/KEY/MODEL` into `.env.local` to route to your own OpenAI-compatible provider (xAI, Groq, OpenAI) through the same endpoint.
- **India region only.** Project keys are regional. Everything targets `in.api.slng.ai`, `in.context-router.slng.ai` and the Mumbai LiveKit region.

## Unmute package

`unmute/janvaani/` is a complete Unmute v1 package: `agent.yaml` (models, greeting, capacity, tools), `prompt.md` (the system prompt with the same scheme rules and the three CSC checks), `targets.yaml` (SLNG, `ap-south-livekit`). It validates and compiles with `unmute` 0.7.4:

```sh
cd unmute/janvaani
unmute validate .          # ✓ slng (slng)
unmute compile .           # build/slng/agent.json — the exact Agents API body
cd ../..
node scripts/push-agent.mjs   # PATCH the body onto the agent in SLNG_AGENT_ID
```

`unmute deploy` needs the `voiceai` CLI (Homebrew); `scripts/push-agent.mjs` does the same PATCH directly so it also works on Linux. The compiled body is committed in `unmute/janvaani/build/slng/agent.json` for review.

## Run it locally

The [live demo](https://quick-marble-9ye8oc5.vercel.app/) is already deployed if you want to try it before installing.

```sh
npm install
cp .env.example .env.local      # add SLNG_API_KEY and SLNG_AGENT_ID
npm run dev                     # http://localhost:4517
```

Without an `SLNG_API_KEY` the app runs in text-only mode: typing still fills the form, matches schemes and produces the slip; the mic, speaker and Live Call are disabled with a visible notice.

`.env.local`:

```
SLNG_API_KEY=slng_...        # Project Vault → SLNG API key (an India-region project)
SLNG_AGENT_ID=...            # the project's Agent ID (for Live Call and router cache scope)
SLNG_REGION=in
```

## Demo script (3 minutes)

1. **Hear the greeting.** Bulbul v3 speaks Hindi; note the TTS latency in the telemetry bar.
2. **Hold the mic and say** (or click *Try: Kolar farmer*): *"Main Kolar ke paas ek gaon se hoon, do acre mein tamatar ugata hoon, umar pentalees saal. Is baar baarish se fasal kharab ho gayi. BPL card hai, pitaji bahattar saal ke hain."*
   Watch 12 fields fill with *heard* chips; 5 schemes appear; JanVaani says which ones and asks the first CSC check.
3. **Answer** *"nahi, naam alag likha hai"*, *"haan"*, *"haan"*. The slip becomes ready with a red *fix first* box: Aadhaar vs ration card name mismatch.
4. **Open the CSC Ready Slip** and print.
5. **Switch to Kannada**: click *Try: ಟೈಲರ್ (Kannada)*. Same flow, different script, PM Vishwakarma appears. Toggle *Brain: LLM* off in Models and send it again: identical extraction in ~30 ms from the rule engine alone.
6. **Live Call**: talk to the hosted agent over WebRTC and interrupt it mid-sentence.

## Project layout

```
app/api/{turn,stt,tts,session,health}/route.ts   Route Handlers (Node runtime)
lib/slng.ts              SLNG client: Unmute STT/TTS bridges over ws, Context Router, web-sessions
lib/turn.ts              one conversational turn: rules → LLM → merge → match → stage machine → reply
lib/extract/rules.ts     deterministic Indic-aware extractor (Devanagari/Kannada digits, inflected place names)
lib/extract/llm.ts       JSON-mode extraction prompt with Hinglish/Kannada/Telugu few-shots
lib/profile/schema.ts    27-field citizen profile (zod), labels, jargon, derivations
lib/schemes/catalog.ts   10 schemes with code rules, documents, where to apply
lib/schemes/match.ts     verdicts, next-question scoring, document checklist, fix-first list
lib/dialogue.ts          questions and replies in hi/kn/te/ta/mr/en
components/janvaani/*    the three panes, slip, metrics, settings, live call
unmute/janvaani/*        Unmute package (agent.yaml, prompt.md, targets.yaml, tools/)
scripts/push-agent.mjs   push the compiled agent body to SLNG
```

## Measured on this build (India gateway, Oct 2026)

- Saaras v3 STT: ~2.1 s for a 2.7 s Hindi clip (final transcript, no partials on this bridge).
- Bulbul v3 TTS: first audio ~1.8 s, 2.7 s of speech in ~2.2 s total.
- Context Router (`slng/auto` → hosted model): 0.7–2.7 s per extraction turn.
- Rule engine alone: 13–31 ms.

## Known limits

- Scheme rules cover 10 schemes, with Karnataka as the state layer. Other states need their own entries in `catalog.ts`; the structure is a plain array of `{rule(profile) → verdict, reasons, missing}`.
- Eligibility is indicative. The slip says so in print; the CSC and the portal decide.
- Push-to-talk sends one utterance at a time. Streaming partials are available on the Soniox bridge and would make the form fill mid-sentence; the Live Call mode already does this on the SLNG agent runtime.
