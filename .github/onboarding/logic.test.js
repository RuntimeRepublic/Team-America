'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const logic = require('./logic.js');

const root = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('Chicago date is YYYY-MM-DD across the UTC offset', () => {
  assert.equal(logic.chicagoDate(new Date('2026-01-01T05:30:00Z')), '2025-12-31');
  assert.equal(logic.chicagoDate(new Date('2026-01-01T06:00:00Z')), '2026-01-01');
  assert.equal(logic.chicagoDate(new Date('2026-07-01T04:30:00Z')), '2026-06-30');
  assert.equal(logic.chicagoDate(new Date('2026-07-01T05:00:00Z')), '2026-07-01');
});

test('form answers keep only the AI choice and the list-me checkbox', () => {
  const body = [
    "You're joining as your GitHub username.",
    '',
    '### AI',
    '',
    'Claude (free)',
    '',
    '### Data rules',
    '',
    '- [x] I read DATA-RULES.md and will never put personal data in this repo.',
    '',
    '### Values',
    '',
    '- [x] I understand Team America follows the Runtime Republic control documents.',
    '',
    '### Members list',
    '',
    '- [x] OK to list my GitHub username in MEMBERS.md.'
  ].join('\n');

  assert.equal(logic.parseAi(body), 'Claude (free)');
  assert.equal(logic.parseListMe(body), true);
  assert.equal(logic.parseAi('### AI\n\nJane Doe\n'), 'Other');
  assert.equal(logic.parseAi('no heading'), 'Other');
  assert.equal(logic.parseListMe('- [ ] OK to list my GitHub username in MEMBERS.md.'), false);
  assert.equal(logic.parseListMe(''), false);
});

test('member file is the public record and nothing else', () => {
  assert.equal(
    logic.memberFile({ login: 'octocat', joined: '2026-11-20', ai: 'Grok', issueNumber: 12 }),
    '# octocat\n\nRole: Member\nJoined: 2026-11-20\nAI: Grok\nOnboarding issue: #12\n'
  );
  const file = logic.memberFile({ login: 'octocat', joined: '2026-11-20', ai: 'Grok', issueNumber: 12 });
  assert.equal(logic.sameIssueMember(file, 12), true);
  assert.equal(logic.sameIssueMember(file, 1), false);
  assert.equal(logic.sameIssueMember(file, 123), false);
});

test('check word matching never puts the word in a reply', () => {
  const onboarding = read('ONBOARDING.md');
  const word = logic.readCheckWord(onboarding);
  assert.ok(word);
  assert.equal(onboarding.split(word).length, 2);

  const welcome = logic.welcomeFromOnboarding(onboarding);
  assert.equal(welcome.includes(word), false);
  assert.equal(/^Smoke test check word:/m.test(welcome), false);
  assert.match(welcome, /https:\/\/raw\.githubusercontent\.com\/RuntimeRepublic\/Team-America\/main\/README\.md/);
  assert.match(welcome, /https:\/\/raw\.githubusercontent\.com\/RuntimeRepublic\/Team-America\/main\/DATA-RULES\.md/);
  assert.match(welcome, /https:\/\/raw\.githubusercontent\.com\/RuntimeRepublic\/Team-America\/main\/ONBOARDING\.md/);
  assert.equal(logic.FALLBACK_WELCOME.includes(word), false);

  assert.equal(logic.judgeComment('thanks for the welcome', word).action, 'ignore');
  assert.equal(logic.judgeComment(`please onboarded ${word}`, word).action, 'ignore');

  const mismatch = logic.judgeComment('onboarded nope', word);
  assert.equal(mismatch.action, 'mismatch');
  assert.equal(mismatch.reply, logic.MISMATCH_REPLY);
  assert.equal(mismatch.reply.includes(word), false);

  assert.equal(logic.judgeComment(`onboarded ${word}`, word).action, 'match');
  assert.equal(logic.judgeComment(`ONBOARDED ${word.toLowerCase()}!`, word).action, 'match');
  assert.equal(logic.judgeComment(`onboarded "${word}".`, word).action, 'match');
  assert.equal(logic.judgeComment(`onboarded ${word} thanks`, word).action, 'match');
});

test('the check word is written only in ONBOARDING.md', () => {
  const word = logic.readCheckWord(read('ONBOARDING.md'));
  const files = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else files.push(fullPath);
    }
  }
  walk(root);
  for (const file of files) {
    if (file === path.join(root, 'ONBOARDING.md')) continue;
    assert.equal(fs.readFileSync(file, 'utf8').includes(word), false, file);
  }
});

