# Research 02 — Vision & Image Understanding

> **Status: RESEARCH ONLY — no implementation, no code, no schema, no providers integrated.**
> The definitive reference for all future Vision work in AI Studio: how modern systems *understand*
> images before generation, so identity, editing, quality analysis and creative planning are built
> on research, not assumptions. Companion to [../PROVIDER_RESEARCH.md](../PROVIDER_RESEARCH.md)
> (image generation). Related: [README.md](./README.md), [VISION_MODELS.md](./VISION_MODELS.md),
> [IDENTITY_ANALYSIS.md](./IDENTITY_ANALYSIS.md), [IMAGE_EVALUATION.md](./IMAGE_EVALUATION.md),
> [../FUTURE_RESEARCH.md](../FUTURE_RESEARCH.md).
>
> **Accuracy note:** compiled from knowledge as of **January 2026**. Model versions, licenses,
> hosting and especially **pricing/latency change fast** — verify against each vendor before
> relying on numbers. The *architecture and recommendations* are stable regardless.

## 0. Why AI Studio needs vision

Today an identity image is just a **file**. AI Studio needs it to become **knowledge** — "front
pose, long pink hair, floral chest tattoo, left sleeve tattoo, sharp, well-lit" — so it can
automatically pick the best references, score prompts, evaluate outputs, and organize media. Every
downstream milestone in [../FUTURE_RESEARCH.md](../FUTURE_RESEARCH.md) (Identity Intelligence, Image
Understanding, Prompt/Identity Scoring, Creative Memory) depends on a vision layer.

**This is NOT biometric identification.** The goal is richer Identity Packages, better reference
selection, and quality/consistency evaluation — not identifying strangers.

## 1. Provider-neutral architecture principle (read first)

Mirror the image-provider design (Decision 007/036): a **`VisionProvider`** abstraction with
**capabilities**, so vision backends are swappable and the rest of AI Studio never names a vendor.

Proposed capability vocabulary:

```
caption            structured/dense description of an image
detect             object/region detection (people, clothing, pets, objects, landmarks)
segment            pixel masks (background, subject, garment)
pose               body/hand/face landmarks
faceEmbed          face embedding for identity similarity (NOT identification)
attributes         identity attributes (orientation, hair, tattoos visible, expression, …)
embed              whole-image embedding (similarity, dedup, ranking, search)
quality            technical quality (blur/exposure/occlusion/crop) + aesthetic score
sceneRecognition   place/environment/time-of-day/weather classification
```

A request is provider-neutral (image + task); the adapter maps it to a specific model/API; results
are stored as **media metadata** (via the media layer), never coupled to a provider. Vision runs
**server-side, ideally once on upload**, and caches structured results.

## 2. Research Area 1 — Vision Foundation Models (VLMs)

General vision-language models can caption, answer questions, and (with structured prompts) extract
attributes — a lot of AI Studio's needs from **one** model.

| Model | Type / hosting | License | Strengths | Weaknesses | AI Studio fit |
| ----- | -------------- | ------- | --------- | ---------- | ------------- |
| **Google Gemini Vision** (1.5/2.x Flash/Pro) | Hosted API | Proprietary | Strong general understanding, long context, cheap Flash tier, structured (JSON) output | Vendor lock-in, data-policy review needed | **Strong MVP** hosted default |
| **OpenAI Vision** (GPT-4o / mini) | Hosted API | Proprietary | Excellent reasoning + structured output, mature SDK | Cost at scale, vendor lock-in | **Strong MVP** alt |
| **Qwen2.5-VL** (3B/7B/72B) | Open weights, self-host or hosted | Apache-2.0 (most sizes) | Top open VLM, grounding + OCR + JSON, **commercially usable** | Self-hosting GPU cost/ops | **Best open** default; long-term control |
| **InternVL 2.5** | Open weights | MIT/Apache (varies) | Very strong benchmarks, detection/grounding | Ops burden | Open alt to Qwen |
| **Pixtral** (Mistral) | Open weights / hosted | Apache-2.0 | Solid, EU-friendly vendor | Slightly behind top tier | Open alt |
| **Molmo** (AllenAI) | Open weights | Apache-2.0 | Pointing/grounding, open data | Younger ecosystem | Research/grounding |
| **Florence-2** (Microsoft) | Open weights, tiny (0.2–0.8B) | MIT | **One model → caption + detect + segment + OCR + grounding**; cheap to run | Less "reasoning", task-prompt based | **Excellent** for structured extraction at low cost |
| **LLaVA / LLaVA-OneVision** | Open weights | Apache/research (varies) | Established, fine-tunable | Behind Qwen/InternVL now | Baseline/reference |
| **CLIP / SigLIP** | Open weights | MIT/Apache | Embeddings + zero-shot classification (not generative) | Not a captioner | **Core** for embeddings/similarity (Area 8) |

