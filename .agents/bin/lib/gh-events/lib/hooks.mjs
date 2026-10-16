// Helpers for the ephemeral forwarder webhooks gh-webhook creates on the repo.
// A healthy daemon deletes its own hook on shutdown; this is how we find and
// reap any that a crash/SIGKILL left behind.

import { execFileSync } from 'node:child_process';
import { REPO } from './paths.mjs';

const FORWARDER_URL = 'webhook-forwarder.github.com';

export function listForwarderHooks() {
  try {
    const raw = execFileSync('gh', ['api', `repos/${REPO}/hooks`], { encoding: 'utf8' });
    return JSON.parse(raw).filter((h) => (h.config?.url || '').includes(FORWARDER_URL));
  } catch {
    return [];
  }
}

export function deleteHook(id) {
  execFileSync('gh', ['api', '-X', 'DELETE', `repos/${REPO}/hooks/${id}`], { stdio: 'ignore' });
}
