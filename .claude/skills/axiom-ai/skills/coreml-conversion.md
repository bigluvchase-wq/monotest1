# Core ML Conversion (coremltools)

Already-trained PyTorch / TensorFlow / Keras model → Core ML with the Python `coremltools` package. Doesn't train (`coreml-training.md`), compress (`coreml-compression.md`), or update anything.

## When to Use

- `.pt` / TorchScript / `torch.export` PyTorch model, or TensorFlow/Keras SavedModel → need a `.mlpackage` to ship
- Conversion "succeeded" but Core ML outputs don't match the source
- `coremltools` import or op-support errors → version mismatch or unsupported layer?

## Boundary

| Intent | Go to |
|--------|-------|
| Convert a trained PyTorch/TF model to Core ML | This page |
| Shrink the converted model (quantize / palettize / prune) | `coreml-compression.md` |
| Train a new model from scratch | `coreml-training.md` (Create ML) |
| Personalize a deployed model on-device | `coreml-training.md` (`MLUpdateTask`) |
| Fine-tune Apple's on-device LLM | `foundation-models-adapters.md` |
| Deploy / run the converted model | `skills/coreml-deployment.md` |

Producing the weights = training, not conversion.

## The Unified Converter

One entry point: `coremltools.convert(model, ...)`; output format set by `convert_to` / `minimum_deployment_target`:

- `.mlpackage` (ML Program, `"mlprogram"`) — default; use for anything new
- `.mlmodel` (NeuralNetwork, `"neuralnetwork"`) — legacy NN-spec; only when NN-spec is required, e.g. on-device personalization via `MLUpdateTask` (NN-spec-only → `coreml-training.md`)

```python
import coremltools as ct

mlmodel = ct.convert(
    traced_model,                              # source model (see capture modes below)
    convert_to="mlprogram",                    # default; "neuralnetwork" only for NN-spec needs
    minimum_deployment_target=ct.target.iOS26, # pin to the OS you actually ship
    compute_precision=ct.precision.FLOAT16,    # FP16 is the default; set FLOAT32 only if accuracy demands
    inputs=[ct.TensorType(name="x", shape=(1, 3, 224, 224))],
)
mlmodel.save("Model.mlpackage")
```

### Supported source formats

| Source | Status |
|--------|--------|
| PyTorch | TorchScript (`torch.jit.trace`) — stable, production default; `torch.export` (ExportedProgram) — beta, since coremltools 8 |
| TensorFlow 1.x / 2.x | frozen graph, SavedModel, concrete functions |
| Keras | via the TensorFlow path (`tf.keras.Model`, `.h5`) |
| ONNX | **Removed** (`onnx-coreml` frozen, unmaintained) → convert ONNX → PyTorch or TF first |
| JAX | not a direct source → `jax2tf` → TF → Core ML |

### PyTorch capture: trace vs export

- `torch.jit.trace` — stable default; traces one forward pass → data-dependent control flow not captured
- `torch.export.export` — coremltools 8+, beta; preferred long-term → verify parity before relying on it
- Either way: concrete `inputs` (`ct.TensorType` / `ct.ImageType`); variable sizes → `ct.RangeDim` or `ct.EnumeratedShapes`

### Choosing `minimum_deployment_target`

At least `ct.target.iOS18`; use your app's minimum OS (`ct.target.iOS26` for a 26+ app), not the newest SDK — it gates your install base. Conversion-relevant gates:

| Target | Unlocks at conversion |
|---|---|
| iOS 18 | `states=` (stateful models); fused `scaled_dot_product_attention` op instead of matmul/softmax pieces (WWDC 2024-10159: "really shines on Apple Silicon GPUs"); grouped-channel/per-block/int4/joint compression (`coreml-compression.md`) |
| iOS 26 | int8 model inputs/outputs |

Full matrix (iOS 15–27, runtime + coremltools) → `coreml-ref.md` Part 9.

### Stateful models — KV-cache (iOS 18+)