**Takeaway:** a **general VLM** (hosted Gemini/OpenAI for MVP speed, or self-hosted **Qwen2.5-VL**
for control/cost) covers captioning + attributes + scene + quality-reasoning in one call.
**Florence-2** is a standout for cheap structured caption/detect/segment/grounding in a single tiny
model — a great open workhorse. **CLIP/SigLIP** are separate embedding tools, not VLMs.

## 3. Research Area 2 — Image Captioning

- **Dense captioning** — many region-level captions ("pink hair", "floral tattoo on chest").
- **Descriptive captioning** — one rich paragraph.
- **Structured captioning** — JSON with typed fields (the useful one for us).
- **Semantic captioning** — concepts/tags for search.

**Recommendation for AI Studio: structured captioning.** Prompt a VLM (or Florence-2) to return a
**typed JSON** matching our metadata schema (Area 10) — deterministic to store, query and rank on.
Free-text captions are for human display / semantic search only.

## 4. Research Area 3 — Object Detection

Detect people, clothing, pets, accessories, furniture, vehicles, landmarks, objects.

| Model | Open? | Strength | Note |
| ----- | ----- | -------- | ---- |
| **YOLO (v8–v11, Ultralytics)** | Open (AGPL / commercial license) | Fast, real-time, easy | Fixed classes unless retrained; **AGPL** license caveat for commercial |
| **Grounding DINO** | Open (Apache) | **Open-vocabulary** detection from text ("leg tattoo", "sunglasses") | Heavier; pairs with SAM |
| **OWLv2** | Open (Apache) | Open-vocabulary detection, zero-shot | Google research model |
| **Florence-2 detection** | Open (MIT) | Detection + grounding in the same model as captioning | Convenient one-model story |

**Recommendation:** **open-vocabulary** detection (Grounding DINO / OWLv2 / Florence-2) beats fixed-
class YOLO for us, because our vocabulary is open ("bikini", "chihuahua", "leg tattoo"). Watch YOLO's
**AGPL** license for commercial use.

## 5. Research Area 4 — Segmentation

| Model | Open? | Use |
| ----- | ----- | --- |
| **SAM 2 (Segment Anything 2)** | Open (Apache) | Promptable masks (point/box), images + video | Best general segmenter |
| **Grounded SAM** | Open | Grounding DINO + SAM → "mask the leg tattoo" from text | Text-driven masking |
| **Semantic segmentation** (Mask2Former, etc.) | Open | Class maps of a scene | Scene parsing |

**Uses:** background replacement, garment/object masking for **editing**, **identity isolation**
(mask the person for cleaner reference crops). **Recommendation:** SAM 2 (+ Grounded SAM for
text-driven masks) is the standard; **defer** — it belongs with the future editing/Photoshop
workflows, not the first identity metadata pass.

## 6. Research Area 5 — Pose Estimation

| System | Open? | Detects |
| ------ | ----- | ------- |
| **MediaPipe** (Google) | Open (Apache) | Body/hand/face landmarks, on-device, fast | Great default |
| **ViTPose / DWPose** | Open | High-accuracy body (+hand/face) keypoints | Heavier |
| **OpenPose** | Open (non-commercial license!) | Body/hand/face | **License blocks commercial** — avoid |

**Uses:** classify pose (front/profile/back, full/half body) for Identity Packages; drive
**ControlNet-style** pose-consistent generation later; validate "full body vs headshot" for
reference selection. **Recommendation:** MediaPipe for a cheap pose/orientation signal in v2; avoid
OpenPose (licensing).

## 7. Research Area 6 — Identity Understanding (attributes)

Automatically extract, per identity image: **face orientation** (front/profile/back), **hairstyle**,
**facial hair**, **glasses**, **tattoos** (presence + rough location), **body proportions / visibility**,
**visible accessories**, **age range** (coarse), **expression**, **lighting conditions**.

Two complementary approaches:
- **A VLM with structured output** (Qwen2.5-VL / Gemini / Florence-2) → most attributes in **one
  call**, open-vocabulary (handles "floral chest tattoo"). Best coverage, least plumbing.
