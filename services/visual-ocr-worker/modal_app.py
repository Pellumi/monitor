"""Modal deployment for Tellann screen OCR using baidu/Unlimited-OCR."""

import base64
import binascii
import io
import time
import uuid
from typing import Any

import modal


APP_NAME = "tellann-unlimited-ocr"
MODEL_ID = "baidu/Unlimited-OCR"
MODEL_REVISION = "8249d20b2822a7d8a4c22c8d8c9069b5ac36bda3"
MODEL_DIR = f"/models/unlimited-ocr/{MODEL_REVISION}"
MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
DEFAULT_MAX_NEW_TOKENS = 2_048
MAX_NEW_TOKENS = 4_096
OUTPUT_CONTROL_TOKENS = (
    "<｜end▁of▁sentence｜>",
    "<|end_of_sentence|>",
    "<|endoftext|>",
)

app = modal.App(APP_NAME)
model_cache = modal.Volume.from_name(
    "tellann-unlimited-ocr-models",
    create_if_missing=True,
)

runtime_image = (
    modal.Image.debian_slim(python_version="3.12")
    .uv_pip_install(
        "fastapi[standard]==0.158.1",
        "huggingface-hub==2.2.0",
        "pillow==12.1.1",
        "pydantic==2.14.1",
        "torch==2.10.0",
        "torchvision==0.25.0",
        "transformers==5.20.1",
    )
    .env(
        {
            "HF_HOME": "/models/huggingface",
            "HF_HUB_DISABLE_TELEMETRY": "1",
            "TOKENIZERS_PARALLELISM": "false",
        }
    )
)

web_image = modal.Image.debian_slim(python_version="3.12").uv_pip_install(
    "fastapi[standard]==0.158.1",
    "pydantic==2.14.1",
)


@app.function(
    image=runtime_image,
    volumes={"/models": model_cache},
    timeout=1_800,
    memory=8_192,
)
def download_model() -> str:
    """Download the pinned model once without paying for GPU time."""
    from huggingface_hub import snapshot_download

    snapshot_download(
        repo_id=MODEL_ID,
        revision=MODEL_REVISION,
        local_dir=MODEL_DIR,
    )
    model_cache.commit()
    return MODEL_DIR


@app.cls(
    image=runtime_image,
    gpu="L4",
    memory=16_384,
    volumes={"/models": model_cache},
    min_containers=0,
    buffer_containers=0,
    max_containers=1,
    scaledown_window=60,
    timeout=600,
)
class UnlimitedOcr:
    @modal.enter()
    def load(self) -> None:
        import torch
        from transformers import AutoModelForImageTextToText, AutoProcessor

        self.torch = torch
        self.processor = AutoProcessor.from_pretrained(
            MODEL_DIR,
            local_files_only=True,
        )
        self.model = AutoModelForImageTextToText.from_pretrained(
            MODEL_DIR,
            local_files_only=True,
            dtype=torch.bfloat16,
        ).eval().to("cuda")

    @modal.method()
    def analyze(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
        max_new_tokens: int,
        request_id: str,
    ) -> dict[str, Any]:
        from PIL import Image, UnidentifiedImageError

        started = time.perf_counter()
        Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

        try:
            with Image.open(io.BytesIO(image_bytes)) as source:
                source.verify()
            with Image.open(io.BytesIO(image_bytes)) as source:
                rgb_image = source.convert("RGB")
                width, height = rgb_image.size
                normalized = io.BytesIO()
                rgb_image.save(normalized, format="PNG", optimize=False)
        except (OSError, UnidentifiedImageError) as error:
            raise ValueError("The payload is not a supported image") from error

        encoded_image = base64.b64encode(normalized.getvalue()).decode("ascii")
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "url": f"data:image/png;base64,{encoded_image}",
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ]
        inputs = self.processor.apply_chat_template(
            messages,
            add_generation_prompt=True,
            tokenize=True,
            return_dict=True,
            return_tensors="pt",
        ).to(self.model.device, self.model.dtype)
        input_length = inputs["input_ids"].shape[1]

        with self.torch.inference_mode():
            output = self.model.generate(
                **inputs,
                do_sample=False,
                max_new_tokens=max_new_tokens,
                no_repeat_ngram_size=35,
            )

        generated_tokens = output[0, input_length:]
        raw_text, raw_detections = self.processor.decode(
            generated_tokens,
            skip_special_tokens=False,
            return_detections=True,
        )

        detections: list[dict[str, Any]] = []
        for detection in raw_detections:
            normalized_box = [int(value) for value in detection["box"]]
            x1, y1, x2, y2 = normalized_box
            detection_text = _clean_detection_text(detection.get("text", ""))
            detections.append(
                {
                    "type": detection["region_type"],
                    "text": detection_text,
                    "box_normalized": normalized_box,
                    "box_pixels": [
                        round(x1 * width / 999),
                        round(y1 * height / 999),
                        round(x2 * width / 999),
                        round(y2 * height / 999),
                    ],
                }
            )

        text = "\n".join(
            detection["text"]
            for detection in detections
            if detection["text"]
        )
        return {
            "schema_version": "tellann.visual-ocr.v1",
            "request_id": request_id,
            "model": MODEL_ID,
            "model_revision": MODEL_REVISION,
            "image": {
                "mime_type": mime_type,
                "width": width,
                "height": height,
            },
            "text": text,
            "raw_text": raw_text,
            "detections": detections,
            "latency_ms": round((time.perf_counter() - started) * 1_000),
        }


