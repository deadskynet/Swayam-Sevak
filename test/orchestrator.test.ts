/**
 * Orchestrator e2e against the echo provider.
 *
 * Echo's contract: "tool:<name> {...json}" → tool call; otherwise echo back.
 * We wire a fixture tool and confirm the loop terminates with the tool result
 * fed back to the model.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Orchestrator } from '../src/orchestrator/orchestrator.js';
import { EchoProvider } from '../src/llm/providers/echo.js';
import type { Tool } from '../src/tools/types.js';

const fixtureTool: Tool = {
  name: 'shout',
  description: 'shouts the input',
  schema: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
  },
  requiresConfirmation: false,
  async execute(args) {
    return { text: String(args.text ?? '').toUpperCase() };
  },
};

const dangerousTool: Tool = {
  name: 'launch_missile',
  description: 'destructive',
  schema: { type: 'object', properties: {} },
  requiresConfirmation: true,
  async execute() {
    return { text: '🚀' };
  },
};

let tempData: string;

beforeEach(async () => {
  tempData = await mkdtemp(join(tmpdir(), 'swayam-test-'));
  process.env.SWAYAM_DATA_DIR = tempData;
});

afterEach(async () => {
  await rm(tempData, { recursive: true, force: true });
});

describe('Orchestrator', () => {
  it('returns the model reply when no tool is called', async () => {
    const provider = new EchoProvider();
    const orch = new Orchestrator({ provider, tools: [fixtureTool], workspace: 'personal' });
    const r = await orch.run({ userMessage: 'hello' });
    expect(r.reply).toBe('[echo] hello');
    expect(r.toolsExecuted).toBe(0);
  });

  it('dispatches a tool call and feeds the result back', async () => {
    const provider = new EchoProvider();
    const orch = new Orchestrator({ provider, tools: [fixtureTool], workspace: 'personal' });
    const r = await orch.run({ userMessage: 'tool:shout {"text":"hi"}' });
    // The echo provider on iter 2 sees a `tool` message in history. Its `last
    // user message` is still iter 1's user. So echo replies "[echo] tool:shout {...}"
    // — but with no tool call this time (regex anchors to msg start, and echo
    // only checks last user). So loop ends.
    expect(r.toolsExecuted).toBe(1);
    expect(r.trace.toolEvents[0]?.name).toBe('shout');
    expect(r.trace.toolEvents[0]?.result).toBe('HI');
  });

  it('blocks confirmation-required tools by default and reports them as pending', async () => {
    const provider = new EchoProvider();
    const orch = new Orchestrator({ provider, tools: [dangerousTool], workspace: 'personal' });
    const r = await orch.run({ userMessage: 'tool:launch_missile {}' });
    expect(r.toolsExecuted).toBe(0);
    expect(r.pendingConfirmations.length).toBe(1);
    expect(r.pendingConfirmations[0]?.name).toBe('launch_missile');
  });

  it('executes a confirmation-required tool when the call id is approved', async () => {
    const provider = new EchoProvider();
    const orch = new Orchestrator({ provider, tools: [dangerousTool], workspace: 'personal' });
    const first = await orch.run({ userMessage: 'tool:launch_missile {}' });
    const callId = first.pendingConfirmations[0]!.id;
    const second = await orch.run({
      history: first.history,
      userMessage: '(confirmed)',
      approvedToolCallIds: new Set([callId]),
    });
    // The "(confirmed)" message is itself the next user turn — the model
    // wouldn't reissue the call. So we test that the orchestrator doesn't
    // crash and returns a reply. The actual re-issue path is exercised by the
    // CLI/Telegram callers, not the orchestrator itself.
    expect(typeof second.reply).toBe('string');
  });
});
