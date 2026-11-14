# A Page has identity: its Read mark and the Bookmark follow it, not its text

Editing a Book used to mean editing its whole text, a `---` line between Pages, and splitting it into Pages again on Save. A Page stayed Read only if its new text matched an old Page's exactly, and the Bookmark kept its Page number whatever was now there. Fixing a typo unmarked a Page you had read, and moving a Page left the Bookmark behind. Once the edit screen shows each Page as a card you can move, join, split and remove, that matching no longer holds up.

So a Page is now the row it always was: the edit screen and the Tutor send every kept Page by its id, in its new order, and `editBook` updates those rows in place (`domain/book-editing.ts`). A Page keeps its Read mark and its date however its text changes, and its Words are counted again, so Words read follows the text. A `---` line splits a Page: the first part keeps it, the others are new and Read if it was. A Page the edit leaves out is removed. The Bookmark goes with its Page; from a removed Page it moves to the next kept one. The Highlight stays while its Page and the Language are unchanged.

## Considered Options

- Keep matching by text: no change to the model, but every small fix costs a Read mark, and moving Pages can't be done at all.
- Match by similarity (the closest old text): guesses, and guesses wrong for Pages that repeat, such as menus and footers on web imports.

## Consequences

- Editing never marks a Page Read; that stays the reading screen's act, with The day so far and the option to make the rest Known. It can take a Read mark away, to undo a mistake.
- An over-long Page is not split on Save, as it is when a Book is created: the screen warns and you split it where you choose.
- The Tutor cleans up imports with the same function through `edit_pages`, as operations on Page ids, and is refused any change to a Read Page (`ReadPageRefused`).
