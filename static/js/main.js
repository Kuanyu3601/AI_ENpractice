// ══════════════════════════════════════════════════
//  📱 PWA：註冊 Service Worker
// ══════════════════════════════════════════════════
// 💡 這是瀏覽器判斷「這個網站可以被安裝成 App」的必要條件之一。
//    ⚠️ 有個重要限制：Service Worker 只能在「安全情境」下註冊成功——
//    也就是網址是 https:// 開頭，或者是 http://localhost / http://127.0.0.1。
//    如果你是透過學校網路的內網 IP（例如 http://192.168.x.x:5001）用 http 連線，
//    瀏覽器會直接拒絕註冊 Service Worker（這不是程式錯誤，是瀏覽器的安全機制），
//    這種情況下 PWA 沒辦法完整安裝，manifest.json 本身還是讀得到，但不會出現安裝按鈕。
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then((reg) => console.log('✅ Service Worker 註冊成功:', reg.scope))
            .catch((err) => console.warn('⚠️ Service Worker 註冊失敗（如果是 http+非localhost 連線，這是正常現象）:', err.message));
    });
}

window.switchWerFilter = function(btn, errorType, stripId) {
    const strip = document.getElementById(stripId);
    if (!strip) return;

    // 1. 高亮按鈕切換
    strip.querySelectorAll('.wer-filter-btn').forEach(b => {
        b.style.background = '#f1f5f9';
        b.style.color = '#475569';
    });
    btn.style.background = '#e63946';
    btn.style.color = '#fff';

    // 2. 取得對齊資料
    const rawData = strip.dataset.alignment;
    if (!rawData) return;
    let alignData = [];
    try { alignData = JSON.parse(rawData); } catch(e) { return; }

    // 3. 類別對應
    const targetCategory = {
        'repair_repetition': 'Repair_Repetition',
        'repair_attempt': 'Repair_Attempt',
        'repair_restart': 'Repair_Restart',
        'substitutions': 'Substitute',
        'deletions': 'Delete',
        'insertions': 'Insert'
    }[errorType] || errorType;

    // 4. 構建上下疊加的單字卡
    let wordPairsHtml = '';

    alignData.forEach(item => {
        const cat = (item.Category || item.category || '').toString();
        const ref = (item.Reference || item.reference || '—').trim();
        let hyp = (item.Hypothesis || item.hypothesis || '—').trim();

        const isTargetError = cat.toLowerCase() === targetCategory.toLowerCase();

        // 💡 調整樣式：正確的字為黑色，大小與發音一致
        let refStyle = 'font-size: 1.05rem; color: #1f2937; font-weight: 500;';
        let hypStyle = 'font-size: 1.05rem; color: #4b5563; font-weight: 500;'; 
        let bgStyle = 'transparent';
        let displayHyp = hyp;

        if (isTargetError) {
            // 🎯 命中錯誤：紅字、紅底、加粗
            hypStyle = 'font-size: 1.05rem; color: #e63946; font-weight: 800; background: #fee2e2; padding: 2px 4px; border-radius: 4px; border-bottom: 2px solid #e63946;';
            bgStyle = '#fee2e2';
            if (cat.toLowerCase() === 'delete') {
                displayHyp = 'NULL';
            }
        } else if (hyp === '—' || !hyp) {
            displayHyp = '-'; 
            hypStyle = 'font-size: 1.05rem; color: #cbd5e1;';
        }

        wordPairsHtml += `
            <div style="display: inline-flex; flex-direction: column; align-items: center; margin: 6px 8px; background: ${bgStyle}; padding: 4px 8px; border-radius: 6px; transition: 0.3s;">
                <span style="${refStyle} margin-bottom: 2px;">${ref === '—' ? '-' : ref}</span>
                <span style="${hypStyle}">${displayHyp}</span>
            </div>
        `;
    });

    // 5. 渲染回畫面上
    const area = strip.querySelector('.transcript-display-area');
    if (area) {
        area.innerHTML = `
            <div style="width:100%; background:#ffffff; padding:20px; border: 1px solid #e2e8f0; border-radius:12px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                <div style="margin-bottom:16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px;">
                    <span style="font-weight:bold; color:#1f2937; font-size: 1.05rem;">📝 逐字對照（${errorType} 已標紅）</span>
                    <span style="font-size: 0.8rem; background: #f1f5f9; color: #64748b; padding: 4px 10px; border-radius: 12px;">上:標準原文 / 下:你的發音</span>
                </div>
                <div style="display: flex; flex-wrap: wrap; line-height: 2.2; align-items: flex-end;">
                    ${wordPairsHtml || '<p style="color:#999;">無內容</p>'}
                </div>
            </div>
        `;
    }
};

console.log('[main.js v3] ✓ 已載入');

function toggleSidebar() {


    const sidebar     = document.getElementById('sidebar');
    const showBtn     = document.getElementById('sidebarShowBtn');
    if (!sidebar) return;
 
    const collapsed = sidebar.classList.toggle('is-collapsed');
 
    if (showBtn) {
        showBtn.classList.toggle('is-visible', collapsed);
    }
 
    // 記住使用者的選擇，下次開啟頁面時維持同樣狀態
    try {
        localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0');
    } catch (e) { /* 忽略無痕模式等例外狀況 */ }

    document.body.classList.toggle('sidebar-open', !collapsed);
}
 
// 💡 頁面載入時還原使用者上次的收合狀態
document.addEventListener('DOMContentLoaded', () => {
    let wasCollapsed = false;
    try {
        wasCollapsed = localStorage.getItem('sidebarCollapsed') === '1';
    } catch (e) { /* 忽略 */ }
 
    if (wasCollapsed) {
        const sidebar = document.getElementById('sidebar');
        const showBtn = document.getElementById('sidebarShowBtn');
        if (sidebar) sidebar.classList.add('is-collapsed');
        if (showBtn) showBtn.classList.add('is-visible');
    }

    document.body.classList.toggle('sidebar-open', !wasCollapsed);
});

function collapseSidebar() {
    const sidebar = document.getElementById('sidebar');
    const showBtn = document.getElementById('sidebarShowBtn');
    if (!sidebar || sidebar.classList.contains('is-collapsed')) return;

    sidebar.classList.add('is-collapsed');
    if (showBtn) showBtn.classList.add('is-visible');

    try {
        localStorage.setItem('sidebarCollapsed', '1');
    } catch (e) { /* 忽略無痕模式等例外狀況 */ }

    document.body.classList.remove('sidebar-open');
}

document.addEventListener('click', (e) => {
    if (window.innerWidth > 768) return;   // 只在手機版生效

    const sidebar = document.getElementById('sidebar');
    if (!sidebar || sidebar.classList.contains('is-collapsed')) return;

    const clickedInsideSidebar = sidebar.contains(e.target);
    const clickedToggleBtn = e.target.closest('#sidebarShowBtn, #sidebarHideBtn, #navHistoryBtn');

    if (!clickedInsideSidebar && !clickedToggleBtn) {
        collapseSidebar();
    }
});

function relayoutMobileControls() {
    const functionEl    = document.getElementById('function');
    const mobileRow      = document.getElementById('mobileControlsRow');
    const lyricsWrapper  = document.getElementById('lyricsWrapper');
    const lyricsView     = document.getElementById('lyricsView');
    if (!functionEl || !mobileRow || !lyricsWrapper || !lyricsView) return;

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // 手機版：把按鈕搬進段落列所在的共用列（跟在段落按鈕後面，形成同一排）
        if (functionEl.parentElement !== mobileRow) {
            mobileRow.appendChild(functionEl);
        }
    } else {
        // 桌面版：搬回原本位置（字幕區 #lyricsView 之前）
        if (functionEl.parentElement !== lyricsWrapper || functionEl.nextElementSibling !== lyricsView) {
            lyricsWrapper.insertBefore(functionEl, lyricsView);
        }
    }
}

document.addEventListener('DOMContentLoaded', relayoutMobileControls);
window.addEventListener('resize', () => {
    clearTimeout(window._controlsRelayoutTimer);
    window._controlsRelayoutTimer = setTimeout(relayoutMobileControls, 80);
});



// Kitten's_Choice 各段提示圖片設定
// 格式：每個段落（索引0, 1, 2...）對應三張圖片的路徑
// 請把 src 換成你實際的檔案路徑
// 💡 翻牌功能：hint 欄位請自行填入該圖片對應的提示文字（點擊圖片翻面後會顯示這段文字）
//    如果想換行，直接在字串裡打 \n 即可，例如：hint: '第一行\n第二行'
var KITTENS_CHOICE_HINTS = [
    // 段落 1（index 0）
    [
        { src: '/static/image/hint/kitten_101.webp', alt: '段落1 提示A', hint: '...plays...\n...loves...' },
        { src: '/static/image/hint/kitten_102.webp', alt: '段落1 提示B', hint: 'Her brother...,too.' },
        { src: '/static/image/hint/kitten_103.webp', alt: '段落1 提示C', hint: 'When...it,\nher brother...play.' },
    ],
    // 段落 2（index 1）
    [
        { src: '/static/image/hint/kitten_201.webp', alt: '段落2 提示A', hint: 'Kitten...fun.' },
        { src: '/static/image/hint/kitten_202.webp', alt: '段落2 提示B', hint: 'Then,...mouse!\n...chase...' },
        { src: '/static/image/hint/kitten_203.webp', alt: '段落2 提示C', hint: 'If...the mouse,\nher brother...toy.' },
    ],
    // 段落 3（index 2）
    [
        { src: '/static/image/hint/kitten_301.webp', alt: '段落3 提示A', hint: '...thinks.\nShe...to play with.' },
        { src: '/static/image/hint/kitten_302.webp', alt: '段落3 提示B', hint: 'If...mouse,\nher toy...her brother.' },
        { src: '/static/image/hint/kitten_303.webp', alt: '段落3 提示C', hint: 'If...toy,\nthe mouse...away.\nWhich...?' },
    ],
    // 段落 4（index 3）
    [
        { src: '/static/image/hint/kitten_401.webp', alt: '段落4 提示A', hint: 'Kitten...mouse' },
        { src: '/static/image/hint/kitten_402.webp', alt: '段落4 提示B', hint: 'She...mice,\nso that...fun.' },
        { src: '/static/image/hint/kitten_403.webp', alt: '段落4 提示C', hint: 'She...mouse,\nbut...after him.\nKitten...choice.' },
    ],
];

var SHARKS_HINTS = [
    // 段落 1（index 0）
    [
        { src: '/static/image/hint/shark_101.webp', alt: '段落1 提示A', hint: '...fins,' },
        { src: '/static/image/hint/shark_102.webp', alt: '段落1 提示B', hint: '...teeth,' },
        { src: '/static/image/hint/shark_103.webp', alt: '段落1 提示C', hint: '...swims...?\nA...!' },
    ],
    // 段落 2（index 1）
    [
        { src: '/static/image/hint/shark_201.webp', alt: '段落2 提示A', hint: 'Sharks...long time.\nSharks...dinosaurs!' },
        { src: '/static/image/hint/shark_202.webp', alt: '段落2 提示B', hint: '...fish,\nand...types...\n' },
        { src: '/static/image/hint/shark_203.webp', alt: '段落2 提示C', hint: '...babies,\n...pups.' },
    ],
    // 段落 3（index 2）
    [
        { src: '/static/image/hint/shark_301.webp', alt: '段落3 提示A', hint: 'Sharks...teeth,\n...humans,' },
        { src: '/static/image/hint/shark_302.webp', alt: '段落3 提示B', hint: 'but...baby teeth.\nThey...lives.' },
        { src: '/static/image/hint/shark_303.webp', alt: '段落3 提示C', hint: 'When...tooth,\n...row...its place.\nNew...growing.' },
    ],
    // 段落 4（index 3）
    [
        { src: '/static/image/hint/shark_401.webp', alt: '段落4 提示A', hint: 'Sharks...scary,\nbut...to people.' },
        { src: '/static/image/hint/shark_402.webp', alt: '段落4 提示B', hint: 'People...to sharks,\nsince...sharks.' },
        { src: '/static/image/hint/shark_403.webp', alt: '段落4 提示C', hint: 'To be...,\n...good idea...if...them!' },
    ],
];

var HILL_HINTS = [
    // 段落 1（index 0）
    [
        { src: '/static/image/hint/Hill_101.webp', alt: '段落1 提示A', hint: '...berries,\n...together.' },
        { src: '/static/image/hint/Hill_102.webp', alt: '段落1 提示B', hint: 'What...sound?\nMonkey...scared.' },
        { src: '/static/image/hint/Hill_103.webp', alt: '段落1 提示C', hint: 'Just...,\nthey...safe place.' },
    ],
    // 段落 2（index 1）
    [
        { src: '/static/image/hint/Hill_201.webp', alt: '段落2 提示A', hint: 'They...home.' },
        { src: '/static/image/hint/Hill_202.webp', alt: '段落2 提示B', hint: 'Bird...,"The rain...Our...help."\nDeer...,"We...,but...!Let\'s...!"' },
        { src: '/static/image/hint/Hill_203.webp', alt: '段落2 提示C', hint: 'First,...rocks.' },
    ],
    // 段落 3（index 2）
    [
        { src: '/static/image/hint/Hill_301.webp', alt: '段落3 提示A', hint: '"One,...!One,...!"' },
        { src: '/static/image/hint/Hill_302.webp', alt: '段落3 提示B', hint: 'Second,...friends.\n"...okay?...safe?"' },
        { src: '/static/image/hint/Hill_303.webp', alt: '段落3 提示C', hint: 'They...trees!' },
    ],
    // 段落 4（index 3）
    [
        { src: '/static/image/hint/Hill_401.webp', alt: '段落4 提示A', hint: 'Their...soil.' },
        { src: '/static/image/hint/Hill_402.webp', alt: '段落4 提示B', hint: 'Everyone...plan!\nThey...seeds.\nThey...trees.' },
        { src: '/static/image/hint/Hill_403.webp', alt: '段落4 提示C', hint: '"Now,...home!"' },
    ],
];


var _total      = 0;
var _currentIdx = 0;
var _recorded   = new Set();
var _decorating = false;
var _articleKey = null; // 💡 新增：追蹤目前是「哪一篇/哪一次」，setTotal 靠這個判斷是否真的換了文章

// 全域遮擋狀態（供 renderLyrics 重繪後重新套用）
window._isMasked = false;

let wavesurfer;
let wsRegions;

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
        setTotal: function (n, key) {
            // 💡 關鍵修正：這個函式原本「每次被呼叫」都會無條件清空 _recorded（已錄音記錄），
            //    但它其實在每次段落重新渲染（包含錄完一段自動跳下一段、或點擊切換段落）都會被呼叫，
            //    導致綠色的「已錄音」標記畫出來沒多久就被下一次重繪清空。
            //    現在改成：只有在「真的換了不同文章/次數」時才重置，同一篇文章內的重繪不會影響已錄音記錄。
            var isSameArticle = (key !== undefined && key !== null)
                ? (key === _articleKey)
                : (n === _total && _total !== 0);

            _total = n;
            if (key !== undefined) _articleKey = key;

            if (!isSameArticle) {
                _recorded   = new Set();
                _currentIdx = 0;
            }
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
    // 1. 建立 AudioContext
    const tmpCtx = new (window.AudioContext || window.webkitAudioContext)();

    // 2. 重要：檢查狀態並喚醒 (解決 Chrome 靜音問題)
    if (tmpCtx.state === 'suspended') {
        await tmpCtx.resume();
    }

    try {
        // 3. 解碼原始錄音資料 (WebM -> PCM)
        const decoded = await tmpCtx.decodeAudioData(arrayBuffer);

        // 4. 重採樣至 16000Hz (專題要求的規格)
        const SR = 16000;
        const numSamples = Math.round(decoded.duration * SR);
        const offCtx = new OfflineAudioContext(1, numSamples, SR);

        const src = offCtx.createBufferSource();
        src.buffer = decoded;
        src.connect(offCtx.destination);
        src.start();

        const rendered = await offCtx.startRendering();
        await tmpCtx.close(); // 釋放記憶體

        // 5. 檢查數據是否有聲音 (Debug 用)
        const pcmData = rendered.getChannelData(0);
        console.log('[WAV轉碼] 第一個樣本點:', pcmData[0]);

        return pcmToWav(pcmData, SR);
    } catch (e) {
        console.error("解碼失敗，可能是錄音檔毀損:", e);
        await tmpCtx.close();
        throw e;
    }
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
    activeProjectId: null, // 當前選中的專案 ID (例如: 'proj_1714320000000')
    projects: {},          // 存放所有專案資料: { 'id': { article, recordings, currentStep, ... } }

    // 以下為「當前活動專案」的快速引用 (保留原本變數名稱，不影響舊有邏輯)
    currentStep: 0,
    completedSteps: new Set([0]),
    article: null,
    currentParagraph: 0,
    practiceMode: 'segment', // 'segment' = 分段練習, 'whole' = 整篇練習
    recordings: [],        // 儲存本次練習的 Blob 暫存

    // 錄音工具狀態
    mediaRecorder: null,
    audioChunks: [],
    isRecording: false,
    recordingBlob: null,
    timerInterval: null,
    timerSeconds: 0,
    recordState: 'idle'
};



// ══════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════
console.log('[main.js v3] loaded ✓');

document.addEventListener('DOMContentLoaded', async() => {
    initTTS();
    initMaskBtn();
    console.log('[main.js] DOMContentLoaded fired');
    checkFirstTime();
    await initUserHistory();
    bindEvents();
    updateStepUI();
    console.log('[main.js] init complete, currentStep =', state.currentStep);
});

function bindEvents() {
    console.log('[Debug] 開始綁定所有事件');

    const safeBind = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, fn);
        else console.warn(`[Missing ID] 找不到 id="${id}"，跳過綁定`);
    };

    // 💡 側邊欄按鈕（順便修正這裡，原本是寫死的 createNewProject()）
    const plusBtn = document.querySelector('.sidebar-header .btn-plus') || document.getElementById('addProjectBtn');
    if (plusBtn) {
        plusBtn.onclick = function(e) {
            e.preventDefault();
            // 這裡可以不改，或者由 HTML 垂直文字按鈕的 onclick 直接觸發
        };
    }

    // ── 這裡就是原本就有的個人資料綁定 ──
    safeBind('userBtn', 'click', openProfile);
    safeBind('profileOverlay', 'click', closeProfile);
    safeBind('profileCloseBtn', 'click', closeProfile);
    safeBind('profileSaveBtn', 'click', saveProfile);

    // 💡 【新增綁定】：點擊修改密碼按鈕時打開密碼彈窗
    safeBind('changePwdBtn', 'click', () => {
        const currentUsername = document.getElementById('profileUsername').value;
        document.getElementById('resetFormUsername').value = currentUsername;
        document.getElementById('resetPwdModal').style.display = 'flex';
    });

    safeBind('logoutBtn', 'click', () => { window.location.href = '/'; });
    safeBind('modalConfirmBtn', 'click', confirmAge);
    safeBind('prevArrow', 'click', () => navigateStep(-1));
    safeBind('nextArrow', 'click', () => navigateStep(1));
    
    safeBind('startBtn', 'click', startPractice);
    safeBind('recordBtn', 'click', toggleRecord);
    safeBind('uploadAudioBtn', 'click', uploadAudio);
    safeBind('newSessionBtn', 'click', newSession);

    // 💡 練習模式切換（分段練習 / 整篇練習）
    safeBind('modeSegmentBtn', 'click', () => setPracticeMode('segment'));
    safeBind('modeWholeBtn', 'click', () => setPracticeMode('whole'));

    // 下拉選單與其他綁定保持你原本的寫法...
    const readingBtn = document.getElementById('readingCountBtn');
    if (readingBtn) {
        readingBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('readingHistoryDropdown');
            if (dropdown) dropdown.classList.toggle('open');
        });
    }

    document.querySelectorAll('.step-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const step = parseInt(dot.dataset.step);
            goToStep(step);
        });
    });

    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) processFile(e.target.files[0]);
        });
    }


}

// ══════════════════════════════════════════════════
//  FIRST-TIME & PROFILE
// ══════════════════════════════════════════════════
function checkFirstTime() {
    const age = localStorage.getItem('userAge');
    const modal = document.getElementById('firstTimeModal');
    // 💡 防禦性修正：加上元素存在檢查，避免這裡出錯連帶讓 DOMContentLoaded
    //    裡「這行之後」的 bindEvents()、initUserHistory() 等初始化整批失效
    if (!age && modal) {
        modal.classList.add('active');
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
    showToast('歡迎！資料已儲存');
}

async function openProfile() {
    // 1. 打開 UI 面板
    document.getElementById('profilePanel').classList.add('open');
    document.getElementById('profileOverlay').classList.add('active');

    try {
        // 2. 向後端要目前 Session 使用者的最新資料
        const res = await fetch('/api/get_user_info');
        const data = await res.json();

        if (data.status === 'success') {
            // 3. 將資料庫的資料填入網頁欄位中
            document.getElementById('profileName').value = data.name || '';
            document.getElementById('profileAge').value = data.age || '';
            document.getElementById('profileUsername').value = data.username || '';
        } else {
            showToast('無法載入使用者資料，請重新登入');
        }
    } catch (err) {
        console.error('載入個人資料失敗:', err);
    }
}

function closeProfile() {
    document.getElementById('profilePanel').classList.remove('open');
    document.getElementById('profileOverlay').classList.remove('active');
}

async function saveProfile() {
    const nameInput = document.getElementById('profileName').value.trim();
    const ageInput = parseInt(document.getElementById('profileAge').value);

    if (!nameInput) { showToast('姓名不能為空喔！'); return; }
    if (!ageInput || ageInput < 1 || ageInput > 120) { showToast('請輸入有效的年齡'); return; }

    try {
        // 將更新後的姓名與年齡傳回後端寫入 users 資料表
        const res = await fetch('/api/update_user_info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: nameInput,
                age: ageInput
            })
        });
        const data = await res.json();

        if (data.status === 'success') {
            showToast('個人資料已成功同步至資料庫 ✓');
            closeProfile();
        } else {
            showToast('儲存失敗，請稍後再試');
        }
    } catch (err) {
        console.error('儲存個人資料失敗:', err);
        showToast('網路錯誤，無法儲存');
    }
}

// ══════════════════════════════════════════════════
//  STEP NAVIGATION  (between Step 1 / 2 / 3)
// ══════════════════════════════════════════════════
function goToStep(step) {
    if (step === state.currentStep) return;
    if (step > 0 && !state.completedSteps.has(step)) return;

    // 若正在錄音，離開前先停止
    if (state.currentStep === 1 && state.isRecording) stopRecording();

    state.currentStep = step;
    updateStepUI();

    if (step === 0) _onEnterStep1();   // 回到選文章：顯示已選文章
    if (step === 1) _onEnterStep2();   // 回到錄音：還原錄音狀態
    if (step === 2) _onEnterStep3();   // 💡 新增：進入分析報告，重新向後端抓資料渲染
}


function navigateStep(dir) {
    const next = state.currentStep + dir;
    if (next < 0 || next > 2) return;
    if (dir > 0 && !state.completedSteps.has(next)) return;

    // 若正在錄音，離開前先停止
    if (state.currentStep === 1 && state.isRecording) stopRecording();

    state.currentStep = next;
    updateStepUI();

    if (next === 0) _onEnterStep1();
    if (next === 1) _onEnterStep2();
    if (next === 2) _onEnterStep3();   // 💡 新增：進入分析報告，重新向後端抓資料渲染
}

// ── 進入 Step 3：重新向後端抓這個專案的分析報告並渲染 ──────
// 💡 這是這次修的核心：之前 goToStep/navigateStep 完全沒有處理「進入 Step 3」要做的事，
//    導致重新整理頁面後，點步驟圓點切到分析頁，畫面只是切換過去，
//    從來沒有真的去後端 /get_project_total_report 抓資料、重新渲染報告，
//    看起來就像是「沒有讀取資料庫顯示對應資料」。
function _onEnterStep3() {
    if (!state.activeProjectId) return;
    _loadAndRenderProjectReport(state.activeProjectId);
}

// ── 進入 Step 1：顯示已選文章預覽 ──────────────────
function _onEnterStep1() {
    if (!state.article) return;
    renderPreview(state.article);
    document.getElementById('startBtn').disabled = false;
}

// ── 進入 Step 2：還原段落錄音視覺狀態 ──────────────
function _onEnterStep2() {
    if (!state.article) return;
    _applyPracticeModeUI();
    // 重繪段落（badges / 鎖定狀態）
    renderLyrics();
    // 還原 pip 小圓點
    _restoreRecordedBadges();
}

// ── 把已錄音的段落重新標記到 ParagraphUI ──────────
function _restoreRecordedBadges() {
    if (!window.ParagraphUI) return;

    // 方式 A：從後端同步的 recordedSet（1-based）
    const proj = state.projects[state.activeProjectId];
    if (proj?.recordedSet) {
        proj.recordedSet.forEach(idx => window.ParagraphUI.markRecorded(idx - 1));
    }

    // 方式 B：從本地 blob 暫存（0-based）
    if (Array.isArray(state.recordings)) {
        state.recordings.forEach((blob, i) => {
            if (blob) window.ParagraphUI.markRecorded(i);
        });
    }
}

function updateStepUI() {

    if (typeof stopChineseFeedback === 'function') stopChineseFeedback();
    const _fbPopup = document.getElementById('category-feedback-popup');
    if (_fbPopup) _fbPopup.style.display = 'none';

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
    if (!article || !article.paragraphs) return;

    // 確保抓到的 DOM 不是 null
    const titleEl = document.getElementById('previewTitle');
    const contentEl = document.getElementById('previewContent');
    const areaEl = document.getElementById('selectedPreview');

    if (titleEl) titleEl.textContent = `${article.title}`;

    if (contentEl) {
        contentEl.innerHTML = article.paragraphs.map((p, i) => `
            <div class="preview-para">
                <span class="para-tag">段落 ${i + 1}</span>
                <p>${p}</p>
            </div>
        `).join('');
    }

    if (areaEl) {
        areaEl.classList.add('visible');
        areaEl.style.display = 'block'; // 確保 CSS 沒有隱藏它
    }
}

// 💡 依目前作用中的專案是否為「複習」，決定文章預覽右上角清除鍵要不要顯示。
//    第一次練習 → 顯示清除鍵（可清除文章、回到只有選擇文章的狀態）
//    複習(retry) → 隱藏清除鍵（不可清除文章）
function _updateClearBtnVisibility() {
    const clearBtn = document.getElementById('clearBtn');
    if (!clearBtn) return;
    const proj = state.projects[state.activeProjectId];
    clearBtn.style.display = (proj && proj.isRetry) ? 'none' : '';
}

function renderPreview(article) {
    if (!article || !article.paragraphs) return;

    const titleEl = document.getElementById('previewTitle');
    const contentEl = document.getElementById('previewContent');
    const areaEl = document.getElementById('selectedPreview');

    if (titleEl) titleEl.textContent = `${article.title}`;

    if (contentEl) {
        contentEl.innerHTML = article.paragraphs.map((p, i) => `
            <div class="preview-para">
                <span class="para-tag">段落 ${i + 1}</span>
                <p>${p}</p>
            </div>
        `).join('');
    }

    if (areaEl) {
        areaEl.classList.add('visible');
        areaEl.style.display = 'block';
    }

    _updateClearBtnVisibility();   // 💡 新增：依複習/首次決定清除鍵顯示
}




