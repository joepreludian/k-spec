/** The command line itself is wrong: an unknown command or option, a missing argument. */
export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}
