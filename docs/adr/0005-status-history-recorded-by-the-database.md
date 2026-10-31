# Status history recorded by the database

Known Terms over time needs every change of a Term's Status, and Statuses change in many places: saving a Term, Follows Parent sharing a Status, a Parent created on the fly, Mark as read with the rest Known, deleting a Term, and the Tutor through the MCP server. We record the history with SQLite triggers on the `term` table, so every write, from either process, is logged without each of those places having to remember to.

## Considered Options

- Log from the domain code at each write: explicit, but one missed call site (or a new one) silently loses history. Rejected.
- Daily snapshots of Known counts: simple, but only while something takes them, and it can't answer "which Terms became Known today". Rejected.

## Consequences

- The history is written in SQLite's clock, not the domain code's, so tests with a fixed clock write their history rows directly.
- Terms saved before the history began get one entry each, on the day they were saved, at their present Status. Known Terms over time is approximate before that day.
- ADR 0003 still holds: the rule lives in one place both processes share; here that place is the database.