function processFile(file) {
    if (!file.name.endsWith('.txt')) {
        showToast('請上傳 .txt 格式的文章');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);

        if (paragraphs.length === 0) {
            showToast('文章內容為空，無法解析');
            return;
        }

        const articleName = file.name.replace('.txt', '');
        const projectId = 'proj_' + Date.now();
        const profile = JSON.parse(localStorage.getItem('userProfile') || '{"username":"guest"}');

        try {
            // 💡 加入這段：記錄並移除舊的「未命名」空殼
            const oldEmptyId = state.activeProjectId;
            if (state.projects[oldEmptyId] &&
                (state.projects[oldEmptyId].title === '未命名文章' || !state.projects[oldEmptyId].article)) {
                delete state.projects[oldEmptyId];
            }

            // 同步到資料庫
            const res = await fetch('/create_project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: profile.username,
                    project_id: projectId,
                    article_name: articleName,
                    article_content: text
                })
            });

            const newArticle = {
                title: articleName,
                paragraphs: paragraphs,
                emoji: '📄',
                content: text // 存一份原文，複習模式好用
            };

            // 更新全域狀態
            state.article = newArticle;
            state.activeProjectId = projectId;
            state.projects[projectId] = {
                id: projectId,
                title: articleName,
                article: newArticle,
                currentStep: 0,
                completedSteps: [0], // 💡 新文章：只完成「選擇文章」，避免繼承上一篇的完成狀態
                practiceMode: 'segment', // 💡 新文章預設為分段練習
                recordings: new Array(paragraphs.length).fill(null),
                currentParagraph: 0,
                date: new Date().toLocaleString('zh-TW', { hour12: false }) // 補上日期，排序才不會亂
            };
            // 💡 立即寫入 localStorage，避免建立後、選擇模式前就重新整理分頁而遺失預設值
            _savePracticeModeForProject(projectId, 'segment');

            // 💡 渲染 UI
            renderPreview(newArticle);

            // 💡 呼叫渲染側邊欄，此時「未命名」已經被 delete 掉了，只會剩下新的專案
            renderProjectSidebar();

            // 跳轉至該專案
            await switchProject(projectId);

            const startBtn = document.getElementById('startBtn');
            if (startBtn) startBtn.disabled = false;

            showToast('文章載入成功！');

        } catch (err) {
            console.error('上傳處理失敗:', err);
            showToast('系統錯誤，請重新整理');
        }
    };
    reader.readAsText(file);
}

// ══════════════════════════════════════════════════
//  練習模式切換：分段練習 / 整篇練習
// ══════════════════════════════════════════════════

/**
 * 💡 關鍵修正：practiceMode（分段/整篇）目前後端完全沒有對應欄位可以存，
 *    只存在瀏覽器記憶體的 state.projects 裡；一旦分頁重新整理、initUserHistory()
 *    重新向後端抓歷史紀錄，這個選擇就會遺失、被迫全部視為預設的「分段練習」。
 *    這裡改用 localStorage（以 project_id 當 key）額外保存一份，
 *    這樣即使重新整理分頁，也能正確還原「這次到底是分段還是整篇」。
 */
const PRACTICE_MODE_STORAGE_KEY = 'practiceModeByProject';

function _savePracticeModeForProject(projectId, mode) {
    if (!projectId) return;
    try {
        const map = JSON.parse(localStorage.getItem(PRACTICE_MODE_STORAGE_KEY) || '{}');
        map[projectId] = mode;
        localStorage.setItem(PRACTICE_MODE_STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
        console.warn('儲存練習模式到 localStorage 失敗:', e);
    }
}

function _loadPracticeModeForProject(projectId) {
    if (!projectId) return null;
    try {
        const map = JSON.parse(localStorage.getItem(PRACTICE_MODE_STORAGE_KEY) || '{}');
        return map[projectId] || null;
    } catch (e) {
        return null;
    }
}

function setPracticeMode(mode) {
    state.practiceMode = mode;

    const segBtn = document.getElementById('modeSegmentBtn');
    const wholeBtn = document.getElementById('modeWholeBtn');
    if (segBtn) segBtn.classList.toggle('active', mode === 'segment');
    if (wholeBtn) wholeBtn.classList.toggle('active', mode === 'whole');

    // 💡 關鍵修正：同步寫回目前作用中的專案，
    //    這樣「切換練習次數」時才能正確還原該次選擇的分段/整篇練習模式
    if (state.activeProjectId && state.projects[state.activeProjectId]) {
        state.projects[state.activeProjectId].practiceMode = mode;
        // 💡 同時寫入 localStorage，避免分頁重新整理後遺失這個選擇
        _savePracticeModeForProject(state.activeProjectId, mode);
    }
}

/** 依目前 state.practiceMode，切換 Step2 錄音區塊的顯示樣式（是否顯示左側段落選欄） */
function _applyPracticeModeUI() {
    const section = document.getElementById('recordSection');
    if (!section) return;
    section.classList.toggle('whole-mode', state.practiceMode === 'whole');
}

async function startPractice() {
    if (!state.article) {
        showToast('請先上傳 .txt 檔案');
        return;
    }

    // ★ 這一行必須在最前面，updateStepUI 的箭頭/圓點判斷依賴它
    state.completedSteps.add(1);
    state.currentStep = 1;
    updateStepUI();
    _applyPracticeModeUI();

    if (window.ParagraphUI) {
        // setTotal 現在只有在真的換了不同次數/文章時才會清空 _recorded，這裡仍保留 restore 以防萬一
        window.ParagraphUI.setTotal(state.article.paragraphs.length, state.activeProjectId);
        window.ParagraphUI.setCurrentIdx(state.currentParagraph || 0);
        _restoreRecordedBadges();
    }


    await goToParagraph(state.currentParagraph || 0);
}

async function fetchInitialRecordings() {
    const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const username = profile.username || "guest";
    const articleName = state.article.title;

    try {
        // 向後端請求該文章所有已上傳的段落索引
        // 假設後端有一個路由回傳: { recorded_indices: [1, 2, 5] }
        const res = await fetch(`/get_recorded_indices?username=${username}&article_name=${articleName}`);
        const data = await res.json();

        if (data.recorded_indices && window.ParagraphUI) {
            data.recorded_indices.forEach(idx => {
                // 標記小圓點為「已錄音」狀態 (index 從 0 開始)
                ParagraphUI.markRecorded(idx - 1);
            });
        }
    } catch (e) {
        console.warn("無法取得初始錄音紀錄", e);
    }
}

document.getElementById('uploadArea').addEventListener('click', function(e) {
    // 避免點到 label 時觸發兩次
    if (e.target.closest('label')) return;
    document.getElementById('fileInput').click();
});
// ══════════════════════════════════════════════════
//  STEP 2 — RECORDING CORE (💡 軌道級精準煞車拼接版)
// ══════════════════════════════════════════════════

let currentStream = null;
// 💡 用來儲存每一段「真正講話期間」產生的 Blob 碎片
let recordedSegments = [];

/**
 * 將段落文字依句號、問號、驚嘆號（含全形）拆成句子陣列。
 */
function splitIntoSentences(text) {

    const parts = text.match(/[^.?!。？！]+[.?!。？！]*(?:["'」』]*)/g) || [text];
    return parts.map(s => s.trim()).filter(Boolean);
}

/** Render all paragraph cards in #lyricsView and update the progress label (不含錄音鎖定邏輯，可安全被整篇練習換頁呼叫) */
function renderLyricsCore() {
    if (!state.article || !state.article.paragraphs) {
        console.warn('[renderLyrics] 警告：尚未載入文章資料，取消渲染');
        return;
    }

    const view     = document.getElementById('lyricsView');
    const progress = document.getElementById('paragraphProgress');
    const paras    = state.article.paragraphs || [];
    const cur      = state.currentParagraph || 0;
    const isWhole  = state.practiceMode === 'whole';

    if (progress) {
        progress.textContent = `段落 ${cur + 1} / ${paras.length}`;
    }

    if (!view) return;

    view.innerHTML = paras.map((text, i) => {
        let cls = 'lyric-para ';
        if      (i < cur)   cls += 'lyric-past';
        else if (i === cur) cls += 'lyric-current';
        else                cls += 'lyric-future';

        const sentences = splitIntoSentences(text);

        // 💡 核心修改：幫每個句子的 span 加上 onclick 事件，並傳入轉義後的字串
        const sentenceHtml = sentences
            .map(s => `${s}`)
            .map(s => {
                // 將句子中的單雙引號轉義，避免 HTML 屬性解析出錯
                const safeSentence = s.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                return `<span class="lyric-sentence" style="cursor: pointer;" onclick="speakSentence('${safeSentence}')" title="點擊朗讀此句">${s}</span>`;
            })
            .join('');

        // 💡 整篇練習模式：每段右下角提供「下一段」箭頭，非第一段則左下角提供「上一段」箭頭
        //    （純粹切換顯示，不影響錄音進行中的狀態）
        let navHtml = '';
        if (isWhole) {
            const hasPrev = i > 0;
            const hasNext = i < paras.length - 1;
            navHtml += '<div class="lyric-nav-arrows">';
            if (hasPrev) {
                navHtml += `<button type="button" class="lyric-nav-arrow lyric-nav-prev" title="上一段" onclick="event.stopPropagation(); switchWholeParagraphView(${i - 1});">&#8592;</button>`;
            } else {
                navHtml += `<span class="lyric-nav-arrow lyric-nav-placeholder"></span>`;
            }
            if (hasNext) {
                navHtml += `<button type="button" class="lyric-nav-arrow lyric-nav-next" title="下一段" onclick="event.stopPropagation(); switchWholeParagraphView(${i + 1});">&#8594;</button>`;
            } else {
                navHtml += `<span class="lyric-nav-arrow lyric-nav-placeholder"></span>`;
            }
            navHtml += '</div>';
        }

        return `<div class="${cls}" data-para-idx="${i}">${sentenceHtml}${navHtml}</div>`;
    }).join('');

    if (window.ParagraphUI) {
        ParagraphUI.setTotal(paras.length, state.activeProjectId);
        ParagraphUI.setCurrentIdx(cur);
    }

    const curEl = view.querySelector('.lyric-current');
    if (curEl) {
        // 💡 只捲動字幕容器本身（不要用 scrollIntoView，它會連外層頁面一起捲、把上緣頂掉）。
        //    一律「對齊目前段落頂端」：目前段落的第一句永遠貼在字幕區上方、不會被推出畫面，
        //    其餘內容往下自由捲動閱讀。（未錄音頁在整篇模式尤其重要：不會把上面的段落吸走害你看不到開頭）
        const TOP_GAP  = 16;   // 段落上緣與字幕區頂端保留的一點緩衝
        const isFirst  = curEl.dataset.paraIdx === '0' || !curEl.previousElementSibling;
        let targetTop  = isFirst ? 0 : (curEl.offsetTop - TOP_GAP);

        const maxTop = Math.max(0, view.scrollHeight - view.clientHeight);
        targetTop = Math.max(0, Math.min(targetTop, maxTop));
        view.scrollTo({ top: targetTop, behavior: 'smooth' });
    }

    if (window._isMasked) {
        const targetIdx = (typeof state.currentParagraph === 'number') ? state.currentParagraph : 0;
        _updateMaskSlots(targetIdx);
    }
}

/** Render all paragraph cards in #lyricsView + 更新錄音按鈕鎖定狀態（僅分段練習模式需要） */
function renderLyrics() {
    renderLyricsCore();
    if (!state.article || !state.article.paragraphs) return;

    // 💡 整篇練習模式只有「一整段」錄音，不依段落鎖定錄音按鈕
    if (state.practiceMode === 'whole') return;

    const recordBtn = document.getElementById('recordBtn');
    const currentProj = state.projects[state.activeProjectId];
    const isRecorded = currentProj?.recordedSet?.has(state.currentParagraph + 1);

    if (isRecorded) {
        if (recordBtn) {
            recordBtn.classList.add('locked');
            recordBtn.innerHTML = '<span>🔒 已完成錄音</span>';
            recordBtn.style.pointerEvents = 'none';
            recordBtn.style.opacity = '0.6';
        }
    } else {
        if (recordBtn) {
            recordBtn.classList.remove('locked');
            recordBtn.innerHTML = '<span class="record-dot-anim"></span><span id="recordBtnText">開始錄音</span>';
            recordBtn.style.pointerEvents = 'auto';
            recordBtn.style.opacity = '1';
        }
    }
}

/**
 * 💡 整篇練習模式專用：僅切換段落文字/圖片提示的顯示，完全不影響錄音狀態
 * （不呼叫 resetRecordUI，不查詢/載入該段落的既有音檔，錄音中可直接切換不中斷）
 */
function switchWholeParagraphView(idx) {
    if (!state.article || !state.article.paragraphs) return;
    if (idx < 0 || idx >= state.article.paragraphs.length) return;
    state.currentParagraph = idx;
    renderLyricsCore();
}

/** Reset all recording UI back to the idle state */
function resetRecordUI() {
    clearInterval(state.timerInterval);
    state.timerSeconds  = 0;
    state.isRecording   = false;
    state.recordingBlob = null;
    state.audioChunks   = [];
    state.recordState   = 'idle';
    recordedSegments    = []; // 清空碎片庫

    const timerEl = document.getElementById('recordTimer');
    if (timerEl) { timerEl.textContent = '00:00'; timerEl.classList.remove('running'); }

    const btn = document.getElementById('recordBtn');
    if (btn) {
        btn.classList.remove('recording', 'paused');
        btn.innerHTML = '<span class="record-dot-anim"></span><span id="recordBtnText">開始錄音</span>';
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
        btn.style.display = 'flex';
    }

    const playbackRow = document.getElementById('playbackRow');
    if (playbackRow) playbackRow.classList.remove('visible');
    const uploadBtn = document.getElementById('uploadAudioBtn');
    if (uploadBtn) uploadBtn.classList.remove('visible');

    const clearBtn = document.getElementById('clearRecordBtn');
    if (clearBtn) clearBtn.style.display = 'none';

    const audio = document.getElementById('playbackAudio');
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    const scoreText = document.getElementById('werScoreText');

    if (scoreText) scoreText.textContent = '0.0%';
}

/** 💡 核心三段分流控制 - 精準判定自訂狀態 */
function toggleRecord() {
    console.log("按鈕點擊，當前錄音狀態機:", state.recordState);
    if (state.recordState === 'idle') {
        startRecordingSegment();
    } else if (state.recordState === 'recording') {
        pauseRecordingSegment();
    } else if (state.recordState === 'paused') {
        startRecordingSegment(); // 暫停後再按，就是繼續錄製下一段碎片
    }
}

// ── 1. 開始錄製（全新錄音 或 繼續錄製下一句） ──
async function startRecordingSegment() {
    try {
        currentStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });

        state.audioChunks = [];
        const options = { mimeType: 'audio/webm;codecs=opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) delete options.mimeType;

        state.mediaRecorder = new MediaRecorder(currentStream, options);

        state.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) state.audioChunks.push(e.data);
        };

        // 💡 煞車按鈕按下去（實質 stop）時觸發
        state.mediaRecorder.onstop = async () => {
            // 徹底切斷麥克風軌道！4-7秒期間硬體完全不收音，背景音雜音絕對塞不進來
            currentStream.getTracks().forEach(t => t.stop());

            const segmentBlob = new Blob(state.audioChunks, { type: state.mediaRecorder.mimeType });
            recordedSegments.push(segmentBlob); // 存入碎片庫

            // 拼接所有講話的碎片，立即畫出並展現波形
            await refreshCombinedWaveform();
        };

        // 如果是第一次錄音，初始化碎片庫與計時
        if (state.recordState === 'idle') {
            recordedSegments = [];
            state.timerSeconds = 0;
        }

        state.mediaRecorder.start();
        state.recordState = 'recording';
        state.isRecording = true;

        // 啟動計時器
        clearInterval(state.timerInterval);
        startRecordTimer();
        updateRecordBtnUI();

        // 隱藏確認按鈕
        const uploadAudioBtn = document.getElementById('uploadAudioBtn');
        if (uploadAudioBtn) uploadAudioBtn.classList.remove('visible');

    } catch (err) {
        showToast('無法存取麥克風，請確認權限');
        console.error(err);
    }
}

// ── 2. 按下暫停（精準煞車，徹底關閉硬體收音） ──
function pauseRecordingSegment() {
    if (!state.mediaRecorder || state.recordState !== 'recording') return;

    // 1. 立即停止計時定時器（秒數絕對鎖死在 4 秒，不准往前）
    clearInterval(state.timerInterval);
    const timerEl = document.getElementById('recordTimer');
    if (timerEl) timerEl.classList.remove('running');

    // 2. 實質切斷麥克風包裹，進入安全暫停狀態
    state.recordState = 'paused';
    state.isRecording = false;
    state.mediaRecorder.stop(); // 👈 觸發上面的 onstop

    updateRecordBtnUI();
    showToast('已精準暫停！秒數已鎖定，可試聽下方波形 🎤');
}

// ── 3. 將多段碎片無縫拼接並渲染 WaveSurfer ──
async function refreshCombinedWaveform() {
    if (recordedSegments.length === 0) return;

    // 將所有暫存的有效說話碎片拼成一個完整的大音檔
    const combinedBlob = new Blob(recordedSegments, { type: recordedSegments[0].type });
    state.recordingBlob = combinedBlob; // 供最終上傳使用

    const url = URL.createObjectURL(combinedBlob);

    initWaveform();
    if (wavesurfer) wavesurfer.load(url);

    const audioEl = document.getElementById('playbackAudio');
    if (audioEl) audioEl.src = url;

    // 展開播放列與上傳確認按鈕
    const playbackRow = document.getElementById('playbackRow');
    const uploadAudioBtn = document.getElementById('uploadAudioBtn');
    if (playbackRow) playbackRow.classList.add('visible');
    if (uploadAudioBtn) uploadAudioBtn.classList.add('visible');
}

// ── 4. 停止錄音輔助 ──
function stopRecording() {
    clearInterval(state.timerInterval);
    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
        state.mediaRecorder.stop();
    }
    state.recordState = 'idle';
    state.isRecording = false;
}

// ── 5. 全部重錄後悔藥 ──
function clearCurrentProgress() {
    stopRecording();
    recordedSegments = [];
    resetRecordUI();
    updateRecordBtnUI();
    showToast('已清空當前錄音 🔄');
}

function startRecordTimer() {
    const timerEl = document.getElementById('recordTimer');
    if (!timerEl) return;

    timerEl.classList.add('running');
    clearInterval(state.timerInterval);

    state.timerInterval = setInterval(() => {
        state.timerSeconds++;
        const m = String(Math.floor(state.timerSeconds / 60)).padStart(2, '0');
        const s = String(state.timerSeconds % 60).padStart(2, '0');
        timerEl.textContent = `${m}:${s}`;
    }, 1000);
}

function updateRecordBtnUI() {
    const btn = document.getElementById('recordBtn');
    const text = document.getElementById('recordBtnText');
    const clearBtn = document.getElementById('clearRecordBtn');

    if (state.recordState === 'idle') {
        if(btn) btn.className = 'record-btn';
        if(text) text.textContent = '開始錄音';
        if(clearBtn) clearBtn.style.display = 'none';
    }
    else if (state.recordState === 'recording') {
        if(btn) btn.className = 'record-btn recording';
        if(text) text.textContent = '⏸ 暫停 (念完一句點此)';
        if(clearBtn) clearBtn.style.display = 'inline-block';
    }
    else if (state.recordState === 'paused') {
        if(btn) btn.className = 'record-btn paused';
        if(text) text.textContent = '▶ 繼續錄音 (往下念)';
        if(clearBtn) clearBtn.style.display = 'inline-block';
    }
}

/** 按下確認上傳鍵：如果還在錄音，幫他自動封裝收尾並傳送 */
// ══════════════════════════════════════════════════
//  ⏳ 上傳分析進度提示（真實輪詢後端目前的處理階段，不是寫死的假動畫）
// ══════════════════════════════════════════════════
/**
 * 💡 upload_audio() 這支 API 要跑很久（語音辨識→節奏分析→好幾個 AI 評分/建議生成），
 *    這裡用一個轉圈圈 + 文字的提示框，文字內容是**每隔約 1 秒去問後端**
 *    「這個上傳工作(progress_id)目前真正跑到哪個階段」得到的真實回應，
 *    不是前端自己猜的固定動畫。
 */
function showUploadProgress(progressId) {
    let overlay = document.getElementById('uploadProgressOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'uploadProgressOverlay';
        overlay.style.cssText = 'margin-top:12px; padding:14px 18px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; display:flex; align-items:center; gap:10px;';
        overlay.innerHTML = `
            <div style="width:18px; height:18px; border:3px solid #bfdbfe; border-top-color:#2563eb; border-radius:50%; animation: uploadSpin 0.8s linear infinite; flex-shrink:0;"></div>
            <span id="uploadProgressText" style="font-size:0.85rem; color:#1e40af; font-weight:bold;">正在上傳錄音...</span>
        `;
        if (!document.getElementById('uploadProgressStyle')) {
            const styleTag = document.createElement('style');
            styleTag.id = 'uploadProgressStyle';
            styleTag.textContent = `@keyframes uploadSpin { to { transform: rotate(360deg); } }`;
            document.head.appendChild(styleTag);
        }
        const uploadBtnEl = document.getElementById('uploadAudioBtn');
        if (uploadBtnEl && uploadBtnEl.parentNode) {
            uploadBtnEl.parentNode.insertBefore(overlay, uploadBtnEl.nextSibling);
        } else {
            document.body.appendChild(overlay);
        }
    }
    overlay.style.display = 'flex';

    // 💡 每隔約 1 秒問後端一次「這個 progress_id 現在真正跑到哪」，拿到什麼就顯示什麼
    clearInterval(window._uploadProgressTimer);
    window._uploadProgressTimer = setInterval(async () => {
        try {
            const resp = await fetch(`/upload_progress/${progressId}?t=${Date.now()}`, { cache: 'no-store' });
            const data = await resp.json();
            if (data.status === 'success' && data.stage) {
                const textEl = document.getElementById('uploadProgressText');
                if (textEl) textEl.textContent = data.stage;
            }
        } catch (e) {
            // 輪詢失敗就靜默略過，不要因為這個把整個上傳流程打斷
        }
    }, 1000);
}

function hideUploadProgress() {
    clearInterval(window._uploadProgressTimer);
    const overlay = document.getElementById('uploadProgressOverlay');
    if (overlay) overlay.style.display = 'none';
}

async function uploadAudio() {
    // 🔧 核心修正：按鈕禁用要在「最開頭」就做，不能等到錄音停止的非同步流程跑完才做！
    //    原本的寫法是：先等錄音停止(await) → 才禁用按鈕 → 才上傳。
    //    這段等待期間按鈕還是可以點的，如果使用者連點兩下（或手機誤觸），
    //    會觸發兩個各自獨立執行的 uploadAudio()，同一段音檔被送出兩次，
    //    後端 Ollama 也會被呼叫兩次，資料庫最後只會留下「後面那次」覆蓋掉的結果——
    //    這就是為什麼你會在 log 裡看到同一次上傳卻打了兩次 Ollama。
    const btn = document.getElementById('uploadAudioBtn');
    if (btn && btn.disabled) {
        // 💡 防止重複進入：按鈕已經是禁用狀態，代表已經有一個上傳正在跑，直接忽略這次呼叫
        console.warn('⚠️ 已經有一個上傳正在進行中，忽略這次重複觸發');
        return;
    }
    if (btn) { btn.disabled = true; btn.textContent = '上傳中…'; }

    if (state.recordState === 'recording' && state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
        const finalizePromise = new Promise(resolve => {
            state.mediaRecorder.onstop = async () => {
                const segmentBlob = new Blob(state.audioChunks, { type: state.mediaRecorder.mimeType });
                recordedSegments.push(segmentBlob);
                await refreshCombinedWaveform();
                resolve();
            };
        });
        state.mediaRecorder.stop();
        state.recordState = 'idle';
        await finalizePromise;
    }

    if (!state.recordingBlob) {
        showToast('請先錄音再上傳');
        if (btn) { btn.disabled = false; btn.textContent = '✓ 上傳並繼續'; }
        return;
    }

    try {
        const wavBlob = await convertToWav16k(state.recordingBlob);
        const projectId = state.activeProjectId;
        if (!projectId) {
            showToast('錯誤：找不到當前專案 ID');
            if (btn) { btn.disabled = false; btn.textContent = '✓ 上傳並繼續'; }
            return;
        }

        const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        let username = profile.username || document.getElementById('profileUsername')?.value || "guest";
        const articleName = state.article ? state.article.title : "unknown";
        const mode = _loadPracticeModeForProject(projectId) || 'segment';
        const currentPara = (mode === 'whole') ? 0 : (state.currentParagraph + 1);

        // --- 📥 動作 A：維持你原本的送出存檔 (只傳給你的 5000 後端，8000 port 交給後端打電話就行！) ---
        const progressId = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; // 💡 這次上傳的一次性識別碼，供輪詢真實進度用

        const formDataMyBackend = new FormData();
        formDataMyBackend.append("audio_data", wavBlob);
        formDataMyBackend.append("project_id", projectId);
        formDataMyBackend.append("username", username);
        formDataMyBackend.append("article_name", articleName);
        formDataMyBackend.append("paragraph_index", currentPara);
        formDataMyBackend.append("mode", mode);
        formDataMyBackend.append("progress_id", progressId);
        console.log(`正在上傳... 模式: ${mode}, 段落索引: ${currentPara}`);

        showUploadProgress(progressId);

        console.log("正在送出音檔至 Flask 後端處理...");
        const response = await fetch('/upload_audio', { method: 'POST', body: formDataMyBackend });
        const result = await response.json();

        // --- 🏁 核心主流程收尾與報表渲染 (在 main.js 內 uploadAudio 成功接收處) ---
        if (response.ok && result.status === 'success') {
            state.recordings[state.currentParagraph] = state.recordingBlob;

            if (window.ParagraphUI) ParagraphUI.markRecorded(state.currentParagraph);

            if (result.wer_result && result.wer_result.statistics) {
                // 補丁安全防禦：如果後端 statistics 裡沒有 npvi/varco/Ollama評分，把外層實體算好的分數注入進去
                if (result.wer_result.npvi !== undefined) {
                    result.wer_result.statistics.npvi = result.wer_result.npvi;
                }
                if (result.wer_result.varco !== undefined) {
                    result.wer_result.statistics.varco = result.wer_result.varco;
                }
                // 💡 新增：四個 Ollama 評分維度（完整度/準確度/流利度/語法），供雷達圖使用
                result.wer_result.statistics.score_completeness = result.wer_result.score_completeness ?? 0;
                result.wer_result.statistics.score_accuracy = result.wer_result.score_accuracy ?? 0;
                result.wer_result.statistics.score_fluency = result.wer_result.score_fluency ?? 0;
                result.wer_result.statistics.score_grammar = result.wer_result.score_grammar ?? 0;
                result.wer_result.statistics.overall_fluency_score_100 = result.wer_result.overall_fluency_score_100 ?? 0;
                result.wer_result.statistics.fluency_feedback_text = result.wer_result.fluency_feedback_text || '';
                result.wer_result.statistics.wer_feedback_text = result.wer_result.wer_feedback_text || '';

                // 呼叫單段即時更新器
                renderWerReportToPanel3(
                    result.wer_result.alignment_report,
                    result.wer_result.statistics,
                    currentPara,
                    result.url
                );
                showToast(`段落 ${currentPara} 儲存與雙 AI 分析成功！🎉`);
            } else {
                showToast(`段落 ${currentPara} 儲存成功 (分析未完成)`);
            }

            const isLast = (state.practiceMode === 'whole')
                ? true
                : state.currentParagraph >= (state.article.paragraphs.length - 1);
            if (isLast) {
                showToast('全部錄音完成！快來看看 AI 流暢度分析報告吧 🎉');

                if (state.practiceMode === 'whole' && result.wer_result && result.wer_result.statistics) {
                    // 💡 整篇模式：不要再呼叫 settleAndShowReport() 去後端 /get_project_total_report 抓「平均」，
                    //    那支 API 目前無法正確辨識整篇錄音這一筆資料，算出來的平均永遠是 0。
                    //    這裡直接拿這次上傳完成、後端即時回傳的分析結果寫進總成績卡，不經過任何平均計算。
                    state.completedSteps.add(2);
                    state.currentStep = 2;
                    updateStepUI();
                    renderWholeReportDirectly(
                        result.wer_result,
                        result.url
                    );
                } else if (typeof settleAndShowReport === 'function') {
                    await settleAndShowReport();
                } else {
                    state.completedSteps.add(2);
                    state.currentStep = 2;
                    updateStepUI();
                }
            } else {
                await goToParagraph(state.currentParagraph + 1);
            }
        } else {
            throw new Error(result.message || "伺服器拒絕請求");
        }
    } catch (error) {
        console.error("上傳失敗細節:", error);
        showToast("上傳失敗: " + error.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '✓ 上傳並繼續'; }
        hideUploadProgress();
    }
}

