// ══════════════════════════════════════════════════
//  音訊
// ══════════════════════════════════════════════════


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



