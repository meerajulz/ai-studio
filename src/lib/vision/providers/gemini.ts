/**
 * Google Gemini vision provider (Milestone 19) — the first `VisionProvider`.
 *
 * The single file allowed to know about Gemini. It fetches the image, sends it to Gemini with a
 * structured-JSON extraction prompt, and returns provider OBSERVATIONS (`VisionObservation`). AI
 * Studio then normalizes those into `IdentityMetadata` knowledge — swapping to OpenAI/Qwen/Florence
 * later changes only this file. `fetch`-based (no SDK). Auth via `GEMINI_API_KEY`.
 * See docs/research/RESEARCH_02_VISION.md, docs/IDENTITY_INTELLIGENCE.md.
 *
 * NOTE: for building identity reference libraries — NOT biometric identification.
 */
import { visionCapabilities } from "../capabilities";
import {
  VisionError,
  type VisionProvider,
  type VisionRequest,
} from "../VisionProvider";
import type { VisionObservation } from "../types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// A ROLLING alias that always points to the current stable Flash model — avoids the version
// treadmill (a pinned "gemini-2.5-flash" gets retired for new keys). If your key doesn't have this
// alias, set GEMINI_VISION_MODEL to one from `listGeminiModels()` (see /debug/vision → "List models").
const DEFAULT_MODEL = "gemini-flash-latest";

/** The JSON shape we ask Gemini for — keys align with what `normalizeToIdentityMetadata` reads. */
const EXTRACTION_PROMPT = `You are building a private identity reference library for image generation.
Do NOT identify the person. Analyse ONLY what is visible in this photo and return STRICT JSON
(no prose) with these keys:
{
  "hairColor": string|null, "hairLength": "short"|"medium"|"long"|null, "hairVisible": boolean,
  "hairTexture": "straight"|"wavy"|"curly"|null, "hairParting": "center"|"side"|"none"|null,
  "hairUpdo": "loose"|"tied-back"|"ponytail"|"bun"|null,
  "hairBangs": boolean, "hairWet": boolean, "hairWindBlown": boolean,
  "faceVisible": boolean, "faceOrientation": "front"|"three-quarter"|"left-profile"|"right-profile"|"back"|null,
  "faceConfidence": number(0-1), "faceYaw": number(deg), "facePitch": number(deg), "faceRoll": number(deg),
  "smiling": boolean, "eyesVisible": boolean,
  "faceExpression": { "smiling": boolean, "teethVisible": boolean, "laughing": boolean,
                      "mouthOpen": boolean, "eyesClosed": boolean, "lookingAtCamera": boolean,
                      "lookingAway": boolean, "squinting": boolean, "serious": boolean },
  "faceLighting": number(0-1), "faceOcclusion": number(0-1), "faceSymmetry": number(0-1),
  "framing": "headshot"|"half-body"|"full-body"|null, "bodyVisibility": "face"|"upper"|"full"|null,
  "visibleRegions": [ "head"|"neck"|"shoulders"|"torso"|"waist"|"hips"|"arms"|"hands"|"legs"|"feet" ],
  "bodyVisiblePercent": number(0-100),
  "tattoos": [{"location": string, "region": <one canonical region below>, "description": string|null, "confidence": number(0-1)}],
  "accessories": [string], "facialHair": string|null, "ageRange": string|null, "expression": string|null,
  "clothing": [string], "lightingSetting": "indoor"|"outdoor"|"studio"|null,
  "lightingQuality": "soft"|"harsh"|"backlit"|"even"|null, "environment": string|null,
  "dominantColors": [string], "objects": [string],
  "sharpness": number(0-1), "exposure": number(0-1), "occluded": boolean, "cropped": boolean,
  "referenceSuitability": { "hero": number(0-1), "faceReference": number(0-1), "bodyReference": number(0-1),
                            "tattooReference": number(0-1), "hairstyleReference": number(0-1),
                            "expressionReference": number(0-1), "reason": string|null },
  "confidence": { "hairColor": number(0-1), "faceOrientation": number(0-1), "framing": number(0-1),
                  "bodyVisibility": number(0-1), "expression": number(0-1), "lightingSetting": number(0-1) }
}
Only list tattoos that are actually visible; give each a confidence. For each tattoo, set "region" to
the SINGLE closest canonical value from: left-shoulder, left-upper-arm, left-forearm, left-hand,
right-shoulder, right-upper-arm, right-forearm, right-hand, chest-left, chest-right, chest, abdomen,
hip, upper-back, lower-back, back, neck, left-thigh, right-thigh, left-calf, right-calf, feet, other.
"referenceSuitability" rates (0-1) how good THIS image is as each kind of training reference, with a
short "reason". "faceExpression" captures the expression/gaze; "confidence" holds how sure you are of
each scalar attribute (0-1). yaw≈0 means facing the camera. In "clothing", ALWAYS state the exposure
level with an explicit term when applicable: "nude"/"topless", "lingerie"/"underwear", or
"bikini"/"swimwear" (this is used only for safe reference selection, never to generate such content).`;

