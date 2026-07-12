import ExpoModulesCore
import MetricKit

// Persists MetricKit diagnostic payloads to disk as they arrive (delivery can happen
// with no JS context alive), then hands them to JS on drain() and deletes them.
public final class ExpoDiagnosticsModule: Module, MXMetricManagerSubscriber {
  private let inboxName = "diagnostics-inbox"
  private let detailCap = 64 * 1024

  public func definition() -> ModuleDefinition {
    Name("ExpoDiagnostics")

    OnCreate {
      MXMetricManager.shared.add(self)
    }

    OnDestroy {
      MXMetricManager.shared.remove(self)
    }

    AsyncFunction("drain") { () -> [[String: Any]] in
      self.drainInbox()
    }
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

  public func didReceive(_ payloads: [MXDiagnosticPayload]) {
    guard let dir = inboxURL() else { return }
    for payload in payloads {
      let name = "\(UUID().uuidString).json"
      let url = dir.appendingPathComponent(name)
      try? payload.jsonRepresentation().write(to: url)
    }
  }

  // MetricKit also delivers metric payloads to this subscriber; ignore them (no telemetry).
  public func didReceive(_ payloads: [MXMetricPayload]) {}

  // MARK: Drain

  private func drainInbox() -> [[String: Any]] {
    guard let dir = inboxURL() else { return [] }
    let fm = FileManager.default
    guard let files = try? fm.contentsOfDirectory(
      at: dir, includingPropertiesForKeys: nil
    ) else { return [] }

    var out: [[String: Any]] = []
    for file in files where file.pathExtension == "json" {
      if let data = try? Data(contentsOf: file) {
        out.append(contentsOf: self.parse(data: data))
      }
      try? fm.removeItem(at: file)
    }
    return out
  }

  // MXDiagnosticPayload.jsonRepresentation() is an array-of-diagnostics envelope; we key
  // off the presence of crash/hang diagnostic arrays to classify.
  private func parse(data: Data) -> [[String: Any]] {
    guard
      let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return [] }

    let now = Date().timeIntervalSince1970 * 1000
    var entries: [[String: Any]] = []

    let crashDiags = (root["crashDiagnostics"] as? [[String: Any]]) ?? []
    for d in crashDiags {
      entries.append(self.entry(kind: "crash", now: now, diag: d))
    }
    let hangDiags = (root["hangDiagnostics"] as? [[String: Any]]) ?? []
    for d in hangDiags {
      entries.append(self.entry(kind: "hang", now: now, diag: d))
    }

    // Fallback: unknown/other diagnostic shapes still surface as a single "other".
    if entries.isEmpty {
      entries.append([
        "id": UUID().uuidString,
        "kind": "other",
        "timestamp": now,
        "summary": "MetricKit diagnostic",
        "detail": self.truncated(String(data: data, encoding: .utf8) ?? ""),
      ])
    }
    return entries
  }

  private func entry(kind: String, now: Double, diag: [String: Any]) -> [String: Any] {
    let meta = (diag["diagnosticMetaData"] as? [String: Any]) ?? [:]
    let exceptionType = meta["exceptionType"] ?? ""
    let exceptionCode = meta["exceptionCode"] ?? ""
    let signal = meta["signal"] ?? ""
    let termination = meta["terminationReason"] as? String ?? ""
    let appVersion = meta["appVersion"] as? String ?? ""
    let summary =
      kind == "crash"
      ? "crash exc=\(exceptionType)/\(exceptionCode) sig=\(signal) \(termination) v\(appVersion)"
      : "hang v\(appVersion)"

    var detail = ""
    if let tree = diag["callStackTree"],
       let treeData = try? JSONSerialization.data(withJSONObject: tree),
       let treeStr = String(data: treeData, encoding: .utf8) {
      detail = self.truncated(treeStr)
    }

    return [
      "id": UUID().uuidString,
      "kind": kind,
      "timestamp": now,
      "summary": summary,
      "detail": detail,
    ]
  }

  private func truncated(_ s: String) -> String {
    if s.utf8.count <= detailCap { return s }
    return String(s.prefix(detailCap / 2)) + "\n…[truncated]"
  }
}