function restoreRecordedBadges() {
    if (!window.ParagraphUI) return;
    const currentProj = state.projects[state.activeProjectId];
    if (currentProj?.recordedSet) {
        currentProj.recordedSet.forEach(idx => {
            window.ParagraphUI.markRecorded(idx - 1);
        });
    }
    if (Array.isArray(state.recordings)) {
        state.recordings.forEach((blob, i) => {
            if (blob) window.ParagraphUI.markRecorded(i);
        });
    }
}

function _refreshStep2() {
    if (!state.article) return;
    renderLyrics();
    restoreRecordedBadges();
}



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
    setPracticeMode('segment');
    resetRecordUI();
    _resetScorePanel();
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
/**
 * 💡 把 WER(詞錯率) 換算成正面呈現的「詞正確率」文字，公式：100% - WER% 。
 *    如果 WER 超過 100%（極端情況，例如插入字太多導致錯誤數比總字數還多），
 *    正確率一律顯示 0%，不會出現負數。
 * @param {number} werRatio - WER 比例值 (0~1 之間，例如 0.42 代表 42%)
 * @returns {string} 例如 "58.0%"
 */
function werToAccuracyPercentText(werRatio) {
    if (werRatio == null || isNaN(werRatio)) return '0.0%';
    const accuracy = 100 - (werRatio * 100);
    return Math.max(accuracy, 0).toFixed(1) + '%';
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}
/**
 * 核心功能：跳轉段落與回波載入
 */
async function goToParagraph(idx) {
    if (!state.article) return;
    state.currentParagraph = idx;
    renderLyrics();
    resetRecordUI();

    const playbackRow = document.getElementById('playbackRow');
    const audioEl = document.getElementById('playbackAudio');
    const recordBtn = document.getElementById('recordBtn');
    const uploadBtn = document.getElementById('uploadAudioBtn');

    const projectId = state.activeProjectId;
    const currentProj = state.projects[projectId];
    const isWholeMode = state.practiceMode === 'whole';
    const dbParaIdx = isWholeMode ? 0 : (idx + 1);

    // 檢查這個專案有沒有這個編號的錄音
    if (currentProj && currentProj.recordedSet && currentProj.recordedSet.has(dbParaIdx)) {
        try {
            const res = await fetch(`/check_audio?project_id=${projectId}&paragraph_index=${dbParaIdx}`);
            const data = await res.json();

            if (data.exists) {
                const audioUrl = data.url + "?t=" + Date.now();
                audioEl.src = audioUrl;

                // 💡 關鍵：同步載入到 WaveSurfer
                initWaveform();
                wavesurfer.load(audioUrl);

                playbackRow.classList.add('visible');
                if (recordBtn) recordBtn.style.display = 'none';
                uploadBtn.classList.remove('visible');
            }
        } catch (e) { console.error("回傳音檔失敗", e); }
    } else {
        if (recordBtn) recordBtn.style.display = 'flex';
    }
}

async function uploadAndContinue() {
    const blob = await getRecorderBlob(); // 獲取錄音的 Blob 檔案
    const formData = new FormData();

    // 從頁面元素或變數中提取資訊
    formData.append("audio_data", blob);
    formData.append("username", document.getElementById('profileUsername').value || "guest");
    formData.append("age", document.getElementById('modalAge').value || "0");
    formData.append("article_name", currentArticleId); // 比如 'shark'
    formData.append("reading_count", document.getElementById('readingCountNum').innerText);
    formData.append("paragraph_index", currentParaIndex);

    try {
        const response = await fetch('/upload_audio', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (result.status === 'success') {
            // 設定回放元件的來源
            const playbackAudio = document.getElementById('playbackAudio');
            playbackAudio.src = result.url;
            showToast("錄音已儲存並可回放！");
        }
    } catch (error) {
        console.error("上傳失敗:", error);
    }
}
// 💡 切換選單顯示/隱藏
// 💡 防禦性修正：加上元素存在檢查。原本這裡沒判斷 null 就直接 .onclick=，
//    若頁面上真的沒有 id="addProjectBtn" 這個元素（目前這份 main.html 就沒有），
//    會直接丟出例外，導致這行「之後」的所有頂層程式碼（不含函式宣告本身）完全不會執行。
(function () {
    const btn = document.getElementById('addProjectBtn');
    if (!btn) return;
    btn.onclick = (e) => {
        e.stopPropagation();
        const menu = document.getElementById('plusMenu');
        // 檢查是否有當前文章，決定「複習」按鈕是否可用
        const retryBtn = document.getElementById('retryCurrentBtn');
        if (retryBtn) retryBtn.style.display = state.article ? 'block' : 'none';
        if (menu) menu.classList.toggle('show');
    };
})();

// 點擊外面關閉選單
window.onclick = () => {
    const menu = document.getElementById('plusMenu');
    if (menu) menu.classList.remove('show');
};

async function createNewProject(type) {
    const projectId = 'proj_' + Date.now();
    let newTitle = '未命名文章';
    let newArticle = null;

    if (type === 'retry') {
        // 檢查是否有文章可以複習
        if (!state.article || !state.article.title) {
            showToast('請先選擇一個現有的專案');
            return;
        }
        // 抓取當前專案的文章內容
        newTitle = state.article.title;
        newArticle = JSON.parse(JSON.stringify(state.article));

        const profile = JSON.parse(localStorage.getItem('userProfile') || '{"username":"guest"}');
        await fetch('/create_project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: profile.username,
                project_id: projectId,
                article_name: newTitle,
                article_content: newArticle.content || newArticle.paragraphs.join('\n\n')
            })
        });
    }
    else {
        // 💡 新增模式：一律開全新的一張。
        //    把先前殘留、還沒選文章的空殼專案（article 為空）直接清掉，
        //    不要再切換過去，避免「按新增卻跳回舊的未命名/複習專案」。
        Object.values(state.projects)
            .filter(p => !p.article)
            .forEach(p => {
                delete state.projects[p.id];
                // 順手把該空殼在 localStorage 裡的練習模式紀錄也移除，保持乾淨
                try {
                    const map = JSON.parse(localStorage.getItem(PRACTICE_MODE_STORAGE_KEY) || '{}');
                    delete map[p.id];
                    localStorage.setItem(PRACTICE_MODE_STORAGE_KEY, JSON.stringify(map));
                } catch (e) { /* 忽略 */ }
            });
    }

    // 建立新專案資料結構
    const initialPracticeMode = (type === 'retry') ? state.practiceMode : 'segment';
    state.projects[projectId] = {
        id: projectId,
        title: newTitle,
        article: newArticle,
        currentStep: 0,
        completedSteps: [0], // 💡 新專案：只完成「選擇文章」，避免繼承上一篇的完成狀態
        // 💡 重錄同一篇文章時延續原本的練習模式；全新專案則預設分段練習
        practiceMode: initialPracticeMode,
        recordings: [],
        isRetry: (type === 'retry'),
        date: new Date().toLocaleString('zh-TW', { hour12: false })
    };
    // 💡 立即寫入 localStorage，避免建立後、選擇模式前就重新整理分頁而遺失這個設定
    _savePracticeModeForProject(projectId, initialPracticeMode);

    // 執行專案切換
    await switchProject(projectId);
    renderProjectSidebar();
}

// 💡 確保 switchProject 最後會更新按鈕顯示狀態
function updateActionButtons() {
    const retryBtn = document.getElementById('retryActionBtn');
    if (retryBtn) {
        // 只有在當前專案有文章時才顯示複習按鈕
        retryBtn.style.display = (state.article && state.article.title) ? 'flex' : 'none';
    }
}

// 切換專案邏輯
async function switchProject(projectId) {
    const nextP = state.projects[projectId];
    if (!nextP) {
        console.error("找不到專案資料:", projectId);
        return;
    }

    // A. 儲存舊專案狀態 (❗ 這裡要確保 recordings 有存進去)
    if (state.activeProjectId && state.projects[state.activeProjectId]) {
        const curP = state.projects[state.activeProjectId];
        curP.currentParagraph = state.currentParagraph;
        curP.currentStep = state.currentStep;
        // 💡 新增：將當前的錄音陣列同步回專案物件中
        curP.recordings = [...state.recordings];
        // 💡 關鍵修正：completedSteps 是每個專案各自的進度，切走前先存回舊專案，
        //    避免下一個專案誤繼承「評分結果已完成」的綠勾勾與舊報告
        curP.completedSteps = Array.from(state.completedSteps);
        // 💡 關鍵修正：練習模式（分段/整篇）也是每個專案各自的設定，切走前先存回舊專案
        curP.practiceMode = state.practiceMode;
        // 💡 保險起見同步寫入 localStorage（正常情況下 setPracticeMode 已經寫過一次了）
        _savePracticeModeForProject(state.activeProjectId, state.practiceMode);
    }

    // B. 切換資料核心
    state.activeProjectId = projectId;
    state.article = nextP.article;
    state.currentParagraph = nextP.currentParagraph || 0;
    state.currentStep = nextP.currentStep || 0;
    // 💡 還原「這個專案」自己的完成度，而不是沿用上一個專案的全域狀態
    state.completedSteps = new Set(nextP.completedSteps || [0]);
    // 💡 關鍵修正：還原「這個專案」自己的練習模式（分段/整篇），而不是沿用目前畫面上的模式
    setPracticeMode(nextP.practiceMode || 'segment');
    _applyPracticeModeUI();
    // 💡 關鍵：載入目標專案的錄音，這樣右上角才抓得到資料
    state.recordings = nextP.recordings || [];

    // 💡 若這個專案尚未完成評分（沒有 completedSteps 包含 2），
    //    清空 Step3 評分結果面板，避免殘留上一篇文章的舊分析結果
    if (!state.completedSteps.has(2)) {
        _resetScorePanel();
    }

    // C. 強制重置錄音 UI
    if (typeof resetRecordUI === 'function') resetRecordUI();

    const strip = document.getElementById('paraOverviewStrip');
    if (strip) strip.innerHTML = '';

    const startBtn = document.getElementById('startBtn');
    const previewArea = document.getElementById('selectedPreview');

    // D. 邏輯判斷：檢查是否有文章內容
    if (state.article && (state.article.paragraphs || state.article.content)) {
        if (!state.article.paragraphs && state.article.content) {
            state.article.paragraphs = state.article.content.split(/\n\s*\n/).map(s => s.trim());
        }

        if (state.currentStep === 0) {
            const proj = state.projects[projectId];
            const prefix = (proj && proj.isRetry) ? '🔄 複習：' : '📄 ';
            document.getElementById('chatTitle').textContent = `${prefix}${state.article.title}`;
            if (previewArea) {
                previewArea.style.display = 'block';
                previewArea.classList.add('visible');
                renderPreview(state.article);
            }
            if (startBtn) startBtn.disabled = false;
            const lyricsView = document.getElementById('lyricsView');
            if (lyricsView) lyricsView.innerHTML = '';
        }
        else if (state.currentStep === 2) {
            // 💡 關鍵修正：評分結果頁要重新向後端抓「這個專案」自己的報告資料，
            //    不能只切換畫面卻沿用上一個專案殘留在 DOM 裡的舊報告
            document.getElementById('chatTitle').textContent = `📄 ${state.article.title}`;
            await _loadAndRenderProjectReport(projectId);
        }
        else {
            document.getElementById('chatTitle').textContent = `📄 ${state.article.title}`;
            renderLyrics();
            await goToParagraph(state.currentParagraph);
            // 💡 順手補上：直接切到這個錄音中的次數時，立即正確還原已錄音的綠色標記
            _restoreRecordedBadges();
        }
    }
    else {
        document.getElementById('chatTitle').textContent = '選擇文章開始練習';
        state.currentStep = 0;
        if (previewArea) {
            previewArea.style.display = 'none';
            previewArea.classList.remove('visible');
        }
        if (startBtn) startBtn.disabled = true;
        const lyricsView = document.getElementById('lyricsView');
        if (lyricsView) lyricsView.innerHTML = '';
    }

    // E. UI 狀態更新
    updateStepUI();

    // F. 處理側邊欄與下拉選單
    document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));

    renderProjectSidebar();

    // 💡 重要：更新右上角選單，這會讀取新的 state.recordings
    updateAttemptDropdown();

    // 更新側邊欄按鈕（複習/新增）的顯示狀態
    if (typeof updateActionButtons === 'function') updateActionButtons();
}

function addProjectToSidebar(id, title, date) {
    renderProjectSidebar();
}

async function initUserHistory() {
    const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const username = profile.username || "guest";

    try {
        const res = await fetch(`/get_all_projects?username=${username}`);
        const data = await res.json();

        if (data.projects) {
            for (const p of data.projects) {
                const tempId = p.id;

                // 💡 抓取該專案已有的錄音段落
                const recRes = await fetch(`/get_recorded_indices?project_id=${tempId}`);
                const recData = await recRes.json();

                const hasAnyRecording = (recData.indices || []).length > 0;

                state.projects[tempId] = {
                    id: tempId,
                    title: p.title, // 💡 這裡要確保有存到
                    date: p.date,
                    article: {
                        title: p.title, // 💡 這裡最關鍵！filter 是靠這個 title 在找人的
                        paragraphs: p.content ? p.content.split(/\n\s*\n/).map(s => s.trim()) : []
                    },
                    recordedSet: new Set(recData.indices || []),
                    // 💡 依實際錄音狀況還原完成度，而非借用其他專案的全域狀態；
                    //    是否「評分結果」已完成需另外判斷，這裡先不預設為完成，避免顯示尚未產生的舊報告
                    completedSteps: hasAnyRecording ? [0, 1] : [0],
                    // 💡 關鍵修正：後端沒有存 practiceMode 欄位，過去在這裡永遠寫死 'segment'，
                    //    導致分頁重新整理後，任何一次曾選過「整篇練習」的紀錄都會被強制打回「分段練習」。
                    //    現在改成優先從 localStorage 讀回這個 project 當初實際選過的模式，讀不到才用預設值。
                    practiceMode: _loadPracticeModeForProject(tempId) || 'segment',
                    currentStep: 1,
                    currentParagraph: 0
                };
            }
            // 💡 整個載入完後，畫出左側欄位
            renderProjectSidebar();
        }
    } catch (e) { console.error("初始化失敗", e); }
}

/**
 * 💡 1. 重新渲染左側側邊欄：以「文章」為大項，顯示最新練習時間
 *  選擇歷史紀錄
 */
function renderProjectSidebar() {
    const list = document.getElementById('historyList');
    if (!list) return;
    list.innerHTML = '';

    // 💡 修正排序：直接對所有專案進行全域排序 (由新到舊)
    const allProjects = Object.values(state.projects).sort((a, b) => {
        // 先比日期，再比 ID (確保剛產生的 proj_xxx 權重最高)
        return new Date(b.date) - new Date(a.date) || b.id.localeCompare(a.id);
    });

    // 💡 建立一個 Set 來追蹤已經顯示過的標題，避免重複顯示舊的嘗試
    const seenTitles = new Set();

    allProjects.forEach(p => {
        const title = p.article?.title || '未命名文章';

        // 💡 如果這個標題已經出現過（代表已經處理過該文章的最新練習），就跳過
        // 但如果是「未命名文章」，我們允許重複顯示（方便老大開多個新專案）
        if (title !== '未命名文章' && seenTitles.has(title)) return;
        seenTitles.add(title);

        // 找出該標題下的所有練習次數
        const attempts = allProjects.filter(proj => (proj.article?.title || '未命名文章') === title);
        const isActive = attempts.some(a => a.id === state.activeProjectId);

        const itemEl = document.createElement('li');
        itemEl.className = `history-item ${isActive ? 'active' : ''}`;

        // 點擊會切換到該組最新的一個
        itemEl.setAttribute('onclick', `switchProject('${p.id}')`);
        itemEl.style.cursor = 'pointer';

        itemEl.innerHTML = `
            <div class="project-info">
                <div class="project-main">
                    <span class="project-name">${title}</span>
                    <span class="project-count-badge">${attempts.length} 次</span>
                </div>
                <small class="project-time">${p.date}</small>
            </div>
        `;
        list.appendChild(itemEl);
    });

    updateAttemptDropdown();
}

/**
 * 💡 2. 更新右上方「第幾次」下拉選單
 */
function updateAttemptDropdown() {
    const dropdown = document.getElementById('attemptDropdown');
    if (!dropdown || !state.activeProjectId) return;

    const currentProj = state.projects[state.activeProjectId];

    if (!currentProj.article || !currentProj.article.title) {
        dropdown.innerHTML = `<option value="${currentProj.id}" selected>請選擇文章</option>`;
        return;
    }

    const currentTitle = currentProj.article.title.trim();

    const attempts = Object.values(state.projects)
        .filter(p => p.article && p.article.title && p.article.title.trim() === currentTitle)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (attempts.length > 0) {
        dropdown.innerHTML = attempts.map((p, index) => `
            <option value="${p.id}" ${p.id === state.activeProjectId ? 'selected' : ''}>
                第 ${index + 1} 次 (${p.date})
            </option>
        `).join('');
    }

    // 💡 【核心修正】：綁定切換事件
    dropdown.onchange = function() {
        const targetId = this.value;
        console.log("切換練習次數至:", targetId);
        switchProject(targetId); // 這裡才會真正觸發音檔載入邏輯
    };
}


// 初始化 Wavesurfer
function initWaveform() {
    // 💡 關鍵：如果已經有實例，先銷毀再重建，避免按鈕抓到舊的實例
    if (wavesurfer) {
        wavesurfer.destroy();
    }

    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#ffb3b3',      // 配合你的紅色系：未播放波形顏色
        progressColor: '#e63946',  // 配合你的紅色系：已播放波形顏色
        cursorColor: '#e63946',
        barWidth: 3,
        barGap: 2,
        height: 80,
        responsive: true,
        barRadius: 4
    });

    // ── 🚀 【全新加入】：等待音檔非同步加載完成後，精準抓取並顯示總時間 ──
    wavesurfer.on('ready', () => {
        const totalDuration = wavesurfer.getDuration();
        const m = String(Math.floor(totalDuration / 60)).padStart(2, '0');
        const s = String(Math.floor(totalDuration % 60)).padStart(2, '0');

        // 更新網頁上的時間小標籤
        const timeDisplay = document.getElementById('current-time-display');
        if (timeDisplay) {
            timeDisplay.textContent = `00:00 / ${m}:${s}`;
        }
        console.log(`[WaveSurfer Ready] 音檔完全載入成功！總長度為: ${m}:${s}`);
    });

    // ── 💡 【全新加入】：隨著播放進度條移動，即時重新繪製變動的時間 ──
    wavesurfer.on('timeupdate', (currentTime) => {
        const totalDuration = wavesurfer.getDuration();

        const curM = String(Math.floor(currentTime / 60)).padStart(2, '0');
        const curS = String(Math.floor(currentTime % 60)).padStart(2, '0');

        const totM = String(Math.floor(totalDuration / 60)).padStart(2, '0');
        const totS = String(Math.floor(totalDuration % 60)).padStart(2, '0');

        const timeDisplay = document.getElementById('current-time-display');
        if (timeDisplay) {
            timeDisplay.textContent = `${curM}:${curS} / ${totM}:${totS}`;
        }
    });

    // 💡 綁定播放/暫停鍵 (微調：使用回呼確保同步切換文字)
    const playPauseBtn = document.getElementById('playPauseWaveBtn');
    if (playPauseBtn) {
        playPauseBtn.onclick = () => {
            wavesurfer.playPause();
        };
    }

    // 當實體開始播放，按鈕立刻換成暫停
    wavesurfer.on('play', () => {
        if (playPauseBtn) playPauseBtn.textContent = '⏸ 暫停';
    });

    // 當實體暫停，按鈕立刻換成播放
    wavesurfer.on('pause', () => {
        if (playPauseBtn) playPauseBtn.textContent = '▶ 播放';
    });

    // 💡 綁定停止鍵
    const stopBtn = document.getElementById('stopWaveBtn');
    if (stopBtn) {
        stopBtn.onclick = () => {
            wavesurfer.stop();
            if(playPauseBtn) playPauseBtn.textContent = '▶ 播放';
        };
    }

    // 播放完畢自動重置文字
    wavesurfer.on('finish', () => {
        if(playPauseBtn) playPauseBtn.textContent = '▶ 播放';
    });
}

// ── TTS 朗讀功能 ──
function initTTS() {
    const ttsBtn = document.getElementById('ttsBtn');
    if (!ttsBtn) return;

    function setTTSActive(active) {
        ttsBtn.classList.toggle('tts-active', active);
        ttsBtn.querySelector('.sf-btn-icon').textContent = active ? '⏹' : '🔊';
        ttsBtn.querySelector('.sf-btn-label').textContent = active ? '停止' : '朗讀';
    }

    ttsBtn.addEventListener('click', () => {
        // 若正在朗讀 → 停止
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
            setTTSActive(false);
            return;
        }

        // 讀取當前段落文字（優先取 .lyric-sentence，避免整篇練習模式的換頁箭頭符號被誤讀）
        const curEl = document.querySelector('#lyricsView .lyric-current');
        if (!curEl) return;

        const sentenceEls = curEl.querySelectorAll('.lyric-sentence');
        const text = (sentenceEls.length
                ? Array.from(sentenceEls).map(el => el.textContent.trim()).join(' ')
                : Array.from(curEl.childNodes)
                    .filter(n => n.nodeType === Node.TEXT_NODE)
                    .map(n => n.textContent.trim())
                    .join(' '))
            || curEl.innerText.trim();

        if (!text) return;

        const utt   = new SpeechSynthesisUtterance(text);
        utt.lang    = 'en-US';
        utt.rate    = 0.9;
        utt.pitch   = 1;

        utt.onstart = () => setTTSActive(true);
        utt.onend   = () => setTTSActive(false);
        utt.onerror = () => setTTSActive(false);

        speechSynthesis.speak(utt);
    });


}


// 💡 新增：點擊單句時觸發的 TTS 朗讀功能
function speakSentence(text) {
    if (!text) return;

    // 如果目前正在朗讀，先強制停止，這樣連續點擊不同句子時才不會塞車
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'en-US';
    utt.rate = 0.9;  // 語速，可依需求調整
    utt.pitch = 1;

    // 朗讀時可以讓畫面上有些視覺反饋（選填）
    utt.onstart = () => console.log(`[TTS 正在朗讀單句]: ${text}`);
    utt.onend = () => console.log('[TTS 朗讀結束]');
    utt.onerror = (e) => console.error('[TTS 朗讀發生錯誤]', e);

    speechSynthesis.speak(utt);
}



