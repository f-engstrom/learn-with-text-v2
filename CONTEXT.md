# Reader

A personal tool for learning languages by reading: you read real texts, look up words you don't know, and record what you know about each word or phrase so later texts show your progress.

## Language

### Texts

**Language**:
A language being studied, with its own rules for splitting text into words and normalising them, and its own dictionaries.

**Book**:
A text you have imported to read, in one Language, split into Pages. It comes from pasted text, a file, a web address or a Suggestion; one from the web keeps its address.
_Avoid_: Text, document, article (an article becomes a Book once you pick it)

**Page**:
One readable chunk of a Book, in order; the unit you open and mark as read.
_Avoid_: Text (Lute's name for it), chapter

**Sentence**:
One sentence of a Page, in order, as split by its Language's rules. Multi-word Terms never cross a Sentence boundary.

**Bookmark**:
Where you are in a Book: its current Page and Sentence, and the Word (or phrase) you last selected in that Sentence, if any. The reading screen and the Tutor both use the same Bookmark; the one moved most recently, in any Book, is where you are now.
_Avoid_: Position, resume point, current page

**Highlight**:
A run of one or more Sentences on one Page that the Tutor points you to, with an optional short note. A Book has at most one; it lasts until the Tutor replaces or clears it, or you mark its Page Read. It never moves the Bookmark.
_Avoid_: Selection (that's yours), focus, annotation

**Word**:
One word-like piece of a Page as produced by its Language's splitting rules. Punctuation, spaces and numbers are not Words.
_Avoid_: Token (except when talking about the parser)

**Normalised form**:
The form of a Word or phrase used for matching: lowercased with the Language's normalisation rules applied (e.g. Russian stress marks removed). Reading always shows the original text.

### Knowledge

**Term**:
A Word or Multi-word Term you have made a judgement about. Unique per Language by its Normalised form.
_Avoid_: Word (for the saved thing), vocabulary item, card

**Multi-word Term**:
A Term made of two or more consecutive Words within one sentence, with only whitespace (or nothing) between them, e.g. "в течение" or a Chinese word the segmenter split apart. Where Multi-word Terms overlap on a Page, the longest one wins, and ties go to the one that starts first.
_Avoid_: Phrase, expression, MWE

**Unknown**:
The state of a Word that has no Term. Unknown is not a Status; there is no record of it.
_Avoid_: Status 0, new word

**Status**:
How well you say you know a Term: Learning 1–4, Known, or Ignored. Only you set it; the Tutor and the Reader may suggest a change.

**Known**:
The Status for a Term you no longer need help with. Covers both "learned" and "already knew it".
_Avoid_: Well known, learned, status 5/99

**Ignored**:
The Status for a Term that shouldn't count as vocabulary at all (names, numbers, foreign words).

**Translation**:
One short meaning attached to a Term; a Term has an ordered list of them. Each Translation has a Source.
_Avoid_: Definition, gloss (except for what the Tutor says during a session)

**Source**:
Who added a Translation: you, the Wiktionary panel, or the Tutor.
_Avoid_: Origin, author

**Pronunciation**:
An optional reading aid on a Term, such as pinyin for Chinese or a vowelled spelling for Farsi.
_Avoid_: Romanization, reading

**Parent**:
The Term a Term is a form of, usually its dictionary form (читала → читать). A Term has at most one Parent.
_Avoid_: Lemma (fine in conversation, but the model says Parent), root, base

**Follows Parent**:
A per-Term choice, off by default, that makes a Term and its Parent share one Status.

### Reading

**Read**:
A Page is Read once you mark it so. Marking a Page Read can optionally make every remaining Unknown Word on it Known, except Words that sit inside a Multi-word Term on that Page.
_Avoid_: Done, finished, completed (for Pages)

**Unknown share**:
The fraction of a Book's (or a Suggestion's) distinct Words that are Unknown.
_Avoid_: Unknown percent, difficulty

**Suggestion**:
A text the Reader found for you to read in a Language, from Wikipedia or a Feed, shown with its Unknown share and length. Picking a Suggestion imports it as a Book. A text you already have as a Book is never suggested again.
_Avoid_: Recommendation, candidate, article

**Fit range**:
The range of Unknown share, set per Language, that a Suggestion should fall in to count as a good fit (5–15% unless you change it). Suggestions are ranked by fit, then by Topic, then by length (one to three Pages is best).
_Avoid_: Level, difficulty

**Topic**:
A subject you like reading about, entered once in English and used to look for Suggestions in every Language.
_Avoid_: Interest, tag, category

**Feed**:
A news feed (RSS or Atom) configured for a Language, which Suggestions can come from. Some are built in; you can add and remove them.
_Avoid_: Source (that's who added a Translation), channel

**Dictionary**:
An external lookup source configured for a Language, shown alongside the Page. You copy from it and paste as a Translation.

### Tutoring

**Tutor**:
Claude running this project's reading-tutor skill, which reads and changes the Reader through its MCP tools. It owns teaching notes (level, chunk size, weak spots, patterns learned); the Reader owns Books, Bookmarks and Terms.
_Avoid_: AI, assistant, bot

**Gloss**:
A short meaning the Tutor offers for a Word during a session. It is offered only for Unknown Words and Learning 1–2 Terms, and is saved as a Translation with Source Tutor.

**Tutor adjustment**:
A step in the Tutor's assessment of a Term: up one after you answer correctly about it, down one after a miss, none after a hard-won answer. It never changes your Status; for a Learning Term the answer also counts as a Review.

**Tutor's assessment**:
How well the Tutor judges you know a Term, from your answers, on the Status scale (Learning 1–4 or Known). Shown beside your Status; empty until the Tutor has asked about the Term.
_Avoid_: Tutor status, score

**Transfer**:
How hard a Term is to carry over from Your languages, judged by the Tutor in two parts: its form (is there a look-alike?) and its concept (does the meaning map one-to-one?), each easy, medium or hard, with an optional reason.
_Avoid_: Difficulty (that's Transfer and Frequency together), cognate score

**Your languages**:
The languages you already know, which Transfer and the Tutor's bridges are measured against. You or the Tutor add them as they come up.

### Practice

**Review**:
One graded recall of a Term: Missed, Hard or Got it. Reviews come from practice on a Page, the review in the Term list, and Tutor questions; reading past a Word is not a Review.
_Avoid_: Test, card, rep

**Due**:
A Term is Due when its schedule, built only from its Reviews, says it needs another one. Only Learning 1–4 Terms are scheduled; a Term that Follows Parent shares its Parent's schedule. How overdue it is shows as a mark on the Word.
_Avoid_: Scheduled, pending

**Recall strength**:
How well the Reviews show you know a Term: how many days the memory holds, and your chance of recalling it today. Shown on the Status scale beside your Status and the Tutor's assessment, as a measurement; it never sets either.
_Avoid_: Memory score, mastery

**Frequency**:
How common a Word is in its Language, as a band (top 1,000, top 5,000, top 20,000, rare) from a frequency list.
_Avoid_: Rank (fine for the list itself), popularity

**Practice priority**:
The order Due Terms come up in: Frequency first, then Transfer (harder first), then how overdue. It only orders; it never hides a Term.

**Practice**:
Going through Due Terms on a Page with the cursor, in a subset you choose (by priority, a paragraph, the Highlight, most overdue), recalling each in its Sentence and grading it as a Review.

**Wiktionary panel**:
The built-in lookup that shows English Wiktionary definitions for the selected Word or Multi-word Term, each of which can be added as a Translation with one click.
