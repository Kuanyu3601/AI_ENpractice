// ══════════════════════════════════════════════════
//  音訊
// ══════════════════════════════════════════════════


// ══════════════════════════════════════════════════
//  WAV ENCODER  (16 kHz mono)
// ══════════════════════════════════════════════════
/**
 * 💡 把一段錄音 Blob 解碼、重新取樣成 16kHz 單聲道，回傳「原始 PCM 樣本」(Float32Array)，
 *    還沒包成 WAV。這是共用的核心步驟，抽出來是因為「合併多段錄音」時
 *    （見 recorder.js 的 refreshCombinedWaveform）不能直接拼接壓縮過的位元組，
 *    必須先把每一段各自解碼成 PCM，PCM 才能安全地首尾接起來。
 */
async function decodeBlobToPcm16k(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const tmpCtx = new (window.AudioContext || window.webkitAudioContext)();

    if (tmpCtx.state === 'suspended') {
        await tmpCtx.resume();
    }

    try {
        const decoded = await tmpCtx.decodeAudioData(arrayBuffer);

        const SR = 16000;
        const numSamples = Math.round(decoded.duration * SR);
        const offCtx = new OfflineAudioContext(1, numSamples, SR);

        const src = offCtx.createBufferSource();
        src.buffer = decoded;
        src.connect(offCtx.destination);
        src.start();

        const rendered = await offCtx.startRendering();
        await tmpCtx.close();

        return rendered.getChannelData(0);
    } catch (e) {
        console.error("解碼失敗，可能是錄音檔毀損:", e);
        await tmpCtx.close();
        throw e;
    }
}

async function convertToWav16k(blob) {
    const pcmData = await decodeBlobToPcm16k(blob);
    console.log('[WAV轉碼] 第一個樣本點:', pcmData[0]);
    return pcmToWav(pcmData, 16000);
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