- **Specialized face analysis** (e.g. **InsightFace**: detection, landmarks, pose, coarse age/expr;
  **MediaPipe Face Mesh**) → precise geometric signals when needed.

**Recommendation:** VLM-first for attributes (fast to ship, open-vocabulary); add specialized face
analysis for precision + the **face embedding** used by consistency scoring (Area 8 / 11).
Reminder: **attributes for reference selection, not identification.**

## 8. Research Area 7 — Image Quality Analysis

Reject poor reference images automatically. Signals: **blur/sharpness**, **exposure**, **resolution**,
**face visibility**, **occlusion**, **cropped body parts**, **composition**.

| Method | Type | Note |
| ------ | ---- | ---- |
| Laplacian variance / **BRISQUE / NIQE** | Classic no-reference | Cheap blur/quality on-server (OpenCV) — great first filter |
| **Aesthetic predictors** (LAION aesthetic, CLIP-IQA / MUSIQ) | Learned | "Is this a good photo?" score |
| **VLM quality check** | VLM | Ask the VLM for occlusion/crop/face-visibility flags in the same structured call |
| Face-crop checks | Detector | Face box size/position → visibility, cropped-head detection |

**Recommendation:** cheap classical metrics (blur/exposure/resolution) + face-visibility from a
detector for an MVP **quality gate** on training uploads; add a learned aesthetic/IQA score in v2.
This directly improves identity output (Lessons Learned: quality hinges on reference quality).

## 9. Research Area 8 — Similarity & Embeddings

| Model | License | Use |
| ----- | ------- | --- |
| **CLIP** | MIT | Image/text embeddings; zero-shot; baseline similarity | 
| **SigLIP / SigLIP2** | Apache | Stronger CLIP-style embeddings | Better default |
| **DINOv2** | Apache | Self-supervised visual features; excellent for **visual** similarity/clustering | Best for dedup/pose clustering |
| **Face embeddings** (ArcFace / InsightFace) | Varies (check) | Face-to-face similarity → **identity consistency** | Core for Character Consistency |

**Uses:** remove **duplicate** identity photos, **rank** references, pick the best **Hero** image,
**cluster** similar poses, and (with face embeddings) score whether a **generated image still looks
like the identity** (→ [IMAGE_EVALUATION.md](./IMAGE_EVALUATION.md)). **Recommendation:** SigLIP/
DINOv2 for whole-image similarity/dedup/ranking; **face embeddings** for consistency scoring — both
high-value, moderate effort.

## 10. Research Area 9 — Landmark & Scene Recognition

- **Zero-shot with CLIP/SigLIP** or a **VLM** → place type (beach/city/studio), indoor/outdoor,
  time of day, weather, architecture — often good enough and open-vocabulary.
- **Places365** (CNN) → 365 scene classes, cheap.
- Famous-landmark recognition (Eiffel Tower, etc.) → VLM or a landmarks dataset/API.

**Use:** enrich the **scene graph** (Creative Director) with detected environment/time/weather when
analyzing *reference* or *generated* images. **Recommendation:** fold into the VLM structured call;
no separate model needed for MVP.

## 11. Research Area 10 — Automatic Metadata Extraction (the synthesis)

The concrete output: on upload, produce a **typed metadata record** per image (stored via the media
layer). Proposed fields:

```
pose               front | profile | back | three-quarter
framing            headshot | half-body | full-body
cameraAngle        eye-level | low | high | …
bodyVisibility     face | upper | full
faceVisible        bool + confidence
hair               { visible, style, color }
facialHair, glasses
tattoos            [{ location, description }]   // visible only
clothing / outfit  [garments]
expression         neutral | smiling | …
lighting           soft | harsh | backlit | …   + quality
environment        indoor | outdoor | place type, time of day, weather
dominantColors     [hex]
detectedObjects    [labels]
quality            { sharpness, exposure, occlusion, cropped, aestheticScore, overall }
embeddings         { image: SigLIP/DINOv2, face: ArcFace }   // for similarity
caption            structured JSON + a human string
```

**Recommendation:** one **VLM structured-extraction** call produces most of this; **classical
quality** + **embeddings** fill the numeric gaps. Compute **once on upload**, cache as metadata,
recompute on demand. This record powers automatic Hero/reference selection, dedup, search, scoring.

## 12. AI Studio applications — priority, complexity, dependencies