def _decode_image(image_base64: str) -> bytes:
    if image_base64.startswith("data:"):
        _, separator, image_base64 = image_base64.partition(",")
        if not separator:
            raise ValueError("Invalid image data URL")

    try:
        image_bytes = base64.b64decode(image_base64, validate=True)
    except (binascii.Error, ValueError) as error:
        raise ValueError("image_base64 must contain valid base64") from error

    if not image_bytes:
        raise ValueError("image_base64 cannot be empty")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError(f"Image exceeds the {MAX_IMAGE_BYTES} byte limit")
    return image_bytes


def _clean_detection_text(value: str) -> str:
    for token in OUTPUT_CONTROL_TOKENS:
        value = value.replace(token, "")
    return value.strip()


@app.function(image=web_image, timeout=620)
@modal.concurrent(max_inputs=20)
@modal.asgi_app(requires_proxy_auth=True)
def api():
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel, Field

    web_app = FastAPI(
        title="Tellann Unlimited OCR",
        version="1.0.0",
        description="Authenticated screen OCR for Tellann automated runs.",
    )

    class AnalyzeRequest(BaseModel):
        image_base64: str = Field(
            description="Raw base64 or a data URL for a PNG, JPEG, or WebP image"
        )
        mime_type: str = Field(default="image/png", max_length=64)
        prompt: str = Field(default="document parsing.", min_length=1, max_length=200)
        max_new_tokens: int = Field(
            default=DEFAULT_MAX_NEW_TOKENS,
            ge=128,
            le=MAX_NEW_TOKENS,
        )
        request_id: str | None = Field(default=None, max_length=128)

    @web_app.get("/health", tags=["operations"])
    def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "app": APP_NAME,
            "model": MODEL_ID,
            "model_revision": MODEL_REVISION,
            "gpu": "L4",
        }

    @web_app.get("/v1/models", tags=["operations"])
    def models() -> dict[str, Any]:
        return {
            "data": [
                {
                    "id": MODEL_ID,
                    "revision": MODEL_REVISION,
                    "capabilities": ["text", "layout", "bounding-boxes"],
                }
            ]
        }

    def run_analysis(payload: AnalyzeRequest) -> dict[str, Any]:
        try:
            image_bytes = _decode_image(payload.image_base64)
            return UnlimitedOcr().analyze.remote(
                image_bytes,
                payload.mime_type,
                payload.prompt,
                payload.max_new_tokens,
                payload.request_id or str(uuid.uuid4()),
            )
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    @web_app.post("/v1/screen/analyze", tags=["inference"])
    def analyze_screen(payload: AnalyzeRequest) -> dict[str, Any]:
        return run_analysis(payload)

    @web_app.post("/v1/ocr", tags=["inference"])
    def ocr(payload: AnalyzeRequest) -> dict[str, Any]:
        return run_analysis(payload)

    return web_app


@app.local_entrypoint()
def main(download_only: bool = False) -> None:
    """Preload model weights into the shared Volume."""
    model_path = download_model.remote()
    print(f"Model cached at {model_path}")
    if not download_only:
        print("Deploy with: modal deploy services/visual-ocr-worker/modal_app.py")
