---
license: cc-by-nc-4.0
tags:
  - face-embedding
  - insightface
  - arcface
  - custom-handler
---

# AuraFace embedding endpoint (AI Studio · Milestone 26)

A Hugging Face **Inference Endpoint** custom handler that turns a face image into an ArcFace embedding
vector, matching AI Studio's provider-neutral `FaceSimilarityProvider` contract. It loads the weights from
[`fal/AuraFace-v1`](https://huggingface.co/fal/AuraFace-v1) at startup — **you do not fork anything.**

## Repo contents
- `handler.py` — the `EndpointHandler` (downloads AuraFace, runs insightface, returns the embedding).
- `requirements.txt` — insightface + onnxruntime (CPU) + deps.
- `README.md` — this file.

## Contract
```
POST {endpoint}
  Authorization: Bearer {HF token}
  Content-Type: application/json
  { "image": "<https url | data-url | base64>" }

→ 200 { "embedding": [512 floats], "dim": 512 }   # L2-normalized ArcFace vector
→ 200 { "embedding": null }                        # no face detected
```

## Deploy (no fork required)
1. Create a **new, empty model repo** on Hugging Face (e.g. `meerajulz/auraface-endpoint`).
2. Add these three files (`handler.py`, `requirements.txt`, `README.md`) and push:
   ```bash
   git clone https://huggingface.co/meerajulz/auraface-endpoint
   cp handler.py requirements.txt README.md auraface-endpoint/
   cd auraface-endpoint && git add . && git commit -m "AuraFace embedding handler" && git push
   ```
3. On the repo page → **Deploy → Inference Endpoints**. A **CPU** instance is enough (small model).
   First boot downloads the weights (~a minute). Set the endpoint to **Protected**.
4. Copy the resulting values into AI Studio (`.env.local` + Vercel):
   ```bash
   FACE_EMBED_ENDPOINT_URL=https://<your-endpoint>.aws.endpoints.huggingface.cloud
   FACE_EMBED_API_KEY=<your Hugging Face access token>   # Bearer token for the endpoint
   # optional: FACE_EMBED_VERSION=auraface-v1
   ```

## Smoke test
```bash
curl -s "$FACE_EMBED_ENDPOINT_URL" \
  -H "Authorization: Bearer $FACE_EMBED_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"image":"https://images.unsplash.com/photo-1544005313-94ddf0286df2"}' | head -c 300
# → {"embedding":[0.01,-0.03,...],"dim":512}
```

If you see a 512-length `embedding`, AI Studio's Identity Evaluation will show a live `👤 NN%` on the next
generation. A wrong URL/shape only degrades to `provider-error` — nothing else breaks.

## Notes
- The provider file (`src/lib/identity-engine/evaluation/providers/auraface.ts`) knows only this contract,
  not Hugging Face — if you later move AuraFace to Fal / a self-hosted box, just change `FACE_EMBED_*`.
- License: AuraFace weights are CC-BY-NC-4.0 (non-commercial) — verify before commercial use.
