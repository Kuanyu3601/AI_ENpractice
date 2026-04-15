console.log('[main.js v3] ✓ 已載入');

var _total      = 0;
var _currentIdx = 0;
var _recorded   = new Set();
var _decorating = false;

window.ParagraphUI = (function () {
    'use strict';

    // 【關鍵】所有工具函數都必須在這個 function 作用域內定義
    function buildOverview() {
        const overviewStrip = document.getElementById('paraOverviewStrip');
        if (!overviewStrip) return;
        overviewStrip.innerHTML = '';
        for (var i = 0; i < _total; i++) {
            var pip = document.createElement('div');
            pip.className   = 'para-pip';
            pip.dataset.idx = i;
            pip.title       = '段落 ' + (i + 1);
            pip.textContent = i + 1;
            pip.addEventListener('click', function() {
                var idx = parseInt(this.dataset.idx, 10);
                if (typeof window.goToParagraph === 'function') window.goToParagraph(idx);
            });
            overviewStrip.appendChild(pip);
        }
        refreshOverview();
    }

    function refreshOverview() {
        const overviewStrip = document.getElementById('paraOverviewStrip');
        if (!overviewStrip) return;
        overviewStrip.querySelectorAll('.para-pip').forEach(function (pip) {
            var idx = parseInt(pip.dataset.idx, 10);
            pip.className = 'para-pip';
            if (idx === _currentIdx)     pip.classList.add('pip-current');
            else if (_recorded.has(idx)) pip.classList.add('pip-recorded');
            else                         pip.classList.add('pip-pending');
        });
    }

    // ── Paragraph badge decoration ───────────────────
    function decorateParagraphs() {
        if (!lyricsView) return;
        _decorating = true;
        var paras = lyricsView.querySelectorAll('.lyric-para');
        if (!paras.length) return;

        if (_total === 0) _total = paras.length;
        if (overviewStrip && !overviewStrip.children.length) buildOverview();

        paras.forEach(function (para, domIdx) {
            var idx = parseInt(para.dataset.paraIdx, 10);
            if (isNaN(idx)) idx = domIdx;

            if (para.classList.contains('lyric-current')) _currentIdx = idx;

            // Inject status-row once
            if (!para.querySelector('.lyric-status-row')) {
                var row   = document.createElement('div');
                row.className = 'lyric-status-row';
                var num   = document.createElement('span');
                num.className = 'lyric-para-num';
                num.textContent = '段落 ' + (idx + 1);
                var badge = document.createElement('span');
                badge.className = 'lyric-badge';
                row.appendChild(num);
                row.appendChild(badge);
                para.insertBefore(row, para.firstChild);
            }

            updateParaBadge(para, idx);

            // Click handler (once)
            if (!para.dataset.clickBound) {
                para.dataset.clickBound = '1';
                para.addEventListener('click', function () {
                    if (this.classList.contains('lyric-current')) return;
                    var i = parseInt(this.dataset.paraIdx, 10);
                    if (isNaN(i)) {
                        i = Array.prototype.indexOf.call(
                            lyricsView.querySelectorAll('.lyric-para'), this
                        );
                    }
                    if (typeof window.goToParagraph === 'function') window.goToParagraph(i);
                });
            }

            // Tooltip hint
            para.dataset.hint = para.classList.contains('lyric-current') ? '' : '點擊切換至此段落';

            // Recorded tint
            if (_recorded.has(idx)) para.classList.add('para-recorded');
            else                     para.classList.remove('para-recorded');
        });

        refreshOverview();
        _decorating = false;
    }

    function updateParaBadge(para, idx) {
        var badge = para.querySelector('.lyric-badge');
        if (!badge) return;
        if (para.classList.contains('lyric-current')) {
            badge.className   = 'lyric-badge badge-current';
            badge.textContent = '▶ 目前段落';
        } else if (_recorded.has(idx)) {
            badge.className   = 'lyric-badge badge-recorded';
            badge.textContent = '✓ 已錄音';
        } else {
            badge.className   = 'lyric-badge badge-pending';
            badge.textContent = '○ 待錄音';
        }
    }

    function refreshAll() {
        // 這裡可以呼叫原本的 decorateParagraphs 邏輯
        // 確保你原本 code 裡的 decorateParagraphs 也在這個作用域內
        if (typeof decorateParagraphs === 'function') decorateParagraphs();
        refreshOverview();
    }

    // 暴露給外部的 API
    return {
        setTotal: function (n) {
            _total      = n;
            _recorded   = new Set();
            _currentIdx = 0;
            buildOverview(); // 現在這裡就能找到了
        },
        markRecorded: function (idx) {
            _recorded.add(idx);
            refreshOverview();
        },
        setCurrentIdx: function (idx) {
            _currentIdx = idx;
            refreshOverview();
        }
    };
})();

