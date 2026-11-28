'use strict';

// Rebuild letters/log.csv and letters/offices from each letter's meta.yml.

const fs = require('node:fs');
const path = require('node:path');

const TYPES = [
  'Letter',
  'FOIA request',
  'Open-records request',
  'Public comment'
];

const META_KEYS = [
  'type',
  'office',
  'state',
  'district_or_agency',
  'sent',
  'tracking_no',
  'acknowledged',
  'reply_received'
];

const LOG_COLUMNS = [
  'card',
  'type',
  'member',
  'state',
  'district_or_agency',
  'office',
  'sent',
  'tracking_no',
  'acknowledged',
  'reply_received',
  'days_waiting'
];

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

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function validLogin(login) {
  return typeof login === 'string'
    && login.length >= 1
    && login.length <= 39
    && /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9]))*$/.test(login);
}

function validCard(name) {
  return /^LTR-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(name);
}

function validSlug(name) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name);
}

function parseMeta(text, where) {
  const found = {};
  const lines = String(text || '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!match) throw new Error(`letters-log: bad meta line in ${where}: ${line}`);
    if (Object.prototype.hasOwnProperty.call(found, match[1])) {
      throw new Error(`letters-log: duplicate ${match[1]} in ${where}`);
    }
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2)
      || (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    found[match[1]] = value;
  }
  for (const key of META_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(found, key)) {
      throw new Error(`letters-log: ${where} missing ${key}`);
    }
  }
  for (const key of Object.keys(found)) {
    if (!META_KEYS.includes(key)) throw new Error(`letters-log: ${where} has unknown key ${key}`);
  }
  if (!TYPES.includes(found.type)) {
    throw new Error(`letters-log: ${where} has unknown type ${found.type}`);
  }
  if (found.state !== '' && !/^[A-Z]{2}$/.test(found.state)) {
    throw new Error(`letters-log: ${where} state must be a two-letter code or empty`);
  }
  for (const key of ['sent', 'acknowledged', 'reply_received']) {
    if (found[key] !== '' && !isIsoDate(found[key])) {
      throw new Error(`letters-log: ${where} ${key} must be YYYY-MM-DD or empty`);
    }
  }
  return found;
}

function daysBetween(start, end) {
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  return String(Math.round((to - from) / 86400000));
}

function letterFromMeta({ card, member, officeSlug, metaText, where }) {
  const meta = parseMeta(metaText, where || `${card}/${member}/${officeSlug}/meta.yml`);
  return {
    card,
    member,
    officeSlug,
    type: meta.type,
    office: meta.office,
    state: meta.state,
    district_or_agency: meta.district_or_agency,
    sent: meta.sent,
    tracking_no: meta.tracking_no,
    acknowledged: meta.acknowledged,
    reply_received: meta.reply_received
  };
}

function collectLetters(lettersDir, fsImpl = fs) {
  const letters = [];
  if (!fsImpl.existsSync(lettersDir)) return letters;
  for (const card of fsImpl.readdirSync(lettersDir, { withFileTypes: true })) {
    if (!card.isDirectory() || !validCard(card.name) || card.name === 'LTR-EXAMPLE') continue;
    const cardDir = path.join(lettersDir, card.name);
    for (const member of fsImpl.readdirSync(cardDir, { withFileTypes: true })) {
      if (!member.isDirectory()) continue;
      if (!validLogin(member.name)) {
        throw new Error(`letters-log: bad member folder ${card.name}/${member.name}`);
      }
      const memberDir = path.join(cardDir, member.name);
      for (const office of fsImpl.readdirSync(memberDir, { withFileTypes: true })) {
        if (!office.isDirectory()) continue;
        if (!validSlug(office.name)) {
          throw new Error(`letters-log: bad office slug ${card.name}/${member.name}/${office.name}`);
        }
        const metaPath = path.join(memberDir, office.name, 'meta.yml');
        if (!fsImpl.existsSync(metaPath)) continue;
        letters.push(letterFromMeta({
          card: card.name,
          member: member.name,
          officeSlug: office.name,
          metaText: fsImpl.readFileSync(metaPath, 'utf8'),
          where: metaPath
        }));
      }
    }
  }
  return letters;
}

