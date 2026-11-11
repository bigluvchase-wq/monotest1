# iOS Machine Learning

The **hub** for custom on-device ML — converting, compressing, training, and deploying your own models with Core ML — and the router for on-device speech-to-text. For Apple's built-in on-device LLM (Foundation Models, `@Generable`), stay in `axiom-ai`. For computer vision (image analysis, detection, segmentation), use `axiom-vision`.

This page **routes**. Every stage has a dedicated file:

| Stage | File |
|-------|------|
| Convert a trained PyTorch/TF model → Core ML | `coreml-conversion.md` |
| Compress it (QAT vs PTQ, palettize/quantize/prune) | `coreml-compression.md` |
| Train from scratch (Create ML) or personalize on-device (`MLUpdateTask`) | `coreml-training.md` |
| Deploy / run (Swift 6-safe prediction, KV-cache, multifunction, `MLTensor`) | `coreml-deployment.md` |
| API lookup | `coreml-ref.md` |
| Load failures, slowness, memory, accuracy loss | `coreml-diag.md` |
| Speech-to-text (`SpeechAnalyzer`, `SFSpeechRecognizer`) | `speech.md` |

## When to Use

- Converting PyTorch/TensorFlow models to Core ML
- Compressing models (quantization, palettization, pruning)
- Deploying / running custom models on device (including LLMs, KV-cache, `MLTensor` stitching)
- Building speech-to-text / transcription features → `speech.md`

## Boundary: ML (custom models) vs AI (Apple Intelligence) vs Vision

| Developer intent | Go to |
|------------------|-------|
| "Use Apple Intelligence / Foundation Models" | `axiom-ai` — Apple's on-device LLM |
| "Add text generation with `@Generable`" | `axiom-ai` — structured output |
| "Run / convert / compress my OWN model" | This page — Core ML |
| "Deploy a custom LLM with KV-cache" | This page — Core ML stateful models |
| "Use the Vision framework for image analysis" | `axiom-vision` |
| "Use pre-trained Apple NLP models" | `axiom-ai` |

**Rule of thumb**: converting/compressing/deploying your own model → Core ML (this page). Using Apple's built-in AI → `axiom-ai` Foundation Models. Computer vision → `axiom-vision`.

## Core ML — Decision Framework

### Conversion & compression → dedicated files

- **Converting** a PyTorch/TF/Keras model → `coreml-conversion.md` (`coremltools.convert`, ML Program vs NN-spec, trace vs export, parity validation).
- **Compressing** the result → `coreml-compression.md` (the PTQ-vs-QAT decision, palettization/quantization/pruning).

### Deployment / runtime → dedicated files

- **Deploy and run** → `coreml-deployment.md`: load/cache/pre-warm, compute units, Swift 6-safe prediction (`MLModel` isn't Sendable → actor-owned model, per-lane instances, or a job-owned async call — never one shared instance across tasks), stateful KV-cache, multifunction adapters, `MLTensor` stitching, `OS27` background-inference entitlement.
- **API lookup** → `coreml-ref.md`: `MLModel`/`MLModelAsset`/configuration, compute devices, prediction overloads + Sendability, `MLState`, `MLTensor` ops, `MLComputePlan`, deployment-target matrix, coremltools convert/optimize/multifunction index.
- **Something's wrong** → `coreml-diag.md` (below).

### Core AI `OS27`

LLM-scale / transformer models, custom Metal kernels, `.aimodel`, or backing a Foundation Models session with your own model → **`core-ai.md`**.
Core ML (this page) stays the path for classic models (`.mlpackage`, `MLModel`, `MLUpdateTask`).

### Failures → `coreml-diag.md`

Model fails to load, slow first load or every prediction, memory growth, differs on a device or in Simulator, or accuracy lost after compression → `coreml-diag.md`: real error strings, Instruments load labels, compute-plan placement, op-level comparator. Conversion-time failures (output divergence, `coremltools` import errors, unsupported ops) → `coreml-conversion.md`.

## Speech-to-Text → `speech.md`

`SpeechAnalyzer` / `SpeechTranscriber` / `DictationTranscriber`, `AssetInventory`, the ~2-analyzer `insufficientResources` cap on iOS/visionOS (no limit on macOS), `OS27` capture/asset input providers, Swift 6 mic-tap isolation → **`speech.md`**. `SFSpeechRecognizer` only below 26 or for server-only locales.

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Core ML is just load and predict" | Real apps need async load off the launch path, actor-owned prediction (`MLModel` isn't Sendable), pre-warming, and (LLMs) stateful KV-cache → `coreml-deployment.md` |
| "My model is small, no optimization needed" | Even small models need async load and off-main-actor prediction; keep `computeUnits = .all` unless a profile shows a win (`coreml-deployment.md`); large ones need compression to fit memory |
| "Compression is free accuracy" | Post-training compression is lossy — always re-measure; move to calibration-/training-time compression if accuracy drops. |

## Resources

**WWDC**: 2024-10161, 2024-10159

**Docs**: /coreml, /coreml/mlmodelconfiguration, /coreml/mltensor, /coreai — plus the `coremltools` guide (apple.github.io/coremltools) for conversion + `coremltools.optimize`

**Skills**: coreml-conversion, coreml-compression, coreml-training, coreml-deployment, coreml-ref, coreml-diag (Core ML), speech (speech-to-text), core-ai (the 27-cycle Core AI path for LLM-scale models), axiom-ai (Foundation Models — Apple's built-in LLM), axiom-vision (computer vision), axiom-apple-docs (Apple API doc lookup), axiom-concurrency (off-main-thread inference)