// ══════════════════════════════════════════════════
//  WAV ENCODER  (16 kHz mono)
// ══════════════════════════════════════════════════
async function convertToWav16k(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const tmpCtx = new AudioContext();
    const decoded = await tmpCtx.decodeAudioData(arrayBuffer);
    await tmpCtx.close();

    const SR = 16000;
    const numSamples = Math.round(decoded.duration * SR);
    const offCtx = new OfflineAudioContext(1, numSamples, SR);
    const src = offCtx.createBufferSource();
    src.buffer = decoded;
    src.connect(offCtx.destination);
    src.start();
    const rendered = await offCtx.startRendering();
    return pcmToWav(rendered.getChannelData(0), SR);
}

function pcmToWav(samples, sampleRate) {
    const buf = new ArrayBuffer(44 + samples.length * 2);
    const v = new DataView(buf);
    const wr = (off, str) => { for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i)); };
    wr(0, 'RIFF');
    v.setUint32(4, 36 + samples.length * 2, true);
    wr(8, 'WAVE'); wr(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);  // PCM
    v.setUint16(22, 1, true);  // mono
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, sampleRate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    wr(36, 'data');
    v.setUint32(40, samples.length * 2, true);
    let off = 44;
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        off += 2;
    }
    return new Blob([buf], { type: 'audio/wav' });
}

// ══════════════════════════════════════════════════
//  PRESET ARTICLES DATA
// ══════════════════════════════════════════════════
const PRESET_ARTICLES = {
    shark: {
        title: 'Shark',
        emoji: '🦈',
        paragraphs: [
            "What has fins, sharp teeth, and swims in the ocean? A Shark!",
            "Sharks have been around for a very long time. Sharks have lived in the oceans even before dinosaurs! Sharks are fish, and there are over four hundred types of sharks. When they have babies, the babies are called pups.",
            "Sharks lose their teeth, like humans, but they don't just lose their baby teeth. They lose teeth throughout their lives. When a shark loses a tooth, a tooth from another row of teeth will move into its place. New teeth are always growing.",
            "Sharks might look scary, but they are not usually dangerous to people. People are more dangerous to sharks, since people hunt sharks. To be safe, it is a good idea to leave sharks alone if you see them!"
        ]
    },
    kitten: null, // Coming soon
    temp: null    // Coming soon
};

// ══════════════════════════════════════════════════
//  APP STATE
// ══════════════════════════════════════════════════
const state = {
    currentStep: 0,
    completedSteps: new Set([0]),
    article: null,
    currentParagraph: 0,
    recordings: [],
    mediaRecorder: null,
    audioChunks: [],
    isRecording: false,
    recordingBlob: null,
    timerInterval: null,
    timerSeconds: 0,
};



// ══════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════
console.log('[main.js v3] loaded ✓');

document.addEventListener('DOMContentLoaded', () => {
    console.log('[main.js] DOMContentLoaded fired');
    checkFirstTime();
    loadHistory();
    bindEvents();
    updateStepUI();
    console.log('[main.js] init complete, currentStep =', state.currentStep);
});