function officePagePath(letter) {
  if (/^[A-Z]{2}$/.test(letter.state)) {
    return `letters/offices/${letter.state}/${letter.officeSlug}.md`;
  }
  return `letters/offices/agencies/${letter.officeSlug}.md`;
}

function letterDir(letter) {
  return `letters/${letter.card}/${letter.member}/${letter.officeSlug}`;
}

function relativeLink(fromFile, toDir) {
  const fromDir = fromFile.split('/').slice(0, -1);
  const toParts = toDir.split('/');
  let shared = 0;
  while (shared < fromDir.length && shared < toParts.length && fromDir[shared] === toParts[shared]) {
    shared += 1;
  }
  const parts = Array(fromDir.length - shared).fill('..').concat(toParts.slice(shared));
  return `${parts.join('/')}/`;
}

function cell(value) {
  return String(value ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
}

function csvField(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function compareLetters(a, b) {
  return a.card.localeCompare(b.card)
    || a.member.localeCompare(b.member)
    || a.officeSlug.localeCompare(b.officeSlug)
    || a.state.localeCompare(b.state);
}

function withDays(letter, today) {
  if (!isIsoDate(today)) throw new Error(`letters-log: bad today ${today}`);
  const end = letter.reply_received || (letter.sent ? today : '');
  const days = letter.sent && end ? daysBetween(letter.sent, end) : '';
  return { ...letter, days_waiting: days };
}

function pageMarkdown(pagePath, rows) {
  const first = rows[0];
  const title = first.office || first.officeSlug;
  const place = first.state
    ? `State: ${first.state}. District or agency: ${cell(first.district_or_agency) || '-'}.`
    : `Agency office. District or agency: ${cell(first.district_or_agency) || '-'}.`;
  const lines = [
    `# ${title}`,
    '',
    place,
    '',
    `Office slug: \`${first.officeSlug}\``,
    '',
    'Every letter to this office. Rebuilt by the letters-log Action. Do not edit by hand.',
    '',
    '| Card | Member | Type | Sent | Acknowledged | Reply received | Days waiting |',
    '|---|---|---|---|---|---|---|',
    ...rows.map((row) => {
      const link = relativeLink(pagePath, letterDir(row));
      return `| [${row.card}](${link}) | ${cell(row.member)} | ${cell(row.type)} | ${row.sent} | ${row.acknowledged} | ${row.reply_received} | ${row.days_waiting} |`;
    }),
    ''
  ];
  return lines.join('\n');
}

function buildOutputs(letters, today) {
  const rows = letters.map((letter) => withDays(letter, today)).sort(compareLetters);
  if (rows.length === 0) return { rows, csv: '', pages: [] };
  const csv = [
    LOG_COLUMNS.join(','),
    ...rows.map((row) => LOG_COLUMNS.map((column) => csvField(row[column])).join(','))
  ].join('\n') + '\n';
  const groups = new Map();
  for (const row of rows) {
    const pagePath = officePagePath(row);
    if (!groups.has(pagePath)) groups.set(pagePath, []);
    groups.get(pagePath).push(row);
  }
  const pages = [...groups.keys()].sort().map((pagePath) => ({
    path: pagePath,
    markdown: pageMarkdown(pagePath, groups.get(pagePath))
  }));
  return { rows, csv, pages };
}

module.exports = {
  TYPES,
  META_KEYS,
  LOG_COLUMNS,
  chicagoDate,
  isIsoDate,
  validLogin,
  parseMeta,
  letterFromMeta,
  collectLetters,
  officePagePath,
  buildOutputs
};
