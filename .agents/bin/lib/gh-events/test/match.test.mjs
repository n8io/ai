import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, evaluateSince, seedVerdict, normalizeSnapshot } from '../lib/match.mjs';

// A seed is what gh-wait learns from its single authoritative `gh pr view`
// call at startup: which head commit the PR currently points at.
const seed = { headSha: 'abc123', headBranch: 'feature/x' };

function checkSuiteCompleted(headSha, conclusion) {
  return {
    type: 'check_suite',
    payload: { action: 'completed', check_suite: { head_sha: headSha, conclusion, pull_requests: [] } },
  };
}

function reviewSubmitted(prNumber, state, login) {
  return {
    type: 'pull_request_review',
    payload: { action: 'submitted', pull_request: { number: prNumber }, review: { state, user: { login } } },
  };
}

test('ci: satisfied when a check_suite completes for the PR head sha', () => {
  const events = [checkSuiteCompleted('abc123', 'success')];
  const verdict = evaluate({ events, condition: { pr: 1370, kind: 'ci' }, seed });
  assert.equal(verdict.satisfied, true);
  assert.equal(verdict.detail.conclusion, 'success');
});

test('ci: NOT satisfied when the completed check_suite is for a different head sha', () => {
  // Mutation guard: an implementation that ignores head_sha would wrongly pass.
  const events = [checkSuiteCompleted('deadbeef', 'success')];
  const verdict = evaluate({ events, condition: { pr: 1370, kind: 'ci' }, seed });
  assert.equal(verdict.satisfied, false);
});

test('ci: NOT satisfied while the check_suite is still queued/in_progress', () => {
  const events = [{ type: 'check_suite', payload: { action: 'requested', check_suite: { head_sha: 'abc123', conclusion: null } } }];
  const verdict = evaluate({ events, condition: { pr: 1370, kind: 'ci' }, seed });
  assert.equal(verdict.satisfied, false);
});

test('review: satisfied when a review is submitted for the PR', () => {
  const events = [reviewSubmitted(1370, 'approved', 'copilot')];
  const verdict = evaluate({ events, condition: { pr: 1370, kind: 'review' }, seed });
  assert.equal(verdict.satisfied, true);
  assert.equal(verdict.detail.state, 'approved');
  assert.equal(verdict.detail.reviewer, 'copilot');
});

test('review: NOT satisfied when the review belongs to a different PR', () => {
  // Mutation guard: an implementation that ignores the PR number would wrongly pass.
  const events = [reviewSubmitted(9999, 'approved', 'copilot')];
  const verdict = evaluate({ events, condition: { pr: 1370, kind: 'review' }, seed });
  assert.equal(verdict.satisfied, false);
});

// seedVerdict answers "is it already done?" from the one `gh pr view` snapshot,
// so a finished CI run short-circuits without ever starting the daemon.

test('seed ci: satisfied when every rollup check has completed', () => {
  const rollup = [
    { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS' },
    { __typename: 'StatusContext', state: 'SUCCESS' },
  ];
  const v = seedVerdict({ statusCheckRollup: rollup }, 'ci');
  assert.equal(v.satisfied, true);
});

test('seed ci: NOT satisfied while any check is still in progress', () => {
  // Mutation guard: ignoring in-progress checks would falsely short-circuit.
  const rollup = [
    { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS' },
    { __typename: 'CheckRun', status: 'IN_PROGRESS', conclusion: null },
  ];
  const v = seedVerdict({ statusCheckRollup: rollup }, 'ci');
  assert.equal(v.satisfied, false);
});

test('seed ci: NOT satisfied when no checks have registered yet', () => {
  // Empty rollup at seed time is ambiguous — wait for events rather than
  // declaring victory, so a not-yet-started CI is not mistaken for finished.
  const v = seedVerdict({ statusCheckRollup: [] }, 'ci');
  assert.equal(v.satisfied, false);
});

test('seed review: satisfied when a review already exists', () => {
  const v = seedVerdict({ reviews: [{ state: 'APPROVED' }] }, 'review');
  assert.equal(v.satisfied, true);
});

test('seed review: NOT satisfied when there are no reviews yet', () => {
  const v = seedVerdict({ reviews: [] }, 'review');
  assert.equal(v.satisfied, false);
});

// normalizeSnapshot maps REST responses (core bucket) into the canonical shape
// seedVerdict understands, so gh-wait never touches the scarce GraphQL bucket.

test('normalizeSnapshot: all check-runs completed → ci seed is satisfied', () => {
  const snap = normalizeSnapshot({
    pull: { head: { sha: 'abc', ref: 'feat' }, mergeable: true, mergeable_state: 'clean' },
    checkRuns: [{ status: 'completed', conclusion: 'success' }, { status: 'completed', conclusion: 'success' }],
    combinedStatus: { state: 'pending', statuses: [] }, // no legacy statuses → must be ignored
    reviews: [],
  });
  assert.equal(snap.headRefOid, 'abc');
  assert.equal(seedVerdict(snap, 'ci').satisfied, true);
});

test('normalizeSnapshot: an in-progress check-run keeps ci seed unsatisfied', () => {
  const snap = normalizeSnapshot({
    pull: { head: { sha: 'abc', ref: 'feat' }, mergeable: null, mergeable_state: 'unknown' },
    checkRuns: [{ status: 'completed', conclusion: 'success' }, { status: 'in_progress', conclusion: null }],
    combinedStatus: { state: 'pending', statuses: [] },
    reviews: [],
  });
  assert.equal(seedVerdict(snap, 'ci').satisfied, false);
});

test('normalizeSnapshot: an empty combined status is not treated as a blocking pending', () => {
  // Mutation guard: including an empty combined-status (state=pending) would
  // wrongly block a PR whose GitHub-Actions checks are all done.
  const snap = normalizeSnapshot({
    pull: { head: { sha: 'abc', ref: 'feat' }, mergeable: true, mergeable_state: 'clean' },
    checkRuns: [{ status: 'completed', conclusion: 'success' }],
    combinedStatus: { state: 'pending', statuses: [] },
    reviews: [],
  });
  assert.equal(seedVerdict(snap, 'ci').satisfied, true);
});

// The wait must ignore events that predate it — the daemon's log is shared and
// long-lived, so a leftover event from an earlier wait must not satisfy a new one.

test('evaluateSince: a stale event that predates the wait does NOT satisfy it', () => {
  const events = [{ type: 'issue_comment', receivedAt: 100, payload: { action: 'created', issue: { number: 1370 } } }];
  const v = evaluateSince({ events, since: 200, condition: { pr: 1370, kind: 'any' }, seed: {} });
  assert.equal(v.satisfied, false);
});

test('evaluateSince: an event at/after the wait start satisfies it', () => {
  const events = [{ type: 'issue_comment', receivedAt: 300, payload: { action: 'created', issue: { number: 1370 } } }];
  const v = evaluateSince({ events, since: 200, condition: { pr: 1370, kind: 'any' }, seed: {} });
  assert.equal(v.satisfied, true);
});

test('normalizeSnapshot: mergeable boolean becomes MERGEABLE', () => {
  const snap = normalizeSnapshot({
    pull: { head: { sha: 'abc', ref: 'feat' }, mergeable: true, mergeable_state: 'clean' },
    checkRuns: [], combinedStatus: { state: 'success', statuses: [] }, reviews: [],
  });
  assert.equal(snap.mergeable, 'MERGEABLE');
  assert.equal(seedVerdict(snap, 'mergeable').satisfied, true);
});
