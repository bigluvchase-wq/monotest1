import AVFoundation
import Speech

final class SpeechBridge {
    private final class Session {
        let id: String
        let engine = AVAudioEngine()
        let request = SFSpeechAudioBufferRecognitionRequest()
        var task: SFSpeechRecognitionTask?
        var hasTap = false
        var stopping = false
        var audioActive = false
        var latest = ""
        var deadline: DispatchWorkItem?
        init(id: String) { self.id = id }
    }

    private var current: Session?
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "ru-RU"))
    private let emit: (String, String, [String: String]) -> Void
    init(emit: @escaping (String, String, [String: String]) -> Void) { self.emit = emit }

    func start(_ id: String) {
        if let current { finish(current) }
        let session = Session(id: id)
        current = session
        SFSpeechRecognizer.requestAuthorization { [weak self, weak session] status in
            DispatchQueue.main.async {
                guard let self, let session, self.current === session else { return }
                guard status == .authorized else {
                    self.fail(session, "not-allowed", "Разрешите распознавание речи в настройках iPhone.")
                    return
                }
                AVAudioSession.sharedInstance().requestRecordPermission { [weak self, weak session] allowed in
                    DispatchQueue.main.async {
                        guard let self, let session, self.current === session else { return }
                        if allowed { self.begin(session) }
                        else { self.fail(session, "not-allowed", "Разрешите доступ к микрофону в настройках iPhone.") }
                    }
                }
            }
        }
    }

    private func begin(_ session: Session) {
        guard let recognizer, recognizer.isAvailable else {
            fail(session, "service-not-allowed", "Системное распознавание речи недоступно.")
            return
        }
        do {
            let audio = AVAudioSession.sharedInstance()
            try audio.setCategory(.record, mode: .measurement)
            try audio.setActive(true)
            session.audioActive = true
            let input = session.engine.inputNode
            let format = input.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else {
                fail(session, "audio-capture", "Вход микрофона недоступен.")
                return
            }

            let request = session.request
            request.shouldReportPartialResults = true
            request.taskHint = .dictation
            // Prefer on-device recognition when iOS offers it for Russian.
            request.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
                request.append(buffer)
            }
            session.hasTap = true
            session.task = recognizer.recognitionTask(with: request) { [weak self, weak session] result, error in
                DispatchQueue.main.async {
                    guard let self, let session, self.current === session else { return }
                    if let result {
                        let text = result.bestTranscription.formattedString
                        if !text.isEmpty { session.latest = text }
                        self.emit(session.id, "result", ["text": session.latest])
                        if result.isFinal { self.finish(session); return }
                    }
                    if let error {
                        let native = error as NSError
                        if !session.latest.isEmpty || session.stopping || native.code == 1110 {
                            self.finish(session)
                        } else {
                            self.fail(session, "speech-error", error.localizedDescription)
                        }
                    }
                }
            }
            session.engine.prepare()
            try session.engine.start()
            emit(session.id, "start", [:])
        } catch {
            fail(session, "audio-capture", error.localizedDescription)
        }
    }

    func stop(_ id: String) {
        guard let session = current, session.id == id, !session.stopping else { return }
        guard session.task != nil else { finish(session); return }
        session.stopping = true
        stopAudio(session)
        session.request.endAudio()
        let deadline = DispatchWorkItem { [weak self, weak session] in
            guard let self, let session else { return }
            self.finish(session)
        }
        session.deadline = deadline
        DispatchQueue.main.asyncAfter(deadline: .now() + 3, execute: deadline)
    }

    func cancel(_ id: String? = nil) {
        guard let session = current, id == nil || session.id == id else { return }
        finish(session)
    }

    private func stopAudio(_ session: Session) {
        session.engine.stop()
        if session.hasTap {
            session.engine.inputNode.removeTap(onBus: 0)
            session.hasTap = false
        }
    }

    private func fail(_ session: Session, _ code: String, _ detail: String) {
        emit(session.id, "error", ["code": code, "detail": detail])
        finish(session)
    }

    private func finish(_ session: Session) {
        guard current === session else { return }
        current = nil
        session.deadline?.cancel()
        stopAudio(session)
        session.task?.cancel()
        if session.audioActive {
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
        emit(session.id, "end", [:])
    }
}
