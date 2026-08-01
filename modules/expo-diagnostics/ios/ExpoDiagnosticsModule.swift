import ExpoModulesCore
import MetricKit

// MetricKit subscriber must inherit NSObject (MXMetricManagerSubscriber refines NSObjectProtocol),
// so it lives in its own NSObject class rather than on the Expo Module (a plain Swift class).
// Persists diagnostic payloads to disk as they arrive (delivery can happen with no JS context
// alive). Peek/ack protocol: drain() parses inbox files without deleting them; JS calls ack()
// with the entries' tokens once the log write is durable, and only then are files removed —
// a crash in between replays the payloads instead of losing them. Unreadable or oversized
// files are quarantined (renamed .bad), never silently destroyed.
final class DiagnosticsInbox: NSObject, MXMetricManagerSubscriber {
  private let inboxName = "diagnostics-inbox"
  private let detailCap = 64 * 1024
  private let maxFileBytes = 4 * 1024 * 1024
  private let maxFilesPerDrain = 32

  func start() {
    MXMetricManager.shared.add(self)
  }

  func stop() {
    MXMetricManager.shared.remove(self)
  }

  private func inboxURL() -> URL? {
    guard let support = FileManager.default.urls(
      for: .applicationSupportDirectory, in: .userDomainMask
    ).first else { return nil }
    let dir = support.appendingPathComponent(inboxName, isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }

  // MARK: MXMetricManagerSubscriber

  func didReceive(_ payloads: [MXDiagnosticPayload]) {
    guard let dir = inboxURL() else { return }
    for payload in payloads {
      let name = "\(UUID().uuidString).json"
      let url = dir.appendingPathComponent(name)
      // Atomic so a concurrent drain can never observe (and quarantine) a half-written file.
      try? payload.jsonRepresentation().write(to: url, options: [.atomic])
    }
  }

  // MetricKit also delivers metric payloads to this subscriber; ignore them (no telemetry).
  func didReceive(_ payloads: [MXMetricPayload]) {}

  // MARK: Drain / ack

  func drain() -> [[String: Any]] {
    guard let dir = inboxURL() else { return [] }
    let fm = FileManager.default
    guard let files = try? fm.contentsOfDirectory(
      at: dir, includingPropertiesForKeys: [.fileSizeKey]
    ) else { return [] }

    var out: [[String: Any]] = []
    let jsonFiles = files.filter { $0.pathExtension == "json" }.sorted {
      $0.lastPathComponent < $1.lastPathComponent
    }
    for file in jsonFiles.prefix(maxFilesPerDrain) {
      let size = (try? file.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0
      guard size <= maxFileBytes, let data = try? Data(contentsOf: file) else {
        quarantine(file)
        continue
      }
      let entries = self.parse(data: data, token: file.deletingPathExtension().lastPathComponent)
      if entries.isEmpty {
        quarantine(file)
      } else {
        out.append(contentsOf: entries)
      }
    }
    return out
  }

  // Delete the files whose entries JS has durably persisted. Tokens are inbox file stems.
  func ack(_ tokens: [String]) {
    guard let dir = inboxURL() else { return }
    let fm = FileManager.default
    for token in tokens {
      // Tokens round-trip through JS; refuse anything that could escape the inbox dir.
      guard !token.isEmpty, !token.contains("/"), !token.contains(".") else { continue }
      try? fm.removeItem(at: dir.appendingPathComponent(token).appendingPathExtension("json"))
    }
  }

  // Keep undecodable payloads on disk for later inspection instead of deleting them;
  // the .bad extension takes them out of every future drain.
  private func quarantine(_ file: URL) {
    let dest = file.deletingPathExtension().appendingPathExtension("bad")
    try? FileManager.default.moveItem(at: file, to: dest)
  }

  // MXDiagnosticPayload.jsonRepresentation() is an array-of-diagnostics envelope; we key
  // off the presence of crash/hang diagnostic arrays to classify.
  private func parse(data: Data, token: String) -> [[String: Any]] {
    guard
      let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return [] }

    // Prefer the payload's own event time; fall back to drain time only if it's absent.
    let now = self.eventTimestamp(root: root) ?? Date().timeIntervalSince1970 * 1000
    var entries: [[String: Any]] = []

    let crashDiags = (root["crashDiagnostics"] as? [[String: Any]]) ?? []
    for (i, d) in crashDiags.enumerated() {
      entries.append(self.entry(kind: "crash", now: now, diag: d, token: token, index: i))
    }
    let hangDiags = (root["hangDiagnostics"] as? [[String: Any]]) ?? []
    for (i, d) in hangDiags.enumerated() {
      entries.append(self.entry(kind: "hang", now: now, diag: d, token: token, index: i))
    }

    // Fallback: unknown/other diagnostic shapes still surface as a single "other".
    if entries.isEmpty {
      entries.append([
        "id": "\(token)#other",
        "kind": "other",
        "timestamp": now,
        "summary": "MetricKit diagnostic",
        "detail": self.truncated(String(data: data, encoding: .utf8) ?? ""),
        "ackToken": token,
      ])
    }
    return entries
  }

  private func entry(
    kind: String, now: Double, diag: [String: Any], token: String, index: Int
  ) -> [String: Any] {
    let meta = (diag["diagnosticMetaData"] as? [String: Any]) ?? [:]
    let exceptionType = meta["exceptionType"] ?? ""
    let exceptionCode = meta["exceptionCode"] ?? ""
    let signal = meta["signal"] ?? ""
    let termination = meta["terminationReason"] as? String ?? ""
    let appVersion = meta["appVersion"] as? String ?? ""
    let osVersion = meta["osVersion"] as? String ?? ""
    var summary: String
    if kind == "crash" {
      summary = "crash exc=\(exceptionType)/\(exceptionCode) sig=\(signal) \(termination) v\(appVersion)"
      if let reason = meta["objectiveCexceptionReason"] as? [String: Any],
         let composed = reason["composedMessage"] as? String {
        summary += " reason=\(composed.prefix(200))"
      }
    } else {
      summary = "hang v\(appVersion)"
      if let duration = meta["hangDuration"] as? [String: Any],
         let value = duration["value"], let unit = duration["unitDuration"] as? String {
        summary = "hang \(value)\(unit) v\(appVersion)"
      }
    }
    if !osVersion.isEmpty { summary += " os=\(osVersion)" }

    // Compact attributed-thread stack first, then the FULL diagnostic JSON (metadata,
    // virtual-memory info, every thread) — the cap can only ever truncate the raw tail,
    // never the crashed thread.
    var parts: [String] = []
    if let tree = diag["callStackTree"] as? [String: Any],
       let compact = CallStackCompactor.attributedStack(tree: tree) {
      parts.append(compact)
    }
    if let diagData = try? JSONSerialization.data(withJSONObject: diag),
       let diagStr = String(data: diagData, encoding: .utf8) {
      parts.append(diagStr)
    }

    return [
      "id": "\(token)#\(kind)\(index)",
      "kind": kind,
      "timestamp": now,
      "summary": summary,
      "detail": self.truncated(parts.joined(separator: "\n")),
      "ackToken": token,
    ]
  }

  private func truncated(_ s: String) -> String {
    let bytes = Array(s.utf8)
    if bytes.count <= detailCap { return s }
    let marker = "\n…[truncated]"
    let keep = detailCap - marker.utf8.count
    return String(decoding: bytes.prefix(keep), as: UTF8.self) + marker
  }

  // MetricKit stamps payloads with timeStampBegin/End; End is the closest available
  // proxy for the event time (it is the reporting-period endpoint, not the incident
  // instant). Observed payloads use "2021-06-07 15:59:00 +0000" rather than RFC 3339,
  // so that format is tried alongside ISO 8601.
  private func eventTimestamp(root: [String: Any]) -> Double? {
    guard let s = root["timeStampEnd"] as? String else { return nil }
    let withFraction = ISO8601DateFormatter()
    withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let d = withFraction.date(from: s) { return d.timeIntervalSince1970 * 1000 }
    if let d = ISO8601DateFormatter().date(from: s) { return d.timeIntervalSince1970 * 1000 }
    let metricKit = DateFormatter()
    metricKit.locale = Locale(identifier: "en_US_POSIX")
    metricKit.dateFormat = "yyyy-MM-dd HH:mm:ss Z"
    if let d = metricKit.date(from: s) { return d.timeIntervalSince1970 * 1000 }
    return nil
  }
}

public final class ExpoDiagnosticsModule: Module {
  private let inbox = DiagnosticsInbox()

  public func definition() -> ModuleDefinition {
    Name("ExpoDiagnostics")

    OnCreate {
      self.inbox.start()
    }

    OnDestroy {
      self.inbox.stop()
    }

    AsyncFunction("drain") { () -> [[String: Any]] in
      self.inbox.drain()
    }

    AsyncFunction("ack") { (tokens: [String]) in
      self.inbox.ack(tokens)
    }

    // Force a fatal out-of-bounds trap; MetricKit records an MXCrashDiagnostic next launch.
    Function("testNativeCrash") {
      let empty: [Int] = []
      _ = empty[1]
    }

    // Block the main thread past MetricKit's hang threshold to record an MXHangDiagnostic.
    Function("testHang") {
      DispatchQueue.main.sync {
        Thread.sleep(forTimeInterval: 8.0)
      }
    }
  }
}
