# Core ML API Reference

CoreML Swift API (checked against the iOS 27.1 SDK) + coremltools 9.0 Python index. Patterns and discipline → `coreml-deployment.md`; conversion decisions → `coreml-conversion.md`; compression decisions → `coreml-compression.md`; 27-cycle LLM runtime → `core-ai.md`.

Versions are iOS; same APIs on macOS/tvOS/watchOS/visionOS at the matching release unless noted. The 27.1 SDK adds no new CoreML API (Swift interface or headers).

## Part 1 — Model Lifecycle

### Loading

| API | Availability | Notes |
|---|---|---|
| `MLModel.load(contentsOf:configuration:) async throws` | iOS 15 | preferred; `configuration` defaults to `MLModelConfiguration()`; URL = `.mlmodelc` |
| `MLModel.load(asset:configuration:) async throws` | iOS 16 | from `MLModelAsset`; no default configuration |
| `MLModel(contentsOf:configuration:) throws` | iOS 12 | synchronous — blocks caller |
| `MLModel.compileModel(at:) async throws -> URL` | iOS 16, not watchOS | `.mlmodel`/`.mlpackage` → temporary `.mlmodelc`; move it to keep it |
| `MLModel.compileModel(at:) throws -> URL` | not watchOS | sync; header marks it to-be-deprecated |

Specialization cache, invalidation, Core ML instrument load labels → `coreml-deployment.md` (Load, Cache, Pre-Warm).

### Asset types

| Type | What | Loaded at run time |
|---|---|---|
| `.mlmodel` | single-file spec: NeuralNetwork and other non-ML-Program types (an ML Program must save as `.mlpackage`) | no — compile first |
| `.mlpackage` | ML Program directory, weights stored separately | no — compile first |
| `.mlmodelc` | compiled; Xcode emits it for bundled models | yes |

### MLModelAsset

| API | Availability |
|---|---|
| `MLModelAsset(url:)` — compiled `.mlmodelc` | iOS 18 |
| `MLModelAsset(specification:)` — in-memory spec `Data` | iOS 16, not watchOS |
| `MLModelAsset(specification:blobMapping:)` | iOS 18, not watchOS |
| `try await asset.functionNames` / `modelDescription` / `modelDescription(of:)` | iOS 18 |

- `functionNames` = `[]` on a single-function model (measured, macOS 27.2)
- `modelDescription(of:)` with a name not in `functionNames` (including `"main"` on a single-function model) raises an uncaught `NSInvalidArgumentException` (`The specified function name: X is not among the available function names: [...]`) → **process abort**, not a throw; `do`/`catch` can't intercept it (measured, macOS 27.2). Guard with `functionNames.contains(name)`; single-function model → `modelDescription`

### MLModelConfiguration

| Property | Availability | Notes |
|---|---|---|
| `computeUnits` | iOS 12 | Part 2 |
| `functionName: String?` | iOS 18 | `nil` → default function; multifunction: a name from `functionNames`; single-function ML Program: only `"main"`; NeuralNetwork: only `nil`; anything else → load throws (`coreml-diag.md` Load Failures) |
| `optimizationHints` (`MLOptimizationHints`) | iOS 17.4 | set in place: `configuration.optimizationHints.reshapeFrequency = .infrequent` |
| ↳ `reshapeFrequency` | iOS 17.4 | `.frequent` (default): fast shape switching, skips shape-specific optimization; `.infrequent`: stable shapes, re-optimizes on each shape change, faster predictions per seen shape |
| ↳ `specializationStrategy` | iOS 18 | `.default`; `.fastPrediction`: lower prediction latency "at the potential cost of specialization time, memory footprint, and the disk space usage of specialized artifacts" (SDK header) |
| `allowLowPrecisionAccumulationOnGPU` | iOS 13 | |
| `preferredMetalDevice` | iOS 13 | |
| `modelDisplayName` | iOS 16 | |
| `parameters: [MLParameterKey: Any]?` | iOS 13 | model/update parameters |

## Part 2 — Compute Availability

| `MLComputeUnits` | Availability | Runs on |
|---|---|---|
| `.all` | iOS 12 | CPU + GPU + Neural Engine |
| `.cpuAndNeuralEngine` | iOS 16 | excludes GPU |
| `.cpuAndGPU` | iOS 12 | excludes Neural Engine |
| `.cpuOnly` | iOS 12 | CPU |