function _updateMaskSlots(paraIndex) {
    const slots = [
        document.getElementById('maskSlot0'),
        document.getElementById('maskSlot1'),
        document.getElementById('maskSlot2'),
    ];
    if (!slots[0]) return;

    let safeIdx = parseInt(paraIndex, 10);
    if (isNaN(safeIdx) || safeIdx < 0) safeIdx = 0;

    const articleTitleRaw = (document.getElementById('chatTitle')?.textContent || '').trim();
    // 💡 全部轉小寫再比對，避免大小寫不一致造成誤判
    const titleLower = articleTitleRaw.toLowerCase();

    const isKitten = titleLower.includes("kitten's_choice") || titleLower.includes("kitten's choice") || titleLower.includes("kitten");
    const isShark  = titleLower.includes("sharks") || titleLower.includes("shark");
    const isHill  = titleLower.includes("hill") || titleLower.includes("Hill");

    // 💡 容錯：同時支援 _p2 / -p2 / p2 (前面接底線、減號或空白)
    const paraMatch = articleTitleRaw.match(/[_\-\s]p(\d+)/i) || articleTitleRaw.match(/[_\-\s]s(\d+)/i);

    console.log('[除錯] 原始標題:', JSON.stringify(articleTitleRaw));
    console.log('[除錯] isKitten:', isKitten, ' isShark:', isShark);
    console.log('[除錯] paraMatch:', paraMatch);

    if (paraMatch) {
        safeIdx = parseInt(paraMatch[1], 10) - 1;
        console.log(`[遮擋提示] 標題指定強制段落 p${paraMatch[1]}，索引鎖定為 ${safeIdx}`);
    }

    let hintSet = [];

    if (isKitten) {
        let idx = safeIdx;
        if (idx < 0 || idx >= KITTENS_CHOICE_HINTS.length) idx = KITTENS_CHOICE_HINTS.length - 1;
        hintSet = KITTENS_CHOICE_HINTS[idx] || [];
    } else if (isShark) {
        let idx = safeIdx;
        if (idx < 0 || idx >= SHARKS_HINTS.length) idx = SHARKS_HINTS.length - 1;
        hintSet = SHARKS_HINTS[idx] || [];
    } else if (isHill){
        let idx = safeIdx;
        if (idx < 0 || idx >= HILL_HINTS.length) idx = HILL_HINTS.length - 1;
        hintSet = HILL_HINTS[idx] || [];
    }else {
        console.warn('[遮擋警告] 標題既不符合 Kitten 也不符合 Shark 與 Hill，hintSet 為空');
    }

    console.log(`[遮擋觸發] 最終使用段落索引:${safeIdx} 圖片數量: ${hintSet.length}`, hintSet);

    slots.forEach((slot, i) => {
        if (!slot) return;
        const imgData = hintSet[i] || null;
        while (slot.firstChild) slot.removeChild(slot.firstChild);

        if (imgData && imgData.src) {
            // 💡 翻牌功能：外層 .flip-card 負責 3D 翻轉，內層分正面(圖片) / 背面(提示文字)
            const flipCard = document.createElement('div');
            flipCard.className = 'flip-card';

            const flipInner = document.createElement('div');
            flipInner.className = 'flip-card-inner';

            const front = document.createElement('div');
            front.className = 'flip-card-front';

            const img = document.createElement('img');
            img.src = imgData.src;
            img.alt = imgData.alt || '';
            img.onerror = function() {
                console.error(`❌ 圖片載入失敗！路徑: ${this.src}`);
                front.innerHTML = `<div style="font-size:0.65rem; color:#e63946; padding:5px; word-break:break-all;">圖片404<br>${this.src.substring(this.src.lastIndexOf('/'))}</div>`;
            };
            front.appendChild(img);

            const back = document.createElement('div');
            back.className = 'flip-card-back';
            const hintText = document.createElement('p');
            hintText.className = 'flip-hint-text';
            // 💡 提示文字：請在 KITTENS_CHOICE_HINTS / SHARKS_HINTS / HILL_HINTS 內的 hint 欄位自行填入
            hintText.textContent = imgData.hint && imgData.hint.trim() ? imgData.hint : '（尚未設定提示文字）';
            back.appendChild(hintText);

            flipInner.appendChild(front);
            flipInner.appendChild(back);
            flipCard.appendChild(flipInner);

            // 點擊卡片即可翻面，再點一次翻回去
            flipCard.addEventListener('click', () => {
                flipCard.classList.toggle('is-flipped');
            });

            slot.appendChild(flipCard);
        } else {
            const ph = document.createElement('div');
            ph.className = 'mask-img-placeholder';
            ph.style.cssText = 'color: #e63946 !important; font-size: 1.2rem !important; font-weight: bold;';
            ph.textContent = `無圖(Slot${i})`;
            slot.appendChild(ph);
        }
    });

    // 💡 整篇練習模式：遮擋圖片區也要比照文字模式，右下角「下一段」、非第一段時左下角「上一段」
    //    每次重繪都先清掉舊的換頁按鈕，避免重複疊加
    const maskArea = document.getElementById('maskImageArea');
    if (maskArea) {
        const oldNav = maskArea.querySelector('.mask-nav-arrows');
        if (oldNav) oldNav.remove();

        const isWhole = state.practiceMode === 'whole';
        if (isWhole && state.article && Array.isArray(state.article.paragraphs)) {
            const totalParas = state.article.paragraphs.length;
            const curIdx = (typeof state.currentParagraph === 'number') ? state.currentParagraph : 0;
            const hasPrev = curIdx > 0;
            const hasNext = curIdx < totalParas - 1;

            const navWrap = document.createElement('div');
            navWrap.className = 'mask-nav-arrows lyric-nav-arrows';

            if (hasPrev) {
                const prevBtn = document.createElement('button');
                prevBtn.type = 'button';
                prevBtn.className = 'lyric-nav-arrow lyric-nav-prev';
                prevBtn.title = '上一段';
                prevBtn.innerHTML = '&#8592;';
                prevBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    switchWholeParagraphView(curIdx - 1);
                });
                navWrap.appendChild(prevBtn);
            } else {
                const phPrev = document.createElement('span');
                phPrev.className = 'lyric-nav-arrow lyric-nav-placeholder';
                navWrap.appendChild(phPrev);
            }

            if (hasNext) {
                const nextBtn = document.createElement('button');
                nextBtn.type = 'button';
                nextBtn.className = 'lyric-nav-arrow lyric-nav-next';
                nextBtn.title = '下一段';
                nextBtn.innerHTML = '&#8594;';
                nextBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    switchWholeParagraphView(curIdx + 1);
                });
                navWrap.appendChild(nextBtn);
            } else {
                const phNext = document.createElement('span');
                phNext.className = 'lyric-nav-arrow lyric-nav-placeholder';
                navWrap.appendChild(phNext);
            }

            maskArea.appendChild(navWrap);
        }
    }

    // 💡 圖片(卡片)重新產生後，立即用 JS 重新計算一次正方形邊長
    //    用 requestAnimationFrame 是為了等瀏覽器先把上面 DOM 異動排版完，量到的容器尺寸才準
    requestAnimationFrame(_resizeMaskSlots);
}

/**
 * 💡 正方形保證器：不依賴 CSS 的 aspect-ratio（在 flexbox 情境下不一定可靠），
 *    改成直接量測 .mask-image-area 目前的可用寬度／高度，
 *    取「三張圖平分寬度」與「容器高度」兩者中較小值當作正方形邊長，
 *    並用 setProperty(..., 'important') 蓋掉 CSS 裡的 !important，強制寫死 px。
 *    這樣無論視窗寬高比例怎麼變，三張圖永遠是正方形，只有整體大小會跟著縮放。
 */
function _resizeMaskSlots() {
    const area = document.getElementById('maskImageArea');
    if (!area || !area.classList.contains('visible')) return;

    const slots = [
        document.getElementById('maskSlot0'),
        document.getElementById('maskSlot1'),
        document.getElementById('maskSlot2'),
    ].filter(Boolean);
    if (!slots.length) return;

    const areaStyle = getComputedStyle(area);
    const padLeft    = parseFloat(areaStyle.paddingLeft)   || 0;
    const padRight   = parseFloat(areaStyle.paddingRight)  || 0;
    const padTop     = parseFloat(areaStyle.paddingTop)    || 0;
    const padBottom  = parseFloat(areaStyle.paddingBottom) || 0;
    const gap        = parseFloat(areaStyle.columnGap || areaStyle.gap) || 16;

    const rect = area.getBoundingClientRect();
    const isColumn = areaStyle.flexDirection === 'column';

    let size;
    if (isColumn) {
        // 手機版直向堆疊：每張圖大小 = 視窗寬度的一半，夾在 160~300px。
        // （對應原本 CSS 的 clamp(160px, 50vw, 300px)，因為這裡用 !important 寫死，才是真正生效的地方）
        // 👉 想改大小就調這三個數字：MIN_SIZE / VW_RATIO / MAX_SIZE
        const MIN_SIZE = 160;   // 最小邊長(px)
        const VW_RATIO = 0.60;  // 佔視窗寬度的比例（調小=圖片更小）
        const MAX_SIZE = 300;   // 最大邊長(px)
        size = Math.max(MIN_SIZE, Math.min(window.innerWidth * VW_RATIO, MAX_SIZE));
    } else {
        // 桌機版橫向並排：維持原本邏輯
        const availableWidth  = rect.width  - padLeft - padRight  - gap * (slots.length - 1);
        const availableHeight = rect.height - padTop  - padBottom;
        size = Math.min(availableWidth / slots.length, availableHeight, 320);
    }
    if (!isFinite(size) || size < 20) size = 20;

    slots.forEach(slot => {
        slot.style.setProperty('width',      size + 'px', 'important');
        slot.style.setProperty('height',     size + 'px', 'important');
        slot.style.setProperty('max-width',  size + 'px', 'important');  /* 👈 新增 */
        slot.style.setProperty('max-height', size + 'px', 'important');  /* 👈 新增 */
        slot.style.setProperty('flex', '0 0 auto', 'important');
    });
}

// 💡 視窗大小改變時（包含寬高比例改變）即時重新計算正方形邊長
window.addEventListener('resize', () => {
    clearTimeout(window._maskResizeTimer);
    window._maskResizeTimer = setTimeout(_resizeMaskSlots, 80);
});

// 💡 更保險：用 ResizeObserver 盯著容器本身，
//    涵蓋「側欄收合/展開」「視窗縮放」等所有會改變可用空間、但不一定觸發 window resize 事件的狀況
document.addEventListener('DOMContentLoaded', () => {
    const wrapperEl = document.querySelector('.lyrics-wrapper');
    if (wrapperEl && typeof ResizeObserver !== 'undefined') {
        const maskRO = new ResizeObserver(() => _resizeMaskSlots());
        maskRO.observe(wrapperEl);
    }
});

function initMaskBtn() {
    const maskBtn = document.getElementById('maskBtn');
    if (!maskBtn) return;

    maskBtn.addEventListener('click', () => {
        window._isMasked = !window._isMasked;

        const lyricsView  = document.getElementById('lyricsView');
        const maskArea    = document.getElementById('maskImageArea');
        const wrapper     = document.querySelector('.lyrics-wrapper');

        if (window._isMasked) {
            applyWordMask();
            // 💡 終極修正 1：隱藏歌詞區，騰出物理空間
            if (lyricsView) {
                lyricsView.style.display = 'none';
            }

            // 💡 終極修正 2：強制用 JS 注入樣式，破除 CSS 裡高度被固定 300px 或 !important 的壓制
            if (maskArea) {
                maskArea.classList.add('visible');
                maskArea.style.setProperty('display', 'flex', 'important');
                maskArea.style.setProperty('flex', '1', 'important');
                maskArea.style.setProperty('width', '100%', 'important');
                maskArea.style.setProperty('height', '100%', 'important');
                // 💡 修正：拿掉寫死的 min-height: 260px，改讓它跟著 .lyrics-wrapper 現在的動態高度（clamp 縮放後）走，
                //    不然視窗縮小、字幕區跟著變矮時，這個圖片區還是會被撐開到至少 260px，跟外面對不齊。
                maskArea.style.removeProperty('min-height');
            }

            // 💡 終極修正 3：防禦索引，確保絕對不為 undefined 或 NaN
            let targetIdx = 0;
            if (typeof state.currentParagraph === 'number') {
                targetIdx = state.currentParagraph;
            } else if (typeof _currentIdx === 'number') {
                targetIdx = _currentIdx;
            }

            _updateMaskSlots(targetIdx);
        } else {
            removeWordMask();
            // 還原字幕欄
            if (lyricsView) {
                lyricsView.style.display = 'flex';
            }
            // 隱藏圖片區
            if (maskArea) {
                maskArea.classList.remove('visible');
                maskArea.style.display = 'none';
            }
        }

        maskBtn.classList.toggle('mask-active', window._isMasked);
        maskBtn.querySelector('.sf-btn-icon').textContent = window._isMasked ? '💬' : '🖼️';
        maskBtn.querySelector('.sf-btn-label').textContent = window._isMasked ? '文字' : '圖片';
    });
}




/**
 * 將當前段落的文字節點拆成 <span class="masked-word">單字</span>
 * 空白字元保留為純文字節點
 */
function applyWordMask() {
    const curEl = document.querySelector('#lyricsView .lyric-current');
    if (!curEl) return;
    if (curEl.querySelector('.masked-line')) return;


    // 支援新的 .lyric-sentence 結構與舊的純文字節點
    const sentenceEls = curEl.querySelectorAll('.lyric-sentence');

    function maskTextNodesIn(container) {
        Array.from(container.childNodes)
            .filter(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim())
            .forEach(node => {
                const wrapper = document.createElement('span');
                wrapper.className = 'masked-line';

                // 💡 修改這行：優化切分邏輯，確保引號與前後單字或標點符號在一起
                node.textContent.split(/(\s+)/).forEach(part => {
                    if (/^\s+$/.test(part)) {
                        wrapper.appendChild(document.createTextNode(part));
                    } else if (part) {
                        const span = document.createElement('span');
                        span.className = 'masked-word';
                        span.textContent = part;
                        wrapper.appendChild(span);
                    }
                });

                node.parentNode.replaceChild(wrapper, node);
            });
    }

    if (sentenceEls.length > 0) {
        sentenceEls.forEach(el => maskTextNodesIn(el));
    } else {
        // 舊版相容：直接文字節點
        maskTextNodesIn(curEl);
    }
}

function removeWordMask() {
    document.querySelectorAll('#lyricsView .masked-line').forEach(wrapper => {
        wrapper.parentNode.replaceChild(
            document.createTextNode(wrapper.textContent),
            wrapper
        );
    });
}

// ══════════════════════════════════════════════════
//  📊 SCORE REPORT RENDERING ENGINE (真·四段分立、流暢度大波動完全體)
// ══════════════════════════════════════════════════

/**
 * 💡 1. 局部即時分析器：在 Step 2 錄音中，每錄完一段點擊「上傳並繼續」時觸發。
 * 它的唯一職責：精準寻找有沒有 data-strip-para="${currentParaNum}" 的橫條，只做局部抽換，絕不胡亂 append！
 */
