import './bootstrap.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INVESTIGATION_CLUES } from '../src/games/investigation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const srcDir = path.resolve(projectRoot, 'src');
const distDir = path.resolve(projectRoot, 'dist');

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

test('Security scan: src/ directory must not contain any accepted investigation answers or decoded flags', () => {
  assert.ok(fs.existsSync(srcDir), 'src directory must exist');
  const srcFiles = getAllFiles(srcDir).filter((file) => {
    const rel = path.relative(srcDir, file);
    // Exclude test files
    return !rel.includes('.test.') && !rel.includes('.spec.');
  });

  assert.ok(srcFiles.length > 0, 'src directory must contain files to scan');

  const knownAnswers = INVESTIGATION_CLUES.map((clue) => clue.expectedAnswer);

  for (const filePath of srcFiles) {
    const relativePath = path.relative(projectRoot, filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    for (const answer of knownAnswers) {
      assert.equal(
        content.includes(answer),
        false,
        `Client source file ${relativePath} must not contain accepted answer "${answer}"`
      );
    }

    // Special check: final decoded keyword UNMASKED must not appear even case-insensitively
    assert.equal(
      content.toUpperCase().includes('UNMASKED'),
      false,
      `Client source file ${relativePath} must not contain decoded keyword "UNMASKED"`
    );
  }
});

test('Security scan: fresh dist/ build must not leak accepted investigation answers in client bundles', () => {
  assert.ok(fs.existsSync(distDir), 'Fresh dist build directory must exist (run npm run build first)');

  const distFiles = getAllFiles(distDir);
  assert.ok(distFiles.length > 0, 'dist directory must contain built files');

  const knownAnswers = INVESTIGATION_CLUES.map((clue) => clue.expectedAnswer);

  // 1. All compiled JS, CSS, and HTML bundles must never contain any known investigation answer
  const bundleFiles = distFiles.filter((f) => {
    const ext = path.extname(f);
    return ['.js', '.css', '.html'].includes(ext);
  });

  assert.ok(bundleFiles.length > 0, 'dist must contain client bundle files');

  for (const bundlePath of bundleFiles) {
    const relativePath = path.relative(projectRoot, bundlePath);
    const content = fs.readFileSync(bundlePath, 'utf8');

    for (const answer of knownAnswers) {
      assert.equal(
        content.includes(answer),
        false,
        `Production client bundle ${relativePath} must not leak accepted answer "${answer}"`
      );
    }

    // Final keyword UNMASKED must not appear in any client bundle
    assert.equal(
      content.toUpperCase().includes('UNMASKED'),
      false,
      `Production client bundle ${relativePath} must not leak decoded keyword "UNMASKED"`
    );
  }

  // 2. The decoded final keyword UNMASKED must never appear in ANY file in dist/
  for (const filePath of distFiles) {
    const relativePath = path.relative(projectRoot, filePath);
    const ext = path.extname(filePath);
    if (['.png', '.jpg', '.jpeg', '.gif', '.ico'].includes(ext)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    assert.equal(
      content.toUpperCase().includes('UNMASKED'),
      false,
      `dist file ${relativePath} must not contain decoded keyword "UNMASKED"`
    );
  }

  // 3. All non-exhibit files in dist/ must not contain any known answers
  // (Excludes only the intentional Lead 2 SVG evidence exhibit doc-forensic-report.svg)
  for (const filePath of distFiles) {
    const relativePath = path.relative(projectRoot, filePath);
    if (relativePath.includes('doc-forensic-report.svg')) continue;
    const ext = path.extname(filePath);
    if (['.png', '.jpg', '.jpeg', '.gif', '.ico'].includes(ext)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    for (const answer of knownAnswers) {
      assert.equal(
        content.includes(answer),
        false,
        `dist file ${relativePath} must not contain accepted answer "${answer}"`
      );
    }
  }
});
