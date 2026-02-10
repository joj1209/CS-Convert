console.log('[comMapper.js] 파일 로드 시작');
window.onerror = function (msg, src, lineno, colno, err) {
  console.error('[comMapper.js] window.onerror:', msg, src, lineno + ':' + colno, err);
};

(function () {
  function byId(id) { return document.getElementById(id); }

  function normalizeToken(s) {
    return (s === null || s === undefined) ? '' : String(s).trim();
  }

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function extractHeaderValue(sql, headerName) {
    // Matches patterns like:
    // /* PGM ID : wzaw_공통코드00.sql */
    // /* TBL_ID : BM.공통코드 */
    // Allows varying spaces and keeps value trimmed.
    var name = escapeRegExp(headerName);
    var re = new RegExp(String.raw`\/\*\s*${name}\s*:\s*([^\r\n*]+?)\s*\*\/`, 'i');
    var match = re.exec(sql);
    if (!match) return '';
    if (!match[1]) return '';
    return String(match[1]).trim();
  }

  function extractDwProgramIdFromLogDeclare(sql) {
    // Preferred: commented DECLARE line containing a literal program id
    // -- DECLARE `log_프로그램ID` STRING DEFAULT 'wzaw_서비스내역00';
    var reCommented = /--\s*DECLARE\s+`?log_프로그램ID`?\s+STRING\s+DEFAULT\s+'([^']*)'\s*;/i;
    var match = reCommented.exec(sql);
    if (match && match[1]) return String(match[1]).trim();

    // Fallback: non-commented literal if present
    var reAny = /DECLARE\s+`?log_프로그램ID`?\s+STRING\s+DEFAULT\s+'([^']*)'\s*;/i;
    match = reAny.exec(sql);
    if (match && match[1]) return String(match[1]).trim();

    return '';
  }

  function extractServiceNameFromProgramId(programId) {
    // Example: wzaw_서비스내역00 -> 서비스내역
    var s = normalizeToken(programId);
    if (!s) return '';

    var parts = s.split('_');
    var candidate = (parts.length > 1) ? parts.slice(1).join('_') : s;
    var withoutTrailingDigits = candidate.replace(/\d+$/g, '').trim();
    return withoutTrailingDigits || candidate.trim();
  }

  function stripSqlSuffix(pgmIdMaybeWithExt) {
    var v = normalizeToken(pgmIdMaybeWithExt);
    if (!v) return '';
    return v.replace(/\.sql\s*$/i, '');
  }

  function collectBacktickedIdentifiers(sql) {
    // returns array of tokens including backticks: [`edw_전월`, ...]
    var re = /`([^`]+)`/g;
    var out = [];
    var m;
    while ((m = re.exec(sql))) {
      if (!m[1]) continue;
      out.push('`' + m[1] + '`');
    }
    return out;
  }

  function collectWordTokens(sql, word) {
    // If token appears as a word boundary, return it.
    var re = new RegExp('\\b' + escapeRegExp(word) + '\\b', 'g');
    return re.test(sql) ? [word] : [];
  }

  function quoteSqlString(value) {
    // returns a SQL single-quoted literal; internal ' is doubled
    var v = (value === null || value === undefined) ? '' : String(value);
    return "'" + v.replace(/'/g, "''") + "'";
  }

  function buildDwMappings(sql) {
    var programId = extractDwProgramIdFromLogDeclare(sql);
    var serviceName = extractServiceNameFromProgramId(programId);

    var mappings = [];

    // Core variables
    if (programId) mappings.push({ from: '@program_id', to: quoteSqlString(programId) });
    mappings.push({ from: '@standard_date', to: quoteSqlString('99991231') });
    mappings.push({ from: '@job_seq', to: "''" });

    if (serviceName) {
      mappings.push({ from: '@target_table', to: quoteSqlString('DW.' + serviceName) });
      mappings.push({ from: '@temp_table', to: quoteSqlString('DWWRK.' + serviceName) });
    }

    // Growing variables: any backticked identifiers that start with `edw_`
    var ticks = collectBacktickedIdentifiers(sql);
    for (var i = 0; i < ticks.length; i++) {
      var token = ticks[i];
      if (/^`edw_/i.test(token)) {
        mappings.push({ from: token, to: quoteSqlString('999912') });
      }
    }

    return normalizeAndDedupeMappings(mappings);
  }

  function buildDmMappings(sql) {
    // Hint comments:
    // /* PGM ID : wzaw_공통코드00.sql */
    // /* TBL_ID : BM.공통코드 */
    var pgmRaw = extractHeaderValue(sql, 'PGM ID');
    var tblId = extractHeaderValue(sql, 'TBL_ID');

    var pgmId = stripSqlSuffix(pgmRaw);

    var mappings = [];
    if (pgmId) mappings.push({ from: '@program_id', to: quoteSqlString(pgmId) });
    mappings.push({ from: '@standard_date', to: quoteSqlString('99991231') });
    if (tblId) mappings.push({ from: '@table_name', to: quoteSqlString(tblId) });

    // Growing variables: vs_job_d / vs_job_yyyymm may appear with or without backticks.
    // We add backticked first so it replaces safely (longer token first in applyMappings).
    if (sql.indexOf('`vs_job_d`') >= 0) mappings.push({ from: '`vs_job_d`', to: quoteSqlString('999912') });
    if (sql.indexOf('`vs_job_yyyymm`') >= 0) mappings.push({ from: '`vs_job_yyyymm`', to: quoteSqlString('999912') });

    var plainVsJobD = collectWordTokens(sql, 'vs_job_d');
    if (plainVsJobD.length) mappings.push({ from: 'vs_job_d', to: quoteSqlString('999912') });

    var plainVsJobYm = collectWordTokens(sql, 'vs_job_yyyymm');
    if (plainVsJobYm.length) mappings.push({ from: 'vs_job_yyyymm', to: quoteSqlString('999912') });

    return normalizeAndDedupeMappings(mappings);
  }

  function normalizeAndDedupeMappings(mappings) {
    // stable-ish order: keep first occurrence, overwrite later duplicates
    var map = new Map();
    for (var i = 0; i < mappings.length; i++) {
      var m = mappings[i];
      if (!m || !m.from) continue;
      map.set(String(m.from), (m.to === null || m.to === undefined) ? '' : String(m.to));
    }

    // Preserve the "core" ordering
    var coreOrder = ['@program_id', '@standard_date', '@target_table', '@temp_table', '@job_seq', '@table_name'];
    var out = [];
    for (var j = 0; j < coreOrder.length; j++) {
      var k = coreOrder[j];
      if (map.has(k)) {
        out.push({ from: k, to: map.get(k) });
        map.delete(k);
      }
    }

    map.forEach(function (to, from) {
      out.push({ from: from, to: to });
    });

    return out;
  }

  function mergeMappings(defaultMappings, userMappings) {
    var defaults = Array.isArray(defaultMappings) ? defaultMappings : [];
    var users = Array.isArray(userMappings) ? userMappings : [];

    var userMap = new Map();
    for (var i = 0; i < users.length; i++) {
      var um = users[i];
      if (!um || !um.from) continue;
      userMap.set(String(um.from), {
        from: String(um.from),
        to: (um.to === null || um.to === undefined) ? '' : String(um.to)
      });
    }

    var out = [];
    var seen = new Set();

    // Keep default order, but allow user-entered "to" to override when provided.
    for (var j = 0; j < defaults.length; j++) {
      var dm = defaults[j];
      if (!dm || !dm.from) continue;
      var key = String(dm.from);
      var to = (dm.to === null || dm.to === undefined) ? '' : String(dm.to);

      if (userMap.has(key)) {
        var userTo = userMap.get(key).to;
        if (String(userTo).trim() !== '') {
          to = userTo;
        }
      }

      out.push({ from: key, to: to });
      seen.add(key);
    }

    // Append user-added mappings not present in defaults.
    for (var k = 0; k < users.length; k++) {
      var extra = users[k];
      if (!extra || !extra.from) continue;
      var extraKey = String(extra.from);
      if (seen.has(extraKey)) continue;
      out.push({
        from: extraKey,
        to: (extra.to === null || extra.to === undefined) ? '' : String(extra.to)
      });
      seen.add(extraKey);
    }

    return normalizeAndDedupeMappings(out);
  }

  function renderMappings(mappings) {
    var container = byId('mappingRows');
    if (!container) return;

    container.innerHTML = '';

    for (var i = 0; i < mappings.length; i++) {
      var row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '4px';
      row.style.marginBottom = '2px';

      var before = document.createElement('input');
      before.type = 'text';
      before.className = 'beforeVar';
      before.style.flex = '1';
      before.value = mappings[i].from;

      var after = document.createElement('input');
      after.type = 'text';
      after.className = 'afterVar';
      after.style.flex = '1';
      after.value = mappings[i].to;

      row.appendChild(before);
      row.appendChild(after);
      container.appendChild(row);
    }
  }

  function readMappingsFromUi() {
    var beforeInputs = Array.from(document.querySelectorAll('#mappingRows .beforeVar'));
    var afterInputs = Array.from(document.querySelectorAll('#mappingRows .afterVar'));

    var len = Math.min(beforeInputs.length, afterInputs.length);
    var mappings = [];
    for (var i = 0; i < len; i++) {
      var from = normalizeToken(beforeInputs[i].value);
      if (!from) continue;
      var to = afterInputs[i].value;
      mappings.push({ from: from, to: (to === null || to === undefined) ? '' : String(to).trim() });
    }
    return mappings;
  }

  function applyMappings(text, mappings) {
    var out = String(text);

    // Replace longer tokens first to avoid partial replacement issues (e.g., `vs_job_d` vs vs_job_d)
    var sorted = mappings.slice().sort(function (a, b) {
      return String(b.from).length - String(a.from).length;
    });

    for (var i = 0; i < sorted.length; i++) {
      var from = sorted[i].from;
      var to = sorted[i].to;
      if (!from) continue;

      var re = new RegExp(escapeRegExp(from), 'g');
      out = out.replace(re, to);
    }

    return out;
  }

  function filterMappingsByOption(mappings) {
    var onlyAtEl = byId('onlyAtVars');
    var onlyAt = !!(onlyAtEl && onlyAtEl.checked);
    if (!onlyAt) return mappings;

    return mappings.filter(function (m) {
      return m && typeof m.from === 'string' && m.from.indexOf('@') === 0;
    });
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function (err) {
        console.warn('[comMapper.js] navigator.clipboard.writeText 실패, 폴백 시도:', err);
        return fallbackCopy(text);
      });
    }
    return fallbackCopy(text);
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok ? Promise.resolve() : Promise.reject(new Error('execCommand copy 실패'));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function convert(mode) {
    var inputEl = byId('inputSql');
    var outputEl = byId('outputSql');
    if (!inputEl || !outputEl) return;

    var sql = inputEl.value || '';

    // User-entered values in the UI should take precedence once provided.
    var userMappings = readMappingsFromUi();
    var defaultMappings = (mode === 'DW') ? buildDwMappings(sql) : buildDmMappings(sql);
    var mergedMappings = mergeMappings(defaultMappings, userMappings);
    renderMappings(mergedMappings);

    var effectiveMappings = filterMappingsByOption(mergedMappings);
    var outSql = applyMappings(sql, effectiveMappings);

    outputEl.value = outSql;

    copyToClipboard(outSql)
      .then(function () {
        console.log('[comMapper.js] 자동 복사 완료');
      })
      .catch(function (err) {
        console.error('[comMapper.js] 자동 복사 실패:', err);
        outputEl.focus();
        outputEl.select();
      });
  }

  function attachHandlers() {
    var dwBtn = byId('convertDwBtn');
    var dmBtn = byId('convertDmBtn');
    if (!dwBtn || !dmBtn) {
      console.warn('[comMapper.js] 버튼을 아직 못 찾음. 100ms 후 재시도');
      return setTimeout(attachHandlers, 100);
    }

    dwBtn.addEventListener('click', function () { convert('DW'); });
    dmBtn.addEventListener('click', function () { convert('DM'); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachHandlers);
  } else {
    attachHandlers();
  }
})();

console.log('[comMapper.js] 파일 로드 끝');
