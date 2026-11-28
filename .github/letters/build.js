'use strict';

// Rebuild letters/log.csv and letters/offices from meta.yml files.
// Office pages and the log are written only when a letter exists.

const fs = require('node:fs');
const path = require('node:path');
const logic = require('./logic.js');

function applyBuild(repoRoot, today) {
  const lettersDir = path.join(repoRoot, 'letters');
  if (!fs.existsSync(lettersDir)) return { letters: [], csv: '', pages: [] };
  const letters = logic.collectLetters(lettersDir);
  const built = logic.buildOutputs(letters, today);
  const logPath = path.join(lettersDir, 'log.csv');
  if (built.csv) fs.writeFileSync(logPath, built.csv, 'utf8');
  else if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

  const officesDir = path.join(lettersDir, 'offices');
  fs.rmSync(officesDir, { recursive: true, force: true });
  for (const page of built.pages) {
    const full = path.join(repoRoot, ...page.path.split('/'));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, page.markdown, 'utf8');
  }
  return { letters, csv: built.csv, pages: built.pages };
}

function todayFromEnv() {
  return process.env.LETTERS_TODAY || logic.chicagoDate();
}

if (require.main === module) {
  const repoRoot = path.join(__dirname, '..', '..');
  const built = applyBuild(repoRoot, todayFromEnv());
  console.log(`letters ${built.letters.length}`);
  for (const page of built.pages) console.log(page.path);
  if (!built.csv) console.log('no log.csv');
}

module.exports = { applyBuild, todayFromEnv };
