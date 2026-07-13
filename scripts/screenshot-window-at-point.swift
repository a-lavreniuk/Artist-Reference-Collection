import Cocoa
import CoreGraphics
import Foundation

guard CommandLine.arguments.count >= 3,
      let x = Double(CommandLine.arguments[1]),
      let y = Double(CommandLine.arguments[2]) else {
  fputs("null\n", stderr)
  exit(1)
}

let point = CGPoint(x: x, y: y)
let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
guard let infoList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
  print("null")
  exit(0)
}

func screenMaxY() -> CGFloat {
  NSScreen.screens.map { $0.frame.maxY }.max() ?? 0
}

func rectFromWindowInfo(_ info: [String: Any]) -> CGRect? {
  guard let bounds = info[kCGWindowBounds as String] as? [String: Any],
        let bx = bounds["X"] as? CGFloat,
        let by = bounds["Y"] as? CGFloat,
        let bw = bounds["Width"] as? CGFloat,
        let bh = bounds["Height"] as? CGFloat else {
    return nil
  }
  let maxY = screenMaxY()
  let top = maxY - by - bh
  return CGRect(x: bx, y: top, width: bw, height: bh)
}

func isOnScreen(_ info: [String: Any]) -> Bool {
  if let onScreen = info[kCGWindowIsOnscreen as String] as? Int, onScreen == 0 { return false }
  if let alpha = info[kCGWindowAlpha as String] as? Double, alpha < 0.05 { return false }
  let layer = info[kCGWindowLayer as String] as? Int ?? 0
  if layer < 0 { return false }
  return true
}

func isExcluded(title: String, owner: String) -> Bool {
  let t = title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
  let o = owner.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
  if t.isEmpty && o.isEmpty { return true }
  if t.contains("arc screenshot area picker") { return true }
  if t.contains("arc screenshot window picker") { return true }
  if t.contains("artist reference collection") { return true }
  if o == "electron" && t.contains("arc") { return true }
  return false
}

var match: [String: Any]?

for info in infoList {
  guard isOnScreen(info), let rect = rectFromWindowInfo(info) else { continue }
  guard rect.width >= 8, rect.height >= 8 else { continue }
  guard rect.contains(point) else { continue }

  let title = (info[kCGWindowName as String] as? String) ?? ""
  let owner = (info[kCGWindowOwnerName as String] as? String) ?? ""
  if isExcluded(title: title, owner: owner) { continue }

  match = info
  break
}

guard let picked = match, let rect = rectFromWindowInfo(picked) else {
  print("null")
  exit(0)
}

let title = (picked[kCGWindowName as String] as? String) ?? ""
let owner = (picked[kCGWindowOwnerName as String] as? String) ?? ""
let nativeId = picked[kCGWindowNumber as String] as? Int ?? 0

let payload: [String: Any] = [
  "title": title,
  "owner": owner,
  "nativeId": nativeId,
  "x": rect.origin.x,
  "y": rect.origin.y,
  "width": rect.width,
  "height": rect.height
]

if let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
   let json = String(data: data, encoding: .utf8) {
  print(json)
} else {
  print("null")
}
