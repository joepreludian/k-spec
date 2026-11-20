/** The command line itself is wrong: an unknown command or option, a missing argument. */
export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

/** The command understood what was asked and will not do it: the port is taken, a file cannot be written. */
export class Refused extends Error {
  constructor(message) {
    super(message);
    this.name = "Refused";
  }
}