function bindEvents() {
    // Profile
    document.getElementById('userBtn').addEventListener('click', openProfile);
    document.getElementById('profileOverlay').addEventListener('click', closeProfile);
    document.getElementById('profileCloseBtn').addEventListener('click', closeProfile);
    document.getElementById('profileSaveBtn').addEventListener('click', saveProfile);
    document.getElementById('logoutBtn').addEventListener('click', () => { window.location.href = 'index.html'; });
    document.getElementById('changePwdBtn').addEventListener('click', () => showToast('更改密碼功能即將推出'));

    // First-time modal
    document.getElementById('modalConfirmBtn').addEventListener('click', confirmAge);
    document.getElementById('modalAge').addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmAge(); });

    // Step nav arrows
    document.getElementById('prevArrow').addEventListener('click', () => navigateStep(-1));
    document.getElementById('nextArrow').addEventListener('click', () => navigateStep(1));

    // Step dots
    document.querySelectorAll('.step-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const step = parseInt(dot.dataset.step);
            goToStep(step);
        });
    });

    // Article cards
    document.querySelectorAll('.article-card:not(.locked)').forEach(card => {
        card.addEventListener('click', () => selectPreset(card.dataset.article));
    });

    // File upload
    document.getElementById('fileInput').addEventListener('change', (e) => {
        if (e.target.files[0]) processFile(e.target.files[0]);
    });

    // Drag & drop
    const uploadArea = document.getElementById('uploadArea');
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    });

    // Clear selection
    document.getElementById('clearBtn').addEventListener('click', clearSelection);

    // Start button
    document.getElementById('startBtn').addEventListener('click', startPractice);

    // Record button
    document.getElementById('recordBtn').addEventListener('click', toggleRecord);

    // Upload audio
    document.getElementById('uploadAudioBtn').addEventListener('click', uploadAudio);

    // Reading count dropdown
    document.getElementById('readingCountBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('readingHistoryDropdown').classList.toggle('open');
    });
    document.addEventListener('click', () => {
        document.getElementById('readingHistoryDropdown').classList.remove('open');
    });

    // New session
    document.getElementById('newSessionBtn').addEventListener('click', newSession);
}

// ══════════════════════════════════════════════════
//  FIRST-TIME & PROFILE
// ══════════════════════════════════════════════════
function checkFirstTime() {
    const age = localStorage.getItem('userAge');
    if (!age) {
        document.getElementById('firstTimeModal').classList.add('active');
    }
}

function confirmAge() {
    const input = document.getElementById('modalAge');
    const age = parseInt(input.value);
    if (!age || age < 1 || age > 120) {
        input.style.borderColor = '#e74c3c';
        input.focus();
        return;
    }
    localStorage.setItem('userAge', age);
    const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    profile.age = age;
    localStorage.setItem('userProfile', JSON.stringify(profile));
    document.getElementById('firstTimeModal').classList.remove('active');
    showToast('歡迎！資料已儲存 🎉');
}

function openProfile() {
    const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    document.getElementById('profileName').value = profile.name || '';
    document.getElementById('profileAge').value = profile.age || localStorage.getItem('userAge') || '';
    document.getElementById('profileUsername').value = profile.username || '';
    document.getElementById('profilePanel').classList.add('open');
    document.getElementById('profileOverlay').classList.add('active');
}

function closeProfile() {
    document.getElementById('profilePanel').classList.remove('open');
    document.getElementById('profileOverlay').classList.remove('active');
}

function saveProfile() {
    const age = document.getElementById('profileAge').value;
    const profile = {
        name: document.getElementById('profileName').value.trim(),
        age: parseInt(age) || '',
        username: document.getElementById('profileUsername').value.trim()
    };
    localStorage.setItem('userProfile', JSON.stringify(profile));
    if (age) localStorage.setItem('userAge', age);
    closeProfile();
    showToast('個人資料已儲存 ✓');
}

// ══════════════════════════════════════════════════
//  STEP NAVIGATION  (between Step 1 / 2 / 3)
// ══════════════════════════════════════════════════
function goToStep(step) {
    if (step === state.currentStep) return;
    if (step > 0 && !state.completedSteps.has(step)) return;
    state.currentStep = step;
    updateStepUI();
}

function navigateStep(dir) {
    const next = state.currentStep + dir;
    if (next < 0 || next > 2) return;
    if (dir > 0 && !state.completedSteps.has(next)) return;
    state.currentStep = next;
    updateStepUI();
}

