#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { shouldEmitAdditionalContext } from './lib/config.mjs';

const cmd = process.argv[2] || '';

function readStdinJson() {
  try {
    const raw = readFileSync(0, 'utf8').trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function trimmed(value) {
  return String(value || '').trim();
}

function parseTeammateIdentity(payload = {}) {
  const candidates = [
    trimmed(payload?.agent_id),
    trimmed(process.env.CLAUDE_CODE_AGENT_ID),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const separator = candidate.indexOf('@');
    if (separator <= 0 || separator >= candidate.length - 1) continue;

    return {
      agentId: candidate,
      agentName: candidate.slice(0, separator),
      teamName: candidate.slice(separator + 1),
    };
  }

  return null;
}

function modeState(mode, identity) {
  const stateByMode = {
    explore: {
      mode: 'Explore',
      capability: 'read-only-search',
      can_write: false,
    },
    plan: {
      mode: 'Plan',
      capability: 'read-only-planning',
      can_write: false,
    },
    general: {
      mode: 'General-Purpose',
      capability: 'full-tool-surface',
      can_write: true,
    },
  };

  return {
    hello2cc_role: 'host-state',
    semantic_routing: 'model_decides',
    higher_priority_rules: [
      'parent_task',
      'claude_code_host',
      'CLAUDE.md',
      'AGENTS.md',
      'project_rules',
    ],
    ...(stateByMode[mode] || {}),
    ...(identity ? {
      teammate: {
        agent: identity.agentName,
        team: identity.teamName,
        coordination_channel: 'SendMessage',
      },
    } : {}),
  };
}

function buildContext(mode, identity) {
  return [
    '# hello2cc subagent_state',
    '',
    'Treat this as host state only. Scope, workflow, and tool choice remain model-decided within the parent task.',
    '',
    '```json',
    JSON.stringify(modeState(mode, identity), null, 2),
    '```',
  ].join('\n');
}

function writeJson(additionalContext) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SubagentStart',
      additionalContext,
    },
    suppressOutput: true,
  }));
}

function writeSuppress() {
  process.stdout.write(JSON.stringify({ suppressOutput: true }));
}

const payload = readStdinJson();
const teammateIdentity = parseTeammateIdentity(payload);

switch (cmd) {
  case 'explore':
    if (!shouldEmitAdditionalContext()) {
      writeSuppress();
      break;
    }
    writeJson(buildContext('explore', teammateIdentity));
    break;
  case 'plan':
    if (!shouldEmitAdditionalContext()) {
      writeSuppress();
      break;
    }
    writeJson(buildContext('plan', teammateIdentity));
    break;
  case 'general':
    if (!shouldEmitAdditionalContext()) {
      writeSuppress();
      break;
    }
    writeJson(buildContext('general', teammateIdentity));
    break;
  default:
    process.stderr.write(`subagent-context.mjs: unknown command "${cmd}"\n`);
    process.exit(1);
}