`MLComputeDevice` (iOS 17, Swift enum, Sendable): `.cpu(MLCPUComputeDevice)`, `.gpu(MLGPUComputeDevice)`, `.neuralEngine(MLNeuralEngineComputeDevice)`.
- `MLModel.availableComputeDevices` → devices Core ML predictions can use
- `MLComputeDevice.allComputeDevices` → all hardware, including devices unavailable to Core ML
- GPU has no `name` → `gpu.metalDevice.name`; Neural Engine → `totalCoreCount`

```swift
import CoreML

func describeComputeDevices() -> [String] {
    MLModel.availableComputeDevices.map { device in
        switch device {
        case .cpu: "CPU"
        case .gpu(let gpu): "GPU \(gpu.metalDevice.name)"
        case .neuralEngine(let engine): "Neural Engine, \(engine.totalCoreCount) cores"
        @unknown default: "unknown"
        }
    }
}

func neuralEngineAvailable() -> Bool {
    MLModel.availableComputeDevices.contains { device in
        if case .neuralEngine = device { true } else { false }
    }
}
```

`MLComputePolicy` (iOS 18, `MLTensor` only): `.cpuOnly`, `.cpuAndGPU`, `MLComputePolicy(_ computeUnits: MLComputeUnits)` → `withMLTensorComputePolicy(_:_:)`.

## Part 3 — Prediction APIs

| Call | Availability | Notes |
|---|---|---|
| `prediction(from:) throws` / `prediction(from:options:) throws` | iOS 11 | sync; not thread-safe |
| `prediction(from:options:) async throws` | iOS 17 | `options` defaults; Apple: thread-safe, best-effort cancellation |
| `predictions(fromBatch:) throws` | iOS 12 | batch |
| `predictions(from:options:) throws` | iOS 12 | batch with options; `predictions(from: batch)` alone → `missing argument for parameter 'options'` |
| `prediction(from:using:) throws` / `prediction(from:using:options:) throws` | iOS 18 | sync, stateful |
| `prediction(from:using:options:) async throws` | iOS 18 | async, stateful |
| `prediction(from: [String: MLTensor]) async throws -> [String: MLTensor]` | iOS 18 | all inputs/outputs must be multiarrays |
| `prediction(from: [String: MLTensor], using:) async throws` | iOS 18 | stateful tensor form |

`MLPredictionOptions.outputBackings` (iOS 16): `[featureName: CVPixelBuffer | MLMultiArray]` preallocated outputs; Core ML may ignore them (unknown name, unsupported model, batch mode) → compare output object identity to check; page-aligned `MLMultiArray` / IOSurface-backed pixel buffers perform best.

### State (iOS 18)

| API | Notes |
|---|---|
| `model.makeState() -> MLState` | zero-initialized buffers |
| `model.newState()` | unavailable in Swift — Apple's doc-comment examples still use it |
| `state.withMultiArray(for:_:)` | read/seed a named buffer; access only inside the closure |
| `state.withMultiArray(_:)` | deprecated |
| `modelDescription.stateDescriptionsByName` | declared states; `MLStateConstraint.bufferShape` / `dataType` |

Rules (SDK header): serialize predictions sharing one `MLState`, or behavior is undefined; never touch buffers while a prediction is in flight.

### Sendability (Swift 6)

| Type | Sendable |
|---|---|
| `MLModel`, `MLModelConfiguration`, `MLComputePlan`, `MLImageConstraint`, `any MLFeatureProvider`, `MLDictionaryFeatureProvider` | no |
| `MLState`, `MLTensor`, `MLShapedArray`, `MLShapedArraySlice`, `MLComputeDevice`, `MLComputePolicy`, `MLOptimizationHints` | yes |
| `MLSendableFeatureValue` (iOS 18) | yes — `MLSendableFeatureValue(_ value: MLFeatureValue)` failable; back via `MLFeatureValue(_:)` |
| `CVPixelBuffer` | no (conformance explicitly unavailable) |
| `CGImage` | yes |

Consequences and the three prediction shapes → `coreml-deployment.md`.

