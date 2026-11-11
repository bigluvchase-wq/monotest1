# Core ML Deployment

Running a converted Core ML model in an app: asset handling, load/cache/pre-warm, compute units, Swift 6 prediction shapes, stateful KV-cache, multifunction adapters, `MLTensor` stitching.

Scope: produce → `coreml-conversion.md`; shrink → `coreml-compression.md`; train/personalize → `coreml-training.md`; LLM-scale on the 27 runtime → `core-ai.md`; Apple's built-in LLM → `foundation-models.md`; signatures/availability → `coreml-ref.md`.

Versions are iOS; same APIs on macOS/tvOS/watchOS/visionOS at the matching release unless noted. At a 26/27 deployment target every iOS ≤18 API here is unconditional — no `#available`.

## Red Flags

- `MLModel` built at launch, in an `init`, or with `try!` on the main actor
- New `MLModel` per prediction
- `await model.prediction(...)` on a model stored in an actor or `@MainActor` type → Swift 6 error `sending 'self.model' risks causing data races`
- `@unchecked Sendable` / `nonisolated(unsafe)` / `@preconcurrency import CoreML` to share one `MLModel` across child tasks
- KV-cache passed as model inputs/outputs on an iOS 18+ target
- One `MLState` shared by two conversations, or two in-flight predictions on one state
- N copies of a base model differing only by adapter
- `computeUnits` changed before profiling
- Neural Engine inference expected to continue after backgrounding

## Model Asset

| You have | Build time | Run time |
|---|---|---|
| `.mlpackage`/`.mlmodel` in the target | Xcode → `.mlmodelc` in bundle + generated class | load bundled `.mlmodelc` or generated class |
| Downloaded after install | — | `MLModel.compileModel(at:)` (iOS 16+, not watchOS) → move out of temp dir |
| Large, opt-in feature | don't bundle | Background Assets → `axiom-integration (skills/background-assets.md)` |