function updateStepUI() {
    // Panels — use inline style.display as well as class,
    // so Safari cache issues with CSS cannot block switching.
    document.querySelectorAll('.step-panel').forEach((panel, i) => {
        const isActive = (i === state.currentStep);
        panel.classList.toggle('active', isActive);

        if (isActive) {
            panel.style.display = 'flex'; // 你的錄音區塊使用 flex 佈局
        } else {
            panel.style.display = 'none';
        }
         
    });

    // Step dots
    document.querySelectorAll('.step-dot').forEach((dot, i) => {
        dot.classList.remove('active', 'completed', 'clickable');
        if (i === state.currentStep) dot.classList.add('active');
        else if (i < state.currentStep || state.completedSteps.has(i)) dot.classList.add('completed');
        if (state.completedSteps.has(i) && i !== state.currentStep) dot.classList.add('clickable');
    });

    // Step lines
    document.querySelectorAll('.step-line').forEach((line, i) => {
        line.classList.toggle('filled', state.completedSteps.has(i + 1));
    });

    // Arrows
    document.getElementById('prevArrow').disabled = state.currentStep === 0;
    document.getElementById('nextArrow').disabled =
        state.currentStep === 2 || !state.completedSteps.has(state.currentStep + 1);
}

// ══════════════════════════════════════════════════
//  STEP 1 — ARTICLE SELECTION
// ══════════════════════════════════════════════════
function selectPreset(key) {
    console.log('[main.js] selectPreset:', key);
    const article = PRESET_ARTICLES[key];
    if (!article) { console.warn('[main.js] 找不到文章:', key); return; }
    state.article = article;

    document.querySelectorAll('.article-card').forEach(c => c.classList.remove('selected'));
    document.querySelector(`[data-article="${key}"]`).classList.add('selected');

    renderPreview(article);
    document.getElementById('startBtn').disabled = false;
    updateReadingCount();
}

function renderPreview(article) {
    document.getElementById('previewTitle').textContent = `${article.emoji} ${article.title}`;
    document.getElementById('previewContent').innerHTML = article.paragraphs.map((p, i) =>
        `<div class="preview-para">
            <span class="para-tag">段落 ${i + 1}</span>
            <p>${p}</p>
        </div>`
    ).join('');
    document.getElementById('selectedPreview').classList.add('visible');
}