function renderWerReportToPanel3(alignmentReport, stats, currentParaNum = 1, backendAudioUrl = '') {
    try {
        console.log("開始動態渲染單段落手風琴長條...", stats);

        // 1. 綁定最下方大底座 Total 的統計數據 (單段上傳時先作為即時看板)
        if (document.getElementById('werScoreText')) {
            document.getElementById('werScoreText').innerText = werToAccuracyPercentText(stats.wer_repair_fluency);
        }

        const container = document.getElementById('werParagraphsContainer');
        if (!container) return;

        // 💡 【防禦雙胞胎機制 1】：如果原本只有「暫無分析資料」的提示文字，先清空它
        if (container.querySelector('p') || container.innerText.includes('暫無分析資料')) {
            container.innerHTML = '';
        }

        // 💡 【防禦雙胞胎機制 2】：如果畫面上已經有同一個段落的舊長條，先把它拔掉，防止一筆變兩筆！
        const oldStrip = container.querySelector(`[data-strip-para="${currentParaNum}"]`);
        if (oldStrip) {
            oldStrip.remove();
        }

        // 2. 遍歷報表，組合全彩單字膠囊
        let errorCount = 0;
        let visualHTML = '';

        alignmentReport.forEach(item => {
            let colorStyle = 'color: #4ade80;';
            let textDecoration = '';
            let bgStyle = 'background-color: #f0fdf4;';

            if (item.Category !== 'Match' && item.category !== 'Match') errorCount++;

            const category = item.Category || item.category || 'Match';
            const reference = item.Reference || item.reference || '';
            const hypothesis = item.Hypothesis || item.hypothesis || '';

            switch (category) {
                case 'Delete': case 'delete':
                    colorStyle = 'color: #9ca3af;'; bgStyle = 'background-color: #f3f4f6;'; textDecoration = 'text-decoration: line-through;'; break;
                case 'Substitute': case 'substitute':
                    colorStyle = 'color: #dc2626; font-weight: bold;'; bgStyle = 'background-color: #fef2f2;'; break;
                case 'Insert': case 'insert':
                    colorStyle = 'color: #d97706;'; bgStyle = 'background-color: #fffbeb;'; break;
                case 'Repair_Repetition': case 'repetition':
                    colorStyle = 'color: #ea580c;'; bgStyle = 'background-color: #fff7ed'; textDecoration = 'text-decoration: underline wavy #ea580c; text-underline-offset: 4px;'; break;
                case 'Repair_Attempt': case 'attempt':
                    colorStyle = 'color: #db2777'; bgStyle = 'background-color: #fdf2f8;'; textDecoration = 'text-decoration: underline dashed #db2777; text-underline-offset: 4px;'; break;
                case 'Repair_Restart': case 'restart':
                    colorStyle = 'color: #7c3aed;'; bgStyle = 'background-color: #f5f3ff;'; textDecoration = 'text-decoration: underline dotted #7c3aed; text-underline-offset: 4px;'; break;
            }

            visualHTML += `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px 12px; border-radius: 8px; ${bgStyle} min-width: 65px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                    <div style="font-size: 1.1rem; font-weight: bold; color: #1f2937; margin-bottom: 4px; text-align: center;">${reference === '—' ? '-' : reference}</div>
                    <div style="font-size: 0.95rem; ${colorStyle} ${textDecoration} text-align: center; font-weight: 600;">${hypothesis === '—' ? '-' : hypothesis}</div>
                </div>
            `;
        });

        // 3. 建立 100% 滿版橫向手風琴長條元件
        const strip = document.createElement('div');
        strip.style.background = '#fff';
        strip.style.border = '1px solid #e2e8f0';
        strip.style.borderRadius = '12px';
        strip.style.overflow = 'hidden';
        strip.style.boxShadow = '0 2px 6px rgba(0,0,0,0.01)';
        strip.style.width = '100%';
        strip.style.boxSizing = 'border-box';
        strip.setAttribute('data-strip-para', currentParaNum); // 標記身分證

        const header = document.createElement('div');
        header.style.padding = '18px 24px';
        header.style.background = '#f8fafc';
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.justifyContent = 'space-between';
        header.style.cursor = 'pointer';
        header.style.width = '100%';
        header.style.boxSizing = 'border-box';

        // 🚀 【全新進化核心】：先動態拔出後端回傳並塞入 stats 的 npvi 分數
        const displayNpvi = (stats.npvi !== undefined && stats.npvi !== null)
            ? parseFloat(stats.npvi).toFixed(2)
            : '—';

        header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 30px; flex: 1; flex-wrap: wrap;">
                <span style="font-weight: bold; color: #1f2937; min-width: 65px; font-size: 1.05rem; white-space: nowrap;">段落 ${currentParaNum}</span>
                <span style="color: #16a34a; font-weight: bold; background: #dcfce7; padding: 4px 12px; border-radius: 8px; font-size: 0.85rem; white-space: nowrap;">✓ 已錄音</span>
                
                <div style="display: flex; gap: 24px; color: #4a5568; font-size: 0.92rem; align-items: center; flex-wrap: wrap; white-space: nowrap;">
                    <div>WER: <strong style="color: #e63946; font-size: 1.05rem;">${(stats.wer_repair_fluency * 100).toFixed(1)}%</strong></div>
                    <div>錯誤數: <strong style="color: #fb923c; font-size: 1.05rem;">${errorCount}</strong></div>
                    <div>總字數: <strong style="color: #333; font-size: 1.05rem;">${stats.total_ref_words}</strong></div>
                    
                    <div style="color: #1f2937; border-left: 1px solid #e2e8f0; padding-left: 16px;">
                        nPVI: <strong style="color: #2563eb; font-size: 1.05rem;">${displayNpvi}</strong>
                    </div>
                    <div style="color: #94a3b8;">Varco: <span style="font-style: italic; font-size:0.8rem;">(預留)</span></div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; white-space: nowrap;">
                <span style="color: #a0aec0; font-size: 0.85rem;">展開對照</span> <span class="arrow-icon" style="transition: transform 0.2s; color: #cbd5e1;">▼</span>
            </div>
        `;

        // 下拉展開大容器 (上層音檔、下層文字)
        const body = document.createElement('div');
        body.style.padding = '24px';
        body.style.display = 'none';
        body.style.background = '#ffffff';
        body.style.borderTop = '1px solid #edf2f7';
        body.style.flexDirection = 'column';
        body.style.gap = '20px';
        body.style.width = '100%';
        body.style.boxSizing = 'border-box';

        // 💡 【精準安全過濾】：優先使用後端回傳的實體路徑，並強行鎖定時間戳
        const playbackAudio = document.getElementById('playbackAudio');
        let cleanAudioUrl = backendAudioUrl || (playbackAudio ? playbackAudio.src : '');

        if (cleanAudioUrl && !cleanAudioUrl.startsWith('/') && !cleanAudioUrl.startsWith('http')) {
            cleanAudioUrl = '/' + cleanAudioUrl;
        }
        if (cleanAudioUrl) {
            cleanAudioUrl += (cleanAudioUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
        }

        const audioSection = document.createElement('div');
        audioSection.style.background = '#f8fafc';
        audioSection.style.border = '1px solid #e2e8f0';
        audioSection.style.padding = '14px 18px';
        audioSection.style.borderRadius = '10px';
        audioSection.style.width = '100%';
        audioSection.style.boxSizing = 'border-box';

        // 💡 加上 preload="metadata" 讓網頁加載時自動去撈音檔長度
        audioSection.innerHTML = `
            <div style="font-size: 0.9rem; font-weight: bold; color: #475569; margin-bottom: 8px;">
                🎵 段落 ${currentParaNum} 錄音回回放 (WAV)：
            </div>
            <audio src="${cleanAudioUrl}" controls style="width: 100%; max-width: 500px; height: 36px; display: block;" preload="metadata"></audio>
        `;

        const capsuleSection = document.createElement('div');
        capsuleSection.style.display = 'flex';
        capsuleSection.style.flexWrap = 'wrap';
        capsuleSection.style.gap = '12px';
        capsuleSection.style.lineHeight = '1.8';
        capsuleSection.style.width = '100%';
        capsuleSection.style.boxSizing = 'border-box';
        capsuleSection.innerHTML = visualHTML;

        body.appendChild(audioSection);
        body.appendChild(capsuleSection);

        header.addEventListener('click', () => {
            const isHidden = body.style.display === 'none';
            body.style.display = isHidden ? 'flex' : 'none';
            header.querySelector('.arrow-icon').style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
            header.style.background = isHidden ? '#f1f5f9' : '#f8fafc';

            // 強制再次檢查與激活加載
            if (isHidden) {
                const audEl = body.querySelector('audio');
                if (audEl && audEl.readyState === 0) {
                    audEl.load();
                }
            }
        });

        strip.appendChild(header);
        strip.appendChild(body);
        container.appendChild(strip);

        console.log(`🎯 [WER 報表] 段落 ${currentParaNum} 即時更新完成！`);

    } catch (err) {
        console.error("❌ 即時渲染單段落失敗：", err);
    }
}


// ══════════════════════════════════════════════════
//  📊 整篇練習模式專用：直接寫入總成績卡（不經平均計算）
// ══════════════════════════════════════════════════
/**
 * 💡 整篇練習(whole)剛完成上傳、拿到後端「這一次上傳」的即時分析結果(result.wer_result)時呼叫。
 *    直接把 stats 裡的數值寫進總成績卡（werScoreText / werFluencyScore100），
 *    完全不經過 /get_project_total_report 的後端平均計算 —
 *    因為那支 API 目前無法正確辨識整篇錄音這一筆資料，算出來的平均值永遠是 0。
 *    下方段落列表也只會渲染這一筆「整篇朗讀」的手風琴卡，不會有其他段落殘影。
 */
function renderWholeReportDirectly(werResult, backendAudioUrl) {
    try {
        werResult = werResult || {};
        const stats = werResult.statistics || {};
        const alignmentReport = werResult.alignment_report || [];

        const werPct = werToAccuracyPercentText(stats.wer_repair_fluency || 0);
        const npvi = (werResult.npvi != null) ? parseFloat(werResult.npvi).toFixed(2) : '0.00';
        const varco = (werResult.varco != null) ? parseFloat(werResult.varco).toFixed(2) : '0.00';
        const overallFluencyScore = werResult.overall_fluency_score_100 != null ? parseFloat(werResult.overall_fluency_score_100) : null;
        const errorCount = alignmentReport.filter(i => (i.Category || i.category) !== 'Match').length;

        // 1. 直接改寫總成績卡的兩個數字，不做任何平均運算
        if (document.getElementById('werScoreText')) document.getElementById('werScoreText').innerText = werPct;
        if (document.getElementById('werFluencyScore100')) {
            const tierInfo = scoreToFluencyTierLabel(overallFluencyScore);
            const scoreEl = document.getElementById('werFluencyScore100');
            scoreEl.innerText = tierInfo ? tierInfo.text : '—';
            scoreEl.style.color = tierInfo ? tierInfo.color : '';
        }

        const bannerTitle = document.getElementById('scoreBannerTitle');
        if (bannerTitle) bannerTitle.innerHTML = '📊 整篇朗讀流暢度結算看板';

        // 💡 標題文字也換成「整篇」版本，跟分段模式的報告頁共用同一套文字比對邏輯
        (function updateDetailReportSectionTitle() {
            const allEls = document.querySelectorAll('h1, h2, h3, h4, h5, span, div, p, label');
            for (const el of allEls) {
                if (el.children.length > 0) continue;
                const text = (el.textContent || '').trim();
                if (text.includes('段落詳細回報') || text.includes('整篇詳細回報')) {
                    el.textContent = text.replace('段落詳細回報', '整篇詳細回報');
                    break;
                }
            }
        })();

        // 2. 下方直接顯示「整篇朗讀」這一份完整報告，跟分段模式共用同一套小工具，不用手風琴收合
        const container = document.getElementById('werParagraphsContainer');
        if (!container) return;
        container.innerHTML = '';

        const stripId = `strip-whole-${Date.now()}`;
        const radarScores = [
            werResult.score_completeness || 0,
            werResult.score_accuracy || 0,
            werResult.score_fluency || 0,
            werResult.score_grammar || 0
        ];

        const strip = document.createElement('div');
        strip.id = stripId;
        strip.style.cssText = 'background:#fff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.01); width:100%; box-sizing:border-box; margin-bottom:8px;';

        if (alignmentReport.length > 0) {
            strip.setAttribute('data-alignment', JSON.stringify(alignmentReport).replace(/'/g, "&apos;"));
        }

        // 💡 標題列（純顯示，不能點擊收合，因為整篇模式本來就只有一份資料要直接展開）
        const header = document.createElement('div');
        header.style.cssText = 'padding: 18px 24px; background: #f8fafc; display: flex; align-items: center; justify-content: space-between; cursor: default;';
        header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 30px; flex: 1; flex-wrap: wrap;">
                <span style="font-weight: bold; color: #1f2937; min-width: 65px; font-size: 1.05rem;">整篇朗讀</span>
                <span style="color: #16a34a; font-weight: bold; background: #dcfce7; padding: 4px 12px; border-radius: 8px; font-size: 0.85rem;">✓ 已錄音</span>
                <div style="display: flex; gap: 24px; color: #4a5568; font-size: 0.92rem; align-items: center; flex-wrap: wrap;">
                    <div>詞正確率: <strong style="color: #16a34a; font-size: 1.05rem;">${werPct}</strong></div>
                    <div>錯誤數: <strong style="color: #fb923c; font-size: 1.05rem;">${errorCount}</strong></div>
                    <div style="color: #4a5568; border-left: 1px solid #e2e8f0; padding-left: 16px;">nPVI: <strong style="color: #2563eb; font-size: 1.05rem;">${npvi}</strong></div>
                    <div style="color: #4a5568;">Varco: <strong style="color: #10b981; font-size: 1.05rem;">${varco}</strong></div>
                </div>
            </div>
        `;

        const body = document.createElement('div');
        // 💡 整篇模式：不用手風琴收合，直接展開顯示
        body.style.cssText = 'padding: 24px; display: flex; background: #ffffff; border-top: 1px solid #edf2f7; flex-direction: column; gap: 24px;';

        const actualNpviNum = parseFloat(npvi) || 0;
        const actualVarcoNum = parseFloat(varco) || 0;
        const fluencyFeedbackText = werResult.fluency_feedback_text || '';
        const completenessFeedbackText = werResult.completeness_feedback_text || '';
        const accuracyFeedbackText = werResult.accuracy_feedback_text || '';
        const werFluencyFeedbackText = werResult.wer_fluency_feedback_text || '';

        const chartsHTML = `
            <div style="display: flex; gap: 24px; width: 100%; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 300px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center;">
                    <div style="font-size: 0.95rem; font-weight: bold; color: #475569; margin-bottom: 12px; align-self: flex-start;">🕸️ 朗讀整體面向分析</div>
                    <div style="position: relative; width: 100%; height: 220px;">
                        <canvas class="radar-canvas"></canvas>
                    </div>
                </div>
                <div style="flex: 1; min-width: 300px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; justify-content: center; gap: 20px;">
                    <div style="font-size: 0.95rem; font-weight: bold; color: #475569; margin-bottom: 4px;">🎯 口語流暢分析</div>
                    ${renderFluencyBulletBar('nPVI 相鄰語速變異', actualNpviNum, NPVI_SYL_MEAN, NPVI_SYL_STD, '#3b82f6')}
                    ${renderFluencyBulletBar('Varco 整體語速變異', actualVarcoNum, VARCO_SYL_MEAN, VARCO_SYL_STD, '#10b981')}
                </div>
            </div>
        `;

        // 💡 跟分段模式共用同一套「分色分段音檔對照小工具」，整篇模式沒有段落分界資料可傳（單一整篇本身就是一份）
        const chunkListForWidget = werResult.chunk_details || [];
        const wordTimingsForWidget = werResult.word_timings || [];
        const sentenceFluencyForWidget = werResult.sentence_fluency || [];
        const chunkedAudioHTML = buildChunkedAudioBlock(
            stripId, chunkListForWidget, alignmentReport, backendAudioUrl || '',
            wordTimingsForWidget, sentenceFluencyForWidget,
            fluencyFeedbackText, completenessFeedbackText, accuracyFeedbackText, werFluencyFeedbackText,
            werResult.recording_fluency_score_100, werResult.score_completeness, werResult.score_accuracy, werResult.score_fluency,
            null
        );

        body.innerHTML = chartsHTML + chunkedAudioHTML;

        const canvas = body.querySelector('.radar-canvas');
        if (canvas) {
            new Chart(canvas.getContext('2d'), {
                type: 'radar',
                data: {
                    labels: ['發音完整度', '發音準確度', '口說流利度', '語法'],
                    datasets: [{ label: '評分 (0-5)', data: radarScores, backgroundColor: 'rgba(230, 57, 70, 0.2)', borderColor: '#e63946', pointBackgroundColor: '#e63946', borderWidth: 2 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: { r: { beginAtZero: true, min: 0, max: 5, ticks: { stepSize: 1, backdropColor: 'transparent' }, pointLabels: { font: { size: 12, weight: 'bold' }, color: '#475569' } } },
                    plugins: { legend: { display: false } }
                }
            });
        }

        strip.appendChild(header);
        strip.appendChild(body);
        container.appendChild(strip);

        initChunkedAudioBlock(stripId);

        console.log('🎯 [WER 報表] 整篇模式直接渲染完成，未經任何平均計算！');
    } catch (err) {
        console.error('❌ 整篇模式直接渲染失敗：', err);
    }
}


// ══════════════════════════════════════════════════
// 📊 多段落報告總成渲染 (精準拆開資料庫大禮盒)
// ══════════════════════════════════════════════════
/**
 * 💡 核心修正（whole 模式支援）：
 *   - 分段練習 (segment)：維持原本邏輯，把 paragraph_list 內每一段的數據平均加總，
 *     顯示於頂部總成績卡，並逐段列出手風琴長條。
 *   - 整篇練習 (whole)：後端只會有「一筆」真正的整篇錄音資料（paragraph_index = 0），
 *     其餘 paragraph_index 1~N 只是分段模式殘留的欄位佔位（file_path / wer 皆為 null），
 *     不該參與平均、也不該顯示在下方列表。這裡改成直接抓那一筆整篇資料的數值當作
 *     總成績卡顯示內容（不再平均），並且下方只顯示「整篇朗讀」這一張手風琴卡。
 */
// ══════════════════════════════════════════════════
//  🎵 段落詳細回報 — 分色分段音檔對照小工具 (chunk-aligned playback + transcript)
// ══════════════════════════════════════════════════
/**
 * 💡 依照 NPVI 回傳的 chunk_details（每個語塊的 xmin/xmax/label）
 *    把整段 word_alignments 依序分配進對應的 chunk。
 *    因為我們沒有逐字時間戳，這裡用「每個 chunk 的 hypothesis 字數」當作分配依據：
 *    依序消耗 alignment_report，湊滿一個 chunk 的字數就換下一個 chunk。
 *    這是近似值，但因為整份文本是照順序念的，實務上準確度足夠。
 */
function assignItemsToChunks(chunks, alignmentReport) {
    const sorted = [...(chunks || [])].sort((a, b) => (a.xmin || 0) - (b.xmin || 0));
    if (sorted.length === 0) {
        return [{ xmin: 0, xmax: 0, label: '', items: alignmentReport || [] }];
    }

    const targets = sorted.map(c => {
        const words = (c.label || '').trim().split(/\s+/).filter(Boolean);
        return Math.max(words.length, 1);
    });

    const buckets = sorted.map(() => []);
    let idx = 0;
    let count = 0;

    (alignmentReport || []).forEach(item => {
        if (idx >= buckets.length) idx = buckets.length - 1;
        buckets[idx].push(item);

        const hyp = (item.Hypothesis || item.hypothesis || '').trim();
        const isRealHyp = hyp && hyp !== '—' && hyp !== '–';
        if (isRealHyp) {
            count++;
            if (count >= targets[idx] && idx < buckets.length - 1) {
                idx++;
                count = 0;
            }
        }
    });

    return sorted.map((c, i) => ({ ...c, items: buckets[i] }));
}

/**
 * 💡 【核心新增】：用真正的逐字時間戳（來自 TextGrid 的 "words" tier）做精準的逐字對齊，
 *    取代 assignItemsToChunks() 那種「用字數比例去猜」的近似做法。
 *    因為 wordTimings 裡每一筆本來就對應「一個」真正念出來的字，
 *    所以分配邏輯簡單很多：依序把 alignment_report 塞進對應的字，
 *    每遇到一個「真的有念出來的字」(非 Delete) 就換下一個字的時間戳。
 */
function assignItemsToWords(wordTimings, alignmentReport) {
    const sorted = [...(wordTimings || [])].sort((a, b) => (a.xmin || 0) - (b.xmin || 0));
    if (sorted.length === 0) {
        return [{ xmin: 0, xmax: 0, label: '', items: alignmentReport || [] }];
    }

    const buckets = sorted.map(() => []);
    let idx = 0;

    (alignmentReport || []).forEach(item => {
        if (idx >= buckets.length) idx = buckets.length - 1;
        buckets[idx].push(item);

        const hyp = (item.Hypothesis || item.hypothesis || '').trim();
        const isRealHyp = hyp && hyp !== '—' && hyp !== '–';
        if (isRealHyp && idx < buckets.length - 1) {
            idx++;
        }
    });

    return sorted.map((w, i) => ({ xmin: w.xmin, xmax: w.xmax, label: w.text, items: buckets[i] }));
}

/**
 * 💡 【核心新增】：把逐字對齊後的每一個「字」，對應回它所屬的「句子分段」(NPVI chunk_results) 編號。
 *    用途：逐字對齊只負責「位置精準」，但顏色分組要維持「以句子為單位」交錯，
 *    不然每個字都換色，畫面會像彩虹一樣亂。
 *    做法：用每個字的開始時間 (xmin)，去對應落在哪個句子分段的時間範圍內；
 *    萬一時間有些微誤差、沒有剛好落在任何分段裡，就找時間上最接近的那個分段。
 */
function assignChunkIndices(groupedWords, sortedChunks) {
    if (!sortedChunks || sortedChunks.length === 0) {
        return groupedWords.map((w) => ({ ...w, chunkIndex: 0 }));
    }
    return groupedWords.map((w) => {
        const t = w.xmin || 0;
        let idx = sortedChunks.findIndex(c => t >= (c.xmin || 0) && t < (c.xmax != null ? c.xmax : Infinity));
        if (idx === -1) {
            let bestIdx = 0;
            let bestDist = Infinity;
            sortedChunks.forEach((c, i) => {
                const dist = Math.min(Math.abs((c.xmin || 0) - t), Math.abs((c.xmax || 0) - t));
                if (dist < bestDist) { bestDist = dist; bestIdx = i; }
            });
            idx = bestIdx;
        }
        return { ...w, chunkIndex: idx };
    });
}

/**
 * 💡 【核心新增】：依指定的「每秒像素」比例，把 grouped 陣列（含 xmin/xmax/chunkIndex/items/label）
 *    換算成實際要畫在畫面上的 left / width / gapBeforePx。
 *    這個函式在「第一次建立畫面」跟「使用者拉縮放滑桿」時都會呼叫到，統一用同一套邏輯，
 *    確保縮放前後排版邏輯一致，不會跑版。
 */
function computeLayout(groupedItems, pxPerSec) {
    let prevXmax = 0;
    return (groupedItems || []).map((c) => {
        const duration = Math.max((c.xmax || 0) - (c.xmin || 0), 0.05);
        const gapBeforeSec = Math.max((c.xmin || 0) - prevXmax, 0);
        const gapBeforePx = gapBeforeSec * pxPerSec;
        const left = (c.xmin || 0) * pxPerSec;
        const width = duration * pxPerSec;
        prevXmax = c.xmax || 0;
        return {
            xmin: c.xmin, xmax: c.xmax, label: c.label,
            chunkIndex: c.chunkIndex || 0,
            left, width, gapBeforePx, items: c.items
        };
    });
}

/**
 * 💡 渲染逐段對照的逐字稿列（上：正確課文 / 下：使用者實際發音），
 *    每個 chunk 一塊，跟上方時間軸的顏色一黑一白對應。
 *    targetCategory 有值時，只把該類別的錯誤標紅；null 時全部維持中性色。
 */
// ══════════════════════════════════════════════════
//  🎯 nPVI / Varco (syl) 達標判斷：標準值 ± 標準差
// ══════════════════════════════════════════════════
// 💡 這裡的標準值是用比例(0~1)乘以 100 換算過來的，
//    因為後端存進資料庫的 npvi/varco 分數本身就是 raw_value * 100。
const NPVI_SYL_MEAN = 56.22;   // 0.5622 * 100
const NPVI_SYL_STD = 13.35;    // 0.1335 * 100
const VARCO_SYL_MEAN = 46.71;  // 0.4671 * 100
const VARCO_SYL_STD = 9.33;    // 0.0933 * 100

/**
 * 💡 畫一條子彈圖：實測值是否落在「標準值 ± 標準差」範圍內，
 *    範圍內顯示綠色 ✓ 過關，範圍外顯示紅色 ✗ 未過關。
 *    圖表上用綠色淡色區塊標出合格範圍，兩條綠色細線是範圍的上下界。
 */
function renderFluencyBulletBar(label, value, mean, std, barColor) {
    const low = mean - std;
    const high = mean + std;
    const passed = value >= low && value <= high;
    const maxScale = Math.max(high * 1.3, value * 1.15, 10);
    // 💡 留一點左右邊界(2%~98%)，避免刻度線剛好卡在圖表最邊緣、文字被裁掉一半
    const toPct = (v) => Math.max(2, Math.min((v / maxScale) * 100, 98));
    const valuePct = toPct(value);
    const lowPct = toPct(low);
    const meanPct = toPct(mean);
    const highPct = toPct(high);
    const bandWidthPct = Math.max(highPct - lowPct, 0);
    const statusHtml = passed
        ? `<span style="color:#16a34a; font-weight:bold;">✓ 過關</span>`
        : `<span style="color:#e63946; font-weight:bold;">✗ 未過關</span>`;

    return `
        <div style="margin-bottom: 4px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 26px;">
                <span style="font-size:0.85rem; font-weight:bold; color:#333;">${label}</span>
                ${statusHtml}
            </div>

            <div style="position:relative; padding-top: 24px; padding-bottom: 40px;">
                <!-- 💡 實測值：箭頭 + 數字，標在填色長條的頂端 -->
                <div style="position:absolute; left:${valuePct}%; top:0; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; z-index:10; white-space:nowrap;">
                    <span style="font-size:0.8rem; font-weight:bold; color:${barColor};">實測 ${value.toFixed(1)}</span>
                    <span style="color:${barColor}; font-size:1rem; line-height:1; margin-top:1px;">|</span>
                </div>

                <!-- 💡 主軌道：從 0 一路實心填色到實測值的位置，不是只有一個標記點 -->
                <div style="position:relative; width:100%; height:14px; background:#e2e8f0; border-radius:8px; overflow:hidden;">
                    <div style="width:${valuePct}%; height:100%; background:${barColor}; transition:width 1s;"></div>
                </div>

                <!-- 💡 標準範圍：外框方框改成紅色，不用底色填滿，直接把下限到上限框起來 -->
                <div style="position:absolute; left:${lowPct}%; width:${bandWidthPct}%; top:24px; height:14px; border:2px solid #e63946; border-radius:6px; box-sizing:border-box; pointer-events:none;"></div>

                <!-- 💡 標準值(平均)在框內的確切位置，用一條直線標出來 -->
                <div style="position:absolute; left:${meanPct}%; top:22px; width:2px; height:18px; background:#e63946; pointer-events:none;"></div>

                <!-- 💡 下限 / 標準 / 上限：只顯示數字，不顯示文字說明，位置在方框下方留出間距，不會跟軌道疊到 -->
                <div style="position:absolute; left:${lowPct}%; top:44px; transform:translateX(-50%); font-size:0.78rem; color:#64748b; font-weight:bold; white-space:nowrap;">${low.toFixed(1)}</div>
                <div style="position:absolute; left:${meanPct}%; top:44px; transform:translateX(-50%); font-size:0.78rem; color:#1f2937; font-weight:bold; white-space:nowrap;">${mean.toFixed(1)}</div>
                <div style="position:absolute; left:${highPct}%; top:44px; transform:translateX(-50%); font-size:0.78rem; color:#64748b; font-weight:bold; white-space:nowrap;">${high.toFixed(1)}</div>
            </div>
        </div>
    `;
}

function renderChunkTranscriptRow(layout, targetCategory, chunkFluencyMap) {
    // 💡 「重新開始」這個類別，同時涵蓋 Repair_Restart 跟 Repair_Replacement 兩種原始類別
    //    （這是原本就有的設計：replacement 屬於一種特殊的 restart，兩者合併算同一個按鈕）
    const targetCategoryMap = {
        'repair_repetition': ['repair_repetition'],
        'repair_attempt': ['repair_attempt'],
        'repair_restart': ['repair_restart', 'repair_replacement'],
        'substitutions': ['substitute'],
        'deletions': ['delete'],
        'insertions': ['insert'],
        // 💡 新增組合類別：標籤按鈕隱藏底層細項後，改由「發音完整度」「口說流利度」一次觸發多種類別的標色
        'completeness_combined': ['delete', 'insert', 'substitute'],
        'fluency_wer_combined': ['repair_repetition', 'repair_attempt', 'repair_restart', 'repair_replacement']
    };
    const isFluencyMode = targetCategory === 'fluency';
    const normalizedTargets = (targetCategory && !isFluencyMode) ? (targetCategoryMap[targetCategory] || [targetCategory.toLowerCase()]) : null;
    let lastChunkIdxSeen = null; // 💡 用來判斷「這是不是這句話的第一個字」，只在第一個字前面加播放圖示

    return layout.map((c, i) => {
        // 💡 核心修正：顏色分組改用 chunkIndex（這個字屬於第幾個句子分段），
        //    不再用逐字本身的陣列位置 i，這樣同一句話裡的每個字會維持同一個顏色，
        //    只有換到下一句才會切換淺藍/淺綠，不會變成每個字一個顏色的彩虹畫面。
        const isBlue = (c.chunkIndex || 0) % 2 === 0;
        let bg = isBlue ? '#eff6ff' : '#ecfdf5';       // 淺藍 / 淺綠 交錯
        const refColor = '#1f2937';
        const hypColorDefault = '#6b7280';

        // 💡 流暢度模式：整句(這個 chunk)的 npvi/varco 有沒有落在標準範圍內，
        //    黃色 = 只有一個指標過關，紅色 = 兩個指標都沒過關，整句的字全部套用同一個顏色。
        const sentenceStatus = (isFluencyMode && chunkFluencyMap) ? ((chunkFluencyMap[c.chunkIndex] || {}).status || 'pass') : null;
        let sentenceWordColor = null;
        if (sentenceStatus === 'red') {
            bg = '#fee2e2';
            sentenceWordColor = '#dc2626';
        } else if (sentenceStatus === 'yellow') {
            bg = '#fef9c3';
            sentenceWordColor = '#b45309';
        }

        const wordsHtml = (c.items || []).map(item => {
            const cat = (item.Category || item.category || '').toString().toLowerCase();
            const ref = (item.Reference || item.reference || '—').trim();
            let hyp = (item.Hypothesis || item.hypothesis || '—').trim();
            const isTargetError = normalizedTargets && normalizedTargets.includes(cat);

            let hypStyle = `color: ${hypColorDefault}; font-weight: 500;`;
            let displayHyp = hyp;

            let wordDivClass = '';
            let wordDivExtraAttrs = '';
            let megaphoneHtml = '';

            if (isFluencyMode) {
                // 💡 流暢度模式：不管這個字本身是不是 WER 錯誤，只要整句被判定黃/紅，字就套用該顏色
                if (sentenceWordColor) {
                    hypStyle = `color: ${sentenceWordColor}; font-weight: 700;`;
                }
                if (hyp === '—' || !hyp) displayHyp = '-';
            } else if (isTargetError) {
                hypStyle = 'color: #e63946; font-weight: 800; background: #fee2e2; padding: 2px 4px; border-radius: 4px; border-bottom: 2px solid #e63946;';
                if (cat === 'delete') displayHyp = 'NULL';
                // 💡 這個字是目前篩選類別命中的錯誤：可以點擊查詢發音教學提示，旁邊也放一個大聲公可以直接聽正確發音
                wordDivClass = 'wer-error-word-badge';
                const refEsc = ref.replace(/"/g, '&quot;');
                const hypEsc = hyp.replace(/"/g, '&quot;');
                wordDivExtraAttrs = ` data-ref="${refEsc}" data-hyp="${hypEsc}" data-cat="${targetCategory || ''}"`;
                if (ref && ref !== '—') {
                    megaphoneHtml = `<span class="word-megaphone" onclick="event.stopPropagation(); window.speakEnglishWord('${ref.replace(/'/g, "\\'")}');" title="點擊聽正確發音" style="cursor:pointer; font-size:0.85rem; margin-left:2px;">🔊</span>`;
                }
            } else if (hyp === '—' || !hyp) {
                displayHyp = '-';
                hypStyle = 'color: #6b7280; opacity: 0.6;';
            }

            return `
                <div class="${wordDivClass}"${wordDivExtraAttrs} style="display:flex; flex-direction:column; align-items:center; margin: 4px 6px; min-width: 34px; flex: 0 0 auto; white-space:nowrap; ${isTargetError && !isFluencyMode ? 'cursor:pointer; position:relative;' : ''}">
                    <span class="ref-word-span" style="font-size:0.95rem; color:${refColor}; font-weight:600; cursor:pointer;">${ref === '—' ? '-' : ref}</span>
                    <span style="font-size:0.9rem; ${hypStyle}">${displayHyp}</span>${megaphoneHtml}
                </div>
            `;
        }).join('');

        const spacerHtml = (c.gapBeforePx && c.gapBeforePx > 0.5)
            ? `<div style="flex: 0 0 ${c.gapBeforePx}px; width:${c.gapBeforePx}px;"></div>`
            : '';

        // 💡 只在流暢度模式，且是「這句話的第一個字」，且這句被標記黃/紅時，
        //    加一個小小的播放圖示 + 文字標籤，讓顏色代表的意思一目瞭然，
        //    不然只看紅色/黃色的底色，使用者不會知道那是什麼意思。
        const isFirstWordOfChunk = c.chunkIndex !== lastChunkIdxSeen;
        lastChunkIdxSeen = c.chunkIndex;
        const showPlayHint = isFluencyMode && isFirstWordOfChunk && (sentenceStatus === 'red' || sentenceStatus === 'yellow');
        let playHintHtml = '';
        if (showPlayHint) {
            const isRed = sentenceStatus === 'red';
            const labelText = isRed ? '不流暢' : '待加強';
            const labelColor = isRed ? '#dc2626' : '#b45309';
            const labelBg = isRed ? '#fecaca' : '#fde68a';
            playHintHtml = `
                <span title="點擊這句可以聽正確發音示範" style="display:flex; flex-direction:column; align-items:center; margin-right:6px; align-self:center; flex:0 0 auto;">
                    <span style="font-size:0.9rem;">🔊</span>
                    <span style="font-size:0.65rem; font-weight:bold; color:${labelColor}; background:${labelBg}; padding:1px 6px; border-radius:8px; white-space:nowrap; margin-top:2px;">${labelText}</span>
                </span>
            `;
        }

        return spacerHtml + `
            <div class="chunk-transcript-block" data-word-idx="${i}" data-chunk-idx="${c.chunkIndex || 0}" style="flex: 0 0 ${c.width}px; width:${c.width}px; background:${bg}; cursor:pointer;
                        display:flex; flex-wrap:nowrap; align-items:flex-start; padding:8px 6px; box-sizing:border-box;
                        border-right: 3px solid rgba(30,41,59,0.35); overflow:visible; transition: box-shadow 0.15s;">
                ${playHintHtml}${wordsHtml || '<span style="color:#9ca3af;font-size:0.8rem;">（無內容）</span>'}
            </div>
        `;
    }).join('');
}

/**
 * 💡 統計整段錄音裡，每一種錯誤類別各發生了幾次。
 *    用於按鈕文字後面顯示「這個類別總共有幾個字錯」，
 *    避免使用者點了 0 次的類別、畫面完全沒反應，誤以為系統壞了。
 *    「重新開始」這個類別統計時，會把 Repair_Restart 跟 Repair_Replacement 兩種都算進去。
 */
function countErrorsByCategory(alignmentReport) {
    const categoryGroups = {
        repair_repetition: ['repair_repetition'],
        repair_attempt: ['repair_attempt'],
        repair_restart: ['repair_restart', 'repair_replacement'],
        substitutions: ['substitute'],
        deletions: ['delete'],
        insertions: ['insert']
    };
    const counts = { repair_repetition: 0, repair_attempt: 0, repair_restart: 0, substitutions: 0, deletions: 0, insertions: 0 };

    (alignmentReport || []).forEach(item => {
        const cat = (item.Category || item.category || '').toString().toLowerCase();
        for (const key in categoryGroups) {
            if (categoryGroups[key].includes(cat)) {
                counts[key]++;
                break;
            }
        }
    });

    return counts;
}

/**
 * 💡 在目前的排版陣列(layout)裡，找出「第一個」包含指定錯誤類別的位置索引(i)。
 *    找不到就回傳 -1。用來實現「點擊錯誤類別 → 自動跳到第一個命中的錯誤」。
 */
function findFirstErrorLayoutIndex(layout, errorType) {
    const targetCategoryMap = {
        'repair_repetition': ['repair_repetition'],
        'repair_attempt': ['repair_attempt'],
        'repair_restart': ['repair_restart', 'repair_replacement'],
        'substitutions': ['substitute'],
        'deletions': ['delete'],
        'insertions': ['insert'],
        'completeness_combined': ['delete', 'insert', 'substitute'],
        'fluency_wer_combined': ['repair_repetition', 'repair_attempt', 'repair_restart', 'repair_replacement']
    };
    const targets = targetCategoryMap[errorType] || [errorType.toLowerCase()];

    for (let i = 0; i < layout.length; i++) {
        const items = layout[i].items || [];
        const hasMatch = items.some(item => {
            const cat = (item.Category || item.category || '').toString().toLowerCase();
            return targets.includes(cat);
        });
        if (hasMatch) return i;
    }
    return -1;
}

/**
 * 💡 流暢度模式專用：在目前排版陣列裡，找出「第一個」被標記為紅色或黃色的句子(chunk)位置。
 *    優先找紅色（比較嚴重），找不到紅色才找黃色。找不到都回傳 -1。
 */
/**
 * 💡 跟 findFirstErrorLayoutIndex 邏輯一樣，但回傳「全部」命中的位置陣列，
 *    給上一個/下一個箭頭導航用，不是只找第一個就停。
 */
function findAllErrorLayoutIndices(layout, errorType) {
    const targetCategoryMap = {
        'repair_repetition': ['repair_repetition'],
        'repair_attempt': ['repair_attempt'],
        'repair_restart': ['repair_restart', 'repair_replacement'],
        'substitutions': ['substitute'],
        'deletions': ['delete'],
        'insertions': ['insert'],
        'completeness_combined': ['delete', 'insert', 'substitute'],
        'fluency_wer_combined': ['repair_repetition', 'repair_attempt', 'repair_restart', 'repair_replacement']
    };
    const targets = targetCategoryMap[errorType] || [errorType.toLowerCase()];
    const indices = [];

    for (let i = 0; i < layout.length; i++) {
        const items = layout[i].items || [];
        const hasMatch = items.some(item => {
            const cat = (item.Category || item.category || '').toString().toLowerCase();
            return targets.includes(cat);
        });
        if (hasMatch) indices.push(i);
    }
    return indices;
}

/**
 * 💡 流暢度模式專用：找出「全部」被標記為黃/紅的句子位置（每句只算一次，用該句第一個字代表）。
 */
function findAllFlaggedSentenceIndices(layout, chunkFluencyMap) {
    if (!chunkFluencyMap) return [];
    const seenChunks = new Set();
    const indices = [];
    for (let i = 0; i < layout.length; i++) {
        const chunkIdx = layout[i].chunkIndex;
        if (seenChunks.has(chunkIdx)) continue;
        const status = (chunkFluencyMap[chunkIdx] || {}).status;
        if (status === 'red' || status === 'yellow') {
            indices.push(i);
            seenChunks.add(chunkIdx);
        }
    }
    return indices;
}

function findFirstFlaggedSentenceIndex(layout, chunkFluencyMap) {
    if (!chunkFluencyMap) return -1;
    let firstYellow = -1;
    for (let i = 0; i < layout.length; i++) {
        const status = (chunkFluencyMap[layout[i].chunkIndex] || {}).status;
        if (status === 'red') return i;
        if (status === 'yellow' && firstYellow === -1) firstYellow = i;
    }
    return firstYellow;
}

// ══════════════════════════════════════════════════
//  🗣️ 逐句「點擊 TTS 朗讀正確版本」— 只在流暢度模式下才會觸發，不顯示提示文字
// ══════════════════════════════════════════════════
/**
 * 💡 把某個 chunkIndex 所有字的「正確課文(Reference)」依序接起來，組成完整的正確句子，
 *    給 TTS 唸出來，讓小朋友聽到正確的示範發音（不是唸使用者念錯的內容）。
 */
function buildReferenceSentenceForChunk(layout, chunkIndex) {
    const words = [];
    layout.forEach(entry => {
        if (entry.chunkIndex !== chunkIndex) return;
        (entry.items || []).forEach(item => {
            const ref = (item.Reference || item.reference || '').trim();
            if (ref && ref !== '—' && ref !== '–') words.push(ref);
        });
    });
    return words.join(' ');
}

/**
 * 💡 用繁體中文語音唸出 Ollama 產生的整體回饋文字（節奏流暢度評語 / 發音正確度評語）。
 *    跟 speakSentence() 不同：speakSentence() 是唸英文課文(lang=en-US)，
 *    這個是唸中文評語，語言要設定成 zh-TW。
 */
function getChineseVoice() {
    if (typeof speechSynthesis === 'undefined') return null;
    const voices = speechSynthesis.getVoices() || [];
    if (voices.length === 0) {
        // 語音清單還沒載入完成，掛一次性監聽，下次呼叫就會抓到
        speechSynthesis.onvoiceschanged = () => { speechSynthesis.getVoices(); };
        return null;
    }
    // 💡 優先選 Google 的中文語音（音質通常比作業系統內建的 SAPI 語音自然一點），
    //    找不到才退回任何 zh-TW / zh 開頭的語音。
    return voices.find(v => v.lang === 'zh-TW' && v.name.includes('Google'))
        || voices.find(v => v.lang === 'zh-TW')
        || voices.find(v => (v.lang || '').toLowerCase().startsWith('zh'))
        || null;
}

function getEnglishVoice() {
    if (typeof speechSynthesis === 'undefined') return null;
    const voices = speechSynthesis.getVoices() || [];
    return voices.find(v => v.lang === 'en-US') || voices.find(v => (v.lang || '').toLowerCase().startsWith('en')) || null;
}

/**
 * 💡 核心修正：整段回饋文字常常會是「中文說明 + 『英文原句引用』」混在一起，
 *    如果整句都用同一個中文語音去唸，唸到中間那段英文時，中文語音引擎會用中文腔調
 *    硬拼英文單字，聽起來就會卡卡的、像在一個字一個字唸。
 *
 *    這裡改成：先用「『...』」這個引號抓出裡面包的英文句子，把整段文字拆成一節一節，
 *    中文的部分用中文語音唸、引號裡的英文句子用英文語音唸，兩種語音接力播放，
 *    這樣中英文各自都能唸得自然，不會互相干擾。
 */
function splitFeedbackIntoSegments(text) {
    const segments = [];
    const regex = /『([^』]+)』|「([^」]+)」/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            const zhPart = text.slice(lastIndex, match.index).trim();
            if (zhPart) segments.push({ text: zhPart, lang: 'zh' });
        }
        const quoted = (match[1] || match[2] || '').trim();
        if (quoted) segments.push({ text: quoted, lang: 'en' });
        lastIndex = regex.lastIndex;
    }
    const rest = text.slice(lastIndex).trim();
    if (rest) segments.push({ text: rest, lang: 'zh' });

    return segments.length ? segments : [{ text, lang: 'zh' }];
}

// 💡 「播放批次代號」：評語是一段一段輪流唸的，每唸完一段會排下一段。
//    按叉叉／點浮框外／切換分類要停止時，光呼叫 speechSynthesis.cancel() 不夠——
//    取消當下那段會觸發它的 onend/onerror，反而又排了下一段去唸（叉叉按了還會繼續唸）。
//    所以用這個遞增代號：一旦停止就把代號 +1，讓任何排程中的下一段自動失效。
let _feedbackSpeechToken = 0;

function stopChineseFeedback() {
    _feedbackSpeechToken++;   // 讓任何還在排隊的 speakNext 立刻作廢
    if (typeof speechSynthesis !== 'undefined') {
        // 💡 Chrome 在「暫停中」呼叫 cancel() 有時停不乾淨，先 resume 再 cancel 比較保險
        try { if (speechSynthesis.paused) speechSynthesis.resume(); } catch (e) {}
        speechSynthesis.cancel();
    }
}
// 💡 曝露到全域，讓 HTML 上任何「關閉視窗／返回」按鈕都能直接呼叫 window.stopChineseFeedback()
window.stopChineseFeedback = stopChineseFeedback;

/**
 * 💡 統一的「關閉評語浮框」動作：把浮框藏起來 + 徹底停止朗讀。
 *    任何關閉入口（浮框叉叉、點浮框外、切換步驟、關閉評分視窗）都走這裡，行為才會一致。
 */
function closeCategoryFeedbackPopup() {
    const popup = document.getElementById('category-feedback-popup');
    if (popup) popup.style.display = 'none';
    stopChineseFeedback();
}
window.closeCategoryFeedbackPopup = closeCategoryFeedbackPopup;

function speakChineseFeedback(text, onEndCallback) {
    if (!text || !text.trim()) {
        if (onEndCallback) onEndCallback();
        return;
    }
    // 💡 開一個新的播放批次：先讓先前批次全部作廢，再清掉舊佇列
    const myToken = ++_feedbackSpeechToken;
    speechSynthesis.cancel();

    const segments = splitFeedbackIntoSegments(text);
    const zhVoice = getChineseVoice();
    const enVoice = getEnglishVoice();

    let idx = 0;
    function speakNext() {
        // 💡 若中途被停止（按叉叉/點外面/切換），或又有新的播放開始，
        //    myToken 就不再是最新的 → 立刻停手，不再唸下一段。
        if (myToken !== _feedbackSpeechToken) return;
        if (idx >= segments.length) {
            if (onEndCallback) onEndCallback();
            return;
        }
        const seg = segments[idx];
        idx++;

        const utt = new SpeechSynthesisUtterance(seg.text);
        if (seg.lang === 'en') {
            utt.lang = 'en-US';
            if (enVoice) utt.voice = enVoice;
            utt.rate = 0.95;
        } else {
            utt.lang = 'zh-TW';
            if (zhVoice) utt.voice = zhVoice;
            utt.rate = 0.92; // 💡 比 1.0 稍慢一點，聽起來比較像自然講話，不會像在逐字念
        }
        utt.pitch = 1;

        // 💡 排下一段前也要確認批次還是最新的，否則被取消時 onend/onerror 會又接著唸
        utt.onend = () => { if (myToken === _feedbackSpeechToken) setTimeout(speakNext, 50); };
        utt.onerror = () => { if (myToken === _feedbackSpeechToken) setTimeout(speakNext, 50); };

        speechSynthesis.speak(utt);
    }

    setTimeout(() => { if (myToken === _feedbackSpeechToken) speakNext(); }, 60);
}

// ══════════════════════════════════════════════════
//  🔊 點紅字聽正確發音（純 TTS，不用問 Ollama）
// ══════════════════════════════════════════════════
window.speakEnglishWord = function(word) {
    if (!word) return;
    if (speechSynthesis.speaking) speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(word);
    utt.lang = 'en-US';
    const voices = speechSynthesis.getVoices() || [];
    const voice = voices.find(v => v.lang === 'en-US');
    if (voice) utt.voice = voice;
    utt.rate = 0.85;
    setTimeout(() => speechSynthesis.speak(utt), 60);
};

// ══════════════════════════════════════════════════
//  📖 點擊黑色正確文字：從該字開始往下念到底，再點一次暫停/繼續
// ══════════════════════════════════════════════════
// 💡 記錄「目前是哪個小工具、從第幾個字開始」在朗讀，
//    因為 Web Speech API 全域只有一個播放佇列，用這個物件判斷
//    使用者是點了「同一個起點」（該暫停/繼續）還是「新的起點」（該重新開始念）。
let currentReadSession = null; // { stripId, startIndex }

/**
 * 💡 把 layout 陣列裡，從 startIndex 開始到最後一個字為止的所有「正確課文(Reference)」接起來。
 */
function buildReferenceTextFromIndex(layout, startIndex) {
    const words = [];
    for (let i = startIndex; i < layout.length; i++) {
        (layout[i].items || []).forEach(item => {
            const ref = (item.Reference || item.reference || '').trim();
            if (ref && ref !== '—' && ref !== '–') words.push(ref);
        });
    }
    return words.join(' ');
}

window.toggleReadFromWord = function(stripId, layout, wordIndex) {
    const isSameSession = currentReadSession
        && currentReadSession.stripId === stripId
        && currentReadSession.startIndex === wordIndex;

    // 💡 點的是「同一個起點」而且現在還在講：切換暫停/繼續，不要重新開始念
    if (isSameSession && speechSynthesis.speaking) {
        if (speechSynthesis.paused) {
            speechSynthesis.resume();
        } else {
            speechSynthesis.pause();
        }
        return;
    }

    // 💡 點的是新的起點（或目前沒在念）：從這個字開始重新往下念到底
    speechSynthesis.cancel();
    const textToRead = buildReferenceTextFromIndex(layout, wordIndex);
    if (!textToRead) return;

    currentReadSession = { stripId, startIndex: wordIndex };
    setTimeout(() => {
        if (typeof speakSentence === 'function') speakSentence(textToRead);
    }, 60);
};

// ══════════════════════════════════════════════════
//  💬 點紅字看「音節拆解教學提示」— 即時跟後端要，不預先產生
// ══════════════════════════════════════════════════
/**
 * 💡 點擊一個紅字錯誤時呼叫：即時打 /get_word_pronunciation_tip，
 *    請 Ollama 根據這個字的音節拆分，生成一句 20 字以內的繁體中文教學提示，
 *    用一個小泡泡顯示在那個字下方；點擊泡泡文字會用 TTS 唸出這句提示。
 */
window.showWordPronunciationTip = async function(el) {
    // 先清掉畫面上其他還開著的提示泡泡，同一時間只顯示一個
    document.querySelectorAll('.word-tip-bubble').forEach(b => b.remove());

    const ref = el.dataset.ref || '';
    const hyp = el.dataset.hyp || '';
    const cat = el.dataset.cat || '';
    if (!ref) return;

    const bubble = document.createElement('div');
    bubble.className = 'word-tip-bubble';
    bubble.style.cssText = 'position:absolute; top:100%; left:50%; transform:translateX(-50%); margin-top:4px; ' +
        'background:#1f2937; color:#fff; padding:6px 10px; border-radius:8px; font-size:0.75rem; white-space:nowrap; ' +
        'z-index:30; cursor:pointer; box-shadow:0 4px 10px rgba(0,0,0,0.25);';
    bubble.textContent = '教練思考中…';
    el.appendChild(bubble);

    try {
        const resp = await fetch('/get_word_pronunciation_tip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference: ref, hypothesis: hyp, category: cat })
        });
        const data = await resp.json();
        if (data.status === 'success' && data.tip) {
            bubble.textContent = data.tip + ' 🔊';
            bubble.dataset.tipText = data.tip;
            bubble.onclick = (ev) => {
                ev.stopPropagation();
                speakChineseFeedback(bubble.dataset.tipText);
            };
        } else {
            bubble.textContent = '暫時無法取得提示';
        }
    } catch (err) {
        bubble.textContent = '連線失敗，稍後再試';
    }
};

// 💡 點擊提示泡泡以外的地方，自動關掉泡泡
document.addEventListener('click', (e) => {
    if (e.target.closest('.word-tip-bubble') || e.target.closest('.wer-error-word-badge')) return;
    document.querySelectorAll('.word-tip-bubble').forEach(b => b.remove());
});

// ══════════════════════════════════════════════════
//  📋 點擊「完整度/準確度/流利度」標籤 → 右側浮框顯示該分項 LLM 評語 + TTS
// ══════════════════════════════════════════════════
/**
 * 💡 把 0-10 的流暢度分數換算成「初級/中級/高級」等級文字。
 *    這個判斷邏輯要跟後端 app.py 的 score_to_fluency_tier() 保持完全一致：
 *    低於 5 分 = 初級 / 5~8 分 = 中級 / 高於 8 分 = 高級。
 *    等級完全由分數落在哪個區間反推，後端不會另外存等級欄位。
 */
function scoreToFluencyTierLabel(score) {
    if (score == null || isNaN(score)) return '';
    if (score < 5) return { text: '初級', color: '#dc2626' };
    if (score <= 8) return { text: '中級', color: '#d97706' };
    return { text: '高級', color: '#16a34a' };
}

function ensureCategoryFeedbackPopup() {
    let popup = document.getElementById('category-feedback-popup');
    if (popup) return popup;

    popup = document.createElement('div');
    popup.id = 'category-feedback-popup';
    popup.style.cssText = 'display:none; position:fixed; top:90px; right:24px; width:320px; max-width:88vw; ' +
        'background:#fff; border:2px solid #e2e8f0; border-radius:14px; box-shadow:0 10px 30px rgba(0,0,0,0.18); ' +
        'padding:18px; z-index:9999;';
    popup.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span id="category-feedback-title" style="font-weight:bold; font-size:1rem; color:#1f2937;"></span>
                <span id="category-feedback-score" style="font-size:0.8rem; font-weight:bold; color:#fff; background:#64748b; padding:2px 10px; border-radius:12px; display:none;"></span>
            </div>
            <span id="category-feedback-close" style="cursor:pointer; font-size:1.3rem; color:#94a3b8; line-height:1;">✕</span>
        </div>
        <div id="category-feedback-text" style="font-size:0.85rem; color:#334155; line-height:1.7; margin-bottom:14px;"></div>
        <div style="display:flex; gap:14px; align-items:center;">
            <span id="category-feedback-pause" style="cursor:pointer; font-size:1.3rem; display:none;" title="暫停/繼續">⏸</span>
            <span id="category-feedback-replay" style="cursor:pointer; font-size:1.3rem; display:none;" title="重播">🔁</span>
        </div>
    `;
    document.body.appendChild(popup);

    const closeBtn = document.getElementById('category-feedback-close');
    const pauseIcon = document.getElementById('category-feedback-pause');
    const replayIcon = document.getElementById('category-feedback-replay');

    closeBtn.onclick = () => {
        closeCategoryFeedbackPopup();   // 💡 按右上角叉叉：關閉浮框 + 徹底停止評語朗讀
    };
    pauseIcon.onclick = () => {
        if (!speechSynthesis.speaking) return;
        if (speechSynthesis.paused) {
            speechSynthesis.resume();
            pauseIcon.textContent = '⏸';
        } else {
            speechSynthesis.pause();
            pauseIcon.textContent = '▶';
        }
    };
    replayIcon.onclick = () => {
        const text = popup.dataset.lastText || '';
        if (!text) return;
        replayIcon.style.display = 'none';
        pauseIcon.style.display = 'inline';
        pauseIcon.textContent = '⏸';
        speakChineseFeedback(text, () => {
            pauseIcon.style.display = 'none';
            replayIcon.style.display = 'inline';
        });
    };

    // 💡 點浮框外面的任意地方就關閉（點觸發浮框的標籤本身除外，避免跟它自己的 onclick 打架）
    document.addEventListener('click', (e) => {
        if (popup.style.display === 'none') return;
        if (popup.contains(e.target)) return;
        if (e.target.closest('.category-label-clickable')) return;
        closeCategoryFeedbackPopup();   // 💡 點浮框外關閉時，評語也要一併停止
    });

    // 💡 最強保險：只要這個浮框被「任何方式」隱藏（不管是哪顆關閉/返回按鈕，
    //    或別的程式把它 display:none），就自動停止朗讀。這樣就算關閉入口不在這支檔案裡，
    //    只要它讓浮框消失，Ollama 評語也一定會跟著停。
    let _popupWasVisible = false;
    new MutationObserver(() => {
        const visible = popup.style.display !== 'none' && document.body.contains(popup);
        if (_popupWasVisible && !visible) {
            stopChineseFeedback();   // 由「顯示」變成「隱藏」的那一刻 → 停止朗讀
        }
        _popupWasVisible = visible;
    }).observe(popup, { attributes: true, attributeFilter: ['style'] });

    return popup;
}

window.showCategoryFeedback = function(title, text, scoreText, scoreColor) {
    const popup = ensureCategoryFeedbackPopup();
    document.getElementById('category-feedback-title').textContent = title;
    document.getElementById('category-feedback-text').textContent = text && text.trim() ? text : '（這個面向目前沒有回饋內容）';
    popup.dataset.lastText = text || '';
    popup.style.display = 'block';

    const scoreEl = document.getElementById('category-feedback-score');
    if (scoreEl) {
        if (scoreText) {
            scoreEl.textContent = scoreText;
            scoreEl.style.background = scoreColor || '#64748b';  // 💡 有等級顏色就用等級色，沒有就用預設灰色
            scoreEl.style.display = 'inline-block';
        } else {
            scoreEl.style.display = 'none';
        }
    }

    const pauseIcon = document.getElementById('category-feedback-pause');
    const replayIcon = document.getElementById('category-feedback-replay');
    pauseIcon.style.display = 'none';
    replayIcon.style.display = 'none';
    pauseIcon.textContent = '⏸';

    if (text && text.trim()) {
        pauseIcon.style.display = 'inline';
        speakChineseFeedback(text, () => {
            pauseIcon.style.display = 'none';
            replayIcon.style.display = 'inline';
        });
    }
};

/** 💡 從按鈕的 stripId 讀取對應分項評語文字 + 分數，開啟浮框 */
window.openCategoryFeedbackForStrip = function(stripId, category) {
    const widget = document.getElementById(`${stripId}-chunkwidget`);
    if (!widget) return;

    const fluencyScoreNum = widget.dataset.fluencyScore100 ? parseFloat(widget.dataset.fluencyScore100) : null;
    const fluencyTier = scoreToFluencyTierLabel(fluencyScoreNum);

    const map = {
        fluency: {
            title: '🎯 口語流暢度評語',
            text: widget.dataset.fluencyFeedback || '',
            score: fluencyTier ? fluencyTier.text : '',
            scoreColor: fluencyTier ? fluencyTier.color : null,
            filterCategory: 'fluency'   // 💡 口語流暢度：沿用句子層級的黃/紅標色 + 跳轉
        },
        completeness: {
            title: '📋 發音完整度評語',
            text: widget.dataset.completenessFeedback || '',
            score: widget.dataset.scoreCompleteness ? `${parseFloat(widget.dataset.scoreCompleteness).toFixed(1)}/5` : '',
            filterCategory: 'completeness_combined'   // 💡 一次標色：刪除+插入+替換
        },
        accuracy: {
            title: '📋 發音準確度評語',
            text: widget.dataset.accuracyFeedback || '',
            score: widget.dataset.scoreAccuracy ? `${parseFloat(widget.dataset.scoreAccuracy).toFixed(1)}/5` : '',
            filterCategory: null   // 💡 準確度故意不做任何標色，只顯示評語+TTS
        },
        fluency_wer: {
            title: '📋 口說流利度評語',
            text: widget.dataset.werFluencyFeedback || '',
            score: widget.dataset.scoreFluencyWer ? `${parseFloat(widget.dataset.scoreFluencyWer).toFixed(1)}/5` : '',
            filterCategory: 'fluency_wer_combined'   // 💡 一次標色：重複+嘗試修正+重新開始
        }
    };
    const item = map[category];
    if (!item) return;

    // 💡 先觸發標色/跳轉（準確度傳 null，代表清掉標色只顯示原本樣式），再打開評語浮框
    window.switchWerFilterChunked(null, item.filterCategory, stripId);
    window.showCategoryFeedback(item.title, item.text, item.score, item.scoreColor);
};

/**
 * 💡 建立完整的「WaveSurfer 波形(疊加一深一淺色塊做分段) + 逐字稿對照 + 篩選按鈕」小工具 HTML。
 *    chunks 直接用 extendedReport.chunk_details（NPVI 回傳的 chunk_results，含 xmin/xmax/label）。
 */
function buildChunkedAudioBlock(stripId, chunks, alignmentReport, rawAudioUrl, wordTimings, sentenceFluency, fluencyFeedbackText, completenessFeedbackText, accuracyFeedbackText, werFluencyFeedbackText, fluencyScore100, scoreCompleteness, scoreAccuracy, scoreFluencyWer, originalParagraphs) {
    const WORD_SLOT_WIDTH = 50;  // 每個字（含上下兩行）大約需要的寬度
    const MIN_PX_PER_SEC = 60;   // 每秒最少像素，避免音檔很長、字很少時比例被拉得太小

    // 💡 核心修改：優先用真正的逐字時間戳（TextGrid words tier）做逐字對齊，
    //    只有拿不到逐字時間戳的情況（例如同學那邊沒回傳、或退回自己組的備援 TextGrid），
    //    才退回用 NPVI 的 chunk_results 做「用字數比例分配」的近似對齊。
    const hasWordTimings = Array.isArray(wordTimings) && wordTimings.length > 0;
    const sortedChunks = [...(chunks || [])].sort((a, b) => (a.xmin || 0) - (b.xmin || 0));

    // 💡 建立「這句話(chunkIndex) → 完整流暢度判定物件」對照表（含 npvi_direction/varco_direction/差距等）。
    //    後端 compute_sentence_fluency_status() 是依 xmin 排序後用陣列位置當 chunk_index，
    //    跟這裡 sortedChunks 的排序方式完全一致，兩邊的索引才能直接對應。
    const chunkFluencyMap = {};
    (sentenceFluency || []).forEach(sf => {
        chunkFluencyMap[sf.chunk_index] = sf;
    });
    const fluencyFlaggedCount = (sentenceFluency || []).filter(sf => sf.status === 'yellow' || sf.status === 'red').length;

    let grouped = hasWordTimings
        ? assignItemsToWords(wordTimings, alignmentReport)
        : assignItemsToChunks(chunks, alignmentReport);

    // 💡 位置用逐字對齊（精準），顏色分組用句子分段（不要每個字一個顏色）
    grouped = hasWordTimings
        ? assignChunkIndices(grouped, sortedChunks)
        : grouped.map((c, i) => ({ ...c, chunkIndex: i }));

    // 💡 先算出每個分段的文字排成「一整排、不換行」實際需要多寬，
    //    再反推「這一段每秒至少要有多少像素」，取全部分段裡最吃緊的那一個，
    //    當作整個波形統一放大的基準比例——這樣波形會被拉長到剛好能讓文字都排成一排，
    //    而不是文字被硬擠到跟波形一樣窄。這個基準比例對應縮放滑桿的 100%。
    let basePxPerSec = MIN_PX_PER_SEC;
    grouped.forEach((c) => {
        const duration = Math.max((c.xmax || 0) - (c.xmin || 0), 0.1);
        const wordCount = Math.max((c.items || []).length, 1);
        const neededWidth = wordCount * WORD_SLOT_WIDTH + 20;
        const neededPxPerSec = neededWidth / duration;
        if (neededPxPerSec > basePxPerSec) basePxPerSec = neededPxPerSec;
    });

    const layout = computeLayout(grouped, basePxPerSec);
    const transcriptHtml = renderChunkTranscriptRow(layout, null);

    // 💡 整篇模式專用：估算每個「原始段落」在這份逐字對齊結果裡，是從哪個字開始的，
    //    供下方的「跳到下一段開頭」箭頭使用。做法：依序累計每個字的正確課文(Reference)字數，
    //    累計到達某段落的字數時，就代表換下一段了，記錄那個位置。
    //    這只是用字數比對的估算，不是 100% 精準對齊到逐字，但已經足夠讓使用者快速跳到大概的段落起點。
    let paragraphStartIndices = [];
    if (Array.isArray(originalParagraphs) && originalParagraphs.length > 1) {
        let paraPtr = 0;
        let wordsIntoCurrentPara = 0;
        let targetWordCount = (originalParagraphs[0] || '').trim().split(/\s+/).filter(Boolean).length;
        paragraphStartIndices.push(0);

        for (let i = 0; i < layout.length && paraPtr < originalParagraphs.length - 1; i++) {
            const realWordCount = (layout[i].items || []).filter(item => {
                const ref = (item.Reference || item.reference || '').trim();
                return ref && ref !== '—' && ref !== '–';
            }).length;
            wordsIntoCurrentPara += realWordCount;

            if (wordsIntoCurrentPara >= targetWordCount) {
                paraPtr++;
                if (paraPtr < originalParagraphs.length) {
                    paragraphStartIndices.push(Math.min(i + 1, layout.length - 1));
                    targetWordCount = (originalParagraphs[paraPtr] || '').trim().split(/\s+/).filter(Boolean).length;
                    wordsIntoCurrentPara = 0;
                }
            }
        }
    }

    const layoutJson = JSON.stringify(layout).replace(/'/g, "&apos;");
    // 💡 存一份「還沒換算成像素位置」的原始分組資料，縮放滑桿拉動時要用這份資料重新計算，
    //    不能直接拿 layout（那是已經用 basePxPerSec 算好位置的結果）去等比縮放，
    //    不然每次縮放都會累積誤差。
    const rawGroupsJson = JSON.stringify(grouped.map(c => ({
        xmin: c.xmin, xmax: c.xmax, label: c.label, chunkIndex: c.chunkIndex, items: c.items
    }))).replace(/'/g, "&apos;");
    // 💡 波形上疊加色塊維持用「句子分段」的起訖時間，跟逐字對齊的位置分開處理
    const chunkTimesJson = JSON.stringify(sortedChunks.map(c => ({ xmin: c.xmin, xmax: c.xmax }))).replace(/'/g, "&apos;");

    // 💡 核心修正：算出一個明確固定的總寬度（像素），直接指定給容器，
    //    不要再用 min-width:100% 這種「跟父層寬度綁定」的寫法——
    //    那種寫法會在「捲軸出現/消失造成可視寬度改變」時，
    //    跟波形實際內容寬度互相牽動，形成版面量測迴圈，畫面就會一直左右跳動。
    const totalDurationSec = layout.length ? Math.max(...layout.map(l => l.xmax || 0)) : 0;
    const totalWidthPx = Math.max(Math.ceil(totalDurationSec * basePxPerSec) + 20, 200);

    let cleanAudioUrl = rawAudioUrl || '';
    if (cleanAudioUrl && !cleanAudioUrl.startsWith('/') && !cleanAudioUrl.startsWith('http')) cleanAudioUrl = '/' + cleanAudioUrl;
    if (cleanAudioUrl) cleanAudioUrl += (cleanAudioUrl.includes('?') ? '&' : '?') + 't=' + Date.now();

    const errorCounts = countErrorsByCategory(alignmentReport);

    // 💡 新增：算出每個標籤要顯示的「(錯誤數/總數)」，讓使用者知道大概有幾個問題
    const totalRefWords = (alignmentReport || []).filter(item => {
        const cat = (item.Category || item.category || '').toString().toLowerCase();
        return cat !== 'insert'; // insert 是多念出來的字，本來就不對應任何一個課文原字，不算進總字數
    }).length;
    const completenessErrCount = errorCounts.deletions + errorCounts.insertions + errorCounts.substitutions;
    const accuracyErrCount = errorCounts.substitutions;
    const fluencyWerErrCount = errorCounts.repair_repetition + errorCounts.repair_attempt + errorCounts.repair_restart;
    const totalSentenceCount = (sentenceFluency || []).length;

    return `
        <div class="chunk-audio-widget" id="${stripId}-chunkwidget"
             data-layout='${layoutJson}' data-raw-groups='${rawGroupsJson}' data-chunks='${chunkTimesJson}'
             data-audio-url="${cleanAudioUrl}" data-base-px-per-sec="${basePxPerSec}" data-active-category=""
             data-chunk-fluency='${JSON.stringify(chunkFluencyMap).replace(/'/g, "&apos;")}'
             data-fluency-feedback="${(fluencyFeedbackText || '').replace(/"/g, '&quot;')}"
             data-completeness-feedback="${(completenessFeedbackText || '').replace(/"/g, '&quot;')}"
             data-accuracy-feedback="${(accuracyFeedbackText || '').replace(/"/g, '&quot;')}"
             data-wer-fluency-feedback="${(werFluencyFeedbackText || '').replace(/"/g, '&quot;')}"
             data-fluency-score100="${fluencyScore100 != null ? fluencyScore100 : ''}"
             data-score-completeness="${scoreCompleteness != null ? scoreCompleteness : ''}"
             data-score-accuracy="${scoreAccuracy != null ? scoreAccuracy : ''}"
             data-score-fluency-wer="${scoreFluencyWer != null ? scoreFluencyWer : ''}"
             data-paragraph-starts='${JSON.stringify(paragraphStartIndices)}'>
            <div style="font-size: 0.9rem; font-weight: bold; color: #475569; margin-bottom: 8px;">
                🎵 錄音回放
            </div>

            <div style="display:flex; flex-direction:column; gap:10px; margin-bottom: 10px;">
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <button id="${stripId}-playbtn" type="button" style="padding:6px 16px; border:none; background:#e63946; color:#fff; border-radius:20px; font-weight:bold; cursor:pointer; font-size:0.85rem; white-space:nowrap;">▶ 播放</button>
                

                <!-- 💡 整篇模式專用：跳到上一段/下一段開頭，方便在整篇錄音裡快速定位到原本文章的段落分界。
                     沒有段落分界資料時（分段模式）JS 會自動隱藏這個按鈕組。 -->
                <div id="${stripId}-paragraph-nav" style="display:none; align-items:center; gap:6px; padding:4px 10px; background:#f1f5f9; border-radius:20px;">
                    <span onclick="window.navToParagraph('${stripId}', -1)" title="上一段開頭" style="cursor:pointer; font-size:1rem; color:#475569; font-weight:bold; user-select:none;">⏮</span>
                    <span id="${stripId}-paragraph-counter" style="font-size:0.78rem; color:#475569; font-weight:bold; white-space:nowrap;"></span>
                    <span onclick="window.navToParagraph('${stripId}', 1)" title="下一段開頭" style="cursor:pointer; font-size:1rem; color:#475569; font-weight:bold; user-select:none;">⏭</span>
                </div>

                </div>
                <!-- 第二列：四個指標按鈕（桌面一排、手機 2×2；由 .metric-chip-grid 控制） -->
                <div class="metric-chip-grid" style="display:flex; flex-wrap:wrap; gap:8px;">
                <!-- 💡 發音完整度 ... -->

                <!-- 💡 發音完整度：底層的刪除/插入/替換按鈕隱藏起來（不對外呈現計分細節），
                     標籤點擊後會一次觸發「刪除+插入+替換」三種錯誤的標色與跳轉，同時顯示 LLM 評語+TTS。 -->
                <div style="border:2px solid #16a34a; border-radius:10px; padding:6px 14px; background:#f0fdf4;">
                    <span class="category-label-clickable" onclick="window.openCategoryFeedbackForStrip('${stripId}','completeness')" style="font-size:0.85rem; font-weight:bold; color:#16a34a; text-align:center; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:2px; flex-wrap:wrap;">發音完整度<span style="font-size:0.7rem; font-weight:normal;">(${completenessErrCount}/${totalRefWords})</span><span style="font-size:0.7rem;">👆</span></span>
                    <div style="display:none;">
                        <button class="wer-filter-btn-chunked" data-original-bg="#fff" data-original-color="#16a34a" onclick="window.switchWerFilterChunked(this, 'deletions', '${stripId}')" style="padding: 5px 12px; border:none; background: #fff; color: #16a34a; border-radius: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size:0.85rem;">刪除 (${errorCounts.deletions})</button>
                        <button class="wer-filter-btn-chunked" data-original-bg="#fff" data-original-color="#16a34a" onclick="window.switchWerFilterChunked(this, 'insertions', '${stripId}')" style="padding: 5px 12px; border:none; background: #fff; color: #16a34a; border-radius: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size:0.85rem;">插入 (${errorCounts.insertions})</button>
                        <button class="wer-filter-btn-chunked" data-original-bg="#fff" data-original-color="#16a34a" onclick="window.switchWerFilterChunked(this, 'substitutions', '${stripId}')" style="padding: 5px 12px; border:none; background: #fff; color: #16a34a; border-radius: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size:0.85rem;">替換 (${errorCounts.substitutions})</button>
                    </div>
                </div>

                <!-- 💡 發音準確度：不做任何文字標色/跳轉，純粹只顯示 LLM 評語 + TTS -->
                <div style="border:2px solid #2563eb; border-radius:10px; padding:6px 14px; background:#eff6ff;">
                    <span class="category-label-clickable" onclick="window.openCategoryFeedbackForStrip('${stripId}','accuracy')" style="font-size:0.85rem; font-weight:bold; color:#2563eb; text-align:center; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:2px; flex-wrap:wrap;">發音準確度<span style="font-size:0.7rem; font-weight:normal;">(${accuracyErrCount}/${totalRefWords})</span><span style="font-size:0.7rem;">👆</span></span>
                </div>

                <!-- 💡 口說流利度：底層的重複/嘗試修正/重新開始按鈕隱藏起來，
                     標籤點擊後一次觸發三種行為的標色與跳轉，同時顯示 LLM 評語+TTS。 -->
                <div style="border:2px solid #d97706; border-radius:10px; padding:6px 14px; background:#fffbeb;">
                    <span class="category-label-clickable" onclick="window.openCategoryFeedbackForStrip('${stripId}','fluency_wer')" style="font-size:0.85rem; font-weight:bold; color:#d97706; text-align:center; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:2px; flex-wrap:wrap;">口說流利度<span style="font-size:0.7rem; font-weight:normal;">(${fluencyWerErrCount}/${totalRefWords})</span><span style="font-size:0.7rem;">👆</span></span>
                    <div style="display:none;">
                        <button class="wer-filter-btn-chunked" data-original-bg="#fff" data-original-color="#d97706" onclick="window.switchWerFilterChunked(this, 'repair_repetition', '${stripId}')" style="padding: 5px 12px; border:none; background: #fff; color: #d97706; border-radius: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size:0.85rem;">重複 (${errorCounts.repair_repetition})</button>
                        <button class="wer-filter-btn-chunked" data-original-bg="#fff" data-original-color="#d97706" onclick="window.switchWerFilterChunked(this, 'repair_attempt', '${stripId}')" style="padding: 5px 12px; border:none; background: #fff; color: #d97706; border-radius: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size:0.85rem;">嘗試修正 (${errorCounts.repair_attempt})</button>
                        <button class="wer-filter-btn-chunked" data-original-bg="#fff" data-original-color="#d97706" onclick="window.switchWerFilterChunked(this, 'repair_restart', '${stripId}')" style="padding: 5px 12px; border:none; background: #fff; color: #d97706; border-radius: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size:0.85rem;">重新開始 (${errorCounts.repair_restart})</button>
                    </div>
                </div>

                

                <!-- 💡 口語流暢度：底層的「流暢度」按鈕隱藏起來，標籤點擊後觸發句子層級標色/跳轉 + LLM 評語+TTS。 -->
                <div style="border:2px solid #9333ea; border-radius:10px; padding:6px 14px; background:#faf5ff;">
                    <span class="category-label-clickable" onclick="window.openCategoryFeedbackForStrip('${stripId}','fluency')" style="font-size:0.85rem; font-weight:bold; color:#9333ea; text-align:center; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:2px; flex-wrap:wrap;">口語流暢度<span style="font-size:0.7rem; font-weight:normal;">(${fluencyFlaggedCount}/${totalSentenceCount})</span><span style="font-size:0.7rem;">👆</span></span>
                    <div style="display:none;">
                        <button class="wer-filter-btn-chunked" data-original-bg="#fff" data-original-color="#9333ea" onclick="window.switchWerFilterChunked(this, 'fluency', '${stripId}')" style="padding: 5px 12px; border:none; background: #fff; color: #9333ea; border-radius: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size:0.85rem;">流暢度 (${fluencyFlaggedCount})</button>
                    </div>
                </div>
                </div>
            </div>

            <!-- 💡 上一個/下一個 錯誤跳轉導航，點擊四個色框標籤後才會出現，方便快速在多個問題點之間切換 -->
            <div id="${stripId}-match-nav" style="display:none; align-items:center; gap:12px; margin-bottom: 10px; background:#fef2f2; border:1px solid #fecaca; padding:6px 14px; border-radius:20px; width:fit-content;">
                <span onclick="window.navToMatch('${stripId}', -1)" title="上一個" style="cursor:pointer; font-size:1.1rem; color:#dc2626; font-weight:bold; user-select:none;">◀</span>
                <span id="${stripId}-match-counter" style="font-size:0.8rem; color:#7f1d1d; font-weight:bold; white-space:nowrap;"></span>
                <span onclick="window.navToMatch('${stripId}', 1)" title="下一個" style="cursor:pointer; font-size:1.1rem; color:#dc2626; font-weight:bold; user-select:none;">▶</span>
            </div>

            <div style="display:flex; align-items:center; gap:10px; margin-bottom: 10px; flex-wrap: wrap;">
                <span style="font-size:0.8rem; color:#64748b; white-space:nowrap;">🔍 縮放：</span>
                <span style="font-size:0.8rem; color:#64748b;">縮小</span>
                <input type="range" id="${stripId}-zoom" min="0.2" max="3" step="0.1" value="1" style="flex:1; min-width:120px; max-width:280px;">
                <span style="font-size:0.8rem; color:#64748b;">放大</span>
                <span id="${stripId}-zoom-label" style="font-size:0.8rem; color:#475569; font-weight:bold; min-width:40px;">100%</span>
            </div>

            <!-- 💡 波形與逐字稿現在共用同一個捲動容器，左右拖曳一次同時帶動兩者。
                 寬度用明確算好的固定像素值，不用 min-width:100%，避免版面量測迴圈造成跳動。 -->
            <div id="${stripId}-scrollwrap" style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; cursor: grab;">
                <div id="${stripId}-scrollarea" style="width: ${totalWidthPx}px;">
                    <div id="${stripId}-waveform" style="width: ${totalWidthPx}px; padding: 10px 10px 0 10px; box-sizing: border-box;"></div>
                    <div id="${stripId}-transcript-wrap" style="position: relative; width: ${totalWidthPx}px;">
                        <div id="${stripId}-transcript" style="display: flex; border-top: 1px solid #e2e8f0;">
                            ${transcriptHtml}
                        </div>
                        <div id="${stripId}-transcript-playhead" style="position: absolute; top: 0; bottom: 0; width: 2px; background: #e63946; left: 0; pointer-events: none;"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/** 💡 點擊錯誤類別按鈕：只重繪逐字稿列，波形跟播放狀態維持不動 */
