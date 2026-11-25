'use strict';

// Team news: turn a "Team news" issue form into one line of news/team-log.md.

const { chicagoDate } = require('../onboarding/logic.js');

function normalize(text) {
  return (text || '').replace(/\r\n/g, '\n');
}

const LOG_PATH = 'news/team-log.md';

const TYPE_CODES = {
  'Win - Saturday post done': 'win-sat',
  'Win - mid-week post done': 'win-mid',
  'Win - other': 'win',
  'Finding - something the team should know': 'finding',
  'Issue - a problem or blocker': 'issue',
  'Fixed - an issue that is now solved': 'fixed'
};

const LOG_HEADER = [
  '# Team log',
  '',
  'One line per Team news post, written by the news-log Action. Do not edit by hand;',
  'edit the issue instead and the line updates.',
  '',
  'Format: `date | type | team | member | what happened | link | issue`',
  '',
  'Types: `win-sat` Saturday post · `win-mid` mid-week post · `win` other win ·',
  '`finding` · `issue` open problem · `fixed` solved problem',
  '',
  '## Log',
  ''
].join('\n');

const BLOCKED_COMMENT = [
  'This news post was **not logged** because it looks like it has personal data',
  '(a dollar amount or a long account-style number).',
  '',
  'Please edit the post to remove it (see DATA-RULES.md). It will be logged as soon as you save.'
].join('\n');

function field(body, label) {
  const text = normalize(body);
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`^### ${escaped}[ \\t]*\\n+([\\s\\S]*?)(?=\\n### |(?![\\s\\S]))`, 'm'));
  if (!match) return '';
  const value = match[1].trim();
  return value === '_No response_' ? '' : value;
}

function oneLine(text, max = 280) {
  const flat = (text || '').replace(/\s+/g, ' ').replace(/\|/g, '/').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function parseNews(body) {
  const type = TYPE_CODES[field(body, 'Type')] || 'other';
  return {
    type,
    team: oneLine(field(body, 'Team'), 60) || 'Other',
    what: oneLine(field(body, 'What happened')),
    link: oneLine(field(body, 'Link (optional)'), 200)
  };
}

function hasPersonalData(text) {
  const t = text || '';
  return /\$\s?\d/.test(t) || /\d[\d -]{7,}\d/.test(t.replace(/\b(19|20)\d\d-\d\d-\d\d\b/g, ''));
}

function logLine({ date, news, login, issueNumber }) {
  return `- ${date} | ${news.type} | ${news.team} | @${login} | ${news.what} | ${news.link || '-'} | #${issueNumber}`;
}

function upsertLine(markdown, line, issueNumber) {
  const text = normalize(markdown || '') || LOG_HEADER;
  const tag = ` | #${issueNumber}`;
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.startsWith('- ') && l.endsWith(tag));
  if (at >= 0) {
    if (lines[at] === line) return null; // nothing changed
    lines[at] = line;
    return lines.join('\n');
  }
  return `${text.replace(/\n*$/, '\n')}${line}\n`;
}

function issueDate(createdAt) {
  return chicagoDate(createdAt ? new Date(createdAt) : new Date());
}

module.exports = {
  BLOCKED_COMMENT,
  LOG_HEADER,
  LOG_PATH,
  field,
  hasPersonalData,
  issueDate,
  logLine,
  oneLine,
  parseNews,
  upsertLine
};
