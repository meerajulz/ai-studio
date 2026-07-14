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
// gemini-2.5-flash: strong vision + native JSON output, cheap/fast for per-image analysis at scale.
// Override with GEMINI_VISION_MODEL (e.g. "gemini-2.5-pro" for max quality).
const DEFAULT_MODEL = "gemini-2.5-flash";

/** The JSON shape we ask Gemini for — keys align with what `normalizeToIdentityMetadata` reads. */
const EXTRACTION_PROMPT = `You are building a private identity reference library for image generation.
Do NOT identify the person. Analyse ONLY what is visible in this photo and return STRICT JSON
(no prose) with these keys:
{
  "hairColor": string|null, "hairLength": "short"|"medium"|"long"|null, "hairVisible": boolean,
  "faceVisible": boolean, "faceOrientation": "front"|"three-quarter"|"left-profile"|"right-profile"|"back"|null,
  "faceConfidence": number(0-1), "faceYaw": number(deg), "facePitch": number(deg), "faceRoll": number(deg),
  "smiling": boolean, "eyesVisible": boolean,
  "framing": "headshot"|"half-body"|"full-body"|null, "bodyVisibility": "face"|"upper"|"full"|null,
  "tattoos": [{"location": string, "description": string|null, "confidence": number(0-1)}],
  "accessories": [string], "facialHair": string|null, "ageRange": string|null, "expression": string|null,
  "clothing": [string], "lightingSetting": "indoor"|"outdoor"|"studio"|null,
  "lightingQuality": "soft"|"harsh"|"backlit"|"even"|null, "environment": string|null,
  "dominantColors": [string], "objects": [string],
  "sharpness": number(0-1), "exposure": number(0-1), "occluded": boolean, "cropped": boolean,
  "confidence": { "hairColor": number(0-1), "faceOrientation": number(0-1), "framing": number(0-1),
                  "bodyVisibility": number(0-1), "expression": number(0-1), "lightingSetting": number(0-1) }
}
Only list tattoos that are actually visible; give each a confidence. The "confidence" object holds
how sure you are of each scalar attribute (0-1). yaw≈0 means facing the camera.`;

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
  if (status === 429 || status === 503) {
    return new VisionError("PROVIDER_UNAVAILABLE", "Gemini is busy — try again in a moment.");
  }
  return new VisionError("ANALYSIS_FAILED", message || "Gemini image analysis failed.");
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

  async analyzeImage(request: VisionRequest): Promise<VisionObservation> {
    const key = getKey();
    if (!key) throw new VisionError("MISSING_TOKEN", "Gemini is not configured (set GEMINI_API_KEY).");
    const model = process.env.GEMINI_VISION_MODEL?.trim() || DEFAULT_MODEL;

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