/** 💡 上一個/下一個 錯誤跳轉：direction 傳 -1 是上一個，1 是下一個，會循環（最後一個按下一個回到第一個） */
/** 💡 整篇模式：跳到上一段/下一段的開頭位置，direction 傳 -1 是上一段，1 是下一段，循環切換 */
window.navToParagraph = function(stripId, direction) {
    const widget = document.getElementById(`${stripId}-chunkwidget`);
    if (!widget) return;

    let paragraphStarts = [];
    try { paragraphStarts = JSON.parse(widget.dataset.paragraphStarts || '[]'); } catch (e) { paragraphStarts = []; }
    if (!paragraphStarts.length) return;

    let pointer = parseInt(widget.dataset.paragraphPointer || '0', 10);
    if (isNaN(pointer)) pointer = 0;
    pointer = (pointer + direction + paragraphStarts.length) % paragraphStarts.length;
    widget.dataset.paragraphPointer = String(pointer);

    let layout = [];
    try { layout = JSON.parse(widget.dataset.layout); } catch (e) { return; }

    const idx = paragraphStarts[pointer];
    const scrollWrap = document.getElementById(`${stripId}-scrollwrap`);
    if (scrollWrap && layout[idx]) {
        const targetLeft = Math.max(layout[idx].left - 60, 0);
        scrollWrap.scrollTo({ left: targetLeft, behavior: 'smooth' });
    }

    const counterEl = document.getElementById(`${stripId}-paragraph-counter`);
    if (counterEl) counterEl.textContent = `第 ${pointer + 1} / ${paragraphStarts.length} 段`;
};

