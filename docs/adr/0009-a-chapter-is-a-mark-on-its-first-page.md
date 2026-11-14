# A Chapter is a mark on the Page that starts it

Books have chapters, and the Reader had no way to say where one starts: a long novel was one run of Pages, with nothing to find your way by, and the Tutor couldn't read "the next chapter".

So a Page may carry a Chapter mark: `page.chapter`, the Chapter's title, empty for an untitled one ("Chapter n"), null on a Page that starts none. A Chapter runs from its mark to the next; Pages before the first mark are in none. Chapters don't nest: a Part goes in the title. A Chapter always starts a Page, so a heading mid-Page means splitting the Page first.

The mark lives on the Page row, so it follows the Page wherever it moves (ADR 0008); a split Page keeps it on its first part, and joining drops the joined Page's mark. It changes nothing you read, so a Read Page takes or loses one, from you and the Tutor alike, without touching its Read mark, Words read or the Bookmark.

When a Book is created, a `# ` line starts a Chapter, its text the title and kept in the Page without the `#` (lines like it straight after add to the title). Plain text with no `# ` lines is searched for headings ("Chapter 3", "Глава 3", "IV. Бал", "第三章"), and a web page's `<h2>`s become `# ` lines. Found headings are kept only when there are two or more, each over at least 30 Words, so a table of contents, a Part over its first Chapter or a short article's subheadings aren't taken for Chapters. They are applied straight away, with no step to review them: a wrong one is removed on the edit screen.

## Considered Options

- A Chapter of its own that owns a run of Pages: every move, split, join and removal on the edit screen would have to keep the runs whole.
- A heading in the text, read back each time: no new column, but every edit of a first line would rename or end a Chapter, and a Chapter with no heading (a photo's text) couldn't be one.
- A review step at import: a screen most imports would skip, for marks as easily removed afterwards.

## Consequences

- The reading screen shows the Chapter and the Page within it, opening to the Book's Chapters with the Read Pages of each; a Book with no marks looks as before.
- The Tutor sees each Page's Chapter in `get_pages`, `get_sentences`, `get_bookmark` and `where_am_i`, and marks them with `edit_pages`' `set_chapter`.
- Detection guesses, by word lists in `domain/chapters.ts`; a Language whose headings it misses gets its word added there.
