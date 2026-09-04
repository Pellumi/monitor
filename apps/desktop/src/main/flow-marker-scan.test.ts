import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { distinctMarkers, extractFlowMarkers, scanWorkspaceForFlowMarkers } from './flow-marker-scan';

test('reads the friendly marker format and reports where it was found', () => {
  const hits = extractFlowMarkers('src/checkout.ts', [
    "export function startCheckout() {",
    "  TELLANN.trackEvent('FLOW_INITIAL_STATE', { flow: 'checkout', state: 'cart-viewed' });",
    "}",
  ].join('\n'));
  assert.equal(hits.length, 1);
  assert.deepEqual(
    { ...hits[0] },
    { file: 'src/checkout.ts', line: 2, eventType: 'FLOW_INITIAL_STATE', flow: 'checkout', state: 'cart-viewed', transition: null, checkpointId: null },
  );
});

test('accepts markers split across lines and written in other languages', () => {
  const wrapped = extractFlowMarkers('src/receipt.ts', [
    "TELLANN.trackEvent('FLOW_TERMINAL_STATE', {",
    "  flow: 'checkout',",
    "  state: 'order-confirmed',",
    "});",
  ].join('\n'));
  assert.deepEqual(wrapped.map((hit) => [hit.state, hit.line]), [['order-confirmed', 1]]);
  const python = extractFlowMarkers('app/views.py', 'TELLANN.track_event("FLOW_TRANSITION", {"flow": "checkout", "transition": "submit-payment"})');
  assert.equal(python[0]?.transition, 'submit-payment');
});

test('still recognises legacy checkpointId markers, and ignores bare event names', () => {
  const legacy = extractFlowMarkers('src/legacy.ts', "TELLANN.trackEvent('FLOW_INITIAL_STATE', { checkpointId: 'state:901c8745', stateId: '901c8745', transitionId: null });");
  assert.equal(legacy[0]?.checkpointId, 'state:901c8745');
  const mention = extractFlowMarkers('src/types.ts', "type FlowEvent = 'FLOW_INITIAL_STATE' | 'FLOW_TERMINAL_STATE';");
  assert.deepEqual(mention, [], 'an event name with no marker fields is not a checkpoint');
});

test('walks a workspace, skipping ignored directories and unreadable file types', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-marker-scan-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'node_modules', 'pkg'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'start.ts'), "TELLANN.trackEvent('FLOW_INITIAL_STATE', { flow: 'checkout', state: 'cart-viewed' });");
  fs.writeFileSync(path.join(root, 'src', 'finish.tsx'), "TELLANN.trackEvent('FLOW_TERMINAL_STATE', { flow: 'checkout', state: 'order-confirmed' });");
  fs.writeFileSync(path.join(root, 'src', 'notes.md'), "TELLANN.trackEvent('FLOW_INITIAL_STATE', { flow: 'checkout', state: 'cart-viewed' });");
  fs.writeFileSync(path.join(root, 'node_modules', 'pkg', 'index.js'), "TELLANN.trackEvent('FLOW_INITIAL_STATE', { flow: 'other', state: 'noise' });");

  const result = scanWorkspaceForFlowMarkers(root);
  assert.deepEqual(
    result.matches.map((hit) => `${hit.eventType}:${hit.state}`).sort(),
    ['FLOW_INITIAL_STATE:cart-viewed', 'FLOW_TERMINAL_STATE:order-confirmed'],
  );
  assert.equal(result.filesScanned, 2, 'documentation and dependencies are not scanned');
  fs.rmSync(root, { recursive: true, force: true });
});

test('sends one hit per distinct marker', () => {
  const hit = (state: string, line: number) => ({ file: 'src/a.ts', line, eventType: 'FLOW_INITIAL_STATE', flow: 'checkout', state, transition: null, checkpointId: null });
  const unique = distinctMarkers([hit('cart-viewed', 1), hit('cart-viewed', 90), hit('order-confirmed', 12)]);
  assert.deepEqual(unique.map((item) => [item.state, item.line]), [['cart-viewed', 1], ['order-confirmed', 12]]);
  assert.equal(distinctMarkers([hit('a', 1), hit('b', 2), hit('c', 3)], 2).length, 2, 'the payload stays bounded');
});