window.navToMatch = function(stripId, direction) {
    const widget = document.getElementById(`${stripId}-chunkwidget`);
    if (!widget) return;

    let indices = [];
    try { indices = JSON.parse(widget.dataset.matchIndices || '[]'); } catch (e) { indices = []; }
    if (!indices.length) return;

    let pointer = parseInt(widget.dataset.matchPointer || '0', 10);
    if (isNaN(pointer)) pointer = 0;
    pointer = (pointer + direction + indices.length) % indices.length;
    widget.dataset.matchPointer = String(pointer);

    let layout = [];
    try { layout = JSON.parse(widget.dataset.layout); } catch (e) { return; }

    const idx = indices[pointer];
    const scrollWrap = document.getElementById(`${stripId}-scrollwrap`);
    if (scrollWrap && layout[idx]) {
        const targetLeft = Math.max(layout[idx].left - 60, 0);
        scrollWrap.scrollTo({ left: targetLeft, behavior: 'smooth' });
    }

    const counterEl = document.getElementById(`${stripId}-match-counter`);
    if (counterEl) counterEl.textContent = `第 ${pointer + 1} / ${indices.length} 個`;
};

window.switchWerFilterChunked = function(btn, errorType, stripId) {
    const widget = document.getElementById(`${stripId}-chunkwidget`);
    if (!widget) return;

    // 💡 btn 現在可能是 null（由「發音完整度」等色框標籤直接觸發，不是點擊底層已隱藏的個別按鈕），
    //    只有真的有傳入 btn 時，才需要更新按鈕本身的選取視覺樣式。
    if (btn) {
        widget.querySelectorAll('.wer-filter-btn-chunked').forEach(b => {
            const originalBg = b.dataset.originalBg || '#f1f5f9';
            const originalColor = b.dataset.originalColor || '#475569';
            b.style.background = originalBg;
            b.style.color = originalColor;
        });
        const activeColor = btn.dataset.originalColor || '#e63946';
        btn.style.background = activeColor;
        btn.style.color = '#fff';
    }

    // 💡 記住目前選取的篩選類別，縮放滑桿重繪逐字稿列時要保留這個篩選狀態
    widget.dataset.activeCategory = errorType || '';

    let layout = [];
    try { layout = JSON.parse(widget.dataset.layout); } catch (e) { return; }

    const isFluencyMode = errorType === 'fluency';
    let chunkFluencyMap = null;
    if (isFluencyMode) {
        try { chunkFluencyMap = JSON.parse(widget.dataset.chunkFluency); } catch (e) { chunkFluencyMap = {}; }
    }

    const transcriptRow = document.getElementById(`${stripId}-transcript`);
    if (transcriptRow) {
        transcriptRow.innerHTML = renderChunkTranscriptRow(layout, errorType || null, chunkFluencyMap);
    }

    const matchNav = document.getElementById(`${stripId}-match-nav`);
    const matchCounter = document.getElementById(`${stripId}-match-counter`);

    // 💡 errorType 是空值（例如「發音準確度」故意不標色，純顯示評語）：
    //    只重繪成無標色的預設樣式，不需要自動捲動、跳提示訊息，也不用顯示上一個/下一個導航列。
    if (errorType) {
        // 💡 算出「全部」命中的位置，存進 widget，讓上一個/下一個箭頭可以在裡面循環切換，
        //    不用每次都只能停在第一個、後面的要自己手動拉捲軸找。
        const allIndices = isFluencyMode
            ? findAllFlaggedSentenceIndices(layout, chunkFluencyMap)
            : findAllErrorLayoutIndices(layout, errorType);

        widget.dataset.matchIndices = JSON.stringify(allIndices);
        widget.dataset.matchPointer = '0';

        const scrollWrap = document.getElementById(`${stripId}-scrollwrap`);
        if (allIndices.length > 0) {
            const targetLeft = Math.max(layout[allIndices[0]].left - 60, 0); // 往前留一點邊界，不要貼死在最左邊
            if (scrollWrap) scrollWrap.scrollTo({ left: targetLeft, behavior: 'smooth' });

            if (matchNav) matchNav.style.display = 'flex';
            if (matchCounter) matchCounter.textContent = `第 1 / ${allIndices.length} 個`;
        } else {
            if (matchNav) matchNav.style.display = 'none';
            showToast(isFluencyMode ? '這份錄音的句子流暢度都合格 🎉' : '這個類別目前沒有任何錯誤 🎉');
        }
    } else {
        if (matchNav) matchNav.style.display = 'none';
        widget.dataset.matchIndices = '[]';
        widget.dataset.matchPointer = '0';
    }

    // 💡 「發音完整度/發音準確度/口說流利度/口語流暢度」四個色框標籤現在同時負責標色+浮框評語+TTS，
    //    切換到任何分類時，如果評語還在播放中，先停掉，避免背景一直放著跟目前畫面對不上。
    if (speechSynthesis.speaking) speechSynthesis.cancel();
};

/**
 * 💡 插入 DOM 後呼叫：用 WaveSurfer.js 畫出真正的錄音波形（跟錄音頁面同一套元件），
 *    播放頭是 WaveSurfer 內建游標，直接畫在波形本體上；
 *    一深一淺的分段色塊改用 WaveSurfer 的 Regions 外掛直接疊在波形上，
 *    不再另外畫一條獨立的時間軸。
 */
function initChunkedAudioBlock(stripId) {
    const widget = document.getElementById(`${stripId}-chunkwidget`);
    const waveformEl = document.getElementById(`${stripId}-waveform`);
    const scrollWrap = document.getElementById(`${stripId}-scrollwrap`);
    const playBtn = document.getElementById(`${stripId}-playbtn`);
    const zoomSlider = document.getElementById(`${stripId}-zoom`);
    const zoomLabel = document.getElementById(`${stripId}-zoom-label`);
    const scrollArea = document.getElementById(`${stripId}-scrollarea`);
    const transcriptWrap = document.getElementById(`${stripId}-transcript-wrap`);
    if (!widget || !waveformEl) return;

    let chunkTimes = [];
    try { chunkTimes = JSON.parse(widget.dataset.chunks); } catch (e) { chunkTimes = []; }
    let rawGroups = [];
    try { rawGroups = JSON.parse(widget.dataset.rawGroups); } catch (e) { rawGroups = []; }
    const audioUrl = widget.dataset.audioUrl || '';
    const basePxPerSec = parseFloat(widget.dataset.basePxPerSec) || 90;

    // 💡 整篇模式：如果有段落分界資料（超過 1 段），顯示「上一段/下一段開頭」導航
    let paragraphStarts = [];
    try { paragraphStarts = JSON.parse(widget.dataset.paragraphStarts || '[]'); } catch (e) { paragraphStarts = []; }
    const paragraphNav = document.getElementById(`${stripId}-paragraph-nav`);
    const paragraphCounter = document.getElementById(`${stripId}-paragraph-counter`);
    if (paragraphStarts.length > 1 && paragraphNav) {
        paragraphNav.style.display = 'flex';
        widget.dataset.paragraphPointer = '0';
        if (paragraphCounter) paragraphCounter.textContent = `第 1 / ${paragraphStarts.length} 段`;
    }

    if (typeof WaveSurfer === 'undefined') {
        console.warn('⚠️ WaveSurfer 尚未載入，無法顯示波形');
        return;
    }

    // 💡 防呆：如果這個波形容器之前已經建立過 WaveSurfer 實例（例如報表被重新渲染過一次），
    //    先把舊的銷毀掉，避免同一個位置疊了兩個實例互相干擾、造成畫面跳動。
    if (waveformEl._wsInstance) {
        try { waveformEl._wsInstance.destroy(); } catch (e) { /* 忽略銷毀失敗 */ }
        waveformEl._wsInstance = null;
    }

    const ws = WaveSurfer.create({
        container: waveformEl,
        waveColor: '#ffb3b3',
        progressColor: '#e63946',
        cursorColor: '#1f2937',
        cursorWidth: 2,
        barWidth: 3,
        barGap: 2,
        height: 80,
        minPxPerSec: basePxPerSec,
        autoScroll: false,  // 💡 關掉：這個功能會跟外層我們自己手動控制的捲動容器互相搶控制權，
                             //    導致波形上的色塊左右跳動；改成完全由使用者手動拖曳捲動。
        autoCenter: false,
        url: audioUrl
    });
    waveformEl._wsInstance = ws;

    // 💡 波形點擊播放/停止切換：如果目前正在播放，點擊（不管點哪裡）就停止；
    //    如果目前沒在播放，才從「滑鼠實際點擊的位置」開始播放（不是固定跳到色塊/區段的開頭）。
    let currentPxPerSec = basePxPerSec; // 💡 追蹤目前實際的每秒像素值，縮放滑桿變動時會更新，確保點擊位置換算成時間時比例正確

    function toggleWavePlaybackFrom(seekTime) {
        if (ws.isPlaying()) {
            ws.pause();
        } else {
            if (seekTime != null) ws.setTime(seekTime);
            ws.play();
        }
    }

    /** 💡 把滑鼠點擊事件的畫面座標，換算成波形上對應的實際時間點（秒） */
    function getClickedTimeFromEvent(e) {
        const rect = waveformEl.getBoundingClientRect();
        const clickX = e.clientX - rect.left; // getBoundingClientRect 本身就會反映目前捲動後的位置，不用額外扣掉 scrollLeft
        return Math.max(clickX / currentPxPerSec, 0);
    }

    let lastRegionClickAt = 0; // 💡 用來避免色塊點擊跟下面的 'interaction' 事件同一次點擊觸發兩次

    // 💡 用 Regions 外掛把淺藍/淺綠交錯的「句子分段」色塊直接疊加在波形上（跟逐字對齊的位置分開處理，
    //    這裡永遠是句子層級，不會因為逐字對齊而變成一堆碎顏色）。
    //    改綁在 'ready'（完全載入完成才觸發一次），避免 'decode' 在載入過程中
    //    可能觸發不只一次、導致色塊被重複疊加越疊越深、看起來像在閃爍。
    if (WaveSurfer.Regions) {
        const wsRegionsLocal = ws.registerPlugin(WaveSurfer.Regions.create());
        let regionsAdded = false;
        ws.on('ready', () => {
            if (regionsAdded) return; // 防呆：確保只加一次
            regionsAdded = true;
            chunkTimes.forEach((c, i) => {
                const isBlue = i % 2 === 0;
                const overlayColor = isBlue ? 'rgba(59,130,246,0.18)' : 'rgba(16,185,129,0.18)';
                const region = wsRegionsLocal.addRegion({
                    start: c.xmin,
                    end: c.xmax,
                    color: overlayColor,
                    drag: false,
                    resize: false
                });
                // 💡 點擊色塊：播放/停止切換，從「滑鼠實際點的位置」開始播放，不是整個色塊的開頭
                region.on('click', (e) => {
                    e.stopPropagation();
                    lastRegionClickAt = Date.now();
                    const clickedTime = getClickedTimeFromEvent(e);
                    toggleWavePlaybackFrom(clickedTime);
                });
            });
        });
    }

    // 💡 點擊波形上「沒有色塊覆蓋」的空白部分（例如色塊之間的停頓區域），
    //    也要套用同樣的播放/停止切換邏輯，而不是只有色塊本身有作用。
    //    WaveSurfer 的 'interaction' 事件在使用者點擊/拖曳波形本體時觸發，
    //    此時已經自動 seek 到點擊位置，所以這裡只需要判斷要「播放」還是「停止」。
    ws.on('interaction', () => {
        if (Date.now() - lastRegionClickAt < 150) return; // 剛剛已經由色塊點擊處理過了，避免同一次點擊觸發兩次
        toggleWavePlaybackFrom(null);
    });

    if (playBtn) {
        playBtn.addEventListener('click', () => ws.playPause());
        ws.on('play', () => { playBtn.textContent = '⏸ 暫停'; });
        ws.on('pause', () => { playBtn.textContent = '▶ 播放'; });
        ws.on('finish', () => { playBtn.textContent = '▶ 播放'; });
    }

    // 💡 逐字稿列上方的紅線 + 目前正在念的那個字高亮，兩者都跟著播放進度即時更新，
    //    這樣不管看波形還是看逐字稿，都能清楚知道現在念到哪裡，不用用猜的。
    const transcriptPlayhead = document.getElementById(`${stripId}-transcript-playhead`);
    let currentLayout = [];
    try { currentLayout = JSON.parse(widget.dataset.layout); } catch (e) { currentLayout = []; }
    let lastHighlightedIdx = -1;

    function timeToTranscriptPixel(t) {
        for (let i = 0; i < currentLayout.length; i++) {
            const c = currentLayout[i];
            if (t <= c.xmax) {
                if (t < c.xmin) return c.left;
                const frac = (t - c.xmin) / Math.max(c.xmax - c.xmin, 0.001);
                return c.left + frac * c.width;
            }
        }
        const last = currentLayout[currentLayout.length - 1];
        return last ? last.left + last.width : 0;
    }

    function updateWordHighlight(t) {
        const transcriptRow = document.getElementById(`${stripId}-transcript`);
        if (!transcriptRow) return;
        let idx = -1;
        for (let i = 0; i < currentLayout.length; i++) {
            const c = currentLayout[i];
            if (t >= c.xmin && t < c.xmax) { idx = i; break; }
        }
        if (idx === lastHighlightedIdx) return;
        if (lastHighlightedIdx >= 0) {
            const prevEl = transcriptRow.querySelector(`[data-word-idx="${lastHighlightedIdx}"]`);
            if (prevEl) prevEl.style.boxShadow = '';
        }
        if (idx >= 0) {
            const curEl = transcriptRow.querySelector(`[data-word-idx="${idx}"]`);
            if (curEl) curEl.style.boxShadow = '0 0 0 3px #e63946 inset';
        }
        lastHighlightedIdx = idx;
    }

    ws.on('timeupdate', (currentTime) => {
        if (transcriptPlayhead) transcriptPlayhead.style.left = timeToTranscriptPixel(currentTime) + 'px';
        updateWordHighlight(currentTime);
    });

    // 💡 縮放滑桿：拉動時同時重繪波形（WaveSurfer 內建的 zoom）跟逐字稿列的排版，
    //    兩邊都用同一個新的「每秒像素」比例重新計算，位置才會繼續對得上。
    if (zoomSlider) {
        zoomSlider.addEventListener('input', () => {
            const factor = parseFloat(zoomSlider.value) || 1;
            if (zoomLabel) zoomLabel.textContent = Math.round(factor * 100) + '%';

            const newPxPerSec = basePxPerSec * factor;
            currentPxPerSec = newPxPerSec; // 💡 同步更新，確保縮放後點擊波形換算的時間位置還是準確的

            try { ws.zoom(newPxPerSec); } catch (e) { console.warn('WaveSurfer 縮放失敗:', e); }

            const newLayout = computeLayout(rawGroups, newPxPerSec);
            widget.dataset.layout = JSON.stringify(newLayout).replace(/'/g, "&apos;");
            currentLayout = newLayout;
            lastHighlightedIdx = -1;

            const activeCategory = widget.dataset.activeCategory || null;
            let activeChunkFluencyMap = null;
            if (activeCategory === 'fluency') {
                try { activeChunkFluencyMap = JSON.parse(widget.dataset.chunkFluency); } catch (e) { activeChunkFluencyMap = {}; }
            }
            const transcriptRow = document.getElementById(`${stripId}-transcript`);
            if (transcriptRow) transcriptRow.innerHTML = renderChunkTranscriptRow(newLayout, activeCategory || null, activeChunkFluencyMap);

            const totalDurationSec = newLayout.length ? Math.max(...newLayout.map(l => l.xmax || 0)) : 0;
            const newTotalWidthPx = Math.max(Math.ceil(totalDurationSec * newPxPerSec) + 20, 200);
            if (scrollArea) scrollArea.style.width = newTotalWidthPx + 'px';
            if (waveformEl) waveformEl.style.width = newTotalWidthPx + 'px';
            if (transcriptWrap) transcriptWrap.style.width = newTotalWidthPx + 'px';
        });
    }

    // 💡 波形跟逐字稿現在是同一個捲動容器裡的兩個區塊，
    //    捲動這個容器就會「音檔跟文字一起移動」，不需要再手動同步兩個捲軸。
    //    這裡只加滑鼠按住拖曳的手勢，體驗類似手機滑動。
    let dragMoved = false;
    if (scrollWrap) {
        let isDown = false;
        let startX = 0;
        let scrollLeftStart = 0;
        scrollWrap.addEventListener('mousedown', (e) => {
            isDown = true;
            dragMoved = false;
            scrollWrap.style.cursor = 'grabbing';
            startX = e.pageX - scrollWrap.offsetLeft;
            scrollLeftStart = scrollWrap.scrollLeft;
        });
        ['mouseleave', 'mouseup'].forEach(evt => {
            scrollWrap.addEventListener(evt, () => { isDown = false; scrollWrap.style.cursor = 'grab'; });
        });
        scrollWrap.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - scrollWrap.offsetLeft;
            const walk = (x - startX) * 1.2;
            if (Math.abs(walk) > 5) dragMoved = true; // 💡 移動超過一點距離才算是拖曳，避免誤判成點擊沒反應
            scrollWrap.scrollLeft = scrollLeftStart - walk;
        });
    }

    // 💡 點擊逐字稿：
    //    - 黑色正確課文文字（任何模式下都可以點）：從這個字開始往下念到底，再點同一個字則暫停/繼續。
    //    - 流暢度模式：點任一個字（非黑色課文本身），用 TTS 唸出整句正確版本（原本就有的行為）。
    //    - WER 錯誤類別模式（重複/替換/刪除...等）：點擊「命中該類別的紅字」，
    //      即時跟後端要一句音節拆解的發音教學提示，用小泡泡顯示在那個字下方。
    const transcriptRowEl = document.getElementById(`${stripId}-transcript`);
    if (transcriptRowEl) {
        transcriptRowEl.addEventListener('click', (e) => {
            if (dragMoved) return; // 剛剛是拖曳捲動，不是真的點擊，不要誤觸發

            // 💡 優先判斷：點的是不是黑色正確課文文字本身
            const refSpan = e.target.closest('.ref-word-span');
            if (refSpan) {
                const block = refSpan.closest('.chunk-transcript-block');
                if (!block) return;
                const wordIdx = parseInt(block.dataset.wordIdx, 10);
                if (isNaN(wordIdx)) return;

                let layoutForRead = [];
                try { layoutForRead = JSON.parse(widget.dataset.layout); } catch (err) { return; }

                window.toggleReadFromWord(stripId, layoutForRead, wordIdx);
                return;
            }

            const errorBadge = e.target.closest('.wer-error-word-badge');
            if (errorBadge && widget.dataset.activeCategory && widget.dataset.activeCategory !== 'fluency') {
                window.showWordPronunciationTip(errorBadge);
                return;
            }

            if (widget.dataset.activeCategory !== 'fluency') return; // 💡 只有流暢度模式才會點字出聲唸整句

            const block = e.target.closest('.chunk-transcript-block');
            if (!block) return;
            const chunkIdx = parseInt(block.dataset.chunkIdx, 10);
            if (isNaN(chunkIdx)) return;

            let currentLayoutForClick = [];
            try { currentLayoutForClick = JSON.parse(widget.dataset.layout); } catch (err) { return; }

            const refSentence = buildReferenceSentenceForChunk(currentLayoutForClick, chunkIdx);
            if (refSentence && typeof speakSentence === 'function') {
                speakSentence(refSentence);
            }
        });
    }
}


