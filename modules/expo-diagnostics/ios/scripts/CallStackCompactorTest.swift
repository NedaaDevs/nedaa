import Foundation

// Standalone verification for CallStackCompactor (no XCTest target in this module).
// Run: swiftc ../CallStackCompactor.swift CallStackCompactorTest.swift -o /tmp/callstack-test && /tmp/callstack-test

var failures = 0

func check(_ name: String, _ condition: Bool, _ context: String = "") {
  if condition {
    print("PASS \(name)")
  } else {
    failures += 1
    print("FAIL \(name)\(context.isEmpty ? "" : " — \(context)")")
  }
}

func tree(from json: String) -> [String: Any] {
  guard
    let data = json.data(using: .utf8),
    let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
  else { fatalError("bad test JSON") }
  return obj
}

// Shape mirrors a real MXCrashDiagnostic callStackTree: per-thread stacks, the
// attributed thread NOT first, frames chained through subFrames root-first
// (root = faulting frame for crashes).
let crashTree = tree(from: """
{
  "callStackPerThread": true,
  "callStacks": [
    {
      "threadAttributed": false,
      "callStackRootFrames": [
        {
          "binaryName": "libsystem_pthread.dylib",
          "binaryUUID": "BYSTANDER-UUID",
          "offsetIntoBinaryTextSegment": 4096,
          "address": 7954891776
        }
      ]
    },
    {
      "threadAttributed": true,
      "callStackRootFrames": [
        {
          "binaryName": "nedaa",
          "binaryUUID": "AAAA-BBBB-CCCC",
          "offsetIntoBinaryTextSegment": 90556468,
          "address": 4370746420,
          "subFrames": [
            {
              "binaryName": "hermes",
              "binaryUUID": "DDDD-EEEE-FFFF",
              "offsetIntoBinaryTextSegment": 1052672,
              "address": 4500000000,
              "subFrames": [
                {
                  "binaryUUID": "MISSING-NAME-UUID",
                  "offsetIntoBinaryTextSegment": 255,
                  "address": 4600000000
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
""")

@main
struct CallStackCompactorTest {
  static func main() {
    let compact = CallStackCompactor.attributedStack(tree: crashTree)
    check("crash: parses", compact != nil)
    let text = compact ?? ""
    check("crash: header has thread count", text.contains("attributed stack (2 threads)"), text)
    check("crash: root frame first", text.contains("#00 nedaa +0x565c834 (AAAA-BBBB-CCCC)"), text)
    check("crash: subframe chain", text.contains("#01 hermes +0x101000 (DDDD-EEEE-FFFF)"), text)
    check("crash: missing binaryName", text.contains("#02 <unknown> +0xff (MISSING-NAME-UUID)"), text)
    check("crash: bystander thread excluded", !text.contains("libsystem_pthread"), text)

// Hang-style tree: single stack, no threadAttributed flag — falls back to first stack.
let hangTree = tree(from: """
{
  "callStackPerThread": false,
  "callStacks": [
    {
      "callStackRootFrames": [
        {
          "binaryName": "nedaa",
          "binaryUUID": "HANG-UUID",
          "offsetIntoBinaryTextSegment": 16,
          "address": 1
        }
      ]
    }
  ]
}
""")
    let hang = CallStackCompactor.attributedStack(tree: hangTree)
    check("hang: falls back to first stack", (hang ?? "").contains("#00 nedaa +0x10 (HANG-UUID)"), hang ?? "")

    // Degenerate inputs return nil, never crash.
    check("empty tree: nil", CallStackCompactor.attributedStack(tree: [:]) == nil)
    check("empty stacks: nil", CallStackCompactor.attributedStack(tree: ["callStacks": [] as [Any]]) == nil)
    check(
      "stack without frames: nil",
      CallStackCompactor.attributedStack(tree: ["callStacks": [["threadAttributed": true]] as [Any]]) == nil
    )

    // Runaway subFrames chain is capped, not unbounded.
    var deep: [String: Any] = ["binaryName": "leaf", "binaryUUID": "U", "offsetIntoBinaryTextSegment": 1]
    for _ in 0..<300 {
      deep = ["binaryName": "n", "binaryUUID": "U", "offsetIntoBinaryTextSegment": 1, "subFrames": [deep]]
    }
    let deepTree: [String: Any] = ["callStacks": [["threadAttributed": true, "callStackRootFrames": [deep]]] as [Any]]
    let capped = CallStackCompactor.attributedStack(tree: deepTree) ?? ""
    check("deep chain: capped at 128 frames", capped.contains("#127") && !capped.contains("#128"), "")
    check("deep chain: truncation marker", capped.contains("… [+173 more frames]"), String(capped.suffix(80)))

    print(failures == 0 ? "ALL TESTS PASSED" : "\(failures) TEST(S) FAILED")
    exit(failures == 0 ? 0 : 1)
  }
}