test('invite role cannot be maintain or admin', () => {
  const config = JSON.parse(read('.github/onboarding.json'));
  assert.equal(config.invite_role, 'triage');
  assert.equal(logic.roleAllowed(config.invite_role), true);
  assert.equal(logic.roleAllowed('pull'), true);
  assert.equal(logic.roleAllowed('push'), true);
  assert.equal(logic.roleAllowed('maintain'), false);
  assert.equal(logic.roleAllowed('admin'), false);
  assert.equal(logic.roleAllowed(''), false);
});

test('MEMBERS.md gains one row and only when that login is new', () => {
  const original = read('MEMBERS.md');
  const next = logic.appendMembersRow(original, 'octocat', '2026-11-20');
  const james = next.indexOf('| James Hodges |');
  const added = next.indexOf('| octocat | Member | 2026-11-20 |');
  const note = next.indexOf('Second admin:');
  assert.ok(james !== -1 && added !== -1 && note !== -1);
  assert.ok(james < added && added < note);
  assert.equal(logic.appendMembersRow(next, 'octocat', '2026-11-21'), next);
  assert.equal(next.includes('2026-11-21'), false);
});

test('ACK line matches the public record', () => {
  assert.equal(
    logic.ackLine({
      login: 'octocat',
      teamName: 'Team America',
      teamLead: 'James Hodges',
      date: '2026-11-20'
    }),
    'ACK octocat | Team America onboarding bot for James Hodges | 2026-11-20 | read members/octocat.md | loop OK'
  );
});

test('logins and bots', () => {
  assert.equal(logic.validLogin('octocat'), true);
  assert.equal(logic.validLogin('a-b'), true);
  assert.equal(logic.validLogin('a--b'), false);
  assert.equal(logic.validLogin('../etc'), false);
  assert.equal(logic.validLogin('-ab'), false);
  assert.equal(logic.isBot({ login: 'octocat', type: 'User' }), false);
  assert.equal(logic.isBot({ login: 'github-actions[bot]', type: 'Bot' }), true);
  assert.equal(logic.isBot(null), true);
});

test('GitHub file content decodes without keeping the base64 wrapper', () => {
  const text = '# octocat\n\nRole: Member\n';
  const wrapped = Buffer.from(text, 'utf8').toString('base64').replace(/.{4}/g, '$&\n');
  assert.equal(logic.decodeGithubContent({
    type: 'file',
    encoding: 'base64',
    content: wrapped
  }), text);
});

test('join form has the requested fields and no personal-data fields', () => {
  const form = read('.github/ISSUE_TEMPLATE/join.yml');
  const intro = form.indexOf("Don't type your real name, address, employer or any dollar amounts");
  const ai = form.indexOf('id: ai');
  const dataRules = form.indexOf('id: data_rules');
  const values = form.indexOf('id: values');
  const listMe = form.indexOf('id: list_me');
  assert.ok(intro !== -1 && intro < ai && ai < dataRules && dataRules < values && values < listMe);
  assert.match(form, /Claude \(free\)/);
  assert.match(form, /Claude \(paid\)/);
  assert.match(form, /ChatGPT/);
  assert.match(form, /Grok/);
  assert.match(form, /Other/);
  assert.match(form, /I read DATA-RULES\.md and will never put personal data in this repo\./);
  assert.match(form, /I understand Team America follows the Runtime Republic control documents\./);
  assert.match(form, /OK to list my GitHub username in MEMBERS\.md\./);
  assert.equal(/^\s*id:\s*(name|email|phone|location)\s*$/m.test(form), false);
});

test('workflows do not print the check word or the token', () => {
  for (const relativePath of [
    '.github/workflows/onboard-open.yml',
    '.github/workflows/onboard-verify.yml'
  ]) {
    const source = read(relativePath);
    assert.equal(source.includes('console.log'), false, relativePath);
    assert.equal(source.includes('core.info'), false, relativePath);
    assert.equal(source.includes('core.debug'), false, relativePath);
    assert.equal(/echo\b/.test(source), false, relativePath);
    assert.match(source, /actions\/github-script@v7/);
    assert.match(source, /concurrency: onboard-\$\{\{ github\.event\.issue\.number \}\}/);
  }
  const verify = read('.github/workflows/onboard-verify.yml');
  assert.match(verify, /secrets\.ONBOARD_TOKEN/);
  assert.equal(verify.includes('secrets.GITHUB_TOKEN'), false);
});
