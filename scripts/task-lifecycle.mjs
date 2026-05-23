#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { taskValidationFeedback } from './lib/task-quality.mjs';

function readStdinJson() {
  try {
    const raw = readFileSync(0, 'utf8').trim();
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    process.stderr.write(`task-lifecycle.mjs: failed to parse stdin JSON: ${error.message}\n`);
    return {};
  }
}

const payload = readStdinJson();
const { message, severity, stage } = taskValidationFeedback(payload);

if (message) {
  const guidance =
    stage === 'creation'
      ? 'Tighten the task subject or description before creating it.\n'
      : 'Tighten the task spec or completion evidence before marking it done.\n';
  process.stderr.write(`${message} ${guidance}`);

  if (severity === 'block') {
    process.exit(2);
  }
}
