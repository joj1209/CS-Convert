// scrip.js
console.log('[scrip.js] 파일 로드 시작');
window.onerror = function (msg, src, lineno, colno, err) {
  console.error('[scrip.js] window.onerror:', msg, src, lineno + ':' + colno, err);
};

(function () {
  function byId(id) { return document.getElementById(id); }

  // 행 기준으로 매핑 구성 (같은 인덱스의 beforeVar / afterVar 를 1:1 사용)
  function parseMappings() {
    const beforeInputs = Array.from(document.querySelectorAll('.beforeVar'));
    const afterInputs  = Array.from(document.querySelectorAll('.afterVar'));

    const len = Math.min(beforeInputs.length, afterInputs.length);
    const pairs = [];
    let beforeCount = 0;
    let afterCount  = 0;

    for (let i = 0; i < len; i++) {
      const from = beforeInputs[i].value.trim();
      const to   = afterInputs[i].value.trim();

      if (from !== '') beforeCount++;
      if (to !== '')   afterCount++;

      // 변경전이 비어있으면 해당 행은 스킵
      if (!from) continue;

      pairs.push({
        from: from,
        to: (to !== undefined && to !== null) ? to : ""
      });
    }

    let notice = "";
    if (beforeCount !== afterCount) {
      notice =
        `-- 안내: 매핑 개수 불일치 (변경전 non-empty:${beforeCount}, 변경후 non-empty:${afterCount})\n` +
        `-- 행 단위로 처리하며, 변경전이 비어있는 행은 무시합니다.\n`;
    }
    return { pairs, notice };
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function regexFlags() {
    const mode = byId('caseMode').value;
    return mode === 'insensitive' ? 'gi' : 'g';
  }

  function makeRegexPattern(raw, useWordBoundary) {
    const escaped = escapeRegExp(raw);
    const flags = regexFlags();
    if (!useWordBoundary) return new RegExp(escaped, flags);

    const idChar = '[A-Za-z0-9_]';
    const pattern = `(?<!${idChar}|:)${escaped}(?!${idChar}|:)`;
    try {
      return new RegExp(pattern, flags);
    } catch (e) {
      // lookbehind 미지원 브라우저 폴백
      return new RegExp(escaped, flags);
    }
  }

  function replaceOutsideStrings(sql, pairs, useWordBoundary) {
    const segments = sql.split(/('(?:''|[^'])*')/g);
    for (let i = 0; i < segments.length; i++) {
      if (i % 2 === 1) continue;
      const sorted = [...pairs].sort((a, b) => b.from.length - a.from.length);
      let s = segments[i];
      for (const { from, to } of sorted) {
        const re = makeRegexPattern(from, useWordBoundary);
        s = s.replace(re, to);
      }
      segments[i] = s;
    }
    return segments.join('');
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function (err) {
        console.warn('[scrip.js] navigator.clipboard.writeText 실패, 폴백 시도:', err);
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
    const clearBtn = byId('clearBtn');
    if (!runBtn || !clearBtn) {
      console.warn('[scrip.js] 버튼을 아직 못 찾음. 100ms 후 재시도');
      return setTimeout(attachHandlers, 100);
    }
    console.log('[scrip.js] 버튼 핸들러 연결 완료');

    runBtn.addEventListener('click', function () {
      console.log('[scrip.js] RUN 클릭');
      const input = byId('inputQuery').value;
      const { pairs, notice } = parseMappings();

      if (pairs.length === 0) {
        byId('outputQuery').value =
          '-- 매핑이 없습니다. 변수 행을 채워주세요.\n' + input;
        return;
      }

      const useBoundary = byId('useWordBoundary').checked;
      const skipStrings = byId('skipStrings').checked;

      let output;
      if (skipStrings) {
        output = replaceOutsideStrings(input, pairs, useBoundary);
      } else {
        let s = input;
        const sorted = [...pairs].sort((a, b) => b.from.length - a.from.length);
        for (const { from, to } of sorted) {
          const re = makeRegexPattern(from, useBoundary);
          s = s.replace(re, to);
        }
        output = s;
      }

      const finalText = (notice ? notice : '') + output;
      byId('outputQuery').value = finalText;

      copyToClipboard(finalText)
        .then(function () {
          console.log('[scrip.js] 자동 복사 완료');
        })
        .catch(function (err) {
          console.error('[scrip.js] 자동 복사 실패:', err);
          const out = byId('outputQuery');
          out.focus();
          out.select();
        });
    });

    clearBtn.addEventListener('click', function () {
      console.log('[scrip.js] CLEAR 클릭');
      byId('inputQuery').value = '';
      byId('outputQuery').value = '';

      document.querySelectorAll('.beforeVar').forEach(el => el.value = '');
      document.querySelectorAll('.afterVar').forEach(el  => el.value = '');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      console.log('[scrip.js] DOMContentLoaded');
      attachHandlers();
    });
  } else {
    attachHandlers();
  }
})();
console.log('[scrip.js] 파일 로드 끝');
