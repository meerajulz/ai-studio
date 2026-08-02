"""
AuraFace face-embedding — Hugging Face Inference Endpoint custom handler (Milestone 26 Phase 2).

Speaks the AI Studio `FaceSimilarityProvider` contract so it drops in behind `providers/auraface.ts`
with zero app change:

    POST {endpoint}
      Authorization: Bearer {HF token}      → your FACE_EMBED_API_KEY
      Content-Type: application/json
      { "image": "<signed image url | data-url | base64>" }
    → 200 { "embedding": number[], "dim": 512 }   # L2-normalized ArcFace vector
    → 200 { "embedding": null }                    # no face detected (not an error)

The weights come from `fal/AuraFace-v1` at startup (snapshot_download) — this repo only needs this file
+ requirements.txt, so there is NOTHING to fork.
"""

import base64
import io
import os
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
        root = path or "."
        # insightface expects the ONNX files under {root}/models/{name}/
        snapshot_download(AURAFACE_REPO, local_dir=os.path.join(root, "models", MODEL_NAME))
        self.app = FaceAnalysis(
            name=MODEL_NAME,
            root=root,
            # CUDA if the instance has a GPU, else CPU — insightface falls back gracefully.
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        self.app.prepare(ctx_id=0, det_size=(640, 640))

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
        # Accept {"image": ...}, {"url": ...}, a bare string, or an {"inputs": ...} wrapper.
        payload = data.get("inputs", data)
        if isinstance(payload, str):
            image_ref = payload
        elif isinstance(payload, dict):
            image_ref = payload.get("image") or payload.get("url")
        else:
            image_ref = None
        if not image_ref:
            return {"embedding": None, "error": "no image provided"}

        try:
            img = self._load_image(image_ref)
        except Exception as exc:  # noqa: BLE001
            return {"embedding": None, "error": f"could not load image: {exc}"}

        faces = self.app.get(img)
        if not faces:
            return {"embedding": None}

        # Strongest (largest) face wins — one dominant subject per generated image.
        face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        emb = np.asarray(face.normed_embedding, dtype=float)  # L2-normalized, 512-d
        return {"embedding": emb.tolist(), "dim": int(emb.shape[0])}
