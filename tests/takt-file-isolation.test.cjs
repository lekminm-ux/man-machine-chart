const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const pagePath = path.resolve(__dirname, '../src/app/editor/page.tsx');
const module5Path = path.resolve(__dirname, '../src/components/modules/Module5_YamazumiChart.tsx');

const pageSource = fs.readFileSync(pagePath, 'utf8');
const module5Source = fs.readFileSync(module5Path, 'utf8');

test('source contract: page keys Module5_YamazumiChart by activeFile.id', () => {
  assert.match(
    pageSource,
    /<Module5_YamazumiChart\s+key=\{activeFile\.id\}\s*\/>/,
    'page.tsx must mount Module5_YamazumiChart with key={activeFile.id}'
  );
});

test('source contract: Module5 initializes taktTime with default 60 fallback', () => {
  assert.match(
    module5Source,
    /activeFile\?\.timeMeasurement\?\.taktTime\s*\|\|\s*60/,
    'Module5_YamazumiChart.tsx must initialize localTaktTime from activeFile?.timeMeasurement?.taktTime || 60'
  );
});

test('source contract: Module5 declares isLocked from activeFile.lockedAt', () => {
  assert.match(
    module5Source,
    /const\s+isLocked\s*=\s*Boolean\(activeFile\.lockedAt\);?/,
    'Module5 must define isLocked from activeFile.lockedAt'
  );
});

function extractJsxOpeningTag(source, tagName, identifier) {
  let searchFrom = 0;
  while (true) {
    const start = source.indexOf(`<${tagName}`, searchFrom);
    if (start === -1) break;

    const nextChar = source[start + 1 + tagName.length];
    if (!/\s/.test(nextChar) && nextChar !== '/' && nextChar !== '>') {
      searchFrom = start + 1;
      continue;
    }

    let i = start + 1 + tagName.length;
    let braceDepth = 0;
    let inQuote = null;
    let end = -1;

    while (i < source.length) {
      const char = source[i];
      if (inQuote) {
        if (char === '\\') {
          i += 2;
          continue;
        }
        if (char === inQuote) {
          inQuote = null;
        }
      } else if (char === '"' || char === "'" || char === '`') {
        inQuote = char;
      } else if (char === '{') {
        braceDepth++;
      } else if (char === '}') {
        braceDepth--;
      } else if (braceDepth === 0) {
        if (char === '>' || (char === '/' && source[i + 1] === '>')) {
          end = char === '>' ? i + 1 : i + 2;
          break;
        }
      }
      i++;
    }

    if (end !== -1) {
      const tag = source.slice(start, end);
      if (!identifier || (typeof identifier === 'string' ? tag.includes(identifier) : identifier.test(tag))) {
        return tag;
      }
    }
    searchFrom = start + 1;
  }
  return null;
}

test('source contract: takt input is separately disabled when isLocked is true', () => {
  const taktInputTag = extractJsxOpeningTag(module5Source, 'input', 'value={localTaktTime}');
  assert.ok(taktInputTag, 'takt input with value={localTaktTime} must exist');
  assert.match(
    taktInputTag,
    /disabled=\{isLocked\}/,
    'takt input element must specify disabled={isLocked}'
  );
});

test('source contract: update benchmark / save button is separately disabled when isLocked is true', () => {
  const saveButtonTag = extractJsxOpeningTag(module5Source, 'button', 'onClick={handleSaveTaktTime}');
  assert.ok(saveButtonTag, 'save button with onClick={handleSaveTaktTime} must exist');
  assert.match(
    saveButtonTag,
    /disabled=\{isLocked\}/,
    'save/benchmark button must specify disabled={isLocked}'
  );
});

test('source contract: Module5 binds draggable={hasTimeStudy && !isLocked} in exactly 3 places', () => {
  const matches = module5Source.match(/draggable=\{hasTimeStudy && !isLocked\}/g);
  assert.strictEqual(
    matches ? matches.length : 0,
    3,
    'Module5_YamazumiChart.tsx must contain exactly 3 draggable={hasTimeStudy && !isLocked} bindings'
  );
});

test('source contract: Module5 handleOperatorDrop guards with early if (isLocked) return', () => {
  assert.match(
    module5Source,
    /const\s+handleOperatorDrop\s*=\s*\([^)]*\)\s*=>\s*\{\s*if\s*\(isLocked\)\s*return;/,
    'handleOperatorDrop must return early when isLocked is true'
  );
});

// All 7 real behavioral criteria pending independent local DOM/store/storage runner:
// 1. A120/B300 switching bothways: NOT TESTED (pending local runner)
// 2. Unsaved drafts isolated bothways: NOT TESTED (pending local runner)
// 3. B save preserves A: NOT TESTED (pending local runner)
// 4. Same-file unrelated rerender preserves draft: NOT TESTED (pending local runner)
// 5. Save/fresh readback/reload independent persistence: NOT TESTED (pending local runner)
// 6. Default 60 runtime render: NOT TESTED (pending local runner)
// 7. Locked input/save/drag interaction: NOT TESTED (pending local runner)