- PyTorch side: `register_buffer("keyCache", …)`; update in place inside `forward`; caches are not `forward` inputs
- `states=[ct.StateType(...)]`, with `name` set to the buffer name (`named_buffers()` key); state is fp16 ("As of iOS 18, Core ML state can only be fp16", coremltools source)
- Wrapped `TensorType` takes no `name`/`default_value`; `StateType` inside `inputs` raises `ValueError`; PyTorch sources only (`'states' can only be passed with pytorch source model.`)

```python
import numpy as np
import coremltools as ct

cache_shape = (1, 32, 2048, 128)
mlmodel = ct.convert(
    traced_model,
    inputs=[ct.TensorType(name="inputIds", shape=(1, ct.RangeDim(1, 2048)), dtype=np.int32)],
    states=[
        ct.StateType(wrapped_type=ct.TensorType(shape=cache_shape, dtype=np.float16), name="keyCache"),
        ct.StateType(wrapped_type=ct.TensorType(shape=cache_shape, dtype=np.float16), name="valueCache"),
    ],
    minimum_deployment_target=ct.target.iOS18,
)
```

Runtime (`makeState()`, serialization rules) → `coreml-deployment.md`.

### Converting an already-compressed source

- Compressed with `coremltools.optimize.torch` → compression metadata (`_COREML_…` state-dict keys) read automatically, only when `minimum_deployment_target` ≥ iOS 16
- Weights already palettized or sparse by other means → `pass_pipeline=ct.PassPipeline.DEFAULT_PALETTIZATION` / `DEFAULT_PRUNING` emits the compressed format
- Adapter variants of one base → convert each, merge into one multifunction `.mlpackage` (`coreml-deployment.md`)

## Always Validate Parity

A successful convert only means the graph lowered. Same representative inputs → source model and Core ML model → compare outputs (max abs/relative error; classifiers: top-k agreement). Real input distribution, not random noise.

## Failure Modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `NotImplementedError: PyTorch convert function for op 'X' not implemented.` | No MIL lowering for `X` | Upgrade coremltools; rewrite with supported ops (coremltools op-support list); or `@register_torch_op` from `coremltools.converters.mil` (not `mb.`) |
| Same, plus `Dynamic quantized models are not supported by Core ML.` | PyTorch dynamic quantization | Convert the float model, then compress with `coremltools.optimize` (`coreml-compression.md`) |
| Converts; outputs diverge on every compute unit | Preprocessing (`ct.ImageType` `scale`/`bias`/`color_layout`), training-mode layers, precision drop, imperfect op mapping | Parity check above; compare layer-level outputs; `compute_precision=ct.precision.FLOAT32` separates precision from op mapping |
| Correct on `CPU_ONLY`, wrong on GPU/NE | One op's FP16 precision | `coreml-diag.md` (Wrong Output on One Compute Unit) |
| `coremltools` import errors (e.g. `libmilstoragepython`) | `coremltools` / source-framework version mismatch | coremltools 9.0 is tested up to PyTorch 2.7.0 and TensorFlow 2.12.0 (newer → warning); `optimize.torch` needs PyTorch ≥ 2.1.0; pin in a clean venv |
| Tracing warns about control flow | `torch.jit.trace` can't capture data-dependent branches | `torch.export`, or script the dynamic submodule |

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "Conversion succeeded, so the model is correct" | Graph lowered ≠ outputs match → validate parity on representative inputs before shipping |
| "I'll just convert my ONNX model directly" | ONNX path removed → ONNX → PyTorch/TF first; skip `onnx-coreml` |
| "FP32 to be safe" | FP16 is the default and usually fine on Apple Silicon; FP32 doubles size and memory → measure accuracy first |
| "I'll target the latest OS so I get all the features" | `minimum_deployment_target` gates your install base → your app's minimum OS |
| "Trace and export are interchangeable" | Trace stable; `torch.export` beta in coremltools → trace for production unless export parity is verified |

## Resources

**WWDC**: 2024-10159

**Docs**: /coreml (runtime side); coremltools 9.0 guide at apple.github.io/coremltools (Unified Conversion API, `convert-pytorch-workflow`)

**Skills**: coreml-compression (shrink the converted model), coreml-training (Create ML / `MLUpdateTask`), coreml-deployment (run it in the app), coreml-ref (coremltools index), `skills/ios-ml.md` (hub), axiom-ai (Foundation Models), axiom-apple-docs
