// ══════════════════════════════════════════════════
//  STEP 2 — RECORDING CORE (💡 軌道級精準煞車拼接版)
// ══════════════════════════════════════════════════
//

// 全域遮擋狀態（供 renderLyrics 重繪後重新套用）
window._isMasked = false;

let wavesurfer;
let wsRegions;

let currentStream = null;
// 💡 用來儲存每一段「真正講話期間」產生的 Blob 碎片
let recordedSegments = [];

// ══════════════════════════════════════════════════
//  STEP 2 — RECORDING CORE (💡 軌道級精準煞車拼接版)
// ══════════════════════════════════════════════════
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

    // 🔧 核心修正：多段錄音（中間暫停過又繼續）不能直接拼接原始位元組！
    //    每一段各自都是獨立的 MediaRecorder session、各自完整編碼成一個 WebM 檔案，
    //    直接把兩個獨立 WebM 檔案的位元組接在一起，只有第一段的檔頭有效，
    //    後面接上去的部分瀏覽器完全讀不懂，之後 convertToWav16k() 解碼就會直接報
    //    「EncodingError: Unable to decode audio data」，因為那根本不是一個合法的音檔。
    //
    //    正確做法：把每一段都先各自解碼成原始 PCM 樣本（PCM 是沒有容器格式的純數字資料），
    //    PCM 才能安全地首尾接起來，接完再統一包成一個合法的 WAV 檔案。
    let combinedBlob;
    try {
        if (recordedSegments.length === 1) {
            // 只有一段，不用合併，直接轉成 16kHz WAV 即可
            combinedBlob = await convertToWav16k(recordedSegments[0]);
        } else {
            const pcmParts = [];
            for (const seg of recordedSegments) {
                const pcm = await decodeBlobToPcm16k(seg);
                pcmParts.push(pcm);
            }
            let totalLength = 0;
            for (const p of pcmParts) totalLength += p.length;

            const merged = new Float32Array(totalLength);
            let offset = 0;
            for (const p of pcmParts) {
                merged.set(p, offset);
                offset += p.length;
            }
            combinedBlob = pcmToWav(merged, 16000);
        }
    } catch (err) {
        console.error('合併錄音片段失敗:', err);
        showToast('錄音片段合併失敗，請重新錄這一段');
        return;
    }

    // 💡 combinedBlob 現在已經是合法、可解碼的 16kHz WAV，直接供最終上傳使用
    state.recordingBlob = combinedBlob;

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



// ══════════════════════════════════════════════════
//  段落顯示/還原
// ══════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════
//  波形初始化
// ══════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════
//  遮字功能(圖片)
// ══════════════════════════════════════════════════
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