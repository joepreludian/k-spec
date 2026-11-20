/** The help text, built from the command table so it cannot drift from what the CLI accepts. */
export function usageText(commands) {
  const rows = Object.values(commands);
  return [
    "k-spec <command> [arguments] [options]",
    "",
    "Commands (<n> is a card number, with or without #):",
    ...rows.flatMap((command) => [`  ${command.usage}`, `      ${command.summary}`]),
    "  help",
    "      this text",
    "",
    "Options:",
    "  --json   print JSON instead of text",
    "  --       end of options: put it before text that starts with a dash",
    "",
    "Finding the server:",
    "  K_SPEC_URL + K_SPEC_TOKEN   address and access token of the server, when set",
    "  K_SPEC_SERVER_FILE          otherwise the note the running server leaves (default data/k-spec.server.json)",
    "  K_SPEC_AGENT                name of the agent writing comments (same as comment --agent <name>)",
    "",
    "Requests to the agent:",
    "  comment --request   the comment is a request; it stays open until an agent comments on that card",
    "  watch               one line per open request, for a monitor to read; lines starting k-spec: report its connection",
    "",
    "Exit codes: 0 done, 1 refused, 2 usage, 3 no connection",
  ].join("\n");
}