function clearSelection() {
    state.article = null;
    document.querySelectorAll('.article-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('selectedPreview').classList.remove('visible');
    document.getElementById('startBtn').disabled = true;
    document.getElementById('readingCountNum').textContent = '—';
    document.getElementById('readingHistoryList').innerHTML = '<p class="dropdown-empty">請先選擇文章</p>';
}

function processFile(file) {
    if (!file.name.endsWith('.txt')) {
        showToast('請上傳 .txt 格式的文章');
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const paragraphs = text.split(/\n\s*\n/).map(p => p.replace(/\n/g, ' ').trim()).filter(p => p.length > 0);
        if (paragraphs.length === 0) { showToast('文章內容為空'); return; }
        state.article = { title: file.name.replace('.txt', ''), emoji: '📄', paragraphs };
        document.querySelectorAll('.article-card').forEach(c => c.classList.remove('selected'));
        renderPreview(state.article);
        document.getElementById('startBtn').disabled = false;
        updateReadingCount();
    };
    reader.readAsText(file);
}

function startPractice() {
    if (!state.article) return;
    
    try {
        state.currentParagraph = 0;
        state.recordings = new Array(state.article.paragraphs.length).fill(null);
        document.getElementById('chatTitle').textContent = `${state.article.emoji} ${state.article.title}`;
        
        state.completedSteps.add(1);
        state.currentStep = 1; // 進入第二步

        // 安全檢查：確保 UI 模組已載入
        if (window.ParagraphUI) {
            window.ParagraphUI.setTotal(state.article.paragraphs.length);
            window.ParagraphUI.setCurrentIdx(0);
        }

        renderLyrics();
        resetRecordUI();
        updateStepUI();
        
    } catch(err) {
        console.error('[main.js] startPractice 發生錯誤:', err);
        showToast('切換練習模式時發生錯誤');
    }
}
// ══════════════════════════════════════════════════
//  STEP 2 — RECORDING CORE
// ══════════════════════════════════════════════════

/** Render all paragraph cards in #lyricsView and update the progress label */
function renderLyrics() {
    const view     = document.getElementById('lyricsView');
    const progress = document.getElementById('paragraphProgress');
    const paras    = state.article.paragraphs;
    const cur      = state.currentParagraph;

    progress.textContent = `段落 ${cur + 1} / ${paras.length}`;

    view.innerHTML = paras.map((text, i) => {
        let cls = 'lyric-para ';
        if      (i < cur)   cls += 'lyric-past';
        else if (i === cur) cls += 'lyric-current';
        else                cls += 'lyric-future';
        return `<div class="${cls}" data-para-idx="${i}">${text}</div>`;
    }).join('');

    // Notify ParagraphUI (pip strip + badges)
    if (window.ParagraphUI) {
        ParagraphUI.setTotal(paras.length);
        ParagraphUI.setCurrentIdx(cur);
    }

    // Scroll current paragraph into centre
    const curEl = view.querySelector('.lyric-current');
    if (curEl) curEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/** Reset all recording UI back to the idle state */
function resetRecordUI() {
    clearInterval(state.timerInterval);
    state.timerSeconds  = 0;
    state.isRecording   = false;
    state.recordingBlob = null;
    state.audioChunks   = [];

    const timerEl = document.getElementById('recordTimer');
    timerEl.textContent = '00:00';
    timerEl.classList.remove('running');

    const btn = document.getElementById('recordBtn');
    btn.classList.remove('recording');
    document.getElementById('recordBtnText').textContent = '開始錄音';

    document.getElementById('playbackRow').classList.remove('visible');
    document.getElementById('uploadAudioBtn').classList.remove('visible');
    const _audio = document.getElementById('playbackAudio');
    _audio.pause();
    _audio.removeAttribute('src');
    _audio.load();
}

/** Toggle recording on / off */
function toggleRecord() {
    state.isRecording ? stopRecording() : startRecording();
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.audioChunks   = [];
        state.mediaRecorder = new MediaRecorder(stream);

        state.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) state.audioChunks.push(e.data);
        };

        state.mediaRecorder.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            const blob = new Blob(state.audioChunks, { type: 'audio/webm' });
            state.recordingBlob = blob;
            document.getElementById('playbackAudio').src = URL.createObjectURL(blob);
            document.getElementById('playbackRow').classList.add('visible');
            document.getElementById('uploadAudioBtn').classList.add('visible');
        };

        state.mediaRecorder.start();
        state.isRecording = true;

        // Countdown timer
        state.timerSeconds = 0;
        const timerEl = document.getElementById('recordTimer');
        timerEl.classList.add('running');
        state.timerInterval = setInterval(() => {
            state.timerSeconds++;
            const m = String(Math.floor(state.timerSeconds / 60)).padStart(2, '0');
            const s = String(state.timerSeconds % 60).padStart(2, '0');
            timerEl.textContent = `${m}:${s}`;
        }, 1000);

        const btn = document.getElementById('recordBtn');
        btn.classList.add('recording');
        document.getElementById('recordBtnText').textContent = '停止錄音';
        document.getElementById('playbackRow').classList.remove('visible');
        document.getElementById('uploadAudioBtn').classList.remove('visible');

    } catch (err) {
        showToast('無法存取麥克風，請確認瀏覽器權限設定');
        console.error(err);
    }
}

function stopRecording() {
    if (!state.mediaRecorder || !state.isRecording) return;
    state.mediaRecorder.stop();
    state.isRecording = false;
    clearInterval(state.timerInterval);
    document.getElementById('recordTimer').classList.remove('running');
    const btn = document.getElementById('recordBtn');
    btn.classList.remove('recording');
    document.getElementById('recordBtnText').textContent = '重新錄音';
}

