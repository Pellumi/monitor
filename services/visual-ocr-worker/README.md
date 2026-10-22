# Tellann Unlimited OCR worker

This service runs [`baidu/Unlimited-OCR`](https://github.com/baidu/Unlimited-OCR)
on an on-demand Modal L4 GPU and exposes an authenticated HTTP API for Tellann
automated-run screenshots.

The model is pinned to Hugging Face revision
`8249d20b2822a7d8a4c22c8d8c9069b5ac36bda3`. Its weights live in the
`tellann-unlimited-ocr-models` Modal Volume, so cold starts do not download the
model again.

## Deploy

From the repository root:

```powershell
python -m venv .venv-modal
.\.venv-modal\Scripts\python.exe -m pip install modal==1.6.2
.\.venv-modal\Scripts\python.exe -m modal setup
.\.venv-modal\Scripts\python.exe -m modal run services/visual-ocr-worker/modal_app.py --download-only
.\.venv-modal\Scripts\python.exe -m modal deploy services/visual-ocr-worker/modal_app.py
```

The first command that opens a browser is the one-time Modal authentication
step. `modal deploy` prints the persistent base URL.

In Modal, create a Proxy Token under **Settings > Proxy Tokens**. Keep the token
ID and secret out of Git. Tellann sends either these two headers:

```text
Modal-Key: wk-...
Modal-Secret: ws-...
```

or one combined header:

```text
Authorization: Bearer wk-....ws-...
```

## Endpoints

All routes require the Modal Proxy Token.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Deployment and pinned-model health metadata |
| `GET` | `/v1/models` | Model capability discovery |
| `POST` | `/v1/screen/analyze` | Tellann screen analysis contract |
| `POST` | `/v1/ocr` | Generic alias for the same OCR operation |
| `GET` | `/docs` | Interactive OpenAPI documentation |

Example request:

```powershell
$image = [Convert]::ToBase64String([IO.File]::ReadAllBytes("screenshot.png"))
$headers = @{
  "Modal-Key" = $env:TELLANN_OCR_MODAL_KEY
  "Modal-Secret" = $env:TELLANN_OCR_MODAL_SECRET
}
$body = @{ image_base64 = $image; mime_type = "image/png" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$env:TELLANN_OCR_BASE_URL/v1/screen/analyze" -Headers $headers -ContentType "application/json" -Body $body
```

The response includes extracted `text`, raw model output, normalized 0-999
bounding boxes, pixel bounding boxes, image dimensions, the pinned model
revision, a request ID, and inference latency.

## Cost behavior

`min_containers=0` lets the GPU scale to zero. A single L4 container is allowed
at a time and remains warm for 60 seconds after a request. This minimizes idle
GPU spend but makes the first request after an idle period slower.
