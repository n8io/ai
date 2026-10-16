import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeLease, readLeases, liveLeases, reapStale } from '../lib/leases.mjs';

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'gh-events-leases-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

test('writeLease then readLeases round-trips the lease', () => {
  writeLease(dir, { pid: 111, pr: 1370, kind: 'ci', startedAt: 1000 });
  const leases = readLeases(dir);
  assert.equal(leases.length, 1);
  assert.equal(leases[0].pid, 111);
  assert.equal(leases[0].pr, 1370);
  assert.equal(leases[0].kind, 'ci');
});

test('liveLeases keeps only leases whose PID is alive', () => {
  writeLease(dir, { pid: 111, pr: 1370, kind: 'ci', startedAt: 1000 });
  writeLease(dir, { pid: 222, pr: 1361, kind: 'review', startedAt: 1001 });
  const alive = (pid) => pid === 111; // 222 is a dead waiter
  const live = liveLeases(dir, alive);
  assert.equal(live.length, 1);
  assert.equal(live[0].pid, 111);
});

test('reapStale deletes dead-PID lease files and returns them', () => {
  writeLease(dir, { pid: 111, pr: 1370, kind: 'ci', startedAt: 1000 });
  writeLease(dir, { pid: 222, pr: 1361, kind: 'review', startedAt: 1001 });
  const alive = (pid) => pid === 111;
  const reaped = reapStale(dir, alive);
  assert.deepEqual(reaped.map((l) => l.pid).sort(), [222]);
  // The live lease survives on disk; the stale one is gone.
  assert.deepEqual(readLeases(dir).map((l) => l.pid), [111]);
});

test('reapStale on all-dead leases empties the dir (daemon may now exit)', () => {
  writeLease(dir, { pid: 111, pr: 1370, kind: 'ci', startedAt: 1000 });
  writeLease(dir, { pid: 222, pr: 1361, kind: 'review', startedAt: 1001 });
  const reaped = reapStale(dir, () => false);
  assert.equal(reaped.length, 2);
  assert.equal(readLeases(dir).length, 0);
});
