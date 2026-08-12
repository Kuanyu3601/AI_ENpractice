// ══════════════════════════════════════════════════
//  選文章＋練習模式
// ══════════════════════════════════════════════════
// 原檔案內容：selectPreset、renderPreview、processFile(854–1017) 與 setPracticeMode、startPractice、fetchInitialRecordings 等(1031–1125)

// ══════════════════════════════════════════════════
//  1. STEP 1 選文章
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

// 💡 依目前作用中的專案是否為「複習」，決定文章預覽右上角清除鍵要不要顯示。
//    第一次練習 → 顯示清除鍵（可清除文章、回到只有選擇文章的狀態）
//    複習(retry) → 隱藏清除鍵（不可清除文章）
function _updateClearBtnVisibility() {
    const clearBtn = document.getElementById('clearBtn');
    if (!clearBtn) return;
    const proj = state.projects[state.activeProjectId];
    clearBtn.style.display = (proj && proj.isRetry) ? 'none' : '';
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
//  2. 練習模式切換
// ══════════════════════════════════════════════════
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

document.getElementById('uploadArea').addEventListener('click', function(e) {
    // 避免點到 label 時觸發兩次
    if (e.target.closest('label')) return;
    document.getElementById('fileInput').click();
});