# Practice slices

Spaced repetition woven into reading. Each slice goes from the screen to the database and ends in something you can demo, and each works without the ones after it. Vocabulary follows [CONTEXT.md](../CONTEXT.md); the model is in [ADR 0004](adr/0004-three-views-of-knowing-a-word.md). Numbering continues from [v1](v1-slices.md).

### 19. Reviews, Due and Recall strength
- Record Reviews (Missed, Hard, Got it) per Term and keep an FSRS schedule from them (ts-fsrs). Learning 1–4 Terms take part from their first save; Known and Ignored are never Due. A Term that Follows Parent shares its Parent's schedule.
- The reading screen marks Due Words, from amber to red the more overdue; a toggle (D) hides the marks.
- The Term panel shows Recall strength on the Status scale ("holds ~10 days, 94% today") once a Term has a Review.
- **Demo:** grade a Word Missed from the Term panel; it shows as Due tomorrow, and its mark reddens as the days pass (tested with a fixed clock).

### 20. Practice on the Page
- A key starts Practice and asks for a subset: top by Practice priority, this paragraph, the Highlight, most overdue (Practice priority falls back to most overdue until slice 22).
- The cursor walks the subset's Due Words in the text; Space reveals the Translation, then 1/2/3 grade Missed, Hard, Got it as a Review. Esc leaves.
- **Demo:** practise the Due Words in one paragraph without the mouse; their marks disappear.

### 21. Review in the Term list
- Due, and Recall strength as columns and filters.
- A review mode: one Due Term at a time, bolded in a Sentence from your Books with a link to its Page; reveal shows Translations, Parent and Pronunciation; grade as a Review.
- **Demo:** filter to Due Russian Terms and review them all.

### 22. Frequency and Practice priority
- A frequency list per Language, bundled with attribution, giving each Word a Frequency band (top 1k, 5k, 20k, rare).
- Practice priority orders Due Terms: Frequency, then Transfer once it exists, then how overdue.
- Frequency in the Term panel, the zen tooltip, and the Term list (column and filter).
- **Demo:** practise "top by priority" on a Page and the building-block Words come first.

### 23. The Tutor's assessment, Transfer and Your languages
- The Tutor's assessment per Term; `adjust_learning` moves it instead of Status. Shown beside Status and Recall strength, with a suggestion when they disagree.
- Transfer (form and concept, easy/medium/hard, with a reason) set by the Tutor; Your languages, editable by you and the Tutor.
- MCP: record a Review from a question, list Due Terms by priority, set Transfer, edit Your languages. The skill's warm-ups and quizzes draw on Due Terms.
- Transfer and the Tutor's assessment in the Term panel, the zen tooltip and the Term list.
- **Demo:** after a tutoring exchange, a Term shows "you: Learning 2 · Tutor: Learning 3 · Recall: Learning 2", with Transfer "concept: hard".
