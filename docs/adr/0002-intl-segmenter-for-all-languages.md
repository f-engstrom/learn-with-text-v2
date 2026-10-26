# One parser built on Intl.Segmenter

Lute uses a different parser per language family (regex-based space-delimited, MeCab, per-character Chinese, plugins such as jieba). We use Node's built-in `Intl.Segmenter` (ICU word segmentation) for every Language — Russian, Bosnian, Farsi and Chinese in v1 — behind a single Parser seam. It needs no native dependencies, handles Farsi's zero-width non-joiner inside words, and segments Chinese with ICU's dictionary.

## Considered Options

- jieba (WASM) for Chinese: better segmentation and a custom dictionary, but an extra dependency. Rejected for v1; bad Chinese splits are fixed by creating Multi-word Terms. The Parser seam leaves room to add it later.
