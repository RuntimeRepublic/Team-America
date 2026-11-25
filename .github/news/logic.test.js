'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const news = require('./logic.js');

const BODY = [
  '### Type',
  '',
  'Win - Saturday post done',
  '',
  '### Team',
  '',
  'Team America (FairTax)',
  '',
  '### What happened',
  '',
  'Posted the H.R. 25 explainer in the Hawaii group.',
  'Two people asked how to join.',
  '',
  '### Link (optional)',
  '',
  '_No response_',
  '',
  '### Data rules',
  '',
  '- [X] No personal data in this post.'
].join('\r\n');

test('parses the form into a news item', () => {
  assert.deepEqual(news.parseNews(BODY), {
    type: 'win-sat',
    team: 'Team America (FairTax)',
    what: 'Posted the H.R. 25 explainer in the Hawaii group. Two people asked how to join.',
    link: ''
  });
});

test('unknown type becomes other; pipes are escaped', () => {
  const parsed = news.parseNews('### Type\n\nSomething\n\n### What happened\n\nA | B');
  assert.equal(parsed.type, 'other');
  assert.equal(parsed.what, 'A / B');
});

test('builds one log line', () => {
  const line = news.logLine({
    date: '2026-11-28',
    news: news.parseNews(BODY),
    login: 'FAIRTaxFrank',
    issueNumber: 7
  });
  assert.equal(line, '- 2026-11-28 | win-sat | Team America (FairTax) | @FAIRTaxFrank | Posted the H.R. 25 explainer in the Hawaii group. Two people asked how to join. | - | #7');
});

test('appends to a new log, then replaces on edit, then no-ops', () => {
  const first = news.upsertLine('', '- a | #7', 7);
  assert.ok(first.startsWith('# Team log'));
  assert.ok(first.endsWith('- a | #7\n'));
  const second = news.upsertLine(`${first}- b | #8\n`, '- c | #7', 7);
  assert.ok(second.includes('- c | #7') && !second.includes('- a | #7') && second.includes('- b | #8'));
  assert.equal(news.upsertLine(second, '- c | #7', 7), null);
});

test('issue #7 does not match #70', () => {
  const md = `${news.LOG_HEADER}- x | #70\n`;
  const out = news.upsertLine(md, '- y | #7', 7);
  assert.ok(out.includes('- x | #70') && out.includes('- y | #7'));
});

test('flags dollar amounts and account-style numbers, not dates or bill numbers', () => {
  assert.equal(news.hasPersonalData('Spent $40 on flyers'), true);
  assert.equal(news.hasPersonalData('Account 1234 5678 9012'), true);
  assert.equal(news.hasPersonalData('H.R. 25 hearing on 2026-12-03'), false);
  assert.equal(news.hasPersonalData('Called 316-555-0100'), true);
});

test('issue date uses Chicago time', () => {
  assert.equal(news.issueDate('2026-11-29T03:00:00Z'), '2026-11-28');
});
