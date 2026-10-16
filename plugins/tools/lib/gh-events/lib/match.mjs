// Pure event-matching core. Given the events seen so far, a wait condition,
// and the seed captured at startup, decide whether the wait is satisfied.
// No I/O — this is the honest, unit-tested heart of gh-wait.

const TERMINAL_STATUS = new Set(['success', 'failure', 'error']);

// Does this event concern the PR we're waiting on? Different event types carry
// the PR linkage differently, so we check every shape GitHub uses.
function referencesPr(event, pr, seed) {
  const p = event.payload ?? {};
  if (p.pull_request?.number === pr) return true;
  if (p.issue?.number === pr) return true;
  if (typeof p.number === 'number' && p.number === pr) return true;
  const suitePrs = p.check_suite?.pull_requests ?? p.check_run?.pull_requests ?? [];
  if (suitePrs.some((x) => x.number === pr)) return true;
  // check_suite / check_run / status carry only a head sha; match via seed.
  if (seed?.headSha) {
    const sha = p.check_suite?.head_sha ?? p.check_run?.head_sha ?? p.sha;
    if (sha && sha === seed.headSha) return true;
  }
  return false;
}

function ciVerdict(events, pr, seed) {
  for (const e of events) {
    if (!referencesPr(e, pr, seed)) continue;
    if (e.type === 'check_suite' && e.payload?.action === 'completed') {
      return { satisfied: true, reason: 'check_suite completed', detail: { conclusion: e.payload.check_suite?.conclusion ?? null } };
    }
    if (e.type === 'status' && TERMINAL_STATUS.has(e.payload?.state)) {
      return { satisfied: true, reason: 'status terminal', detail: { state: e.payload.state } };
    }
  }
  return { satisfied: false, reason: null, detail: null };
}

function reviewVerdict(events, pr, seed) {
  for (const e of events) {
    if (!referencesPr(e, pr, seed)) continue;
    if (e.type === 'pull_request_review' && e.payload?.action === 'submitted') {
      return {
        satisfied: true,
        reason: 'review submitted',
        detail: { state: e.payload.review?.state ?? null, reviewer: e.payload.review?.user?.login ?? null },
      };
    }
  }
  return { satisfied: false, reason: null, detail: null };
}

function mergeableVerdict(events, pr, seed) {
  for (const e of events) {
    if (!referencesPr(e, pr, seed)) continue;
    if (e.type === 'pull_request' && e.payload?.pull_request?.mergeable === true) {
      return { satisfied: true, reason: 'pull_request mergeable', detail: { mergeable_state: e.payload.pull_request.mergeable_state ?? null } };
    }
  }
  return { satisfied: false, reason: null, detail: null };
}

function anyVerdict(events, pr, seed) {
  for (const e of events) {
    if (referencesPr(e, pr, seed)) {
      return { satisfied: true, reason: `${e.type} event`, detail: { type: e.type, action: e.payload?.action ?? null } };
    }
  }
  return { satisfied: false, reason: null, detail: null };
}

// Map REST responses (core bucket) into the canonical snapshot shape that
// seedVerdict consumes. This keeps gh-wait off the scarce GraphQL bucket.
export function normalizeSnapshot({ pull = {}, checkRuns = [], combinedStatus = {}, reviews = [] }) {
  const rollup = checkRuns.map((c) => ({ status: (c.status || '').toUpperCase(), conclusion: c.conclusion }));
  // Only fold in legacy commit statuses when some actually exist — an empty
  // combined status reports state:"pending" and would falsely block.
  if ((combinedStatus.statuses ?? []).length > 0) {
    rollup.push({ state: (combinedStatus.state || '').toUpperCase() });
  }
  const mergeable = pull.mergeable === true ? 'MERGEABLE' : pull.mergeable === false ? 'CONFLICTING' : 'UNKNOWN';
  return {
    headRefOid: pull.head?.sha ?? null,
    headRefName: pull.head?.ref ?? null,
    statusCheckRollup: rollup,
    reviews,
    mergeable,
    mergeStateStatus: pull.mergeable_state ?? null,
  };
}

// Is a check-rollup entry in a terminal (finished) state?
function rollupEntryDone(entry) {
  if (entry.__typename === 'CheckRun' || 'status' in entry) return entry.status === 'COMPLETED';
  // StatusContext (legacy commit statuses) report `state`.
  return entry.state != null && entry.state !== 'PENDING' && entry.state !== 'EXPECTED';
}

// Decide from the REST seed snapshot whether the wait is already
// satisfied, so a finished condition never spins up the daemon.
export function seedVerdict(snapshot, kind) {
  switch (kind) {
    case 'ci': {
      const rollup = snapshot.statusCheckRollup ?? [];
      if (rollup.length === 0) return { satisfied: false, reason: null, detail: null };
      const done = rollup.every(rollupEntryDone);
      return done
        ? { satisfied: true, reason: 'all checks complete', detail: { checks: rollup.length } }
        : { satisfied: false, reason: null, detail: null };
    }
    case 'review': {
      const reviews = snapshot.reviews ?? [];
      return reviews.length > 0
        ? { satisfied: true, reason: 'review already present', detail: { state: reviews[reviews.length - 1].state ?? null } }
        : { satisfied: false, reason: null, detail: null };
    }
    case 'mergeable': {
      return snapshot.mergeable === 'MERGEABLE'
        ? { satisfied: true, reason: 'already mergeable', detail: { mergeStateStatus: snapshot.mergeStateStatus ?? null } }
        : { satisfied: false, reason: null, detail: null };
    }
    case 'any':
      return { satisfied: false, reason: null, detail: null };
    default:
      throw new Error(`unknown wait kind: ${kind}`);
  }
}

// Like evaluate, but only considers events that arrived at/after `since`.
// gh-wait captures `since` before its seed call so stale log entries from an
// earlier wait can never satisfy a new one.
export function evaluateSince({ events = [], since = 0, condition, seed = {} }) {
  const fresh = events.filter((e) => (e.receivedAt ?? 0) >= since);
  return evaluate({ events: fresh, condition, seed });
}

export function evaluate({ events = [], condition, seed = {} }) {
  const { pr, kind } = condition;
  switch (kind) {
    case 'ci': return ciVerdict(events, pr, seed);
    case 'review': return reviewVerdict(events, pr, seed);
    case 'mergeable': return mergeableVerdict(events, pr, seed);
    case 'any': return anyVerdict(events, pr, seed);
    default: throw new Error(`unknown wait kind: ${kind}`);
  }
}
