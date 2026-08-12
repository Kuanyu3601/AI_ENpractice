// ══════════════════════════════════════════════════
//  tts
// ══════════════════════════════════════════════════



// ══════════════════════════════════════════════════
//  文章朗讀
// ══════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════
//  中文評語
// ══════════════════════════════════════════════════
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
