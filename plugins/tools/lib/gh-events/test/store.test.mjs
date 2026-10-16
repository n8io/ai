import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldEvent, emptyState } from '../lib/store.mjs';

test('foldEvent records the latest event per PR and counts totals', () => {
  let s = emptyState();
  s = foldEvent(s, { type: 'pull_request_review', payload: { action: 'submitted', pull_request: { number: 1370 } }, receivedAt: 5 });
  assert.equal(s.total, 1);
  assert.equal(s.byPr['1370'].lastType, 'pull_request_review');
  assert.equal(s.byPr['1370'].lastAction, 'submitted');
  assert.equal(s.byPr['1370'].at, 5);
});

test('foldEvent records check_suite conclusion keyed by head sha', () => {
  let s = emptyState();
  s = foldEvent(s, { type: 'check_suite', payload: { action: 'completed', check_suite: { head_sha: 'abc123', conclusion: 'success' } }, receivedAt: 9 });
  assert.equal(s.bySha['abc123'].conclusion, 'success');
});

test('foldEvent keeps the most recent event when a PR gets two events', () => {
  let s = emptyState();
  s = foldEvent(s, { type: 'pull_request', payload: { action: 'synchronize', pull_request: { number: 1370 } }, receivedAt: 5 });
  s = foldEvent(s, { type: 'issue_comment', payload: { action: 'created', issue: { number: 1370 } }, receivedAt: 8 });
  assert.equal(s.total, 2);
  assert.equal(s.byPr['1370'].lastType, 'issue_comment');
  assert.equal(s.byPr['1370'].at, 8);
});
