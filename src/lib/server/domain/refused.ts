/**
 * A broken rule: the request is refused with a message the learner or the Tutor can act on. Every
 * domain refusal (InvalidTerm, InvalidBook, …) is one, so an entry point can catch them all at once.
 */
export class Refused extends Error {}