| Application | Why | Complexity | Depends on | Phase |
| ----------- | --- | ---------- | ---------- | ----- |
| **Quality gate on training uploads** | Reject blurry/cropped/occluded refs → better identity | **Low** | classical quality + face detect | **MVP** |
| **Automatic Hero / Primary selection** | Kill manual tagging; better default references | **Med** | quality + face + attributes | **MVP/v2** |
| **Duplicate detection** | Clean identity libraries | **Low–Med** | image embeddings | **MVP/v2** |
| **Identity Package metadata** (attributes) | Structured knowledge per image → smart selection | **Med** | VLM structured extraction | **v2** |
| **Request-aware reference selection** | "bikini" → full body + tattoos; "portrait" → face/hair | **Med** | metadata + scene graph needs | **v2** |
| **Tattoo / pose / outfit indexing** | Pick refs by attribute; future search | **Med** | detection + attributes | **v2** |
| **Character consistency scoring** | "Still looks like Julieta?" → auto-correct | **Med–High** | face embeddings + eval loop | **v2/LT** |
| **Prompt quality / identity conflict checks** | Warn before spending credits | **Med** | scene graph + attributes | **v2** |
| **Scene understanding of outputs** | Verify prompt adherence; enrich graph | **Med** | detection/VLM | **v2/LT** |
| **Semantic search over media** | "photos on a beach", "with tattoos" | **Med** | embeddings + captions | **LT** |
| **Editing assistance** (masking) | Background/outfit replacement | **High** | SAM2 / Grounded SAM | **LT** |
| **Creative recommendations** | Suggest better refs/prompts | **High** | most of the above | **LT** |

## 13. Architecture recommendations

1. **`VisionProvider` abstraction mirroring `ImageProvider`** — capability-based (Section 1),
   registry + router, adapters isolated in `src/lib/vision/providers/` (proposed). Feature code
   depends on capabilities, never a vendor. **No vendor lock-in.**
2. **Hybrid backend, not one model:** a **general VLM** for structured caption/attributes/scene
   (hosted Gemini/OpenAI for MVP, or self-hosted **Qwen2.5-VL**/**Florence-2** for cost/control) +
   **specialized** models for embeddings (**SigLIP/DINOv2**), **face embeddings** (consistency),
   **classical quality**, and later **SAM2** (editing). The router picks per capability.
3. **Results are media-layer metadata** (like recipes on generations) — provider-neutral, cached,
   recomputable. Never store a provider's internal shape.
4. **Compute on upload, once**; keep it **out of the Creative Director's synchronous path** (the
   Director stays deterministic + fast; it *consumes* cached vision metadata, doesn't call vision).
5. **Provider-neutral selection logic** stays in AI Studio (which reference is "best"); adapters only
   run models. Same split that made the image side clean.
6. **Privacy/licensing gates:** avoid OpenPose (non-commercial) and mind YOLO's AGPL; face
   embeddings are for *consistency*, not identification — document consent + retention.

## 14. Implementation priorities (when we build — not now)

1. **Quality gate** on training uploads (classical) — cheapest, immediate identity win.
2. **Image embeddings** (SigLIP/DINOv2) → dedup + Hero ranking.
3. **VLM structured metadata** extraction on upload → the Identity Package knowledge record.
4. **Request-aware reference selection** using that metadata.
5. **Face-embedding consistency scoring** of outputs (evaluate loop).
6. **Async Job queue** (vision analysis + slow identity generation share this need).
7. **Editing/masking (SAM2)** + **semantic search** — long-term.

Each step: **research doc → Decision → implement**, behind the `VisionProvider` capability router.

## 15. Success criteria (met by this doc)

- **Which technologies:** hybrid — general VLM (Qwen2.5-VL / Gemini / Florence-2) + SigLIP/DINOv2
  embeddings + face embeddings + classical quality + (later) SAM2/pose.
- **What each solves:** captioning/attributes (VLM), dedup/ranking (embeddings), consistency (face
  embeddings), reject-bad-refs (quality), masking/editing (SAM2), pose/orientation (MediaPipe).
- **Where they fit:** a provider-neutral `VisionProvider` layer feeding **media metadata**, consumed
  by Identity selection, the Creative Director, and evaluation.
- **Priority + complexity + roadmap:** Sections 12–14.

**Bottom line:** stand up a **provider-neutral Vision layer** (capabilities + router, like images),
start with a **quality gate + embeddings + one VLM structured-extraction pass on upload**, and grow
toward consistency scoring and editing. This turns identity images into knowledge and unlocks nearly
every milestone in [../FUTURE_RESEARCH.md](../FUTURE_RESEARCH.md) — without coupling AI Studio to any
single Vision vendor.