function getKey(): string | undefined {
  const v = process.env.GEMINI_API_KEY;
  return v && v.trim() ? v.trim() : undefined;
}

export function isGeminiConfigured(): boolean {
  return Boolean(getKey());
}

function mapError(status: number, message: string): VisionError {
  if (status === 401 || status === 403) {
    return new VisionError("MISSING_TOKEN", "Gemini rejected the credentials (check GEMINI_API_KEY).");
  }
  if (status === 404) {
    return new VisionError(
      "UNSUPPORTED",
      "The vision model isn't available for your key. Set GEMINI_VISION_MODEL to a supported model " +
        '(use "List models" on /debug/vision). ' +
        message,
    );
  }
  if (status === 429 || status === 503) {
    return new VisionError("PROVIDER_UNAVAILABLE", "Gemini is busy — try again in a moment.");
  }
  return new VisionError("ANALYSIS_FAILED", message || "Gemini image analysis failed.");
}

/** List the models this key can use with `generateContent` (so you can pick a valid one). */
export async function listGeminiModels(): Promise<string[]> {
  const key = getKey();
  if (!key) return [];
  const res = await fetch(`${API_BASE}?key=${key}&pageSize=1000`);
  if (!res.ok) return [];
  const json = (await res.json()) as {
    models?: { name?: string; supportedGenerationMethods?: string[] }[];
  };
  return (json.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => (m.name ?? "").replace(/^models\//, ""))
    .filter(Boolean);
}

/** Fetch an image URL → base64 + mime type (Gemini needs inline data). */
async function fetchImageInline(url: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new VisionError("ANALYSIS_FAILED", "Could not fetch the image to analyse.");
  const mimeType = res.headers.get("content-type") || "image/jpeg";
  const data = Buffer.from(await res.arrayBuffer()).toString("base64");
  return { data, mimeType };
}

/** Extract the JSON object from Gemini's text response (tolerates code fences). */
function parseJson(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new VisionError("ANALYSIS_FAILED", "Gemini returned no JSON.");
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

export const geminiVisionProvider: VisionProvider = {
  id: "gemini",
  defaultModel: DEFAULT_MODEL,
  capabilities: visionCapabilities(
    "caption",
    "attributes",
    "detect",
    "quality",
    "sceneRecognition",
  ),
  isConfigured: isGeminiConfigured,
  listModels: listGeminiModels,

  async analyzeImage(request: VisionRequest): Promise<VisionObservation> {
    const key = getKey();
    if (!key) throw new VisionError("MISSING_TOKEN", "Gemini is not configured (set GEMINI_API_KEY).");
    // Per-request override (debug) → env → default.
    const model = request.model?.trim() || process.env.GEMINI_VISION_MODEL?.trim() || DEFAULT_MODEL;

    const image = await fetchImageInline(request.imageUrl);

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/${model}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: EXTRACTION_PROMPT },
                { inline_data: { mime_type: image.mimeType, data: image.data } },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      });
    } catch {
      throw new VisionError("PROVIDER_UNAVAILABLE", "Could not reach Gemini.");
    }

    if (!response.ok) {
      throw mapError(response.status, await response.text().catch(() => ""));
    }

    const json = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new VisionError("ANALYSIS_FAILED", "Gemini returned an empty response.");

    const a = parseJson(text);

    // Split the flat JSON into the observation's attribute/quality/scene bags (normalizer reads these).
    return {
      provider: "gemini",
      model,
      caption: typeof a.caption === "string" ? a.caption : null,
      attributes: a,
      objects: Array.isArray(a.objects) ? (a.objects as string[]) : [],
      quality: {
        sharpness: a.sharpness,
        exposure: a.exposure,
        faceVisible: a.faceVisible,
        occlusion: a.occluded,
        cropped: a.cropped,
      },
      scene: { environment: a.environment, setting: a.lightingSetting },
      raw: json,
    };
  },
};
