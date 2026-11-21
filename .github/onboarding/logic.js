'use strict';

const AI_OPTIONS = new Set([
  'Claude (free)',
  'Claude (paid)',
  'ChatGPT',
  'Grok',
  'Other'
]);

const ALLOWED_ROLES = new Set(['pull', 'triage', 'push']);

const ALREADY_MEMBER = "You're already a member,";
const MISMATCH_REPLY = "That check word doesn't match. Ask your AI to read ONBOARDING.md again.";
const ONBOARDED_COMMENT = "You're onboarded! Accept your invite at https://github.com/RuntimeRepublic/Team-America/invitations";
const ADMIN_INVITE_COMMENT = 'An admin will send the invite.';
const INVALID_LOGIN_COMMENT = 'This GitHub login cannot be used for a member file. An admin will look at this issue.';

const FALLBACK_WELCOME = [
  'Welcome. Follow these steps to finish joining.',
  '',
  "1. Make sure you're signed in to GitHub.",
  '2. Open your AI (Claude recommended; free is fine) and paste this prompt:',
  '',
  'Read these three files:',
  'https://raw.githubusercontent.com/RuntimeRepublic/Team-America/main/README.md',
  'https://raw.githubusercontent.com/RuntimeRepublic/Team-America/main/DATA-RULES.md',
  'https://raw.githubusercontent.com/RuntimeRepublic/Team-America/main/ONBOARDING.md',
  'In 3 bullet points, tell me what this team does and what I must never put in the repo. Then tell me the smoke test check word from ONBOARDING.md.',
  '',
  '3. On your ONBOARD: issue, comment exactly: onboarded <check word>',
  '4. Accept the invite GitHub emails you (or open https://github.com/RuntimeRepublic/Team-America/invitations).',
  ''
].join('\n');

function chicagoDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function normalize(text) {
  return (text || '').replace(/\r\n/g, '\n');
}

function trimWord(value) {
  return (value || '').trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
}

function validLogin(login) {
  return typeof login === 'string'
    && login.length >= 1
    && login.length <= 39
    && /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9]))*$/.test(login);
}

function isBot(user) {
  if (!user || typeof user.login !== 'string') return true;
  if (user.type === 'Bot') return true;
  return user.login.endsWith('[bot]');
}

function parseAi(body) {
  const match = normalize(body).match(/^### AI[ \t]*\n+([^\n]+)/m);
  if (!match) return 'Other';
  const value = match[1].trim();
  return AI_OPTIONS.has(value) ? value : 'Other';
}

function parseListMe(body) {
  return /(?:^|\n)-\s+\[[xX]\]\s+OK to list my GitHub username in MEMBERS\.md\./.test(normalize(body));
}

function memberFile({ login, joined, ai, issueNumber }) {
  return [
    `# ${login}`,
    '',
    'Role: Member',
    `Joined: ${joined}`,
    `AI: ${ai}`,
    `Onboarding issue: #${issueNumber}`,
    ''
  ].join('\n');
}

function sameIssueMember(existing, issueNumber) {
  if (!/^\d+$/.test(String(issueNumber))) return false;
  return new RegExp(`^Onboarding issue: #${issueNumber}$`, 'm').test(normalize(existing));
}

function readCheckWord(onboardingText) {
  const match = normalize(onboardingText).match(/^Smoke test check word:[ \t]*(.*)$/m);
  if (!match) return null;
  return trimWord(match[1]) || null;
}

function commentIntent(commentBody) {
  const raw = normalize(commentBody).trim();
  if (!/^onboarded\b/i.test(raw)) return { kind: 'ignore' };
  const after = raw.replace(/^onboarded\b/i, '').trim();
  const first = after.split(/\s+/)[0] || '';
  return { kind: 'attempt', word: trimWord(first) };
}

function wordsMatch(given, expected) {
  if (!given || !expected) return false;
  return given.toLowerCase() === expected.toLowerCase();
}

function judgeComment(commentBody, checkWord) {
  const intent = commentIntent(commentBody);
  if (intent.kind === 'ignore') return { action: 'ignore' };
  if (!wordsMatch(intent.word, trimWord(checkWord))) {
    return { action: 'mismatch', reply: MISMATCH_REPLY };
  }
  return { action: 'match' };
}

function welcomeFromOnboarding(text) {
  const safe = normalize(text)
    .split('\n')
    .filter((line) => !/^Smoke test check word:/.test(line))
    .join('\n')
    .trim();
  return `Welcome. Follow these steps to finish joining.\n\n${safe}\n`;
}

function ackLine({ login, teamName, teamLead, date }) {
  return `ACK ${login} | ${teamName} onboarding bot for ${teamLead} | ${date} | read members/${login}.md | loop OK`;
}

function appendMembersRow(markdown, login, date) {
  const row = `| ${login} | Member | ${date} |`;
  const normalized = normalize(markdown);
  const lines = normalized.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  const already = lines.some((line) => {
    if (!line.startsWith('|')) return false;
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells[1] === 'Member' && cells[2] === 'Role') return false;
    if (/^-+$/.test(cells[1] || '')) return false;
    return cells[1] === login;
  });
  if (already) return markdown;

  let last = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].startsWith('|')) last = index;
  }
  if (last === -1) throw new Error('MEMBERS.md table not found');

  lines.splice(last + 1, 0, row);
  return `${lines.join('\n')}\n`;
}

function roleAllowed(role) {
  return ALLOWED_ROLES.has(role);
}

function httpStatus(error) {
  if (error && typeof error.status === 'number') return error.status;
  if (error && error.response && typeof error.response.status === 'number') return error.response.status;
  return 0;
}

function decodeGithubContent(data) {
  if (!data || data.type !== 'file' || typeof data.content !== 'string') {
    throw new Error('Unexpected file response');
  }
  if (data.encoding !== 'base64') throw new Error('Unexpected file encoding');
  return Buffer.from(data.content.replace(/\s/g, ''), 'base64').toString('utf8');
}

module.exports = {
  ADMIN_INVITE_COMMENT,
  ALREADY_MEMBER,
  FALLBACK_WELCOME,
  INVALID_LOGIN_COMMENT,
  MISMATCH_REPLY,
  ONBOARDED_COMMENT,
  ackLine,
  appendMembersRow,
  chicagoDate,
  commentIntent,
  decodeGithubContent,
  httpStatus,
  isBot,
  judgeComment,
  memberFile,
  parseAi,
  parseListMe,
  readCheckWord,
  roleAllowed,
  sameIssueMember,
  validLogin,
  welcomeFromOnboarding,
  wordsMatch
};
