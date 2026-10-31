# The Tutor waits for answers in the reading screen with a blocking tool call

The Tutor can ask its questions in the reading screen (a Tutor's question) instead of in chat, so the learner answers beside the text. The direction from the Tutor to the screen already worked: the MCP server writes to the shared database and the open Page polls it, as for the Highlight. The reverse direction didn't, because an MCP server can't wake the Tutor; it only hears from the server when it calls a tool. So `ask_learner` writes the question and then waits, checking the database until the learner answers or dismisses it, and returns the answer as its result. After a set time (120 s by default) it returns "waiting", and the Tutor calls `wait_for_answer` to wait again, so no call outlives a client's tool timeout.

## Considered Options

- Claude inside the app, through the API: the screen could talk to the Tutor directly, but the Tutor would lose the Claude Code skill, memory and MCP setup it runs in, and the app would need its own API key and conversation state. Rejected.
- The learner says "answered" in chat and the Tutor reads the answer with a tool: no waiting, but every turn needs a trip back to chat, which is what the question in the screen is meant to remove. Rejected.

## Consequences

- One question per Book, replaced by the next, identified by when it was asked, so an answer to a replaced question is refused.
- Dismissing puts the Tutor aside: the question and the Highlight leave the screen, and a waiting Tutor hears "dismissed". A stale question from a session that ended never sticks.
- The chat keeps only a trace of each turn; the questions and answers live in the reading screen.
