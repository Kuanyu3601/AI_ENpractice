// ══════════════════════════════════════════════════
//  STEP NAVIGATION  (between Step 1 / 2 / 3)
// ══════════════════════════════════════════════════
// goToStep、navigateStep、_onEnterStep1/2/3、updateStepUI(735–850)

function goToStep(step) {
    if (step === state.currentStep) return;
    if (step > 0 && !state.completedSteps.has(step)) return;

    // 若正在錄音，離開前先停止
    if (state.currentStep === 1 && state.isRecording) stopRecording();

    state.currentStep = step;
    updateStepUI();

    if (step === 0) _onEnterStep1();   // 回到選文章：顯示已選文章
    if (step === 1) _onEnterStep2();   // 回到錄音：還原錄音狀態
    if (step === 2) _onEnterStep3();   // 進入分析報告，重新向後端抓資料渲染
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
    if (next === 2) _onEnterStep3();   // 進入分析報告，重新向後端抓資料渲染
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

// ── 進入 Step 3：重新向後端抓這個專案的分析報告並渲染 ──────
// 💡 這是這次修的核心：之前 goToStep/navigateStep 完全沒有處理「進入 Step 3」要做的事，
//    導致重新整理頁面後，點步驟圓點切到分析頁，畫面只是切換過去，
//    從來沒有真的去後端 /get_project_total_report 抓資料、重新渲染報告，
//    看起來就像是「沒有讀取資料庫顯示對應資料」。
function _onEnterStep3() {
    if (!state.activeProjectId) return;
    _loadAndRenderProjectReport(state.activeProjectId);
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