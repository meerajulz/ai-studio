# Research — Providers (broad landscape)

> **Status: research-only.** We have deep-researched exactly one provider family so far — Fal image
> generation (see [../PROVIDER_RESEARCH.md](../PROVIDER_RESEARCH.md), which recommended FLUX.1
> Kontext). This doc is the broader provider backlog. No implementation.

## Question

Which providers should sit behind AI Studio's **capability router**, and for which capabilities?
The router already routes on capabilities (not names), so adding providers is additive.

## To investigate

- **More image generation:** OpenAI (`gpt-image-1`), Google (Imagen), Ideogram, Replicate, Stability,
  local (ComfyUI). Capabilities, quality, pricing, latency, API maturity, editing/reference support.
- **Identity-preserving variants** across providers (beyond Kontext) — so routing can pick the best
  identity model per request.
- **Video providers** (parallel `VideoProvider`) — Kling, Runway, Luma, Fal video models.
- **Async/queue APIs** — which providers need job polling (informs the `asyncJobs` capability + a
  `Job` queue).

## Why it matters

Provider expansion is where "the model becomes interchangeable." Each new provider is one adapter +
one registry entry; the Creative Director / Identity / Gallery never change.

## Open questions

- Cost/quality/latency matrix per capability?
- Which providers support multi-reference identity + editing (the Kontext niche)?
- Pricing model that AI Studio can expose to users (credits)?
