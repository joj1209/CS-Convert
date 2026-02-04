console.log('[backtick-wrapper.js] 파일 로드 시작');
window.onerror = function (msg, src, lineno, colno, err) {
  console.error('[backtick-wrapper.js] window.onerror:', msg, src, lineno + ':' + colno, err);
};

(function () {
  function byId(id) { return document.getElementById(id); }

  function setStatus(message, isError) {
    var el = byId('status');
    if (!el) return;
    el.textContent = message || '';
    el.style.color = isError ? '#b00020' : '#555';
  }

  function containsHangul(s) {
    return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(s);
  }

  function isIdentifierStart(ch) {
    // Broad: ASCII letters, underscore, Hangul ranges
    return /[A-Za-z_ㄱ-ㅎㅏ-ㅣ가-힣]/.test(ch);
  }

  function isIdentifierPart(ch) {
    // Allow digits and $, plus Hangul and underscore
    return /[A-Za-z0-9_$ㄱ-ㅎㅏ-ㅣ가-힣]/.test(ch);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function (err) {
        console.warn('[backtick-wrapper.js] navigator.clipboard.writeText 실패, 폴백 시도:', err);
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

  function wrapKoreanIdentifiers(sql, options) {
    var out = '';
    var i = 0;
    var wrapCount = 0;

    var skipStrings = !!options.skipStrings;
    var skipComments = !!options.skipComments;
    var skipBackticks = !!options.skipBackticks;

    // States
    var NORMAL = 0;
    var SINGLE = 1;
    var DOUBLE = 2;
    var BACKTICK = 3;
    var LINE_COMMENT = 4;
    var BLOCK_COMMENT = 5;

    var state = NORMAL;

    while (i < sql.length) {
      var ch = sql[i];
      var next = (i + 1 < sql.length) ? sql[i + 1] : '';

      if (state === NORMAL) {
        if (skipComments && ch === '-' && next === '-') {
          state = LINE_COMMENT;
          out += ch + next;
          i += 2;
          continue;
        }
        if (skipComments && ch === '/' && next === '*') {
          state = BLOCK_COMMENT;
          out += ch + next;
          i += 2;
          continue;
        }
        if (skipStrings && ch === "'") {
          state = SINGLE;
          out += ch;
          i += 1;
          continue;
        }
        // BigQuery generally uses single quotes for strings; we treat double quotes as protected text too.
        if (skipStrings && ch === '"') {
          state = DOUBLE;
          out += ch;
          i += 1;
          continue;
        }
        if (skipBackticks && ch === '`') {
          state = BACKTICK;
          out += ch;
          i += 1;
          continue;
        }

        if (isIdentifierStart(ch)) {
          var start = i;
          i += 1;
          while (i < sql.length && isIdentifierPart(sql[i])) i += 1;
          var word = sql.slice(start, i);

          // Avoid quoting pure numbers (unlikely due to start char rule, but keep safe)
          if (containsHangul(word)) {
            out += '`' + word + '`';
            wrapCount += 1;
          } else {
            out += word;
          }
          continue;
        }

        // Default char passthrough
        out += ch;
        i += 1;
        continue;
      }

      if (state === SINGLE) {
        out += ch;
        i += 1;
        if (ch === "'") {
          // escaped '' inside string
          if (i < sql.length && sql[i] === "'") {
            out += sql[i];
            i += 1;
          } else {
            state = NORMAL;
          }
        }
        continue;
      }

      if (state === DOUBLE) {
        out += ch;
        i += 1;
        if (ch === '"') {
          // escaped "" inside quoted text
          if (i < sql.length && sql[i] === '"') {
            out += sql[i];
            i += 1;
          } else {
            state = NORMAL;
          }
        }
        continue;
      }

      if (state === BACKTICK) {
        out += ch;
        i += 1;
        if (ch === '`') {
          state = NORMAL;
        }
        continue;
      }

      if (state === LINE_COMMENT) {
        out += ch;
        i += 1;
        if (ch === '\n') {
          state = NORMAL;
        }
        continue;
      }

      if (state === BLOCK_COMMENT) {
        out += ch;
        i += 1;
        if (ch === '*' && i < sql.length && sql[i] === '/') {
          out += '/';
          i += 1;
          state = NORMAL;
        }
        continue;
      }
    }

    return { text: out, wrapCount: wrapCount };
  }

  function convert() {
    var input = (byId('inputSql').value ?? '').toString();

    var options = {
      skipStrings: !!(byId('skipStrings') && byId('skipStrings').checked),
      skipComments: !!(byId('skipComments') && byId('skipComments').checked),
      skipBackticks: !!(byId('skipBackticks') && byId('skipBackticks').checked),
      wrapSegments: !!(byId('wrapSegments') && byId('wrapSegments').checked)
    };

    // Current implementation naturally wraps per identifier token (segment-by-segment),
    // so wrapSegments is kept for UI clarity and future extension.
    var result = wrapKoreanIdentifiers(input, options);

    byId('outputSql').value = result.text;
    byId('wrapCount').textContent = String(result.wrapCount);

    var autoCopy = !!(byId('autoCopy') && byId('autoCopy').checked);
    if (!autoCopy) {
      setStatus('변환 완료', false);
      return;
    }

    copyToClipboard(result.text)
      .then(function () {
        setStatus('변환 완료 + 자동 복사 완료', false);
      })
      .catch(function (err) {
        console.error('[backtick-wrapper.js] 자동 복사 실패:', err);
        setStatus('변환은 완료했지만 자동 복사에 실패했습니다. 출력창을 선택 후 Ctrl+C 하세요.', true);
        var outEl = byId('outputSql');
        outEl.focus();
        outEl.select();
      });
  }

  function clearAll() {
    byId('inputSql').value = '';
    byId('outputSql').value = '';
    byId('wrapCount').textContent = '0';
    setStatus('', false);
  }

  function attachHandlers() {
    var convertBtn = byId('convertBtn');
    if (!convertBtn) {
      console.warn('[backtick-wrapper.js] convertBtn을 아직 못 찾음. 100ms 후 재시도');
      return setTimeout(attachHandlers, 100);
    }

    byId('clearBtn').addEventListener('click', function () {
      clearAll();
    });

    convertBtn.addEventListener('click', function () {
      convert();
    });

    byId('copyBtn').addEventListener('click', function () {
      var text = (byId('outputSql').value ?? '').toString();
      if (!text) {
        setStatus('복사할 결과가 없습니다. 먼저 변환하세요.', true);
        return;
      }

      copyToClipboard(text)
        .then(function () {
          setStatus('클립보드로 복사했습니다.', false);
        })
        .catch(function (err) {
          console.error('[backtick-wrapper.js] 복사 실패:', err);
          setStatus('복사에 실패했습니다. 출력창을 선택 후 Ctrl+C 하세요.', true);
          var outEl = byId('outputSql');
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

console.log('[backtick-wrapper.js] 파일 로드 끝');