## Part 4 — MLTensor (iOS 18)

| Area | API |
|---|---|
| Create | `MLTensor(shape:scalars:scalarType:)`, `MLTensor(_ shapedArray:)`, `MLTensor(_ scalars:scalarType:)`, nested array literal, `MLTensor(zeros:scalarType:)` / `(ones:scalarType:)` / `(repeating:shape:)`, `(randomNormal:…)` / `(randomUniform:…)`, `(rangeFrom:to:by:)`, `(linearSpaceFrom:through:count:)`, `(concatenating:alongAxis:)`, `(stacking:alongAxis:)` |
| Inspect | `shape`, `rank`, `scalarCount`, `scalarType`, `isScalar` |
| Math | `+ - * / %` (tensor or scalar, broadcasting), `matmul`, `pow`, `exp`, `log`, `squareRoot`, `rsqrt`, `abs`, …, `softmax(alongAxis:)` (default last axis), `clamped(to:)`; free functions `pointwiseMin(_:_:)` / `pointwiseMax(_:_:)` (scalar overloads iOS 26) |
| Reduce | `sum`, `mean`, `min`, `max`, `product`, `all`, `any` (`alongAxes:keepRank:`); `argmax()` / `argmin()` (flattened, `Int32`), `argmax(alongAxis:keepRank:)` |
| Compare / logic | `.== .!= .> .>= .< .<=` → Bool tensor; `.& .| .^ .!`; `replacing(with:where:)` |
| Index | `t[0]`, `t[0..<2, 1..<3]`, `t[..., 0]` (unbounded = `...`), `.newAxis`, `.squeezeAxis`, `.range(_:stride:)` |
| Shape | `reshaped(to:)`, `flattened()`, `expandingShape(at:)`, `squeezingShape()`, `transposed(permutation:)`, `concatenated(with:alongAxis:)`, `split(count:)` / `split(sizes:)`, `unstacked`, `tiled(multiples:)`, `padded(forSizes:…)`, `resized(to:method:)`, `cast(to:)` |
| LLM helpers | `topK(_ k:)` → `(values, indices: Int32)` along last axis; `argsort`; `gathering(atIndices:alongAxis:)` (Int32 indices); `bandPart(lowerBandCount:upperBandCount:)` (causal masks); `cumulativeSum` |
| Materialize | `await t.shapedArray(of: Float.self)` — required before reading scalars |
| Device | `withMLTensorComputePolicy(.cpuAndGPU) { … }` (sync and async overloads, task-local) |

Absent — common wrong guesses: `multinomial(numSamples:)`, `topK(k:)` (label), `t[.all, 0]` (→ `t[..., 0]`).

```swift
import CoreML

func tensorBasics() async -> [Float] {
    let x = MLTensor(shape: [2, 3], scalars: [1, 2, 3, 4, 5, 6], scalarType: Float.self)
    let fromShaped = MLTensor(MLShapedArray<Float>(scalars: [1, 2, 3, 4], shape: [2, 2]))
    let nested = MLTensor([[1.0, 2.0], [3.0, 4.0]])
    let columnIndices = MLTensor([2, 0], scalarType: Int32.self)

    let y = (x + Float(1)) * Float(2)
    let mean = y.mean()
    let rowSums = y.sum(alongAxes: 1)
    let clipped = y.replacing(with: Float(0), where: y .> mean)

    let firstRow = x[0]
    let firstColumn = x[..., 0]
    let corner = x[0..<2, 1..<3]
    let batched = x.expandingShape(at: 0)
    let picked = x.gathering(atIndices: columnIndices, alongAxis: 1)
    let product = fromShaped.matmul(nested)

    _ = (rowSums, firstRow, firstColumn, corner, batched, picked, product)
    return await clipped.shapedArray(of: Float.self).scalars
}
```

Typed scalars (`Float(1)`) → scalar overload. Bare `1` → `MLTensor(integerLiteral:)`, an `Int32` tensor, through the tensor–tensor overload (checked in SIL). Sampling example → `coreml-deployment.md`.

## Part 5 — coremltools Conversion Index (Python)

Decisions (format, trace vs export, parity) → `coreml-conversion.md`.

