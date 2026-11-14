# One parser built on Intl.Segmenter

Lute uses a different parser per language family (regex-based space-delimited, MeCab, per-character Chinese, plugins such as jieba). We use Node's built-in `Intl.Segmenter` (ICU word segmentation) for every Language — Russian, Bosnian, Farsi and Chinese in v1 — behind a single Parser seam. It needs no native dependencies, handles Farsi's zero-width non-joiner inside words, and segments Chinese with ICU's dictionary.

One rule sits on top of ICU: Words joined by a single hyphen are one Word (Russian *почему-то*, *кое-что*, *по-русски*; Indonesian doubled Words such as *anak-anak*). ICU splits at the hyphen, which loses Words that dictionaries list whole, and a Multi-word Term can't stand in for them because punctuation ends a phrase. Dashes, a hyphen with a space beside it, and a hyphen beside a number still split. A hyphen left by a line break inside a word (*по-мню*) makes one odd Word; that's the cost. The rule lives in `src/lib/words.ts`, shared with the browser's word count, and changing it re-works every Book's Words (migration 0025).

## Considered Options

- jieba (WASM) for Chinese: better segmentation and a custom dictionary, but an extra dependency. Rejected for v1; bad Chinese splits are fixed by creating Multi-word Terms. The Parser seam leaves room to add it later.
