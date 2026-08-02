"""
AuraFace face-embedding — Hugging Face Inference Endpoint custom handler (Milestone 26 Phase 2).

Speaks the AI Studio `FaceSimilarityProvider` contract. NOTE: HF's inference toolkit requires an
`inputs` key in the request body, so AI Studio sends `{ "inputs": { "image": <ref> } }`; this handler
unwraps it. `<ref>` may be an https URL, a data-url, or raw base64.

    → 200 { "embedding": number[], "dim": 512 }   # L2-normalized ArcFace vector
    → 200 { "embedding": null }                    # no face detected
    → 200 { "embedding": null, "error": "..." }    # any failure (surfaced, never a 500)

Weights come from `fal/AuraFace-v1` at startup — nothing to fork.
"""

import base64
import io
import os
import traceback
from typing import Any, Dict

import numpy as np
import requests
from huggingface_hub import snapshot_download
from insightface.app import FaceAnalysis
from PIL import Image

AURAFACE_REPO = os.environ.get("AURAFACE_REPO", "fal/AuraFace-v1")
MODEL_NAME = "auraface"
HTTP_TIMEOUT = int(os.environ.get("IMAGE_FETCH_TIMEOUT", "20"))


class EndpointHandler:
    def __init__(self, path: str = ""):
        # Capture any startup failure so it's reported on call instead of an opaque 500.
        self.init_error = None
        self.app = None
        try:
            root = path or "."
            snapshot_download(AURAFACE_REPO, local_dir=os.path.join(root, "models", MODEL_NAME))
            self.app = FaceAnalysis(
                name=MODEL_NAME,
                root=root,
                providers=["CPUExecutionProvider"],
            )
            self.app.prepare(ctx_id=-1, det_size=(640, 640))  # ctx_id=-1 → CPU
        except Exception:  # noqa: BLE001
            self.init_error = traceback.format_exc()

    def _load_image(self, ref: str) -> np.ndarray:
        if ref.startswith("http://") or ref.startswith("https://"):
            resp = requests.get(ref, timeout=HTTP_TIMEOUT)
            resp.raise_for_status()
            raw = resp.content
        else:
            if ref.strip().startswith("data:") and "," in ref:
                ref = ref.split(",", 1)[1]
            raw = base64.b64decode(ref)
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        return np.array(img)[:, :, ::-1]  # RGB → BGR for insightface

    def __call__(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if self.init_error is not None:
            return {"embedding": None, "error": f"init failed: {self.init_error[-800:]}"}
        try:
            payload = data.get("inputs", data) if isinstance(data, dict) else data
            if isinstance(payload, str):
                image_ref = payload
            elif isinstance(payload, dict):
                image_ref = payload.get("image") or payload.get("url")
            else:
                image_ref = None
            if not image_ref:
                return {"embedding": None, "error": f"no image in payload: {str(data)[:200]}"}

            img = self._load_image(image_ref)
            faces = self.app.get(img)
            if not faces:
                return {"embedding": None}
            face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
            emb = np.asarray(face.normed_embedding, dtype=float)
            return {"embedding": emb.tolist(), "dim": int(emb.shape[0])}
        except Exception:  # noqa: BLE001 — surface the error instead of a bare 500
            return {"embedding": None, "error": traceback.format_exc()[-1000:]}
