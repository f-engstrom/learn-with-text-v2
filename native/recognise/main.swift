// The Mac helper for Recognise (ADR 0010): reads the text in photos and PDFs with Apple's Vision and
// PDFKit and prints what it found as JSON, one entry per page, for `domain/recognise.ts` to clean up.
//
//   recognise --language ru photo1.heic photo2.jpg book.pdf
//   recognise --languages
//
// A photo is one page. A PDF page that carries its own text gives that text; a scanned one is drawn
// and read like a photo. Lines come with their box (0–1, origin top-left, in the upright image) and
// Vision's confidence, so the clean-up can tell a running head from the text. Exit 2 means the
// Language can't be read; exit 1 a file that can't.

import Foundation
import ImageIO
import PDFKit
import Vision

struct Line: Encodable {
	let text: String
	let confidence: Float
	let x: Double
	let y: Double
	let width: Double
	let height: Double
	/// The middle of the line's left and right ends, top-down: a tilted photo's lines slope, so these
	/// order and join them better than the box does.
	let leftY: Double
	let rightY: Double
}

struct Page: Encodable {
	let file: String
	/// The PDF's own text, when it has some; otherwise the lines Vision read.
	let text: String?
	let lines: [Line]?
}

func fail(_ message: String, code: Int32 = 1) -> Never {
	FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
	exit(code)
}

func request(languages: [String]) -> VNRecognizeTextRequest {
	let request = VNRecognizeTextRequest()
	request.recognitionLevel = .accurate
	request.usesLanguageCorrection = true
	request.recognitionLanguages = languages
	return request
}

func supportedLanguages() -> [String] {
	(try? request(languages: []).supportedRecognitionLanguages()) ?? []
}

/// Vision's codes for a BCP 47 Language code: "ru" → ["ru-RU"], "zh-Hant" → ["zh-Hant"].
func visionLanguages(for code: String) -> [String] {
	let supported = supportedLanguages()
	if supported.contains(code) { return [code] }
	let base = code.split(separator: "-").first.map(String.init) ?? code
	return supported.filter { $0 == base || $0.hasPrefix(base + "-") }.prefix(1).map { $0 }
}

func read(_ image: CGImage, orientation: CGImagePropertyOrientation, languages: [String]) throws -> [Line] {
	let req = request(languages: languages)
	try VNImageRequestHandler(cgImage: image, orientation: orientation).perform([req])
	return (req.results ?? []).compactMap { observation in
		guard let best = observation.topCandidates(1).first else { return nil }
		let box = observation.boundingBox
		let leftY = 1 - (observation.topLeft.y + observation.bottomLeft.y) / 2
		let rightY = 1 - (observation.topRight.y + observation.bottomRight.y) / 2
		return Line(
			text: best.string, confidence: best.confidence,
			x: box.minX, y: 1 - box.maxY, width: box.width, height: box.height, leftY: leftY, rightY: rightY)
	}
}

func readImage(at url: URL, languages: [String]) throws -> Page {
	guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
		let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
	else { fail("\(url.lastPathComponent) isn't an image or PDF that can be read.") }
	let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
	let raw = properties?[kCGImagePropertyOrientation] as? UInt32 ?? 1
	let orientation = CGImagePropertyOrientation(rawValue: raw) ?? .up
	return Page(file: url.lastPathComponent, text: nil, lines: try read(image, orientation: orientation, languages: languages))
}

/// A PDF page drawn at 300 dpi, white behind it, for Vision.
func draw(_ page: PDFPage) -> CGImage? {
	let bounds = page.bounds(for: .mediaBox)
	let scale = 300.0 / 72.0
	let width = Int(bounds.width * scale), height = Int(bounds.height * scale)
	guard
		let context = CGContext(
			data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
			space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
	else { return nil }
	context.setFillColor(CGColor(gray: 1, alpha: 1))
	context.fill(CGRect(x: 0, y: 0, width: width, height: height))
	context.scaleBy(x: scale, y: scale)
	context.translateBy(x: -bounds.minX, y: -bounds.minY)
	page.draw(with: .mediaBox, to: context)
	return context.makeImage()
}

func readPDF(at url: URL, languages: [String]) throws -> [Page] {
	guard let document = PDFDocument(url: url) else { fail("\(url.lastPathComponent) isn't a PDF that can be read.") }
	if document.isLocked { fail("\(url.lastPathComponent) is locked with a password.") }
	var pages: [Page] = []
	for index in 0..<document.pageCount {
		guard let page = document.page(at: index) else { continue }
		let own = page.string?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
		if own.count >= 20 {
			pages.append(Page(file: url.lastPathComponent, text: own, lines: nil))
		} else if let image = draw(page) {
			pages.append(Page(file: url.lastPathComponent, text: nil, lines: try read(image, orientation: .up, languages: languages)))
		}
	}
	return pages
}

var arguments = Array(CommandLine.arguments.dropFirst())

if arguments == ["--languages"] {
	let data = try JSONEncoder().encode(supportedLanguages())
	FileHandle.standardOutput.write(data)
	exit(0)
}

guard arguments.count >= 3, arguments[0] == "--language" else {
	fail("Usage: recognise --language <code> <file>… | recognise --languages")
}
let code = arguments[1]
let languages = visionLanguages(for: code)
if languages.isEmpty { fail("Text recognition can't read \(code).", code: 2) }

var pages: [Page] = []
do {
	for path in arguments.dropFirst(2) {
		let url = URL(fileURLWithPath: path)
		if url.pathExtension.lowercased() == "pdf" {
			pages += try readPDF(at: url, languages: languages)
		} else {
			pages.append(try readImage(at: url, languages: languages))
		}
	}
} catch {
	fail("Text recognition failed: \(error.localizedDescription)")
}

let encoder = JSONEncoder()
FileHandle.standardOutput.write(try encoder.encode(pages))
