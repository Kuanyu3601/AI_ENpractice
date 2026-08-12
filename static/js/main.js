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
                    <button id="${stripId}-playbtn" type="button" style="padding:6px 16px; border:none; background:#3a85cb; color:#fff; border-radius:20px; font-weight:bold; cursor:pointer; font-size:0.85rem; white-space:nowrap;">▶ 播放</button>
                

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
                <div style="border:2px solid #d97706; border-radius:10px; padding:6px 14px; background:#fffbeb;">
                    <span class="category-label-clickable" onclick="window.openCategoryFeedbackForStrip('${stripId}','completeness')" style="font-size:0.85rem; font-weight:bold; color:#d97706; text-align:center; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:2px; flex-wrap:wrap;">發音完整度<span style="font-size:0.7rem; font-weight:normal;">(${completenessErrCount}/${totalRefWords})</span><span style="font-size:0.7rem;">👆</span></span>
                    <div style="display:none;">
                        <button class="wer-filter-btn-chunked" data-original-bg="#fff" data-original-color="#16a34a" onclick="window.switchWerFilterChunked(this, 'deletions', '${stripId}')" style="padding: 5px 12px; border:none; background: #fff; color: #16a34a; border-radius: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size:0.85rem;">刪除 (${errorCounts.deletions})</button>
                        <button class="wer-filter-btn-chunked" data-original-bg="#fff" data-original-color="#16a34a" onclick="window.switchWerFilterChunked(this, 'insertions', '${stripId}')" style="padding: 5px 12px; border:none; background: #fff; color: #16a34a; border-radius: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size:0.85rem;">插入 (${errorCounts.insertions})</button>
                        <button class="wer-filter-btn-chunked" data-original-bg="#fff" data-original-color="#16a34a" onclick="window.switchWerFilterChunked(this, 'substitutions', '${stripId}')" style="padding: 5px 12px; border:none; background: #fff; color: #16a34a; border-radius: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size:0.85rem;">替換 (${errorCounts.substitutions})</button>
                    </div>
                </div>

                <!-- 💡 發音準確度：不做任何文字標色/跳轉，純粹只顯示 LLM 評語 + TTS -->
                <div style="border:2px solid #d97706; border-radius:10px; padding:6px 14px; background:#fffbeb;">
                    <span class="category-label-clickable" onclick="window.openCategoryFeedbackForStrip('${stripId}','accuracy')" style="font-size:0.85rem; font-weight:bold; color:#d97706; text-align:center; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:2px; flex-wrap:wrap;">發音準確度<span style="font-size:0.7rem; font-weight:normal;">(${accuracyErrCount}/${totalRefWords})</span><span style="font-size:0.7rem;">👆</span></span>
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