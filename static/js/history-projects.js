// ══════════════════════════════════════════════════
//  歷史與專案管理
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


