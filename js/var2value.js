console.log('[var2value.js] 파일 로드 시작');
window.onerror = function (msg, src, lineno, colno, err) {
  console.error('[var2value.js] window.onerror:', msg, src, lineno + ':' + colno, err);
};

(function () {
  function byId(id) { return document.getElementById(id); }

  function normalizeToken(s) {
    return (s ?? '').toString().trim();
  }

  function extractHeaderValue(sql, headerName) {
    // Matches patterns like: /* PGM ID : test.sql */
    // Allows varying spaces and keeps value trimmed.
    const name = escapeRegExp(headerName);
    const re = new RegExp(String.raw`\/\*\s*${name}\s*:\s*([^\r\n*]+?)\s*\*\/`, 'i');
    const match = re.exec(sql);
    return match ? match[1].trim() : '';
  }

  function autofillMappingsFromSql(sql) {
    const pgmId = extractHeaderValue(sql, 'PGM ID');
    const targetTable = extractHeaderValue(sql, 'TARGET TABLE');

    if (!pgmId && !targetTable) return;

    const beforeInputs = Array.from(document.querySelectorAll('.beforeVar'));
    const afterInputs = Array.from(document.querySelectorAll('.afterVar'));
    const len = Math.min(beforeInputs.length, afterInputs.length);

    for (let i = 0; i < len; i++) {
      const from = normalizeToken(beforeInputs[i].value);
      if (from === '{PGM_ID}' && pgmId) afterInputs[i].value = pgmId;
      if (from === '{TARGET_TABLE}' && targetTable) afterInputs[i].value = targetTable;
    }
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function parseMappings() {
    const beforeInputs = Array.from(document.querySelectorAll('.beforeVar'));
    const afterInputs = Array.from(document.querySelectorAll('.afterVar'));

    const len = Math.min(beforeInputs.length, afterInputs.length);
    const pairs = [];

    for (let i = 0; i < len; i++) {
      const from = normalizeToken(beforeInputs[i].value);
      const to = afterInputs[i].value;

      if (!from) continue;
      pairs.push({ from, to: (to ?? '').trim() });
    }

    return pairs;
  }

  function applyMappings(text, pairs) {
    let out = text;
    const sorted = [...pairs].sort((a, b) => b.from.length - a.from.length);
    for (const { from, to } of sorted) {
      const re = new RegExp(escapeRegExp(from), 'g');
      out = out.replace(re, to);
    }
    return out;
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function (err) {
        console.warn('[var2value.js] navigator.clipboard.writeText 실패, 폴백 시도:', err);
        return fallbackCopy(text);
      });
    }
    return fallbackCopy(text);
  }

  function fallbackCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok ? Promise.resolve() : Promise.reject(new Error('execCommand copy 실패'));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function attachHandlers() {
    const runBtn = byId('runBtn');
    if (!runBtn) {
      console.warn('[var2value.js] runBtn을 아직 못 찾음. 100ms 후 재시도');
      return setTimeout(attachHandlers, 100);
    }

    runBtn.addEventListener('click', function () {
      const input = byId('inputQuery').value;

      // Auto-fill PGM ID / TARGET TABLE from SQL header comments if present.
      autofillMappingsFromSql(input);
      const pairs = parseMappings();

      const output = applyMappings(input, pairs);
      byId('outputQuery').value = output;

      copyToClipboard(output)
        .then(function () {
          console.log('[var2value.js] 자동 복사 완료');
        })
        .catch(function (err) {
          console.error('[var2value.js] 자동 복사 실패:', err);
          const outEl = byId('outputQuery');
          outEl.focus();
          outEl.select();
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachHandlers);
  } else {
    attachHandlers();
  }
})();

console.log('[var2value.js] 파일 로드 끝');
