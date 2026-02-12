// PPAP Detector - Content Script v1.14.4

(function() {
  'use strict';

  const DEBUG = true;
  const log = (...args) => DEBUG && console.log('[PPAP Detector]', ...args);

  const PPAP_KEYWORDS = [
    'パスワードは別メール', 'パスワードは別途', 'パスワードを別メール',
    'パスワード通知メール', 'パスワードをお送り', 'パスワードメールをお待ち',
    'password notification email', 'Please wait for a password',
    '暗号化されました', 'has been encrypted',
  ];

  const BODY_MAIL_KEYWORDS = [
    '暗号化されました', '暗号化しました', 'has been encrypted',
    'お待ちください', 'Please wait', 'をお待ち',
    '別メールで', '別途', '後ほど',
  ];

  const PASSWORD_MAIL_KEYWORDS = [
    '解凍パスワード', 'パスワード通知', 'パスワードのお知らせ',
    'パスワード:', 'パスワード：', 'password:',
  ];

  const EXCLUDED_WORDS = [
    'information', 'password', 'パスワード', 'notification',
    'encrypted', 'attached', 'security', 'email', 'mail',
  ];

  let state = {
    phase: null,
    originalUrl: null,
    originalSubject: null,
    originalEmailId: null,  // キャンセル判定用
    files: [],
    foundPasswords: [],
    cancelled: false,       // キャンセルフラグ
  };
  
  let passwordPopup = null;
  let passwordCache = new Map();
  let cancelledEmailIds = new Set();  // キャンセルしたメールIDを記録

  function getEmailIdFromUrl() {
    const match = window.location.href.match(/#[^/]+(?:\/[^/]+)*\/([A-Za-z0-9_-]+)$/);
    return match ? match[1] : null;
  }

  function isSearchListPage() {
    return window.location.href.includes('#search/') && !getEmailIdFromUrl();
  }

  function isEmailOpen() {
    return !!getEmailIdFromUrl();
  }

  function getEmailSubject() {
    for (const sel of ['h2.hP', '.hP']) {
      const el = document.querySelector(sel);
      if (el?.innerText?.trim()) return el.innerText.trim();
    }
    return null;
  }

  function getEmailBodyText() {
    for (const sel of ['.a3s.aiL', '.ii.gt', '.a3s']) {
      const el = document.querySelector(sel);
      if (el?.innerText?.length > 10) return el.innerText;
    }
    return '';
  }

  function extractZipFileNames() {
    const files = [];
    const attachments = document.querySelectorAll('.aV3, [download], .aQA span');
    attachments.forEach(el => {
      const name = (el.innerText || el.getAttribute('download') || '').trim();
      if (name.match(/\.(zip|7z|rar)$/i) && !files.includes(name)) {
        files.push(name);
      }
    });
    return files;
  }

  function isPPAPEmail() {
    const body = getEmailBodyText();
    return PPAP_KEYWORDS.some(kw => body.includes(kw));
  }

  function extractPasswords(text) {
    const patterns = [
      /パスワード[\s]*[:：]\s*([A-Za-z0-9!@#$%^&*()_+\-=\[\]{}|;':",.<>?/\\`~]{8,})/gi,
      /password[\s]*[:：]\s*([A-Za-z0-9!@#$%^&*()_+\-=\[\]{}|;':",.<>?/\\`~]{8,})/gi,
      /解凍パスワード[\s]*[:：]\s*([A-Za-z0-9!@#$%^&*()_+\-=\[\]{}|;':",.<>?/\\`~]{8,})/gi,
    ];
    
    const passwords = [];
    for (const p of patterns) {
      let m;
      while ((m = p.exec(text)) !== null) {
        const pw = m[1].trim();
        if (pw.length >= 8 && !EXCLUDED_WORDS.includes(pw.toLowerCase()) && !passwords.includes(pw)) {
          passwords.push(pw);
        }
      }
    }
    
    passwords.sort((a, b) => b.length - a.length);
    return [...new Set(passwords)];
  }

  function createPopup() {
    if (passwordPopup) passwordPopup.remove();
    passwordPopup = document.createElement('div');
    passwordPopup.id = 'ppap-detector-popup';
    passwordPopup.innerHTML = `
      <div class="ppap-header" id="ppap-drag-handle">
        <span class="ppap-title">PPAP Detector</span>
        <button class="ppap-close">&times;</button>
      </div>
      <div class="ppap-content">
        <div class="ppap-loading"><div class="ppap-spinner"></div><span>検索中...</span></div>
      </div>
    `;
    document.body.appendChild(passwordPopup);
    
    // ×ボタン：処理をキャンセルして元のメールに戻る
    passwordPopup.querySelector('.ppap-close').onclick = () => {
      log('User cancelled');
      
      // キャンセル状態を記録
      state.cancelled = true;
      if (state.originalEmailId) {
        cancelledEmailIds.add(state.originalEmailId);
      }
      
      // ポップアップを閉じる
      passwordPopup.remove();
      passwordPopup = null;
      
      // 元のメールに戻る（検索中や別メール表示中の場合）
      if (state.phase && state.originalUrl && window.location.href !== state.originalUrl) {
        window.location.href = state.originalUrl;
      }
      
      // 状態をリセット
      state.phase = null;
    };
    
    makeDraggable(passwordPopup, passwordPopup.querySelector('#ppap-drag-handle'));
  }

  function makeDraggable(popup, handle) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    handle.style.cursor = 'move';
    
    handle.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('ppap-close')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = popup.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      popup.style.left = (startLeft + dx) + 'px';
      popup.style.top = (startTop + dy) + 'px';
      popup.style.right = 'auto';
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  const fileIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;

  function showPassword(files, passwords) {
    if (!passwordPopup) createPopup();
    const c = passwordPopup.querySelector('.ppap-content');
    
    const items = [];
    
    if (files.length === 0) {
      items.push({ file: '添付ファイル', pw: passwords[0] || '' });
    } else if (files.length === passwords.length) {
      files.forEach((f, i) => items.push({ file: f, pw: passwords[i] }));
    } else {
      files.forEach(f => items.push({ file: f, pw: passwords[0] || '' }));
    }
    
    let html = '';
    items.forEach((item, idx) => {
      html += `
        <div class="ppap-item${idx > 0 ? ' ppap-item-border' : ''}">
          <div class="ppap-file">${fileIcon}<span>${esc(item.file)}</span></div>
          <div class="ppap-pw-row">
            <code class="ppap-pw">${esc(item.pw)}</code>
            <button class="ppap-copy" data-pw="${esc(item.pw)}" title="コピー">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    });
    
    c.innerHTML = html;
    
    c.querySelectorAll('.ppap-copy').forEach(btn => {
      btn.onclick = () => {
        const pw = btn.getAttribute('data-pw');
        navigator.clipboard.writeText(pw);
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#81c995" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        setTimeout(() => {
          btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
        }, 2000);
      };
    });
  }

  function showFallback(subject) {
    if (!passwordPopup) createPopup();
    const c = passwordPopup.querySelector('.ppap-content');
    const url = `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(subject + ' パスワード')}`;
    c.innerHTML = `
      <p style="color:#f28b82;margin:0 0 10px;font-size:12px">自動取得できませんでした</p>
      <a href="${url}" class="ppap-search-btn">手動で検索</a>
      <div class="ppap-manual">
        <input type="text" class="ppap-input" placeholder="パスワードを入力">
        <button class="ppap-save">保存</button>
      </div>
    `;
    c.querySelector('.ppap-save').onclick = () => {
      const pw = c.querySelector('.ppap-input').value.trim();
      if (pw) { 
        passwordCache.set(subject, { files: state.files, passwords: [pw] }); 
        showPassword(state.files, [pw]); 
      }
    };
  }

  function esc(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
  }

  function findAndClickPasswordEmail() {
    const rows = document.querySelectorAll('tr.zA, div.zA');
    log('Search results:', rows.length, 'rows');
    
    let candidates = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const snippet = row.querySelector('.y2, .y6')?.innerText || '';
      const subject = row.querySelector('.bqe, .bog, .y6')?.innerText || '';
      
      log(`Row ${i}: "${subject.substring(0, 30)}" | snippet: "${snippet.substring(0, 50)}"`);
      
      const isBodyMail = BODY_MAIL_KEYWORDS.some(kw => snippet.includes(kw));
      if (isBodyMail) {
        log(`  -> Skip (body mail)`);
        continue;
      }
      
      const isPasswordMail = PASSWORD_MAIL_KEYWORDS.some(kw => 
        snippet.includes(kw) || snippet.toLowerCase().includes(kw.toLowerCase())
      );
      
      const maybePasswordMail = (snippet.includes('パスワード') || snippet.toLowerCase().includes('password')) && !isBodyMail;
      
      if (isPasswordMail) {
        log(`  -> Password mail (high confidence)`);
        candidates.unshift({ row, confidence: 'high', index: i });
      } else if (maybePasswordMail) {
        log(`  -> Maybe password mail (low confidence)`);
        candidates.push({ row, confidence: 'low', index: i });
      }
    }
    
    log('Candidates:', candidates.length);
    
    if (candidates.length > 0) {
      const best = candidates[0];
      log(`Clicking row ${best.index} (${best.confidence})`);
      best.row.click();
      return true;
    }
    
    log('No password mail found');
    return false;
  }

  async function tick() {
    // キャンセルされた場合は何もしない
    if (state.cancelled) {
      log('Cancelled, skip');
      return;
    }
    
    const isSearch = isSearchListPage();
    const emailOpen = isEmailOpen();
    const currentEmailId = getEmailIdFromUrl();
    
    log('tick:', state.phase, { isSearch, emailOpen, emailId: currentEmailId?.substring(0, 10) });

    // 検索中にキャンセルされたかチェック
    if (state.phase === 'searching') {
      if (state.cancelled) {
        log('Cancelled during search');
        state.phase = null;
        return;
      }
      
      if (isSearch) {
        await sleep(3500);
        if (state.cancelled) return;  // 待機中にキャンセルされたかチェック
        
        if (findAndClickPasswordEmail()) {
          state.phase = 'opening';
        } else {
          goBackWithFallback();
        }
      }
      return;
    }

    if (state.phase === 'opening' && emailOpen) {
      if (state.cancelled) {
        log('Cancelled during opening');
        state.phase = null;
        return;
      }
      
      await sleep(3000);
      if (state.cancelled) return;
      
      const passwords = extractPasswords(getEmailBodyText());
      if (passwords.length > 0) {
        log('Got passwords:', passwords);
        state.foundPasswords = passwords;
        passwordCache.set(state.originalSubject, { files: state.files, passwords });
        state.phase = 'gotPassword';
        log('Go back');
        window.location.href = state.originalUrl;
      } else {
        log('No password in this email');
        goBackWithFallback();
      }
      return;
    }

    if (state.phase === 'gotPassword' && emailOpen) {
      await sleep(2000);
      if (state.cancelled) return;
      
      log('Show password');
      showPassword(state.files, state.foundPasswords);
      state.phase = null;
      state.foundPasswords = [];
      return;
    }

    if (state.phase === null && emailOpen) {
      // このメールがキャンセルされたものならスキップ
      if (cancelledEmailIds.has(currentEmailId)) {
        log('This email was cancelled, skip');
        return;
      }
      
      await sleep(1500);
      
      const subject = getEmailSubject();
      if (!subject) return;
      
      const cached = passwordCache.get(subject);
      if (cached) {
        log('Cache hit');
        showPassword(cached.files, cached.passwords);
        return;
      }
      
      if (!isPPAPEmail()) {
        if (passwordPopup) { passwordPopup.remove(); passwordPopup = null; }
        return;
      }
      
      const files = extractZipFileNames();
      
      log('PPAP detected:', subject, 'files:', files);
      
      state.originalUrl = window.location.href;
      state.originalSubject = subject;
      state.originalEmailId = currentEmailId;
      state.files = files;
      state.phase = 'searching';
      state.cancelled = false;
      
      createPopup();
      
      // ファイル名 + 件名 + パスワード で検索（より正確）
      const fileNamePart = files.length > 0 ? files[0] + ' ' : '';
      const searchQuery = fileNamePart + subject + ' パスワード';
      log('Search query:', searchQuery);
      const searchUrl = `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(searchQuery)}`;
      log('Go search');
      window.location.href = searchUrl;
    }
  }

  function goBackWithFallback() {
    if (state.cancelled) {
      state.phase = null;
      return;
    }
    state.phase = null;
    window.location.href = state.originalUrl;
    setTimeout(() => {
      if (!state.cancelled) {
        showFallback(state.originalSubject);
      }
    }, 3000);
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  let lastUrl = '';
  let lastEmailId = '';
  
  setInterval(() => {
    const currentUrl = window.location.href;
    const currentEmailId = getEmailIdFromUrl();
    
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      
      // 別のメールを開いた、または一覧に戻った場合はキャンセル状態をリセット
      if (currentEmailId !== lastEmailId) {
        if (state.cancelled && currentEmailId !== state.originalEmailId) {
          log('Reset cancelled state (different email)');
          state.cancelled = false;
        }
        lastEmailId = currentEmailId;
      }
      
      log('URL changed');
      setTimeout(tick, 800);
    }
  }, 800);

  log('=== PPAP Detector v14 ===');
  setTimeout(tick, 2000);
})();
