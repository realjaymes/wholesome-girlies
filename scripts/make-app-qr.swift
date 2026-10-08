// Makes assets/img/qr/app.svg, the QR code on /app/ for visitors on a computer. Uses the QR generator built into
// macOS (CoreImage), so it needs no npm package, then reads the code back with the macOS QR reader to prove it scans.
//   swift scripts/make-app-qr.swift      (run from the repo root)
import CoreImage
import AppKit
import Foundation

let url = "https://wholesomegirlies.xyz/app/?ref=qr"
let out = FileManager.default.currentDirectoryPath + "/assets/img/qr/app.svg"

let f = CIFilter(name: "CIQRCodeGenerator")!
f.setValue(url.data(using: .utf8), forKey: "inputMessage")
f.setValue("M", forKey: "inputCorrectionLevel")
let img = f.outputImage!
let cg = CIContext().createCGImage(img, from: img.extent)!
let data = CFDataGetBytePtr(cg.dataProvider!.data)!
let bpr = cg.bytesPerRow, bpp = cg.bitsPerPixel / 8, n = cg.width, m = 2, size = n + 2 * m
var path = ""
for y in 0..<cg.height { for x in 0..<n where data[y * bpr + x * bpp] < 128 { path += "M\(x + m) \(y + m)h1v1h-1z" } }
let svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 \(size) \(size)\" shape-rendering=\"crispEdges\"><rect width=\"\(size)\" height=\"\(size)\" fill=\"#FFFFFF\"/><path fill=\"#33322A\" d=\"\(path)\"/></svg>\n"
try! svg.write(toFile: out, atomically: true, encoding: .utf8)

var r = NSRect(origin: .zero, size: NSSize(width: 600, height: 600))
let check = NSImage(contentsOfFile: out)!.cgImage(forProposedRect: &r, context: nil, hints: nil)!
let read = CIDetector(ofType: CIDetectorTypeQRCode, context: nil, options: nil)!.features(in: CIImage(cgImage: check)).compactMap { ($0 as? CIQRCodeFeature)?.messageString }
print(read == [url] ? "app.svg scans as \(url)" : "QR check failed: \(read)")
