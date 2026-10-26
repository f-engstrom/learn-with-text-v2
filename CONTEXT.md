# Reader

A personal tool for learning languages by reading: you read real texts, look up words you don't know, and record what you know about each word or phrase so later texts show your progress.

## Language

### Texts

**Language**:
A language being studied, with its own rules for splitting text into words and normalising them, and its own dictionaries.

**Book**:
A text you have imported to read, in one Language, split into Pages.
_Avoid_: Text, document

**Page**:
One readable chunk of a Book, in order; the unit you open and mark as read.
_Avoid_: Text (Lute's name for it), chapter

**Sentence**:
One sentence of a Page, in order, as split by its Language's rules. Multi-word Terms never cross a Sentence boundary.

**Bookmark**:
Where you are in a Book: its current Page and Sentence. The reading screen and the Tutor both use the same Bookmark.
_Avoid_: Position, resume point, current page

**Word**:
One word-like piece of a Page as produced by its Language's splitting rules. Punctuation and spaces are not Words.
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
How well you know a Term: Learning 1–4, Known, or Ignored.

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
The fraction of a Book's distinct Words that are Unknown.
_Avoid_: Unknown percent, difficulty

**Dictionary**:
An external lookup source configured for a Language, shown alongside the Page. You copy from it and paste as a Translation.

### Tutoring

**Tutor**:
Claude running this project's reading-tutor skill, which reads and changes the Reader through its MCP tools. It owns teaching notes (level, chunk size, weak spots, patterns learned); the Reader owns Books, Bookmarks and Terms.
_Avoid_: AI, assistant, bot

**Gloss**:
A short meaning the Tutor offers for a Word during a session. It is offered only for Unknown Words and Learning 1–2 Terms, and is saved as a Translation with Source Tutor.

**Tutor adjustment**:
A Tutor-made change to a Term's Learning level: up one step after you answer correctly about it, down one after a miss, never leaving Learning 1–4. Only you set Known or Ignored.

**Wiktionary panel**:
The built-in lookup that shows English Wiktionary definitions for the selected Word or Multi-word Term, each of which can be added as a Translation with one click.
