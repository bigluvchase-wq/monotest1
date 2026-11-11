# Core ML Compression (QAT vs PTQ)

Shrinking a custom Core ML model to fit memory and run fast on device. Dominant decision: **post-training quantization (PTQ)** vs **quantization-aware training (QAT)**. After conversion (`coreml-conversion.md`), before deployment (`skills/coreml-deployment.md`). API signatures and code → `coreml-ref.md` Part 6.

## When to Use

- Converted model too large or too slow → quantize / palettize / prune
- Accuracy dropped more than acceptable after compressing
- Cheap post-training pass enough, or retrain?

## The Core Decision: PTQ vs QAT

| | Post-training (PTQ) | Quantization-aware training (QAT) |
|--|---------------------|-----------------------------------|
| **When applied** | After training | During training (low precision simulated in the loss) |
| **Cost** | Minutes, no retraining, often data-free | Full retraining loop with QAT-aware optimizers |
| **Accuracy hit** | Larger — worse on small models, low bit-widths, sensitive tasks | Smaller — weights learned robust to quantization |
| **coremltools module** | `optimize.coreml` (on the `.mlpackage`) **or** `optimize.torch` (on the PyTorch model) | `optimize.torch` (hooks into the PyTorch training loop) |

Rubric:
0. Profile the Float16 baseline first. Size ≈ Float16 × nbits/16, plus LUT/scale overhead (8-bit ≈ ½, WWDC 2024-10159).
1. **PTQ** first — free. Step bit-width down 8 → 6 → 4 (`per_grouped_channel`), measuring accuracy at each step.
2. Accuracy holds at the target bit-width → ship.
3. Degrades too much (common at int4 / sub-4-bit, or small models) → **calibration PTQ** (data sample), then **QAT**.
4. QAT can't hold it → bit-width too aggressive; back off.

Authority: Apple ships its on-device foundation model at **2 bits per weight using QAT** (arXiv 2507.13575), balanced 2-bit set `{-1.5, -0.5, 0.5, 1.5}` chosen because it trained more smoothly than `{-2, -1, 0, 1}`. Lesson: Apple reached for QAT, not PTQ, to survive aggressive quantization. 2-bit PTQ on a custom model almost always falls apart.

## Tiers and Families

| Tier | Needs | Module |
|---|---|---|
| Data-free PTQ | nothing | `optimize.coreml` on the `.mlpackage` (all three families), or `optimize.torch` post-training classes |
| Calibration PTQ | sample data | `optimize.torch` (all three families); `optimize.coreml.linear_quantize_activations` (8-bit activations only → W8A8) |
| QAT | training loop | `optimize.torch` (all three families) |

"Post-training" ≠ "`optimize.coreml`": `optimize.torch` holds data-free PTQ, calibration PTQ, and QAT. Class per tier × family → `coreml-ref.md` Part 6.

- **Palettization** — weights clustered into an N-bit lookup table; usually the best size/accuracy trade-off; `nbits` ∈ `{1, 2, 3, 4, 6, 8}`
- **Quantization** — linear int8 / int4 weights, optional int8 activations; W8A8 runs on the Neural Engine (A17 Pro+, M4)
- **Pruning** — zero low-magnitude weights (magnitude threshold, target sparsity, block-structured, N:M). Composes with either: sparse-palettized / sparse-quantized.
  - **Stacking two `optimize.coreml` passes needs `joint_compression=True` on the second call** (prune → palettize/quantize, palettize → quantize, quantize → prune). Without it the second pass is silently skipped: no error, no warning, only the first compression ships (measured, coremltools 9.0) → `coreml-ref.md` Part 6

## Deployment Target and Hardware Fit

| Method | Suits (WWDC 2024-10159) |
|---|---|
| `per_grouped_channel` palettization | Neural Engine |
| int4 or `per_block` quantization | Mac GPUs |
| joint: sparse + palettized/quantized | Neural Engine |

All three need `minimum_deployment_target` ≥ `ct.target.iOS18`, as do vector palettization (`cluster_dim > 1`) and `enable_per_channel_scale`. Below iOS 18 the compression call raises `ValueError`, e.g. `The per_grouped_channel palettization is supported since iOS18. Please re-convert your model with minimum_deployment_target set to at least ct.target.iOS18.` (same shape for vector palettization, 4-bit, `per_block`, joint; `enable_per_channel_scale` reads `Palettization with per-channel-scale is only supported since iOS18…`). Fix at conversion: at least `iOS18`; use your app's minimum OS (`ct.target.iOS26` for a 26+ app) → `coreml-conversion.md`. iOS 16 methods (per-tensor palettization, per-channel int8, sparsity) and the full matrix → `coreml-ref.md` Part 9.

## Always Re-Measure After Compressing

Lossy by definition → eval set before and after every pass, on a realistic input distribution. Fine on synthetic inputs can collapse on real ones. Most-skipped step; most expensive to discover in production. Locating the damaged op → `coreml-diag.md` (Accuracy Loss After Compression).

## Boundary

- QAT/PTQ = deployment-stage decisions for custom Core ML models you train or convert
- Apple's Foundation Models are already 2-bit-quantized at the framework level → you don't quantize them; FM adapters are LoRA deltas inheriting the base quantization → `axiom-ai`

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Compression is free accuracy savings" | Lossy, PTQ especially → re-measure on real inputs; accuracy can drop silently |
| "PTQ is enough, QAT is overkill" | True at int8 on big models; false at int4/sub-4-bit or small models. Apple needed QAT for 2-bit → match method to bit-width |
| "2-bit worked for Apple, I'll do 2-bit PTQ" | Apple used 2-bit *QAT* with a hand-tuned weight set and recovery adapters → 2-bit PTQ on a custom model almost certainly fails |
| "I'll quantize Apple's Foundation Model to save space" | Already 2-bit at the framework level → this page is for *your* models |
| "Pruning or quantization, pick one" | They compose (second pass with `joint_compression=True`) and often beat either alone |

## Resources

**WWDC**: 2024-10159

**Docs**: coremltools 9.0 guide at apple.github.io/coremltools (`opt-overview`, `opt-quantization-api`, `opt-palettization-api`, `opt-pruning-api`); Apple Intelligence Foundation Language Models Tech Report 2025 (arXiv 2507.13575) for the 2-bit QAT specifics

**Skills**: coreml-conversion (produce the model first), coreml-deployment (run the compressed model), coreml-ref (optimize API index), `skills/ios-ml.md` (hub), coreml-training (train from scratch / personalize), axiom-ai (Foundation Models — already quantized)
