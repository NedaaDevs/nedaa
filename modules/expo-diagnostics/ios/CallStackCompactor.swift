import Foundation

// Compacts a MetricKit callStackTree (JSON dictionary) into crash-report-style lines
// for the attributed thread only: "#00 binaryName +0xOFFSET (binaryUUID)". The
// offset/UUID pair is the symbolication key against the build's dSYMs. Frames are
// emitted in MetricKit's root-first order — for crash diagnostics the root frame is
// the faulting one. Pure Foundation so it is verifiable via the standalone script in
// scripts/CallStackCompactorTest.swift.
enum CallStackCompactor {
  private static let maxFrames = 128
  // Walk bound past maxFrames — lets the truncation marker report how many frames were
  // cut without formatting them, while still terminating on pathological trees.
  private static let walkLimit = 4096

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
    var total = 0
    var pending = roots
    while !pending.isEmpty && total < walkLimit {
      let frame = pending.removeFirst()
      total += 1
      if lines.count < maxFrames {
        lines.append(format(frame: frame, index: lines.count))
      }
      if let subFrames = frame["subFrames"] as? [[String: Any]] {
        pending.insert(contentsOf: subFrames, at: 0)
      }
    }
    if lines.isEmpty { return nil }
    if total > lines.count {
      lines.append("  … [+\(total - lines.count)\(pending.isEmpty ? "" : "+") more frames]")
    }

    return (["attributed stack (\(stacks.count) threads):"] + lines).joined(separator: "\n")
  }

  private static func format(frame: [String: Any], index: Int) -> String {
    let name = frame["binaryName"] as? String ?? "<unknown>"
    let offset = (frame["offsetIntoBinaryTextSegment"] as? NSNumber)?.int64Value ?? 0
    let uuid = frame["binaryUUID"] as? String ?? "?"
    return String(format: "#%02d %@ +0x%llx (%@)", index, name, offset, uuid)
  }
}
