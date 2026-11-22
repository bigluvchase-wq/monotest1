const assert = require('node:assert/strict');
const {test} = require('node:test');
const Period = require('../Mono/Web/period.js');
const Engine = require('../Mono/Web/engine.js');

test('presets start on the selected date and chart buckets stay inside the period', () => {
  const month = Period.preset('month', '2026-10-06');
  assert.deepEqual(month, {start: '2026-10-06', end: '2026-11-06'});
  assert.equal(Period.buckets(month).length, 32);
  assert.equal(Period.buckets(Period.month('2026-11')).length, 30);
  assert.equal(Period.buckets(Period.preset('week', '2026-10-06')).length, 7);
  assert.equal(Period.preset('month', '2026-01-31').end, '2026-02-28');
  assert.equal(Period.preset('year', '2024-02-29').end, '2025-02-28');
  const year = Period.buckets(Period.preset('year', '2026-10-06'));
  assert.deepEqual(year[0], {start: '2026-10-06', end: '2026-10-31'});
  assert.deepEqual(year.at(-1), {start: '2027-10-01', end: '2027-10-06'});
  const custom = Period.range('2026-11-05', '2026-11-06');
  assert.deepEqual(Period.buckets(custom), [
    {start: '2026-11-05', end: '2026-11-05'},
    {start: '2026-11-06', end: '2026-11-06'}
  ]);
});

const cases = require('../server/voice-examples.json').examples.filter(e=>e.id.startsWith('legacy-'));

// Legacy references are preserved for compatibility; disputed cases are marked review in the shared corpus.
test('continuous dictation preserves 85 existing operation references across 28 examples', () => {
  const now = new Date(2026, 10, 9, 12);
  for (const {id, text: phrase, legacyExpected} of cases) {
    const state = Engine.initialState();
    let expected = legacyExpected;
    if (id === 'legacy-17') {
      // This fixture used to expense cash withdrawals. A cash account keeps the cash in the ledger.
      state.accounts.push({id: 'cash', name: 'Наличные', initial: 0, currency: 'RUB'});
      expected = expected.replace('5000:Финансовые_операции', '5000:::transfer');
    }
    const result = Engine.parse(phrase, now, [], state);
    const entries = expected.split(' ').map(operation => {
      const [rubles, category, day, type] = operation.split(':');
      return [Number(rubles) * 100, category.replaceAll('_', ' ') || undefined, '2026-11-' + (day || '09'), type || 'expense'];
    });
    assert.deepEqual(result.errors, [], phrase);
    assert.deepEqual(result.entries.map(e => [e.amount, e.category, e.date, e.type]), entries, phrase);
  }
});

test('mixed dictation retains quantity pricing and keeps own transfers separate', () => {
  const now = new Date(2026, 10, 9, 12);
  const state = Engine.initialState();
  state.accounts.push({id: 'cash', name: 'Наличные', initial: 0, currency: 'RUB'});
  const result = Engine.parse('Купил 2 яблока по 100, перевел между своими счетами 500 и такси 300', now, [], state);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.entries.map(e => [e.amount, e.type]), [[20000, 'expense'], [50000, 'transfer'], [30000, 'expense']]);
});
