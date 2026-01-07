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

  function extractProgramIdFromLogDeclare(sql) {
    // Example:
    // DECLARE `log_프로그램ID` STRING DEFAULT 'wcsbv_서비스내역01';
    // Also supports commented form:
    // --DECLARE `log_프로그램ID` STRING DEFAULT 'wcsbv_서비스내역01';
    const re = /(?:--\s*)?DECLARE\s+`?log_프로그램ID`?\s+STRING\s+DEFAULT\s+'([^']*)'\s*;/i;
    const match = re.exec(sql);
    return match ? (match[1] ?? '').trim() : '';
  }

  function extractServiceName(programId) {
    const s = (programId ?? '').toString();
    if (!s) return '';

    // Derive a logical "service name" from programId.
    // Common pattern: <prefix>_<name><digits>  (e.g. wcsbv_서비스내역01 -> 서비스내역)
    // If there are multiple underscores, keep everything after the first underscore.
    const parts = s.split('_');
    const candidate = parts.length > 1 ? parts.slice(1).join('_') : s;
    const withoutTrailingDigits = candidate.replace(/\d+$/g, '').trim();
    return withoutTrailingDigits || candidate.trim();
  }

  function autofillMappingsFromSql(sql) {
    // DM/legacy mappings: only auto-fill from SQL header comments.
    const headerPgmId = extractHeaderValue(sql, 'PGM ID');
    const headerTargetTable = extractHeaderValue(sql, 'TARGET TABLE');

    if (!headerPgmId && !headerTargetTable) return;

    const beforeInputs = Array.from(document.querySelectorAll('.beforeVar'));
    const afterInputs = Array.from(document.querySelectorAll('.afterVar'));
    const len = Math.min(beforeInputs.length, afterInputs.length);

    for (let i = 0; i < len; i++) {
      const from = normalizeToken(beforeInputs[i].value);
      const currentTo = (afterInputs[i].value ?? '').trim();

      if ((from === '{vs_pgm_id}' || from === '{PGM_ID}' || from === '@program_id') && headerPgmId) {
        afterInputs[i].value = headerPgmId;
        continue;
      }

      if ((from === '{vs_tbl_nm}' || from === '{TARGET_TABLE}' || from === '@target_table') && headerTargetTable) {
        afterInputs[i].value = headerTargetTable;
        continue;
      }

      // Standard date default in DM-style mappings
      if ((from === '{vs_job_d}' || from === '@standard_date') && !currentTo) {
        afterInputs[i].value = 'default';
      }
    }
  }

  function autofillDwMappingsFromSql(sql) {
    const headerPgmId = extractHeaderValue(sql, 'PGM ID');
    // Input SQL is one of two formats:
    // - If PGM ID header exists, prefer that format for parsing
    // - Otherwise parse from log_프로그램ID DECLARE (quoted literal, comment allowed)
    const programId = headerPgmId || extractProgramIdFromLogDeclare(sql);

    const serviceName = extractServiceName(programId);
    const dwTargetTable = serviceName ? `DW.${serviceName}` : '';
    const dwTempTable = serviceName ? `DWWRK.${serviceName}` : '';

    const beforeInputs = Array.from(document.querySelectorAll('.beforeVarDw'));
    const afterInputs = Array.from(document.querySelectorAll('.afterVarDw'));
    const len = Math.min(beforeInputs.length, afterInputs.length);

    for (let i = 0; i < len; i++) {
      const from = normalizeToken(beforeInputs[i].value);
      const currentTo = (afterInputs[i].value ?? '').trim();

      if (from === '@standard_date') {
        if (!currentTo) afterInputs[i].value = 'default';
        continue;
      }

      if (from === '@job_seq') {
        if (!currentTo) afterInputs[i].value = '';
        continue;
      }

      if (from === '@program_id') {
        if (!currentTo && programId) afterInputs[i].value = programId;
        continue;
      }

      if (from === '@target_table') {
        if (!currentTo && dwTargetTable) afterInputs[i].value = dwTargetTable;
        continue;
      }

      if (from === '@temp_table') {
        if (!currentTo && dwTempTable) afterInputs[i].value = dwTempTable;
        continue;
      }
    }
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function parseMappings(beforeSelector = '.beforeVar', afterSelector = '.afterVar') {
    const beforeInputs = Array.from(document.querySelectorAll(beforeSelector));
    const afterInputs = Array.from(document.querySelectorAll(afterSelector));

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

  function mergePairs(...pairLists) {
    const map = new Map();
    for (const list of pairLists) {
      for (const pair of list) {
        if (!pair || !pair.from) continue;
        map.set(pair.from, pair.to ?? '');
      }
    }
    return Array.from(map.entries()).map(([from, to]) => ({ from, to }));
  }

  function buildDmHeaderDerivedPairs(sql) {
    const headerPgmId = extractHeaderValue(sql, 'PGM ID');
    const headerTargetTable = extractHeaderValue(sql, 'TARGET TABLE');

    const pairs = [];
    if (headerPgmId) {
      pairs.push({ from: '@program_id', to: headerPgmId });
      pairs.push({ from: '{vs_pgm_id}', to: headerPgmId });
      pairs.push({ from: '{PGM_ID}', to: headerPgmId });
    }
    if (headerTargetTable) {
      pairs.push({ from: '@target_table', to: headerTargetTable });
      pairs.push({ from: '{vs_tbl_nm}', to: headerTargetTable });
      pairs.push({ from: '{TARGET_TABLE}', to: headerTargetTable });
    }
    // DM rule: map standard date to 'default'
    pairs.push({ from: '@standard_date', to: 'default' });
    pairs.push({ from: '{vs_job_d}', to: 'default' });
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

      const headerPgmId = extractHeaderValue(input, 'PGM ID');
      const isDmFormat = !!headerPgmId;

      // Auto-fill PGM ID / TARGET TABLE from SQL header comments if present.
      autofillMappingsFromSql(input);

      // DW rules are only used when PGM ID header is NOT present.
      if (!isDmFormat) {
        autofillDwMappingsFromSql(input);
      }

      const pairsDm = parseMappings('.beforeVar', '.afterVar');

      let pairs;
      if (isDmFormat) {
        // DM format: apply DM mappings only, plus header-derived mapping for @-tokens.
        // Keep DM behavior deterministic when header exists.
        pairs = mergePairs(buildDmHeaderDerivedPairs(input), pairsDm);
      } else {
        const pairsDw = parseMappings('.beforeVarDw', '.afterVarDw');
        pairs = mergePairs(pairsDm, pairsDw);
      }

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
