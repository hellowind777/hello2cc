function trimmedPrompt(prompt) {
  return String(prompt || '').trim();
}

export function startsWithExplicitCommand(prompt) {
  return /^(~|\/)/.test(trimmedPrompt(prompt));
}

export function isSubagentPrompt(prompt) {
  return /^\[(?:子代理任务|subagent task|agent task|teammate task)\]/i.test(trimmedPrompt(prompt));
}
