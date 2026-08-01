import Foundation

// Compacts a MetricKit callStackTree (JSON dictionary) into crash-report-style lines
// for the attributed thread only: "#00 binaryName +0xOFFSET (binaryUUID)". The
// offset/UUID pair is the symbolication key against the build's dSYMs. Frames are
// emitted in MetricKit's root-first order — for crash diagnostics the root frame is
// the faulting one. Pure Foundation so it is verifiable via the standalone script in
// scripts/CallStackCompactorTest.swift.
enum CallStackCompactor {
  private static let maxFrames = 128

  static func attributedStack(tree: [String: Any]) -> String? {
    guard let stacks = tree["callStacks"] as? [[String: Any]], !stacks.isEmpty else {
      return nil
    }
    // Crash payloads flag the crashed thread; hang payloads may carry a single
    // unflagged stack, so fall back to the first one.
    let stack = stacks.first { ($0["threadAttributed"] as? Bool) == true } ?? stacks[0]
    guard let roots = stack["callStackRootFrames"] as? [[String: Any]], !roots.isEmpty else {
      return nil
    }

    var lines: [String] = []
    var pending = roots
    while !pending.isEmpty && lines.count < maxFrames {
      let frame = pending.removeFirst()
      lines.append(format(frame: frame, index: lines.count))
      if let subFrames = frame["subFrames"] as? [[String: Any]] {
        pending.insert(contentsOf: subFrames, at: 0)
      }
    }
    if lines.isEmpty { return nil }

    return (["attributed stack (\(stacks.count) threads):"] + lines).joined(separator: "\n")
  }

  private static func format(frame: [String: Any], index: Int) -> String {
    let name = frame["binaryName"] as? String ?? "<unknown>"
    let offset = (frame["offsetIntoBinaryTextSegment"] as? NSNumber)?.int64Value ?? 0
    let uuid = frame["binaryUUID"] as? String ?? "?"
    return String(format: "#%02d %@ +0x%llx (%@)", index, name, offset, uuid)
  }
}