| Symbol | Notes |
|---|---|
| `ct.convert(model, source=, inputs=, outputs=, classifier_config=, minimum_deployment_target=, convert_to=, compute_precision=, skip_model_load=, compute_units=, package_dir=, debug=, pass_pipeline=, states=)` | 9.0 signature |
| `ct.TensorType(name=, shape=, dtype=, default_value=)` | |
| `ct.ImageType(name=, shape=, scale=, bias=, color_layout=, channel_first=, grayscale_use_uint8=)` | `grayscale_use_uint8` needs iOS 17 target |
| `ct.RangeDim(lower_bound=1, upper_bound=-1, default=None, symbol=None)` | bounded dynamic dim |
| `ct.EnumeratedShapes(shapes, default=None)` | fixed set of shapes |
| `ct.StateType(wrapped_type=ct.TensorType(shape=, dtype=np.float16), name=)` | rules → `coreml-conversion.md` (Stateful models) |
| `ct.target.iOS13` … `iOS18`, `iOS26` | what each unlocks → Part 9 |
| `ct.precision.FLOAT16` / `FLOAT32` | |
| `ct.ComputeUnit.ALL` / `CPU_AND_GPU` / `CPU_ONLY` / `CPU_AND_NE` | Python-side load/predict |
| `ct.models.MLModel(path, skip_model_load=, compute_units=, function_name=, optimization_hints=)` | `function_name` picks a multifunction function |

## Part 6 — Compression Index (coremltools.optimize)

Decisions (PTQ vs calibration vs QAT, bit-width ladder, compute-unit fit) → `coreml-compression.md`.

### `coremltools.optimize.coreml` — on the `.mlpackage`

| Config | Defaults | Function |
|---|---|---|
| `OpPalettizerConfig(mode="kmeans", nbits=, granularity="per_tensor", group_size=32, channel_axis=, cluster_dim=1, enable_per_channel_scale=False, num_kmeans_workers=1, lut_function=, weight_threshold=2048)` | | `palettize_weights(model, config, joint_compression=False)` |
| `OpLinearQuantizerConfig(mode="linear_symmetric", dtype="int8", granularity="per_channel", block_size=32, weight_threshold=2048)` | modes `linear` / `linear_symmetric` | `linear_quantize_weights(model, config, joint_compression=False)` |
| `OpMagnitudePrunerConfig(target_sparsity=, block_size=, n_m_ratio=, dim=, weight_threshold=2048)` / `OpThresholdPrunerConfig` | | `prune_weights(model, config, joint_compression=False)` |
| same `OpLinearQuantizerConfig` | 8-bit activations only; runs the model on sample data | `linear_quantize_activations(model, config, sample_data)` → pair with weight quantization for W8A8 |

- Wrap configs in `OptimizationConfig(global_config=, op_type_configs=, op_name_configs=)`
- `weight_threshold`: only tensors with more than this many elements are compressed
- `mode="kmeans"` needs scikit-learn (`kmeans1d` replaces it only for fp16 tensors of ≥10,000 elements, if installed) → otherwise `ModuleNotFoundError: scikit-learn is required for k-means quantization.`
- **Stacking passes needs `joint_compression=True` on the second pass.** Without it the second pass leaves already-compressed weights untouched, no error, no warning (measured, coremltools 9.0): prune → `linear_quantize_weights` leaves ops `{constexpr_sparse_to_dense}` only; with the flag → `{constexpr_sparse_blockwise_shift_scale, constexpr_sparse_to_dense}`. Same skip for prune → palettize (joint → `constexpr_lut_to_sparse`), palettize → quantize, quantize → prune. Palettize → quantize joint needs `granularity="per_tensor"` (else `NotImplementedError`). Joint needs iOS 18 target
- iOS 18-gated schemes and their `ValueError` → `coreml-compression.md` (Deployment target)
- Also: `decompress_weights`, `get_weights_metadata`

