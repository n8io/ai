// Lease files make the daemon's lifetime observable and self-cleaning.
// Each active gh-wait owns leases/<pid>.json; the daemon runs only while at
// least one *live* lease exists. A lease whose PID died is stale and reaped,
// so a crashed waiter can never pin the daemon open forever.

import { readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const leaseFile = (dir, pid) => join(dir, `${pid}.json`);

export function defaultIsAlive(pid) {
  try {
    process.kill(pid, 0); // signal 0 = existence check, kills nothing
    return true;
  } catch (err) {
    return err.code === 'EPERM'; // exists but not ours → still alive
  }
}

export function writeLease(dir, { pid, pr, kind, startedAt }) {
  writeFileSync(leaseFile(dir, pid), JSON.stringify({ pid, pr, kind, startedAt }));
}

export function removeLease(dir, pid) {
  rmSync(leaseFile(dir, pid), { force: true });
}

export function readLeases(dir) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const leases = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    try {
      leases.push(JSON.parse(readFileSync(join(dir, name), 'utf8')));
    } catch {
      // half-written or corrupt lease — ignore; reap will clear dead ones
    }
  }
  return leases;
}

export function liveLeases(dir, isAlive = defaultIsAlive) {
  return readLeases(dir).filter((l) => isAlive(l.pid));
}

export function reapStale(dir, isAlive = defaultIsAlive) {
  const reaped = [];
  for (const lease of readLeases(dir)) {
    if (!isAlive(lease.pid)) {
      removeLease(dir, lease.pid);
      reaped.push(lease);
    }
  }
  return reaped;
}