/** Convert to WAV, POST to server, then advance paragraph or finish */
async function uploadAudio() {
    if (!state.recordingBlob) { showToast('請先錄音再上傳'); return; }

    const btn = document.getElementById('uploadAudioBtn');
    btn.disabled    = true;
    btn.textContent = '上傳中…';

    try {
        const wavBlob  = await convertToWav16k(state.recordingBlob);
        const formData = new FormData();
        formData.append('audio',           wavBlob, `para_${state.currentParagraph}.wav`);
        formData.append('paragraph_index', state.currentParagraph);
        formData.append('article',         state.article.title);

        const res = await fetch('/upload_audio', { method: 'POST', body: formData });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // Mark paragraph as recorded
        state.recordings[state.currentParagraph] = state.recordingBlob;
        if (window.ParagraphUI) ParagraphUI.markRecorded(state.currentParagraph);

        const isLast = state.currentParagraph >= state.article.paragraphs.length - 1;
        if (isLast) {
            saveSession();
            state.completedSteps.add(2);
            state.currentStep = 2;
            updateStepUI();
            showToast('全部段落錄音完成！🎉');
        } else {
            showToast(`段落 ${state.currentParagraph + 1} 已上傳 ✓`);
            state.currentParagraph++;
            renderLyrics();
            resetRecordUI();
        }
    } catch (err) {
        showToast('上傳失敗，請重試');
        console.error(err);
    } finally {
        btn.disabled    = false;
        btn.textContent = '✓ 上傳並繼續';
        btn.classList.add('visible');
    }
}

/**
 * Jump directly to any paragraph by 0-based index.
 * Exposed on window so ParagraphUI pip clicks can call it.
 */
function goToParagraph(idx) {
    if (!state.article) return;
    if (idx < 0 || idx >= state.article.paragraphs.length) return;
    if (idx === state.currentParagraph) return;
    state.currentParagraph = idx;
    renderLyrics();
    resetRecordUI();
}
window.goToParagraph = goToParagraph;




// ══════════════════════════════════════════════════
//  HISTORY & SESSIONS
// ══════════════════════════════════════════════════
function saveSession() {
    if (!state.article) return;
    const key = `sessions_${state.article.title}`;
    const sessions = JSON.parse(localStorage.getItem(key) || '[]');
    sessions.push({
        date: new Date().toLocaleDateString('zh-TW'),
        time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
        paragraphs: state.article.paragraphs.length,
        score: null
    });
    localStorage.setItem(key, JSON.stringify(sessions));

    const allHistory = JSON.parse(localStorage.getItem('allHistory') || '[]');
    allHistory.unshift({
        title: state.article.title,
        emoji: state.article.emoji,
        date: new Date().toLocaleDateString('zh-TW')
    });
    localStorage.setItem('allHistory', JSON.stringify(allHistory.slice(0, 50)));
    loadHistory();
    updateReadingCount();
}

function loadHistory() {
    const all = JSON.parse(localStorage.getItem('allHistory') || '[]');
    const list = document.getElementById('historyList');
    if (all.length === 0) {
        list.innerHTML = '<li class="history-item muted">尚無練習紀錄</li>';
        return;
    }
    list.innerHTML = all.map((h, i) =>
        `<li class="history-item${i === 0 ? ' active' : ''}">
            <span>${h.emoji || '📄'} ${h.title}</span>
            <small>${h.date}</small>
        </li>`
    ).join('');
}

function updateReadingCount() {
    if (!state.article) return;
    const key = `sessions_${state.article.title}`;
    const sessions = JSON.parse(localStorage.getItem(key) || '[]');
    document.getElementById('readingCountNum').textContent = sessions.length + 1;

    const listEl = document.getElementById('readingHistoryList');
    if (sessions.length === 0) {
        listEl.innerHTML = '<p class="dropdown-empty">✨ 這是您第一次練習這篇文章！</p>';
    } else {
        listEl.innerHTML = sessions.map((s, i) =>
            `<div class="dropdown-session">
                <span class="ds-num">第 ${i + 1} 次</span>
                <span class="ds-date">${s.date} ${s.time}</span>
                <span class="ds-score">${s.score !== null ? s.score + ' 分' : '待評'}</span>
            </div>`
        ).join('');
    }
}

function newSession() {
    state.article          = null;
    state.currentStep      = 0;
    state.currentParagraph = 0;
    state.completedSteps   = new Set([0]);
    state.recordings       = [];
    resetRecordUI();
    document.getElementById('chatTitle').textContent = '選擇文章開始練習';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('selectedPreview').classList.remove('visible');
    document.querySelectorAll('.article-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('readingCountNum').textContent = '—';
    document.getElementById('readingHistoryList').innerHTML = '<p class="dropdown-empty">請先選擇文章</p>';
    updateStepUI();
}

// ══════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}