```python
import coremltools as ct
import coremltools.optimize as cto

model = ct.models.MLModel("Model.mlpackage", skip_model_load=True)

palettized = cto.coreml.palettize_weights(model, cto.coreml.OptimizationConfig(
    global_config=cto.coreml.OpPalettizerConfig(mode="kmeans", nbits=4, granularity="per_grouped_channel", group_size=16)))
palettized.save("Model-palettized.mlpackage")

int4 = cto.coreml.linear_quantize_weights(model, cto.coreml.OptimizationConfig(
    global_config=cto.coreml.OpLinearQuantizerConfig(dtype="int4", granularity="per_block", block_size=32)))

pruned = cto.coreml.prune_weights(model, cto.coreml.OptimizationConfig(
    global_config=cto.coreml.OpMagnitudePrunerConfig(target_sparsity=0.5)))
sparse_int8 = cto.coreml.linear_quantize_weights(pruned, cto.coreml.OptimizationConfig(
    global_config=cto.coreml.OpLinearQuantizerConfig(dtype="int8")), joint_compression=True)
```

`Model.mlpackage` converted with `minimum_deployment_target` ≥ `ct.target.iOS18`.

### `coremltools.optimize.torch` — on the PyTorch model (needs PyTorch)

| Class | Module | Kind | Lifecycle |
|---|---|---|---|
| `DKMPalettizer` | `palettization` | QAT | `prepare()` → train, `step()` per step → `finalize()` |
| `LinearQuantizer` | `quantization` | QAT | same |
| `MagnitudePruner` | `pruning` | QAT | same |
| `SKMPalettizer` | `palettization` | calibration PTQ | `compute_sensitivity` / `compress` |
| `PostTrainingPalettizer` / `PostTrainingQuantizer` | `palettization` / `quantization` | data-free PTQ | `compress()` |
| `LayerwiseCompressor` + `GPTQ` (quantization) / `SparseGPT` (pruning) | `layerwise_compression` (not `pruning`) | calibration PTQ | `compress(dataloader, device)` — `device` is required |

- Config objects are `XConfig(global_config=ModuleXConfig(...))` or `XConfig.from_dict({"global_config": {...}})`; a raw dict passed as `global_config=` fails validation
- `LayerwiseCompressorConfig`: sequential models only; `layers=None` → all immediate children; `calibration_nsamples` default 128; `global_config` dict needs `"algorithm": "gptq"` or `"sparse_gpt"`
- Compression metadata travels in the state dict (`_COREML_` keys) and is read by the converter

```python
from coremltools.optimize.torch.palettization import DKMPalettizer, DKMPalettizerConfig
from coremltools.optimize.torch.layerwise_compression import LayerwiseCompressor, LayerwiseCompressorConfig

config = DKMPalettizerConfig.from_dict({"global_config": {"n_bits": 4}})
palettizer = DKMPalettizer(model, config)
prepared = palettizer.prepare()
for epoch in range(num_epochs):
    train_one_epoch(prepared, train_loader)
    palettizer.step()
palettized = palettizer.finalize()

sparse_config = LayerwiseCompressorConfig.from_dict({
    "global_config": {"algorithm": "sparse_gpt", "target_sparsity": 0.5},
    "calibration_nsamples": 128,
})
pruned = LayerwiseCompressor(model, sparse_config).compress(calibration_loader, device="cpu")
```

`model`, `train_one_epoch`, `train_loader`, `num_epochs` and `calibration_loader` are your PyTorch objects.

## Part 7 — Multifunction Models

| Side | API |
|---|---|
| Python | `ct.utils.MultiFunctionDescriptor(model_path=None)`; `.add_function(model_path, src_function_name, target_function_name)`; `.add_model(path)`; `.remove_function(name)`; `.default_function_name` (required before save) |
| Python | `ct.utils.save_multifunction(desc, destination_path)` → spec version forced to iOS 18; shared weights deduplicated |
| Python | `ct.models.MLModel(path, function_name="…")` |
| Swift | `MLModelConfiguration.functionName`; `MLModelAsset(url:)` + `try await asset.functionNames`; `modelDescription(of:)` — name must be in `functionNames`, else process abort (Part 1) |
| Xcode | model preview lists functions above the inputs |

Pitfalls: `MultiFunctionDescriptor` is not in `ct.models`; the 9.0 docstring's `source_function_name=` keyword → `TypeError`. Merge and load code → `coreml-deployment.md`.

## Part 8 — Performance Profiling

