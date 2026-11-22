# Recognise with Apple's Vision, on the server

Adding Pages from a printed book went through the phone: take a photo in "Add Pages here", hold on it until Live Text selected the text, copy, paste, once per photo. Nothing in the Reader read text from an image, and a new Book took only pasted text, a `.txt` file or a web address.

The Reader runs on the learner's own Mac, so the server reads the text itself with Apple's Vision. A small Swift program, `native/recognise` (built by `pnpm build:native` into `bin/recognise`, and by `pnpm dev`, `dev:sandbox` and `start` when it is missing or older than its source), takes files and a Language and prints the lines it found as JSON: each line's text, box and confidence, and the height of its two ends. A PDF page that carries its own text gives that instead; a scanned one is drawn and read like a photo. The server runs it once per upload (`domain/recognise.ts`, `visionReader`), and turns the lines into text there.

That clean-up is ours, in TypeScript, as rules over the lines, and a rule goes in only with a recorded photo of a real Page that shows it (`fixtures/recognise`; the photos themselves stay in the uncommitted `ocr-samples/`):

- Lines outside the column the full lines make (a facing page's edge, a bookmark) and a page number alone above or below it are left out.
- Lines are put in order by their left ends, since a tilted photo's lines slope and Vision's own order and boxes get the bottom lines wrong; a line Vision read as two pieces is joined.
- A paragraph starts after a gap wider than the lines' spacing, or on a line indented from the margin (fitted along the column, since a photo is rarely square) that begins as a paragraph would. Each becomes one line of text.
- A Word hyphenated at a line's end is joined, and a hyphen that opens dialogue or stands between spaces becomes a dash, as Vision reads every dash as a hyphen.

Running heads aren't handled: none of the recorded photos had one.

In the browser, each photo is sent as soon as it's taken, one at a time, and its text is added to the screen's text box (`lib/recognise.ts` joins it on, mending a Word hyphenated across two photos). Its thumbnail stays beside the box to check against. There is no new step: the text is checked in the box, as pasted text is, then "Add N Pages" or "Create Book" splits it as before. The Tutor has `recognise_files`, which reads files on this computer and saves nothing, ahead of `import_book` or `edit_pages`. The photos are written to a temporary folder for the helper and removed straight after.

## Considered Options

- Recognising in the browser (Tesseract.js or similar): a heavy download for the phone, slower and much worse than Vision at Cyrillic on a curved page.
- Leaving it to the phone's Live Text: what we had, and the reason for this change.
- A long-running helper instead of a process per upload: Vision's own work (about 3–4 seconds a photo on an Intel Mac) dwarfs starting the program.
- Keeping the photos with their Pages: storage, and a link to keep right through splitting and joining Pages (ADR 0008), for something not yet asked for.
- Asking Vision for the Language: the Language is chosen anyway, and the Language's code picks Vision's recogniser.

## Consequences

- Recognising needs macOS and the built helper. Without it the server refuses with a message saying to run `pnpm build:native`, and pasting still works; the domain's tests use a stand-in for the helper and run anywhere.
- A Language Vision has no reader for is refused by name, unless another reader has all its letters (`VISION_STAND_INS` in `domain/recognise.ts`). Vision can only give letters from the languages it has, so a stand-in is chosen on sample text, not by script. Tried on printed sentences (November 2026, macOS 15) with the English, German, French and Portuguese readers, which all gave the same:
  - Indonesian (plain a–z) came back exactly, so it reads with English.
  - Albanian kept `ç`, but about half its `ë` came back as `e` (*liber*, *eshte*). Left out: each such Word becomes another, Unknown Word and a wrong Term if saved, and catching every one when checking is too much to ask. Worth trying again when a newer macOS adds readers.
  - Bosnian lost every `č ć š ž` (*citala*, *zena*, *kljuc*); only `đ` came through, once. Left out.
  - Farsi wasn't tried. Vision's Arabic reader is the only candidate, and Farsi's own letters (پ چ ژ گ) are likely lost the same way.
- `serve.js` takes uploads up to 200 MB (`BODY_SIZE_LIMIT`) and keeps a request open for 30 minutes, for whole scanned PDFs.
- `/books/new` takes text files through the same picker, into the box; the form itself no longer takes a file, so "paste text or choose a file, not both" is gone.
