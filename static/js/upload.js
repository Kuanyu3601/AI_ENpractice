// ══════════════════════════════════════════════════
//  上傳與進度
// ══════════════════════════════════════════════════

/**
 * ⏱️ 把前端量到的等待秒數、白板使用情形回報給後端，寫進 metrics/client_events.csv。
 *    「發了就算」：失敗只會被吃掉，絕不影響使用者操作。
 *    想幫同一批測試加上標籤（例如 child_03、cold、warm），在瀏覽器 Console 執行：
 *        localStorage.setItem('metricsSessionLabel', 'child_03')
 */
function logClientEvent(payload) {
    try {
        const body = Object.assign({
            session_label: localStorage.getItem('metricsSessionLabel') || '',
            project_id: (typeof state !== 'undefined' && state.activeProjectId) || ''
        }, payload);
        fetch('/log_client_event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            keepalive: true
        }).catch(() => {});
    } catch (e) { /* 統計失敗不影響主流程 */ }
}

/**
 * 💡 【核心新增】：「查看結論」按鈕觸發的函式。
 *    不管現在錄了幾段（可能只錄完第 1 段、也可能全部錄完），都可以呼叫，
 *    後端 /generate_project_llm_summary 會自動判斷「哪些段落還沒有 LLM 結果」，
 *    只針對那些段落產生評分與回饋，已經產生過的段落不會被重新呼叫、也不會被覆蓋。
 */
async function viewConclusion() {
    const projectId = state.activeProjectId;
    if (!projectId) {
        showToast('錯誤：找不到當前專案 ID');
        return;
    }

    const btn = document.getElementById('skipToResultBtn');
    if (btn && btn.disabled) return; // 防止重複點擊，也順便擋住「還沒錄過任何一段」時被誤觸發的情況
    if (btn) { btn.disabled = true; btn.textContent = '產生中…'; }

    const progressId = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    showUploadProgress(progressId, 'conclusion');

    try {
        const formData = new FormData();
        formData.append('project_id', projectId);
        formData.append('progress_id', progressId);

        const tConclusionStart = performance.now();  // ⏱️ 小朋友在「查看結論」實際等待的起點
        const response = await fetch('/generate_project_llm_summary', { method: 'POST', body: formData });
        const result = await response.json();
        logClientEvent({
            event: 'conclusion_wait',
            wait_sec: (performance.now() - tConclusionStart) / 1000,
            note: `processed=${result.processed_count ?? ''};skipped=${result.skipped_count ?? ''}`
        });

        if (result.status === 'success') {
            if (result.processed_count > 0) {
                showToast(`已為 ${result.processed_count} 段新錄音產生 AI 評分與建議 🎉`);
            } else {
                showToast('目前所有段落都已經有結果了，直接顯示報告 🎉');
            }
            await settleAndShowReport();
        } else {
            throw new Error(result.message || '產生結論失敗');
        }
    } catch (error) {
        console.error('查看結論失敗:', error);
        showToast('查看結論失敗: ' + error.message);
    } finally {
        hideUploadProgress();
        if (btn) { btn.disabled = false; btn.textContent = '📊 查看結論'; }
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
function showUploadProgress(progressId, phase) {
    window._uploadProgressPhase = phase || '';   // 'upload' 或 'conclusion'，白板統計時用來標註是哪一種等待
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

    // 💡 新增：上傳/處理期間，順便展開等待畫板，讓小朋友等待時可以畫畫打發時間
    // 🧪 後台開關 WHITEBOARD=off 時不顯示白板（效率對照測試用），其餘情況照常顯示
    const _wbOn = !(window.FLOW_CONFIG && window.FLOW_CONFIG.whiteboard === false);
    if (_wbOn && typeof showWhiteboard === 'function') showWhiteboard();
    if (_wbOn && typeof wbMetricsStart === 'function') wbMetricsStart();   // ⏱️ 開始統計這一次等待中的白板使用情形

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

    // ⏱️ 結束這次等待的白板統計並回報（沒有開始過統計就不會回報）
    if (typeof wbMetricsStop === 'function') {
        const wb = wbMetricsStop();
        if (wb) {
            logClientEvent({
                event: 'wb_session',
                wait_sec: wb.waitSec,
                strokes: wb.strokes,
                draw_sec: wb.drawSec,
                note: window._uploadProgressPhase || ''
            });
        }
    }

    // 💡 新增：上傳/處理結束時，把畫板「縮小到側邊」而不是關掉——
    //    小朋友畫的圖要保留下來，隨時可以點旁邊的小圖示繼續畫或看看自己畫了什麼。
    if (typeof minimizeWhiteboard === 'function') minimizeWhiteboard();
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

        showUploadProgress(progressId, 'upload');

        console.log("正在送出音檔至 Flask 後端處理...");
        const tUploadStart = performance.now();  // ⏱️ 小朋友在上傳這一步實際等待的起點
        const response = await fetch('/upload_audio', { method: 'POST', body: formDataMyBackend });
        const result = await response.json();
        logClientEvent({
            event: 'upload_wait',
            paragraph_index: currentPara,
            wait_sec: (performance.now() - tUploadStart) / 1000,
            note: result.status || ''
        });

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

// 🧪 啟動時向後端查詢目前的測試設定（FLOW_MODE / WHITEBOARD）。
//    查不到就用預設值（新流程 + 顯示白板），不影響一般使用。
window.FLOW_CONFIG = window.FLOW_CONFIG || { flow_mode: 'split', whiteboard: true };
fetch('/api/flow_config', { cache: 'no-store' })
    .then(r => r.json())
    .then(cfg => { window.FLOW_CONFIG = cfg; })
    .catch(() => { /* 保持預設值 */ });