`compileModel(at:)` output is temporary → move to Application Support, compile once (not per launch); re-downloadable → exclude from backup (Apple: *Downloading and compiling a model on the user's device*).

```swift
import CoreML
import Foundation

@concurrent
func installDownloadedModel(at sourceURL: URL, named name: String) async throws -> URL {
    let compiledURL = try await MLModel.compileModel(at: sourceURL)
    let fileManager = FileManager.default
    try fileManager.createDirectory(at: .applicationSupportDirectory, withIntermediateDirectories: true)

    var destination = URL.applicationSupportDirectory.appending(path: "\(name).mlmodelc")
    if fileManager.fileExists(atPath: destination.path(percentEncoded: false)) {
        _ = try fileManager.replaceItemAt(destination, withItemAt: compiledURL)
    } else {
        try fileManager.moveItem(at: compiledURL, to: destination)
    }

    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    try destination.setResourceValues(values)
    return destination
}
```

## Load, Cache, Pre-Warm

First load per (compiled-model **path**, configuration, device) → **device specialization** (parse, optimize, segment across compute units, compile segments) → cached on disk, persists across launches and reboots → later loads fast. Cache deleted on low disk space, system update, or compiled model deleted/modified → first launch after every OS update pays again (WWDC 2023-10049). New path or new configuration each launch → never cached.

- Never load at launch on the UI thread → async `MLModel.load(contentsOf:configuration:)` or lazy
- Keep loaded across a run of predictions; never reload per prediction
- Unload if unused for a while — cache makes reload cheaper
- Pre-warm before the user reaches the feature (screen appears, after onboarding)
- Verify with the Core ML instrument (`--instrument 'Core ML'`; Xcode 27.1 has no Core ML template), ML Program load labels: `Load (prepare and cache)` = uncached, `Load (cached)` = cache hit; plain `Load` = not an ML Program
- Shape-change and latency tuning: `optimizationHints` → `coreml-ref.md` Part 1

## Predictions Under Swift 6

- Not Sendable: `MLModel`, `MLModelConfiguration`, `MLFeatureProvider`. Sendable: `MLState`, `MLTensor`, `MLShapedArray`, `MLSendableFeatureValue`, `CGImage`. `CVPixelBuffer` → conformance explicitly unavailable.
- Apple `MLModel` docs: one instance on one thread at a time → serialize, or separate instance per thread. Sync API not thread-safe; Apple calls async `prediction(from:)` (iOS 17+) thread-safe (WWDC 2023-10049) — SDK annotations hide that from the compiler.
- Async `prediction(from:)` is nonisolated → awaiting it on an actor- or `@MainActor`-owned model sends the model across isolation → rejected. Fix = one of the shapes below, never an escape hatch.

| Situation | Shape |
|---|---|
| Default: model lives for the app's lifetime | actor owns model, **synchronous** predictions |
| Throughput, after profiling shows concurrency pays | lanes: N actors, each with its own `MLModel` |
| Finite job (batch import); wants async API, cancellation, or `MLTensor` prediction | `@concurrent` function loads and owns the model for the job |

### Default — actor owns the model

Serializes predictions (satisfies one-thread rule), off the main actor; Sendable values cross the boundary.

```swift
import CoreML
import CoreGraphics

enum ClassifierError: Error {
    case missingImageInput
}

actor ImageClassifier {
    private let model: MLModel
    private let imageConstraint: MLImageConstraint

    init(compiledModelURL: URL) async throws {
        let configuration = MLModelConfiguration()
        configuration.computeUnits = .all
        let model = try await MLModel.load(contentsOf: compiledModelURL, configuration: configuration)
        guard let constraint = model.modelDescription.inputDescriptionsByName["image"]?.imageConstraint else {
            throw ClassifierError.missingImageInput
        }
        self.model = model
        self.imageConstraint = constraint
    }

    func classify(_ image: CGImage) throws -> String? {
        try Task.checkCancellation()
        let value = try MLFeatureValue(cgImage: image, constraint: imageConstraint, options: nil)
        let input = try MLDictionaryFeatureProvider(dictionary: ["image": value])
        let output = try model.prediction(from: input)
        return output.featureValue(for: "classLabel")?.stringValue
    }
}
```

- UI call: `let label = try await classifier.classify(image)`
- Feature names (`"image"`, `"classLabel"`) = model's own; Xcode model preview lists them
- Sync prediction occupies one cooperative-pool thread for its duration and can't be interrupted → check cancellation first

### Throughput — one instance per lane

WWDC 2023-10049: concurrent async predictions ≈2x throughput for one model; gain depends on the model's ops, compute units/hardware, and other device load; each in-flight prediction holds its own inputs/outputs → profile first. Lane count bounds concurrency and peak memory; each instance holds its own loaded resources → measure with Allocations + Core ML Instrument, keep lanes few.

```swift
import CoreML
import CoreGraphics

@concurrent
func classifyAll(_ images: [CGImage], lanes: [ImageClassifier]) async throws -> [String?] {
    precondition(!lanes.isEmpty, "classifyAll needs at least one lane")
    return try await withThrowingTaskGroup(of: (Int, String?).self) { group in
        for (index, image) in images.enumerated() {
            let lane = lanes[index % lanes.count]
            group.addTask { (index, try await lane.classify(image)) }
        }
        var labels = [String?](repeating: nil, count: images.count)
        for try await (index, label) in group {
            labels[index] = label
        }
        return labels
    }
}
```

Fragment: uses `ImageClassifier` above.

### Job-owned model — async API

Model created inside a `@concurrent` function is in no other isolation domain → async API compiles. Async API "will do its best to respond to cancellation" (WWDC 2023-10049); only path to `[String: MLTensor]` prediction. Load once per job.

```swift
import CoreML

enum EmbeddingError: Error {
    case missingOutput(String)
}

@concurrent
func embedAll(_ inputs: [MLShapedArray<Float>], compiledModelURL: URL) async throws -> [MLShapedArray<Float>] {
    let model = try await MLModel.load(contentsOf: compiledModelURL)
    var embeddings: [MLShapedArray<Float>] = []
    for input in inputs {
        try Task.checkCancellation()
        let outputs = try await model.prediction(from: ["input": MLTensor(input)])
        guard let embedding = outputs["embedding"] else { throw EmbeddingError.missingOutput("embedding") }
        embeddings.append(await embedding.shapedArray(of: Float.self))
    }
    return embeddings
}
```

`[String: MLTensor]` overload (iOS 18+) → every input and output must be a multiarray; image/string features → `MLDictionaryFeatureProvider`.

## Compute Units

- `.all` → Core ML splits across CPU/GPU/Neural Engine. Narrower: `.cpuAndNeuralEngine` (iOS 16+), `.cpuAndGPU`, `.cpuOnly` → pin only when a profile shows a win
- Feature needs the Neural Engine → check `MLModel.availableComputeDevices` (iOS 17+), don't assume (`coreml-ref.md` Part 2)
- Before changing anything → Xcode model Performance report (per-op device, unsupported-op hints) or `MLComputePlan` walk (iOS 17.4+, `coreml-diag.md` First Steps)
- Common finding: op kept off the Neural Engine by data type → fix at conversion (e.g. Float16)

### Background inference `OS27`

Entitlement `com.apple.developer.background-tasks.continued-processing.inference`:
- lets a `BGContinuedProcessingTask` finish critical Neural Engine inference after backgrounding
- required "for any Neural Engine access while your app is in the background, regardless of whether it's running a continued background task"
- covers Core ML, Core AI, Metal Performance Shaders Graph
- docs don't say what happens without it → don't assume CPU fallback
- `BGContinuedProcessingTask` → `axiom-integration (skills/background-processing.md)`

## Stateful Models / KV-Cache (iOS 18+)

Without state: recompute past keys/values, or round-trip the cache as I/O (cost grows with cache size). With state: Core ML-owned buffers updated in place. Mistral-7B, M3 Max: ≈8 s → ≈5 s = 1.6x, "will vary depending on your model and hardware" (WWDC 2024-10161).

Declared at conversion: `register_buffer` + `ct.StateType` → `coreml-conversion.md`. Runtime:
- `model.makeState()` → zero-initialized buffers. Not `newState()` — Apple's doc-comment examples use it; Swift: `'newState()' is unavailable in iOS`
- Same state for every prediction in a sequence; new conversation → new state
- Predictions on one `MLState` must be serialized; no buffer reads/writes while one is in flight (SDK header) → actor owning model + state
- Read/seed a buffer: `state.withMultiArray(for: "keyCache") { … }`; closure-only `withMultiArray(_:)` deprecated

```swift
import CoreML

enum GeneratorError: Error {
    case missingOutput(String)
}

actor TextGenerator {
    private let model: MLModel
    private var state: MLState

    init(compiledModelURL: URL) async throws {
        let model = try await MLModel.load(contentsOf: compiledModelURL)
        self.model = model
        self.state = model.makeState()
    }

    func startNewConversation() {
        state = model.makeState()
    }

    func logits(forNextToken tokenID: Int32) throws -> MLShapedArray<Float> {
        let tokens = MLShapedArray<Int32>(scalars: [tokenID], shape: [1, 1])
        let input = try MLDictionaryFeatureProvider(dictionary: ["inputIds": MLFeatureValue(shapedArray: tokens)])
        let output = try model.prediction(from: input, using: state)
        guard let logits = output.featureValue(for: "logits")?.shapedArrayValue(of: Float.self) else {
            throw GeneratorError.missingOutput("logits")
        }
        return logits
    }
}
```

- Input names/shapes (causal mask, positions) = whatever the conversion declared
- iOS 18+ conversion target → fused scaled-dot-product-attention op, "really shines on Apple Silicon GPUs" (WWDC 2024-10159); set at conversion, not run time
- LLM-scale decode loops on 27 → compare `core-ai.md` first

## Multifunction Models — One Asset, Many Adapters (iOS 18+)

N adapter copies → N× base weights. Merge → one `.mlpackage`, one function per adapter; merge dedupes shared weights by hash (WWDC 2024-10159); functions may differ in I/O. Merge on the Mac after converting each variant; merged spec forced to iOS 18:

```python
import coremltools as ct

desc = ct.utils.MultiFunctionDescriptor()
desc.add_function("Sticker.mlpackage", src_function_name="main", target_function_name="sticker")
desc.add_function("Storybook.mlpackage", src_function_name="main", target_function_name="storybook")
desc.default_function_name = "sticker"
ct.utils.save_multifunction(desc, "Adapters.mlpackage")
```

- `default_function_name` unset → `save_multifunction` raises `ValueError`
- In `ct.utils`, not `ct.models`
- Keyword is `src_function_name`; coremltools 9.0's own docstring writes `source_function_name=` → `TypeError`

App: pick the function at load; one `MLModel` per function; `nil` `functionName` → default function. Check `functionNames` before setting a name (`[]` on a single-function model; unknown name → load throws; `modelDescription(of:)` aborts the process → `coreml-ref.md` Part 1).

```swift
import CoreML

enum AdapterError: Error {
    case unknownFunction(String, available: [String])
}

nonisolated func loadAdapter(named functionName: String, from compiledModelURL: URL) async throws -> MLModel {
    let asset = try MLModelAsset(url: compiledModelURL)
    let available = try await asset.functionNames
    guard available.contains(functionName) else {
        throw AdapterError.unknownFunction(functionName, available: available)
    }
    let configuration = MLModelConfiguration()
    configuration.functionName = functionName
    return try await MLModel.load(asset: asset, configuration: configuration)
}
```

- Returned `MLModel` not Sendable → call from the actor or `@concurrent` job that will own it
- `nonisolated` is required under Xcode's new-project defaults (`-default-isolation MainActor` + `NonisolatedNonsendingByDefault`): unannotated, the function becomes `@MainActor` and every off-main caller fails with `non-Sendable 'MLModel'-typed result can not be returned from main actor-isolated global function…`. Same for any free function returning `MLModel`

## MLTensor Pipeline Stitching (iOS 18+)

For pre/post-processing between models (decode logits, hand outputs to the next model) without `MLMultiArray` loops. Ops dispatch asynchronously → materialize with `await tensor.shapedArray(of:)` before reading scalars. Sendable.

No sampling op: no `multinomial`; `topK` takes unlabeled `k`. → top-k on tensor, sample k probabilities on CPU:

```swift
import CoreML

nonisolated func sampleTopK(logits: MLTensor, k: Int, temperature: Float) async -> Int32 {
    let (values, indices) = logits.topK(k)
    let probabilities = (values / temperature).softmax()
    let p = await probabilities.shapedArray(of: Float.self).scalars
    let ids = await indices.shapedArray(of: Int32.self).scalars
    var threshold = Float.random(in: 0..<1)
    for (i, probability) in p.enumerated() {
        threshold -= probability
        if threshold <= 0 { return ids[i] }
    }
    return ids[ids.count - 1]
}

nonisolated func greedyToken(logits: MLTensor) async -> Int32 {
    await logits.argmax().shapedArray(of: Int32.self).scalars[0]
}
```

- Expects single-position logits `[1, vocab]`; `topK` → last axis, `Int32` indices; `argmax()` flattens
- `nonisolated` → runs on the caller's executor (`nonisolated(nonsending)` under `NonisolatedNonsendingByDefault`); unannotated under `-default-isolation MainActor` → `@MainActor`, so every call from an off-main decode loop hops to the main actor
- Steer device: `withMLTensorComputePolicy(.cpuAndGPU) { … }` (task-local)

## Anti-Patterns

| Pattern | Problem | Instead |
|---|---|---|
| `try! MLModel(contentsOf:)` stored on app/view model | sync main-actor load at launch; uncached load can be slow | `await MLModel.load(...)` in the owning actor, before needed |
| `MLModel(contentsOf:)` inside `predict()` | reload + setup every call | load once, keep |
| `Task.detached { try MLModel(contentsOf: url) }.value` | Swift 6: `type 'MLModel' does not conform to the 'Sendable' protocol` | async `load` inside the owning actor / `@concurrent` job |
| `TaskGroup` children capturing one `MLModel` | Swift 6: `passing closure as a 'sending' parameter risks causing data races…`; Apple: one instance per thread | lanes |
| KV-cache as model I/O | large copies per token | `ct.StateType` + `makeState()` + `prediction(from:using:)` |
| One `MLState` for two conversations | mixed histories; concurrent use undefined | one state per sequence, actor-owned |
| N adapter copies of a base model | N× storage and download | multifunction + `functionName` |
| Flipping `computeUnits` until it feels faster | guesswork; can land on a slower device | Performance report / `MLComputePlan` → Core ML Instrument |
| Compressing before measuring | lossy, gain unknown | profile Float16 baseline first → `coreml-compression.md` |

## Diagnosing Slow Inference → `coreml-diag.md`

Deployment-specific causes: KV-cache fed as I/O or absent → stateful conversion + `makeState()` (LLM-scale → `core-ai.md`); attention model converted below iOS 18 → SDPA not fused → re-convert (`coreml-conversion.md`); unbounded concurrent I/O in a batch → lanes. Everything else (load labels, compute-plan placement, memory, accuracy) → `coreml-diag.md`.

## Checklist

- [ ] Async load, once, off the launch path, kept for runs of predictions
- [ ] Downloaded model compiled once, moved out of temp, excluded from backup
- [ ] Each `MLModel` owned by one actor or one `@concurrent` job; no Sendable escape hatches
- [ ] Concurrency only after profiling; one instance per lane
- [ ] `computeUnits` `.all` unless Performance report / `MLComputePlan` justified pinning
- [ ] KV-cache via Core ML state; one `MLState` per sequence
- [ ] Adapter variants shipped as one multifunction model
- [ ] Load events checked in Core ML Instrument
- [ ] Background Neural Engine work has the inference entitlement (`OS27`)

## Resources

**WWDC**: 2023-10049, 2024-10161, 2024-10159

**Docs**: /coreml/mlmodel, /coreml/mlmodelconfiguration, /coreml/mlstate, /coreml/mltensor, /coreml/mlmodelasset, /coreml/downloading-and-compiling-a-model-on-the-user-s-device, /bundleresources/entitlements/com.apple.developer.background-tasks.continued-processing.inference

**Skills**: coreml-ref, coreml-conversion, coreml-compression, coreml-training, core-ai, axiom-concurrency, axiom-integration (background-assets, background-processing)
