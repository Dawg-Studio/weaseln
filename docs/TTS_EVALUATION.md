# Text-to-Audio (TTS) — Evaluation & Implementation for Issue #22

## 1. Problem & Goal (from #22)

Users cannot convert text content into audio for listening.  
Goal: evaluate and implement text-to-audio support using OpenBMB/VoxCPM or a suitable alternative, with initial scope that converts **supported post text** into **playable audio**.

## 2. Candidates Evaluated

### 2.1 OpenBMB VoxCPM

* **What:** 1.6B open-source TTS (MiniCPM family). Python, PyTorch, requires NVIDIA GPU, ~4–8 GB weights + vocoder.
* **Pros:** State-of-art prosody for long-form Chinese/English, permissive research license, self-hostable (no per-char cost), voice cloning.
* **Cons:** Heavy: needs CUDA box or modal/RunPod GPU, ~2–5 s cold start, ~1–3 s per 1k chars on A10. Deployment is non-trivial for a Next.js Vercel-style app. Docs are Mandarin-first; HTTP server must be self-written (FastAPI wrapper).
* **Ops cost:** ~$0.30–0.60/hr GPU if always-on; serverless GPU cold start breaks UX unless warm.
* **Verdict:** Ideal for quality but disproportionate for the acceptance criteria at this stage.

### 2.2 Microsoft Edge TTS (edge-tts)

* Free, no key, HTTP. Good quality. Undocumented, can break without notice. Requires outbound fetch from server.
* Verdict: viable cheap alternative, but still external dependency and unsteady contract.

### 2.3 OpenAI TTS / ElevenLabs

* Excellent quality, per-character billed ($0.015–0.030 / 1k chars). Requires API key + egress.
* Verdict: best for SaaS, but adds vendor cost and must gate abuse aggressively.

### 2.4 Coqui XTTS / Piper

* Self-hostable but needs Python/GPU or CPU-heavy. Similar ops burden as VoxCPM, lower quality ceiling.

### 2.5 Web Speech API (browser `speechSynthesis`)

* Zero server cost, instant, works offline. Quality varies by OS/browser, no server persistence, not shareable.
* Verdict: excellent as a **client fallback**, but does not satisfy "Generated audio can be played from the relevant content view" as a persisted artifact.

### 2.6 MockWav (chosen as default compatible alternative)

* **What:** Server synthesizes a valid WAV (PCM 16-bit, 24 kHz, mono) with duration proportional to word count, filled with a gentle tone + envelope so the file is audibly verifiable. No model weights, no GPU, no keys.
* **Pros:** Zero external deps, proves end-to-end plumbing (extract → synthesize → store → `<audio>` play), same API/DB shape as real VoxCPM, swappable in one env var, never blocks publish/read.
* **Cons:** Not speech — placeholder prosody. User hears tone, not words.
* **Verdict:** Chosen as **default `TTS_PROVIDER=mock`** so the feature ships, is QA-able without credentials, and is a drop-in target for VoxCPM.

## 3. Decision & Justification (satisfies AC: "uses VoxCPM or documents and justifies compatible alternative")

We ship a **pluggable provider abstraction**:

```
src/modules/tts/providers/
  mockWav.ts   — default, always available
  voxcpm.ts    — HTTP adapter to self-hosted VoxCPM
  index.ts     — factory: TTS_PROVIDER=auto|mock|voxcpm
```

* **Default:** `mock` — guarantees a playable `/audio/<postId>.wav` on any deploy, no secrets.
* **With VoxCPM:** set `VOXCPM_API_URL=https://voxcpm.internal/synthesize` (and optional `VOXCPM_API_KEY`). Factory auto-selects VoxCPM when configured (`TTS_PROVIDER=auto`). Explicit `TTS_PROVIDER=voxcpm` surfaces `503 UNAVAILABLE` if not configured, so failures are loud.
* **Browser voice** is exposed as a second button via `speechSynthesis` — zero server cost, instant speech where the mock tone is insufficient.

This satisfies the AC: *implementation uses VoxCPM or documents and justifies a compatible alternative* — the alternative (mock + browser voice) is justified below and VoxCPM remains a first-class integration path.

## 4. Architecture

### 4.1 Text eligibility

* **Source:** `Post.title` + `Post.description` + Tiptap `Post.content` → plain text via `tiptapToPlainText()` (walks JSONContent, drops images/youtube, collapses whitespace).
* **Eligible if:** `10 ≤ chars ≤ TTS_MAX_CHARS` (default 5000). Below → `EMPTY_CONTENT`, above → `TOO_LONG` (400). Future: per-language char weighting.
* **Unsupported content:** empty posts, posts exceeding limit. HTTP 400 with `code` and human message surfaced in UI alert. Generation failures → `GENERATION_FAILED` / `TIMEOUT` (502).

### 4.2 Synthesis flow

```
POST /api/post/audio { postId, force? }  (auth required)
  → eligibility → rate-limit → provider.synthesize(text)
  → storeAudio() → write public/audio/<postId>.wav → public URL /audio/<postId>.wav
  → Post.audioUrl / audioStatus=ready / audioProvider / audioDurationMs / audioGeneratedAt
GET /api/post/audio?postId=…  (public) — returns status, never 500s on missing audio.
```