function renderMultipleParagraphsReport(paragraphList, globalStats, mode = 'segment') {
    try {
        const isWhole = mode === 'whole';

        // 💡 whole 模式：
        //   - 上方總成績卡：直接採用後端回傳的 global_stats，原封不動顯示，不在前端做任何推導/平均計算。
        //   - 下方段落列表：篩出真正有錄音的「整篇」那一筆（paragraph_index = 0，找不到則抓任何一筆有資料的）。
        let effectiveList = paragraphList || [];
        const effectiveGlobalStats = globalStats;

        if (isWhole) {
            let wholeEntry = (paragraphList || []).find(
                p => p.paragraph_index === 0 && p.file_path !== null && p.wer !== null
            );
            if (!wholeEntry) {
                wholeEntry = (paragraphList || []).find(
                    p => p.file_path !== null && p.wer !== null
                );
            }
            effectiveList = wholeEntry ? [wholeEntry] : [];
        }

        if (document.getElementById('werScoreText')) {
            document.getElementById('werScoreText').innerText =
                effectiveGlobalStats ? werToAccuracyPercentText(effectiveGlobalStats.wer_average) : '0.0%';
        }
        if (document.getElementById('werFluencyScore100')) {
            const rawScore = (effectiveGlobalStats && effectiveGlobalStats.overall_fluency_score_100 != null)
                ? parseFloat(effectiveGlobalStats.overall_fluency_score_100) : null;
            const tierInfo = scoreToFluencyTierLabel(rawScore);
            const scoreEl = document.getElementById('werFluencyScore100');
            scoreEl.innerText = tierInfo ? tierInfo.text : '—';
            scoreEl.style.color = tierInfo ? tierInfo.color : '';
        }

        // 💡 順手把標題文字也改一下，whole 模式不叫「Total 平均」
        const bannerTitle = document.getElementById('scoreBannerTitle');
        if (bannerTitle) {
            bannerTitle.innerHTML = isWhole
                ? '📊 整篇式練習 朗讀結算'
                : '📊 分段式練習 朗讀結算';
        }

        // 💡 「段落詳細回報&分析」這個小標題不是用 JS 動態產生的固定文字（是寫死在 main.html 裡），
        //    這裡用文字比對的方式找到那個元素，whole 模式時動態換成「整篇詳細回報&分析」，
        //    分段模式時換回「段落詳細回報&分析」，不用去改 HTML 原始檔。
        (function updateDetailReportSectionTitle() {
            const allEls = document.querySelectorAll('h1, h2, h3, h4, h5, span, div, p, label');
            for (const el of allEls) {
                if (el.children.length > 0) continue; // 只找「純文字」的葉節點，避免改到外層大容器
                const text = (el.textContent || '').trim();
                if (text.includes('段落詳細回報') || text.includes('整篇詳細回報')) {
                    el.textContent = text
                        .replace('段落詳細回報', isWhole ? '整篇詳細回報' : '段落詳細回報')
                        .replace('整篇詳細回報', isWhole ? '整篇詳細回報' : '段落詳細回報');
                    break;
                }
            }
        })();

        const container = document.getElementById('werParagraphsContainer');
        if (!container) return;
        container.innerHTML = '';

        if (isWhole && effectiveList.length === 0) {
            container.innerHTML = `
                <div style="background: #fff; border: 1px solid #e2e8f0; padding: 40px; border-radius: 12px; text-align: center; width: 100%; box-sizing: border-box;">
                    <p style="color: #999; margin: 0; font-size: 0.95rem;">暫無整篇錄音分析資料。</p>
                </div>`;
            return;
        }

        effectiveList.forEach((para) => {
            const hasRecorded = para.file_path !== null && para.wer !== null;
            const stripId = `strip-para-${para.paragraph_index}-${Date.now()}`;

            let extendedReport = {};
            if (para.alignment_report) {
                if (typeof para.alignment_report === 'string') {
                    try { extendedReport = JSON.parse(para.alignment_report); } catch(e) {}
                } else {
                    extendedReport = para.alignment_report;
                }
            }

            const strip = document.createElement('div');
            strip.id = stripId;
            strip.style.background = '#fff';
            strip.style.border = '1px solid #e2e8f0';
            strip.style.borderRadius = '12px';
            strip.style.overflow = 'hidden';
            strip.style.boxShadow = '0 2px 6px rgba(0,0,0,0.01)';
            strip.style.width = '100%';
            strip.style.boxSizing = 'border-box';
            strip.style.marginBottom = '8px';

            const alignments = extendedReport.word_alignments || [];
            if (hasRecorded && alignments.length > 0) {
                strip.setAttribute('data-alignment', JSON.stringify(alignments).replace(/'/g, "&apos;"));
            }

            // 💡 whole 模式的段落標題顯示為「整篇朗讀」，分段模式維持「段落 N」
            const paraLabel = isWhole ? '整篇朗讀' : `段落 ${para.paragraph_index}`;

            // 標題列
            const singleParaNpvi = (hasRecorded && para.npvi != null) ? parseFloat(para.npvi).toFixed(2) : '—';
            const singleParaVarco = (hasRecorded && para.varco != null) ? parseFloat(para.varco).toFixed(2) : '—';
            const statusBadge = hasRecorded 
                ? `<span style="color: #16a34a; font-weight: bold; background: #dcfce7; padding: 4px 12px; border-radius: 8px; font-size: 0.85rem;">✓ 已錄音</span>` 
                : `<span style="color: #64748b; font-weight: bold; background: #f1f5f9; padding: 4px 12px; border-radius: 8px; font-size: 0.85rem;">✕ 未錄音</span>`;

            const header = document.createElement('div');
            header.style.cssText = `padding: 18px 24px; background: ${hasRecorded ? '#f8fafc' : '#fcfcfc'}; display: flex; align-items: center; justify-content: space-between; cursor: ${(hasRecorded && !isWhole) ? 'pointer' : 'default'}; opacity: ${hasRecorded ? '1' : '0.65'};`;
            header.innerHTML = `
                <div style="display: flex; align-items: center; gap: 30px; flex: 1; flex-wrap: wrap;">
                    <span style="font-weight: bold; color: #1f2937; min-width: 65px; font-size: 1.05rem;">${paraLabel}</span>
                    ${statusBadge}
                    <div style="display: flex; gap: 24px; color: #4a5568; font-size: 0.92rem; align-items: center; flex-wrap: wrap;">
                        <div>WER: <strong style="color: #e63946; font-size: 1.05rem;">${hasRecorded ? (para.wer * 100).toFixed(1) + '%' : '—'}</strong></div>
                        <div>錯誤數: <strong style="color: #fb923c; font-size: 1.05rem;">${hasRecorded ? para.error_count : '—'}</strong></div>
                        <div style="color: #4a5568; border-left: 1px solid #e2e8f0; padding-left: 16px;">nPVI: <strong style="color: #2563eb; font-size: 1.05rem;">${singleParaNpvi}</strong></div>
                        <div style="color: #4a5568;">Varco: <strong style="color: #10b981; font-size: 1.05rem;">${singleParaVarco}</strong></div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    ${(hasRecorded && !isWhole) ? '<span style="color: #a0aec0; font-size: 0.85rem;">展開對照</span> <span class="arrow-icon" style="transition: transform 0.2s; color: #cbd5e1;">▼</span>' : ''}
                </div>
            `;

            const body = document.createElement('div');
            // 💡 whole 模式：不需要手風琴收合，直接展開顯示（display:flex），不是 none
            body.style.cssText = `padding: 24px; display: ${isWhole && hasRecorded ? 'flex' : 'none'}; background: #ffffff; border-top: 1px solid #edf2f7; flex-direction: column; gap: 24px;`;

            if (hasRecorded) {
                // 🚀 雷達圖改成四個維度（0~5分，來自 Ollama 評分），資料直接來自 para 物件（DB 欄位）
                const radarScores = [
                    para.score_completeness || 0,
                    para.score_accuracy || 0,
                    para.score_fluency || 0,
                    para.score_grammar || 0
                ];

                const actualNpviNum = parseFloat(singleParaNpvi) || 0;
                const actualVarcoNum = parseFloat(singleParaVarco) || 0;
                const fluencyFeedbackText = para.fluency_feedback_text || '';
                const completenessFeedbackText = para.completeness_feedback_text || '';
                const accuracyFeedbackText = para.accuracy_feedback_text || '';
                const werFluencyFeedbackText = para.wer_fluency_feedback_text || '';

                const chartsHTML = `
                    <div style="display: flex; gap: 24px; width: 100%; flex-wrap: wrap;">
                        <!-- 左側：WER 錯誤雷達圖 -->
                        <div style="flex: 1; min-width: 300px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center;">
                            <div style="font-size: 0.95rem; font-weight: bold; color: #475569; margin-bottom: 12px; align-self: flex-start;">🕸️ 朗讀整體面向分析</div>
                            <div style="position: relative; width: 100%; height: 220px;">
                                <canvas class="radar-canvas"></canvas>
                            </div>
                        </div>

                        <!-- 右側：nPVI / Varco 子彈圖 -->
                        <div style="flex: 1; min-width: 300px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; justify-content: center; gap: 20px;">
                            <div style="font-size: 0.95rem; font-weight: bold; color: #475569; margin-bottom: 4px;">🎯 口語流暢分析</div>
                            ${renderFluencyBulletBar('nPVI 相鄰語速變異', actualNpviNum, NPVI_SYL_MEAN, NPVI_SYL_STD, '#3b82f6')}
                            ${renderFluencyBulletBar('Varco 整體語速變異', actualVarcoNum, VARCO_SYL_MEAN, VARCO_SYL_STD, '#10b981')}
                        </div>
                    </div>
                `;

                // 🎵 區塊 2：分色分段音檔對照小工具（優先用逐字時間戳做真正的逐字對齊）
                //    💡 兩段 Ollama 評語不再顯示成文字，改傳進小工具，點擊「流暢度」按鈕時用 TTS 唸出來。
                const chunkListForWidget = extendedReport.chunk_details || [];
                const wordTimingsForWidget = extendedReport.word_timings || [];
                const sentenceFluencyForWidget = extendedReport.sentence_fluency || [];
                // 💡 整篇模式才需要傳入原始段落陣列，用來估算段落分界位置（供「下一段開頭」導航使用）
                const originalParagraphsForWidget = (isWhole && state.article && Array.isArray(state.article.paragraphs))
                    ? state.article.paragraphs
                    : null;
                const chunkedAudioHTML = buildChunkedAudioBlock(
                    stripId, chunkListForWidget, alignments, para.file_path || '', wordTimingsForWidget, sentenceFluencyForWidget,
                    fluencyFeedbackText, completenessFeedbackText, accuracyFeedbackText, werFluencyFeedbackText,
                    para.fluency_score_100, para.score_completeness, para.score_accuracy, para.score_fluency,
                    originalParagraphsForWidget
                );

                body.innerHTML = chartsHTML + chunkedAudioHTML;

                // 💡 把雷達圖渲染邏輯抽成函式，whole 模式立即呼叫、分段模式維持點擊展開才呼叫（延遲加載）
                const renderRadarChartOnce = () => {
                    if (body.dataset.chartRendered) return;
                    body.dataset.chartRendered = 'true';

                    const canvas = body.querySelector('.radar-canvas');
                    if (canvas) {
                        new Chart(canvas.getContext('2d'), {
                            type: 'radar',
                            data: {
                                labels: ['發音完整度', '發音準確度', '口說流利度', '語法'],
                                datasets: [{
                                    label: '評分 (0-5)',
                                    data: radarScores,
                                    backgroundColor: 'rgba(230, 57, 70, 0.2)',
                                    borderColor: '#e63946',
                                    pointBackgroundColor: '#e63946',
                                    borderWidth: 2
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                scales: {
                                    r: {
                                        beginAtZero: true,
                                        min: 0,
                                        max: 5,
                                        ticks: { stepSize: 1, backdropColor: 'transparent' },
                                        pointLabels: { font: { size: 12, weight: 'bold' }, color: '#475569' }
                                    }
                                },
                                plugins: { legend: { display: false } }
                            }
                        });
                    }
                };

                if (isWhole) {
                    // 💡 whole 模式：不用等點擊展開，內容本來就是展開狀態，圖表直接畫
                    renderRadarChartOnce();
                } else {
                    // ── 分段模式：手風琴展開事件 (延遲加載雷達圖) ──
                    header.addEventListener('click', () => {
                        const isHidden = body.style.display === 'none';
                        body.style.display = isHidden ? 'flex' : 'none';
                        header.querySelector('.arrow-icon').style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                        header.style.background = isHidden ? '#f1f5f9' : '#f8fafc';

                        if (isHidden) renderRadarChartOnce();
                    });
                }
            }

            strip.appendChild(header);
            strip.appendChild(body);
            container.appendChild(strip);

            if (hasRecorded) {
                initChunkedAudioBlock(stripId);
            }
        });

       

    } catch (err) {
        console.error("❌ 渲染歷史大禮包手風琴失敗:", err);
    }
}

/**
 * 💡 清空 Step3 評分結果面板為初始佔位狀態。
 * 用於切換到「尚未完成評分」的專案時，避免殘留上一篇文章的舊報告。
 */
function _resetScorePanel() {
    const scoreText     = document.getElementById('werScoreText');
    const fluencyScore  = document.getElementById('werFluencyScore100');

    if (scoreText)    scoreText.textContent    = '0.0%';
    if (fluencyScore) fluencyScore.textContent = '—';

    const container = document.getElementById('werParagraphsContainer');
    if (container) {
        container.innerHTML = `
            <div style="background: #fff; border: 1px solid #e2e8f0; padding: 40px; border-radius: 12px; text-align: center; width: 100%; box-sizing: border-box;">
                <p style="color: #999; margin: 0; font-size: 0.95rem;">暫無分析資料，請先錄音並點擊結算。 🎉</p>
            </div>
        `;
    }
}

/**
 * 💡 依 projectId 向後端抓取「該次練習」自己的評分報告並渲染到 Step3 面板。
 * 供切換練習次數（右上角下拉選單）/ 側欄歷史紀錄時，正確顯示「那一次」的評分結果。
 */
async function _loadAndRenderProjectReport(projectId) {
    if (!projectId) return;
    try {
        const response = await fetch(`/get_project_total_report?project_id=${projectId}`);
        if (!response.ok) throw new Error("後端資料彙整失敗");

        const resData = await response.json();
        if (resData.status === 'success') {
            // 💡 帶入這個 project 實際的練習模式，whole 模式才能正確走「不平均、直接顯示整篇數值」的邏輯
            const mode = _loadPracticeModeForProject(projectId) || 'segment';
            renderMultipleParagraphsReport(resData.paragraph_list, resData.global_stats, mode);
        } else {
            showToast("彙整失敗: " + (resData.message || '未知錯誤'));
            _resetScorePanel();
        }
    } catch (err) {
        console.error("載入評分報告失敗:", err);
        showToast("伺服器連線失敗，無法載入報告");
        _resetScorePanel();
    }
}

async function settleAndShowReport() {
    const projectId = state.activeProjectId;
    if (!projectId) {
        showToast('錯誤：找不到當前專案 ID');
        return;
    }

    showToast("正在從資料庫彙整各段落數據...");

    // 切換前端 UI 到 Step 3 評分結果分頁
    state.completedSteps.add(2);
    state.currentStep = 2;
    updateStepUI();

    await _loadAndRenderProjectReport(projectId);
}

// 💡 核心函數：當點擊側邊欄的練習紀錄時觸發
async function loadHistoryProject(projectId, articleTitle) {
    if (!projectId) return;

    // UI 視覺回饋：把點擊的那一列變成高亮 active 狀態
    document.querySelectorAll('.history-item').forEach(item => item.classList.remove('active'));
    const clickedItem = document.querySelector(`[data-project-id="${projectId}"]`);
    if (clickedItem) clickedItem.classList.add('active');

    showToast(`正在載入【${articleTitle}】的歷史分析報告...`);

    try {
        // 1. 直接呼叫我們之前寫好的大禮包 API
        const response = await fetch(`/get_project_total_report?project_id=${projectId}`);
        if (!response.ok) throw new Error("無法取得歷史報告");

        const resData = await response.json();

        if (resData.status === 'success') {
            // 2. 💡 關鍵：把當前全域狀態的專案 ID 切換成這個歷史專案
            state.activeProjectId = projectId;

            // 3. 💡 強制讓畫面切換到 Step 3（評分結果分頁）
            state.currentStep = 2; // Step 3 在你的 index 陣列裡通常是 2
            state.completedSteps.add(0);
            state.completedSteps.add(1);
            state.completedSteps.add(2);
            updateStepUI(); // 呼叫你原本切換 panel 顯示隱藏的 UI 函數

            // 4. 更新頂部標題，讓使用者知道現在是在看哪一場歷史紀錄
            const chatTitle = document.getElementById('chatTitle');
            if (chatTitle) chatTitle.innerText = `歷史紀錄：${articleTitle}`;

            // 5. 🚀 丟進手風琴渲染引擎，秒畫出當年的滿版長條與下拉彩色字！
            //    💡 帶入這個 project 實際的練習模式，whole 模式才能正確顯示「不平均」的整篇成績
            const mode = _loadPracticeModeForProject(projectId) || 'segment';
            renderMultipleParagraphsReport(resData.paragraph_list, resData.global_stats, mode);

            showToast("歷史報告載入成功 🎉");
        } else {
            showToast("載入失敗: " + resData.message);
        }
    } catch (err) {
        console.error("載入歷史專案失敗:", err);
        showToast("伺服器連線失敗，無法讀取歷史紀錄");
    }
}

// 💡 這是在你的撈取所有專案列表的 function 內部 (例如加載側邊欄時)
function displayProjectsInSidebar(projects) {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;
    historyList.innerHTML = ''; // 清空

    if (projects.length === 0) {
        historyList.innerHTML = '<li class="history-item muted">尚無練習紀錄</li>';
        return;
    }

    projects.forEach(proj => {
        const li = document.createElement('li');
        li.className = 'history-item';

        // 💡 這裡很關鍵：給它 data 屬性方便剛剛高亮抓取，並綁定 onclick 事件！
        li.setAttribute('data-project-id', proj.id);
        li.setAttribute('onclick', `loadHistoryProject('${proj.id}', '${proj.title}')`);

        li.innerHTML = `
            <div class="project-main" style="width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="project-name" style="font-weight: bold;">📝 ${proj.title}</span>
                    <span class="project-time" style="font-size: 0.75rem; color: #95a5a6;">${proj.date}</span>
                </div>
            </div>
        `;
        historyList.appendChild(li);
    });
}

/* ══════════════════════════════════════════════════
   📱 手機版：錄音完成顯示波形後，長按錄音區塊上緣邊界即可拖曳「往上蓋住文字」
   ──────────────────────────────────────────────────
   - 觸發條件：手機寬度 (<=768px) 且波形已顯示 (#playbackRow.visible)
   - 長按把手 ~320ms 啟動，接著同一根手指往上拖 = 覆蓋層變高（蓋住下方文字）
   - 錄音區塊改為絕對定位的覆蓋層，字幕區高度被凍結、不擠壓
   - 最高可蓋滿整個錄音內容區塊 (.record-main)；最低為初始高度
   - 「全部重錄」等任何讓波形收起的動作（會呼叫 resetRecordUI 移除 #playbackRow 的
     visible class）都會自動還原成初始狀態
   ══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    const MOBILE_MAX  = 768;
    const MOVE_START  = 6;     // 在把手上滑動超過此距離(px)就立刻啟動調整（不需長按）

    const controls      = document.querySelector('.record-controls');
    const recordMain    = document.querySelector('.record-main');
    const recordSec     = document.getElementById('recordSection');
    const handle        = document.getElementById('recordResizeHandle');
    const playbackRow   = document.getElementById('playbackRow');
    const lyricsWrapper = document.getElementById('lyricsWrapper');
    if (!controls || !recordMain || !recordSec || !handle || !playbackRow) return;

    const isMobile    = () => window.innerWidth <= MOBILE_MAX;
    const waveVisible = () => playbackRow.classList.contains('visible');

    let armed     = false;   // 已啟動、正在調整中
    let pointerId = null;
    let downY = 0, downX = 0, lastY = 0, startY = 0, startH = 0;

    // 還原成初始狀態（清掉覆蓋層高度、解除字幕凍結）
    function resetHeight() {
        controls.style.height = '';
        controls.classList.remove('rc-overlay');
        recordMain.classList.remove('rc-resizing');
        if (lyricsWrapper) lyricsWrapper.style.flex = '';   // 解除字幕高度凍結
    }

    // 依「手機 + 波形顯示中」切換把手；一旦離開此狀態就還原初始高度
    function syncHandle() {
        const on = isMobile() && waveVisible();
        recordSec.classList.toggle('rc-resizable', on);
        if (on) {
            // 尚未進入覆蓋模式時，記錄目前自然高度，作為最小值 / 還原基準（即「初始高度」）
            if (!controls.classList.contains('rc-overlay')) {
                controls._naturalH = controls.offsetHeight;
            }
        } else {
            resetHeight();
            controls._naturalH = 0;
        }
    }

    function clampHeight(h) {
        const min = controls._naturalH || controls.offsetHeight;
        // 最高只到「內容全部展開」的高度（所有按鈕都顯示、剛好不用捲），避免多出空白；
        // 同時不超過整個錄音區塊的高度。
        const full = controls._fullH || recordMain.clientHeight;
        const max  = Math.max(min, Math.min(full, recordMain.clientHeight));
        return Math.min(max, Math.max(min, h));
    }

    // 長按門檻到了 → 正式進入「覆蓋」調整模式
    function arm() {
        armed  = true;
        startY = lastY;                       // 以長按當下的手指位置為基準，避免拖曳一開始跳動
        startH = controls.offsetHeight;       // 目前（初始）高度
        if (!controls._naturalH) controls._naturalH = startH;

        // 💡 先凍結字幕區目前高度，讓它在錄音區塊變成覆蓋層後不會重排/被擠壓
        if (lyricsWrapper) {
            lyricsWrapper.style.flex = '0 0 ' + lyricsWrapper.offsetHeight + 'px';
        }
        // 錄音區塊改成絕對定位的覆蓋層，並先固定在初始高度（外觀不變，只是脫離文件流）
        recordMain.classList.add('rc-resizing');   // 讓 .record-main 成為定位基準
        controls.classList.add('rc-overlay');
        // 💡 量測「內容全部展開」需要的高度（所有錄音按鈕都露出、剛好不用捲）當作拉高上限，
        //    此時還沒設固定高度、max-height:none，scrollHeight 就是完整內容高度。
        controls._fullH = controls.scrollHeight;
        controls.style.height = startH + 'px';

        handle.classList.add('active');
        document.body.style.userSelect = 'none';
        if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} }
    }

    function endDrag() {
        armed = false;
        handle.classList.remove('active');
        document.body.style.userSelect = '';
        if (pointerId != null) { try { handle.releasePointerCapture(pointerId); } catch (e) {} }
        pointerId = null;
    }

    handle.addEventListener('pointerdown', (e) => {
        if (!isMobile() || !waveVisible()) return;
        pointerId = e.pointerId;
        downY = lastY = startY = e.clientY;
        downX = e.clientX;
        startH = controls.offsetHeight;
        if (!controls._naturalH) controls._naturalH = startH;
        try { handle.setPointerCapture(pointerId); } catch (err) {}
        // 不再等長按：改成在下面 pointermove 一滑動就啟動
    });

    handle.addEventListener('pointermove', (e) => {
        if (pointerId == null) return;
        lastY = e.clientY;
        if (!armed) {
            // 💡 在把手上滑動超過小門檻 → 立刻啟動調整（滑動即啟動，免長按）
            if (Math.abs(e.clientY - downY) > MOVE_START ||
                Math.abs(e.clientX - downX) > MOVE_START) {
                arm();
            } else {
                return;
            }
        }
        e.preventDefault();
        const delta = startY - e.clientY;                    // 往上拖 → delta 為正 → 變高
        controls.style.height = clampHeight(startH + delta) + 'px';
    }, { passive: false });

    handle.addEventListener('pointerup',          endDrag);
    handle.addEventListener('pointercancel',      endDrag);
    handle.addEventListener('lostpointercapture', endDrag);

    // 波形顯示/收起（含「全部重錄」呼叫的 resetRecordUI）都會改動 #playbackRow 的 class，
    // 這裡監看它 → 自動顯示/隱藏把手，並在收起時還原初始狀態
    new MutationObserver(syncHandle).observe(playbackRow, {
        attributes: true, attributeFilter: ['class']
    });

    // 視窗尺寸變化：回到桌面版就還原；仍在手機版則重新夾住高度避免超界
    window.addEventListener('resize', () => {
        if (!isMobile()) resetHeight();
        syncHandle();
        if (controls.classList.contains('rc-overlay') && controls.style.height) {
            controls.style.height = clampHeight(parseFloat(controls.style.height)) + 'px';
        }
    });

    syncHandle();
});