`MLComputePlan` (iOS 17.4; not Sendable): `load(contentsOf:configuration:)` / `load(asset:configuration:)` — `configuration` required; URL = `.mlmodelc` (an `.mlpackage` aborts the process → `coreml-diag.md` Red Flags). `modelStructure` is an `MLModelStructure` enum (`.program`, `.neuralNetwork`, `.pipeline`, `.unsupported`), not a list of operations. Per op: `deviceUsage(for:)` → `.preferred` / `.supported`; `estimatedCost(of:)` → `.weight`, the op's fraction (0–1) of total model execution. Walk code → `coreml-diag.md` First Steps.

NeuralNetwork models: `case .neuralNetwork(let network)` → `network.layers` → `deviceUsage(for: layer)` (no cost estimate). `MLModelStructure.load(contentsOf:)` (iOS 17.4) gives the structure without a plan.

| Tool | Shows |
|---|---|
| Xcode model → Performance → + → device + compute units → Run Test | load/prediction times, compute-unit split; per-op estimated time and device support; hover an unsupported op for the reason; export and compare reports |
| Instruments: any template + the Core ML instrument (`xctrace record --instrument 'Core ML'`; Xcode 27.1 ships no Core ML template) — command → `coreml-diag.md` First Steps | load events (labels → `coreml-deployment.md`), predictions, compute-unit activity; add the Neural Engine, GPU, Allocations instruments |

## Part 9 — Deployment Targets

| Target | Core ML runtime | coremltools `minimum_deployment_target` unlocks |
|---|---|---|
| iOS 15 | async `MLModel.load(contentsOf:)`, `MLShapedArray` | ML Program (`.mlpackage`) |
| iOS 16 | `compileModel(at:) async`, `.cpuAndNeuralEngine`, `MLModelAsset(specification:)`, `outputBackings` | weight compression ops: per-tensor palettization, per-channel int8 quantization, sparsity |
| iOS 17 | async `prediction(from:)`, `MLComputeDevice` / `availableComputeDevices` | activation quantization (W8A8), uint8 grayscale image input |
| iOS 17.4 | `MLComputePlan`, `MLModelStructure`, `optimizationHints.reshapeFrequency` | — |
| iOS 18 | `MLTensor`, `MLState` / `makeState()`, `functionName`, `MLModelAsset(url:)`, `specializationStrategy`, `MLSendableFeatureValue` | `StateType`, fused SDPA, `per_grouped_channel` palettization, `per_block` and int4 quantization, joint compression, multifunction |
| iOS 26 | `Int8` `MLShapedArray` / `MLMultiArray` scalars; scalar `pointwiseMin` / `pointwiseMax` | int8 model inputs/outputs |
| 27 | no new CoreML Swift API; background-inference entitlement `OS27` (`coreml-deployment.md`) | — |

`minimum_deployment_target`: at least `ct.target.iOS18` (states, SDPA, modern compression); use your app's minimum OS (`ct.target.iOS26` for a 26+ app). The iOS 26 row (int8 inputs/outputs) needs `iOS26`.

## Part 10 — Conversion Pass Pipelines

| `pass_pipeline=` | Use |
|---|---|
| default (`ct.PassPipeline.DEFAULT`) | normal conversion |
| `ct.PassPipeline.DEFAULT_PALETTIZATION` | source model already has palettized weights → emit compressed format |
| `ct.PassPipeline.DEFAULT_PRUNING` | source model has sparse weights → emit sparse format |
| `ct.PassPipeline.CLEANUP` | cleanup passes only (const elimination, dead code) |
| `ct.PassPipeline.EMPTY` | no graph passes |
| `ct.PassPipeline()` + `.remove_passes({"common::fuse_conv_batchnorm"})` / `.set_options("common::const_elimination", {"skip_const_by_size": "1e6"})` | custom |

## Resources

**WWDC**: 2023-10049, 2024-10161, 2024-10159

**Docs**: /coreml/mlmodel, /coreml/mlmodelconfiguration, /coreml/mlmodelasset, /coreml/mlstate, /coreml/mltensor, /coreml/mlcomputedevice, /coreml/mlsendablefeaturevalue, /coreml/mlpredictionoptions

**Skills**: coreml-deployment, coreml-conversion, coreml-compression, core-ai