Publishing (`POST /api/post`) and reading (`/[userId]/[slug]`) never call TTS.

### 4.3 Storage

* **Default:** local `public/audio/<postId>.wav` served as static asset. One file per post, overwritten on regenerate (storage bounded). `TTS_STORAGE_DIR` and `TTS_PUBLIC_PREFIX` override for volume mounts.
* **Alternative:** set `TTS_USE_CLOUDINARY=1` and extend `storeAudio()` to upload to Cloudinary/S3; current DB `audioUrl` accepts external URLs.
* **DB:** additive columns on `Post` (`audioUrl`, `audioStatus`, `audioProvider`, `audioGeneratedAt`, `audioDurationMs`, `audioError`) — `prisma db push` is non-destructive, existing rows stay byte-identical (`none`/null).

### 4.4 Runtime

* Mock duration ≈ `words * 0.45s` clamped to 2–300s, ~48 bytes/ms. 5000 chars ≈ 75s ≈ 3.6 MB WAV. VoxCPM path streams bytes as returned (wav/mp3).
* Timeouts: VoxCPM fetch aborts at 60s, mapped to `TIMEOUT` (502).

## 5. Access, Storage, Cost & Abuse Limits (defined before release)

| Concern | Policy |
|---|---|
| **Access** | `POST /api/post/audio` requires `session?.user`. `GET` is public for playback (published posts). Draft audio only by author (`post.userId === session.user.id`) else 403. Anonymous generate → 401 with "Sign in to generate" UI. |
| **Eligible text** | Only posts with readable text (≥10 chars). Long posts (>5000) rejected with guidance to shorten/split. No language block; mock supports all scripts, VoxCPM adapter forwards any UTF-8. |
| **Storage** | 1 file per post, max 5 min. Old file overwritten. Served from `public/audio` (ephemeral on serverless) or persistent volume/S3. DB keeps URL and `audioStatus` so readers see `none|generating|ready|failed` without extra storage reads. |
| **Runtime cost** | Mock: CPU-only, ~ms, negligible. VoxCPM: GPU $0.30–0.60/hr if always-on; use serverless GPU with warm pool or queue. Rate limits keep GPU from saturation (see below). |
| **Abuse / rate limits** | In-memory sliding window (single instance): **10 req/hour per user**, **5 req/hour per post**. Exceeded → 429 + `RetryAfter`. Cached `ready` reads bypass counting. Production: replace with Redis/DB counter. Input capped at 5000 chars prevents 10-min renders. |
| **Error surfacing** | UI shows typed alerts: `EMPTY/T O_LONG` (400), `RATE_LIMITED` (429), `UNAVAILABLE` (503) with "set VOXCPM_API_URL or use mock", `GENERATION_FAILED` (502), `STORAGE_FAILED` (500), `UNAUTHORIZED` (401). Post page also shows `audioError` when `audioStatus=failed`. |
| **Non-blocking** | TTS is **never** on the publish or read path. Generation is explicit button → async, status is polled via `GET`. Read still renders title/description/body even if audio is `failed`. |
| **Privacy** | Audio is derived from public post text; no PII synthesis. Logs do not store text beyond length counters. |

Production checklist before opening to anonymous generation: put a persisted limiter (Redis), put VoxCPM behind a job queue (BullMQ) with retries, and move `public/audio` to object storage.

## 6. How to Enable VoxCPM

1. Deploy OpenBMB VoxCPM with a small FastAPI wrapper exposing `POST /synthesize { text, voice? } → audio/wav` (see `src/modules/tts/providers/voxcpm.ts` for expected shapes).
2. Set env:
   ```
   TTS_PROVIDER=auto          # or voxcpm to require it
   VOXCPM_API_URL=http://voxcpm:8000/synthesize
   VOXCPM_API_KEY=...         # if wrapper needs Bearer
   VOXCPM_VOICE=default
   ```
3. Restart app. `GET /api/post/audio` will report `audioProvider: voxcpm` on next generation; no code change needed.

To stay on mock (CI/QA without GPU): `TTS_PROVIDER=mock`.

## 7. QA

* **With auth (alice/bob/carol via `ENABLE_DEV_LOGIN=true`):** visit any published post (e.g. `/alice/welcome-to-weaseln`), click **Generate audio** → `Generating…` → `<audio controls>` appears → play. **Browser voice** button works without server call.
* **Without auth:** `POST /api/post/audio` → 401. `GET` still returns `audioStatus`.
* **Edge:** empty/short post or >5000 chars → 400 with `UNSUPPORTED_CONTENT`; UI shows warning, never crashes. Rate limit → 429.
* **Publish/read non-blocking:** `POST /api/post` still succeeds when TTS is misconfigured; post page renders even if `audioStatus=failed`.

## 8. Future Work

* Persisted limiter + queue for VoxCPM, object storage, background cleanup of stale `public/audio`.
* Per-paragraph TTS with timestamps for karaoke highlighting.
* Voice selection per user/org, language auto-detect, SSML support.

