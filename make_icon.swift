import AppKit

// Kullanım: swift make_icon.swift <çıktı_klasörü>
let outDir = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "AppIcon.iconset"
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

func render(_ px: Int) -> Data? {
    let s = CGFloat(px)
    let img = NSImage(size: NSSize(width: s, height: s))
    img.lockFocus()

    let inset = s * 0.05
    let rect = NSRect(x: inset, y: inset, width: s - 2*inset, height: s - 2*inset)
    let path = NSBezierPath(roundedRect: rect, xRadius: s*0.225, yRadius: s*0.225)
    path.addClip()

    let colors = [
        NSColor(srgbRed: 0.996, green: 0.855, blue: 0.459, alpha: 1),
        NSColor(srgbRed: 0.980, green: 0.494, blue: 0.118, alpha: 1),
        NSColor(srgbRed: 0.839, green: 0.161, blue: 0.463, alpha: 1),
        NSColor(srgbRed: 0.588, green: 0.184, blue: 0.749, alpha: 1),
        NSColor(srgbRed: 0.310, green: 0.357, blue: 0.835, alpha: 1),
    ]
    NSGradient(colors: colors)!.draw(in: rect, angle: -45)

    // Beyaz sembol: kişi + onay
    if let sym = NSImage(systemSymbolName: "person.crop.circle.badge.checkmark",
                         accessibilityDescription: nil) {
        let conf = NSImage.SymbolConfiguration(pointSize: s*0.5, weight: .semibold)
        if let sImg = sym.withSymbolConfiguration(conf) {
            let tinted = NSImage(size: sImg.size)
            tinted.lockFocus()
            let r = NSRect(origin: .zero, size: sImg.size)
            sImg.draw(in: r)
            NSColor.white.set()
            r.fill(using: .sourceAtop)
            tinted.unlockFocus()
            let w = s*0.56
            let h = sImg.size.height / max(sImg.size.width, 1) * w
            tinted.draw(in: NSRect(x: (s-w)/2, y: (s-h)/2, width: w, height: h))
        }
    }

    img.unlockFocus()
    guard let tiff = img.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff) else { return nil }
    return rep.representation(using: .png, properties: [:])
}

let sizes: [(name: String, px: Int)] = [
    ("icon_16x16", 16), ("icon_16x16@2x", 32),
    ("icon_32x32", 32), ("icon_32x32@2x", 64),
    ("icon_128x128", 128), ("icon_128x128@2x", 256),
    ("icon_256x256", 256), ("icon_256x256@2x", 512),
    ("icon_512x512", 512), ("icon_512x512@2x", 1024),
]

for item in sizes {
    if let data = render(item.px) {
        try? data.write(to: URL(fileURLWithPath: "\(outDir)/\(item.name).png"))
    }
}
print("icon png'leri üretildi: \(outDir)")
