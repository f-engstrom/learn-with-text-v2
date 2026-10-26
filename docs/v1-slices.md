# v1 slices

Each slice goes from the screen to the database and ends in something you can demo. Build them in order: each one only depends on slices above it. Vocabulary follows [CONTEXT.md](../CONTEXT.md).

## Reading loop

### 1. Walking skeleton
- SvelteKit (Node adapter), better-sqlite3 in WAL mode with a busy timeout, Kysely, and a migration runner.
- Seed the four Languages (Russian, Bosnian, Farsi, Chinese) with their normalisation rules. Languages can't be edited in v1.
- Domain code lives outside SvelteKit routes (`src/lib/server/domain`) so the MCP server can reuse it later (ADR 0003).
- **Demo:** the app starts and lists the four Languages.

### 2. Paste a Book, read its first Page
- Parser seam with one `Intl.Segmenter` implementation (ADR 0002) that turns text into Sentences of Words and non-Words, and gives each Word its Normalised form.
- Create a Book from pasted text and split it into Pages at about 250 Words or at a line containing only `---`. Store the Sentences.
- Render a Page with every Word marked Unknown. Farsi renders right to left.
- **Demo:** paste a Russian paragraph and a Chinese paragraph. Every Word is highlighted as Unknown, and punctuation is not.
- **Tests:** segmentation and normalisation per Language: stress marks, ё kept distinct, Arabic ي/ك mapped to Persian ی/ک, the zero-width non-joiner staying inside a Farsi Word, Chinese segmentation.

### 3. Click a Word, save a Term
- Clicking a Word opens the Term form with a Status (Learning 1–4, Known, Ignored) and one Translation.
- Saving creates the Term (ADR 0001: no Term means Unknown). The Page re-renders with Status colours, and every occurrence with the same Normalised form changes, e.g. Чита́ть and читать.
- Editing and deleting a Term. A deleted Term's Words go back to Unknown.
- **Demo:** mark three Words, reload, and the colours persist.

### 4. Translations and Pronunciation
- An ordered list of Translations per Term: add, remove and reorder. Source is "you".
- An optional Pronunciation field, filled in automatically with pinyin for Chinese.
- **Demo:** a Chinese Term gets pinyin automatically, and you add two Translations in order.

### 5. Keyboard reading
- Arrows move between Words, 1–4 set a Learning level, K sets Known, I sets Ignored, and Enter opens the Term form. Setting a Status on an Unknown Word creates its Term.
- **Demo:** mark a whole Page without the mouse.

### 6. Pages, Bookmark and Read
- Previous and next Page. The Bookmark stores the Page and Sentence, and opening a Book resumes there.
- "Mark as read", and "Mark as read, rest Known", which creates Known Terms for the remaining Unknown Words.
- **Demo:** finish Page 1 with "rest Known", and Page 2 shows those Words as Known.

### 7. Multi-word Terms
- Click a Word and shift-click a later Word in the same Sentence to open the Term form for that phrase.
- Matching: consecutive Words with only whitespace (or nothing) between them, never across a Sentence boundary. Where Terms overlap, the longest wins, and ties go to the one that starts first.
- "Rest Known" now skips Words inside a Multi-word Term.
- **Demo:** "в течение" is highlighted as one Term. Two Chinese segments joined into one Word display as a single Term.
- **Tests:** the matching and overlap rules, and that punctuation between Words breaks a match.

### 8. Parents
- Set a Term's Parent, creating the Parent if it doesn't exist. A Term has at most one Parent.
- The "Follows Parent" checkbox makes a Term and its Parent share one Status.
- **Demo:** читала → читать. Changing either Status changes both.

## Getting meanings in

### 9. Dictionaries
- Per-Language dictionary URLs (seeded, with a `[TERM]` placeholder), shown as embedded tabs or opened in a popup window.
- A "Paste as Translation" button and hotkey that adds the clipboard text as a Translation.
- **Demo:** look up a Word, copy a meaning, and paste it in with one key.

### 10. Wiktionary panel
- A server-side fetch of English Wiktionary definitions for the selected Word or Multi-word Term.
- Clicking a definition adds it as a Translation with Source "Wiktionary".
- **Demo:** one click turns a Wiktionary definition into a Translation.

## Library

### 11. Book list
- All Books with Language, Page count, Bookmark and Unknown share.
- Also create a Book from an uploaded .txt file.
- **Demo:** the Unknown share drops after you mark Words.

### 12. Term list
- Filter by Language, Status and Translation Source, with inline edit and delete.
- **Demo:** filter to "Source: Tutor" (empty until slice 14).

## Tutor

### 13. MCP server, read-only
- A stdio entry point that reuses the domain code (ADR 0003).
- Tools: list Books, get the Bookmark, get Sentences around the Bookmark with each Word's Term and Status, look up a Term.
- **Demo:** Claude Code with the server configured can say where you are in a Book and which Words are still Unknown.

### 14. MCP writes
- Save a Gloss (creates or extends a Term, as a Translation with Source "Tutor").
- Tutor adjustment: up or down one Learning step, never leaving Learning 1–4. This rule is enforced in domain code.
- Move the Bookmark, mark a Page Read, and import a Book.
- **Demo:** a tutoring exchange creates a Term that shows up in the reading screen after a reload and in the Term list under "Source: Tutor".

### 15. Reading-tutor variant skill
- A copy of the reading-tutor skill in this repo that uses the MCP tools for text, Bookmark, Glosses and Tutor adjustments. Memory holds only teaching notes.
- Glosses are offered only for Unknown Words and Learning 1–2 Terms.
- **Demo:** start a tutoring session on a Book you've half read, and it resumes at your Bookmark.

## Not in v1

EPUB, PDF and URL import; Anki export; audio; configurable hotkeys; editing Languages in the app; jieba; Bosnian Cyrillic; reading stats and streaks; multiple users and sync.
