// ══════════════════════════════════════════════════
//  上傳與進度
// ══════════════════════════════════════════════════


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
