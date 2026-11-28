'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const logic = require('./logic.js');
const build = require('./build.js');

const STATE_META = [
  'type: Letter',
  'office: Example Office',
  'state: KS',
  'district_or_agency: KS-04',
  'sent: 2026-01-15',
  'tracking_no: EXAMPLE',
  'acknowledged:',
  'reply_received:'
].join('\n');

test('parses meta and counts days until a fixed today', () => {
  const letter = logic.letterFromMeta({
    card: 'LTR-TEST',
    member: 'example-member',
    officeSlug: 'us-house-ks-04',
    metaText: STATE_META
  });
  const built = logic.buildOutputs([letter], '2026-02-01');
  assert.equal(built.rows[0].days_waiting, '17');
  assert.equal(
    built.csv,
    'card,type,member,state,district_or_agency,office,sent,tracking_no,acknowledged,reply_received,days_waiting\n'
    + 'LTR-TEST,Letter,example-member,KS,KS-04,Example Office,2026-01-15,EXAMPLE,,,17\n'
  );
  assert.equal(built.pages[0].path, 'letters/offices/KS/us-house-ks-04.md');
  assert.match(built.pages[0].markdown, /\[LTR-TEST\]\(\.\.\/\.\.\/LTR-TEST\/example-member\/us-house-ks-04\/\)/);
  assert.match(built.pages[0].markdown, /2026-01-15/);
});

test('a reply date ends the wait, and an agency page has no state folder', () => {
  const letter = logic.letterFromMeta({
    card: 'LTR-0001',
    member: 'example-member',
    officeSlug: 'agency-ssa-foia',
    metaText: [
      'type: FOIA request',
      'office: Example Agency FOIA',
      'state:',
      'district_or_agency: Example Agency',
      'sent: 2026-01-01',
      'tracking_no: EXAMPLE-FOIA',
      'acknowledged: 2026-01-02',
      'reply_received: 2026-01-05'
    ].join('\n')
  });
  const built = logic.buildOutputs([letter], '2026-02-01');
  assert.equal(built.rows[0].days_waiting, '4');
  assert.equal(logic.officePagePath(letter), 'letters/offices/agencies/agency-ssa-foia.md');
  assert.match(built.pages[0].markdown, /Agency office/);
});

test('quotes a comma in the office name and writes nothing when there are no letters', () => {
  const letter = logic.letterFromMeta({
    card: 'LTR-0002',
    member: 'example-member',
    officeSlug: 'us-house-ks-04',
    metaText: STATE_META.replace('Example Office', 'Example Office, Unit A')
  });
  const built = logic.buildOutputs([letter], '2026-02-01');
  assert.match(built.csv, /"Example Office, Unit A"/);
  assert.deepEqual(logic.buildOutputs([], '2026-02-01'), { rows: [], csv: '', pages: [] });
});

test('LTR-EXAMPLE is documented and is not logged', () => {
  const examplePath = path.join(
    __dirname,
    '../../letters/LTR-EXAMPLE/example-member/us-house-ks-04/meta.yml'
  );
  const letter = logic.letterFromMeta({
    card: 'LTR-EXAMPLE',
    member: 'example-member',
    officeSlug: 'us-house-ks-04',
    metaText: fs.readFileSync(examplePath, 'utf8')
  });
  assert.equal(letter.office, 'Example Office');
  assert.equal(letter.tracking_no, 'EXAMPLE');
  const found = logic.collectLetters(path.join(__dirname, '../../letters'));
  assert.equal(found.some((row) => row.card === 'LTR-EXAMPLE'), false);
});

test('applyBuild writes a log row and an office page, then removes them', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'letters-'));
  const dir = path.join(root, 'letters', 'LTR-TEST', 'example-member', 'us-house-ks-04');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.yml'), `${STATE_META}\n`, 'utf8');
  const first = build.applyBuild(root, '2026-02-01');
  assert.equal(first.letters.length, 1);
  const log = fs.readFileSync(path.join(root, 'letters', 'log.csv'), 'utf8');
  assert.match(log, /^card,type,member,state,district_or_agency,office,sent,tracking_no,acknowledged,reply_received,days_waiting\nLTR-TEST,/);
  assert.equal(fs.existsSync(path.join(root, 'letters', 'offices', 'KS', 'us-house-ks-04.md')), true);
  fs.rmSync(path.join(root, 'letters', 'LTR-TEST'), { recursive: true, force: true });
  build.applyBuild(root, '2026-02-01');
  assert.equal(fs.existsSync(path.join(root, 'letters', 'log.csv')), false);
  assert.equal(fs.existsSync(path.join(root, 'letters', 'offices')), false);
});
