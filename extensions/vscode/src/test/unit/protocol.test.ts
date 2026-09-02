import * as assert from 'assert';
import { isWebviewMessage } from '../../shared/protocol';

suite('Cockpit protocol', () => {
  test('accepts typed dashboard messages', () => {
    assert.strictEqual(isWebviewMessage({ type: 'dashboard.refresh' }), true);
    assert.strictEqual(isWebviewMessage({ type: 'dashboard.mutate', payload: { action: 'team.create', values: { name: 'Platform' } } }), true);
  });

  test('rejects non-message values', () => {
    assert.strictEqual(isWebviewMessage(null), false);
    assert.strictEqual(isWebviewMessage({ payload: {} }), false);
    assert.strictEqual(isWebviewMessage('dashboard.refresh'), false);
    assert.strictEqual(isWebviewMessage({ type: 'dashboard.deleteEverything' }), false);
  });
});
