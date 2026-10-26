# Unknown means no Term exists

Lute saves a status-0 row for every new word on every page you open, so "unknown" is a row. We instead create a Term only when you make a judgement about a Word; Unknown is the absence of a Term. This keeps the database proportional to what you've actually learned, makes deleting a Term really delete it, and keeps "Term" meaning one thing.

## Consequences

- Unknown counts for a Page or Book are computed by matching its Words against existing Terms, not by counting rows.
- Marking a Page as read must create Known Terms for its remaining Unknown Words, where Lute only updated existing rows.
