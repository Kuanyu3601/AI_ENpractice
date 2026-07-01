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

// ==================== 2. 單段落即時分析器 ====================
function renderWerReportToPanel3(alignmentReport, stats, currentParaNum = 1, backendAudioUrl = '') {
    try {
        if (document.getElementById('werScoreText')) document.getElementById('werScoreText').innerText = (stats.wer_repair_fluency * 100).toFixed(1) + '%';
        if (document.getElementById('werTotalWords')) document.getElementById('werTotalWords').innerText = stats.total_ref_words;

        const container = document.getElementById('werParagraphsContainer');
        if (!container) return;

        if (container.querySelector('p') || container.innerText.includes('暫無分析資料')) container.innerHTML = '';
        const oldStrip = container.querySelector(`[data-strip-para="${currentParaNum}"]`);
        if (oldStrip) oldStrip.remove();

        const stripId = `strip-para-${currentParaNum}-${Date.now()}`;
        const strip = document.createElement('div');
        strip.id = stripId;
        strip.style.background = '#fff';
        strip.style.border = '1px solid #e2e8f0';
        strip.style.borderRadius = '12px';
        strip.style.overflow = 'hidden';
        strip.style.boxShadow = '0 2px 6px rgba(0,0,0,0.01)';
        strip.style.width = '100%';
        strip.style.boxSizing = 'border-box';
        strip.setAttribute('data-strip-para', currentParaNum);

        if (alignmentReport && alignmentReport.length > 0) {
            strip.setAttribute('data-alignment', JSON.stringify(alignmentReport).replace(/'/g, "&apos;"));
        }

        const header = document.createElement('div');
        header.style.cssText = `padding: 18px 24px; background: #f8fafc; display: flex; align-items: center; justify-content: space-between; cursor: pointer;`;
        
        let errorCount = alignmentReport ? alignmentReport.filter(i => i.Category !== 'Match' && i.category !== 'Match').length : 0;
        const displayNpvi = (stats.npvi != null) ? parseFloat(stats.npvi).toFixed(2) : '—';
        const displayVarco = (stats.varco != null) ? parseFloat(stats.varco).toFixed(2) : '—';

        header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 30px; flex: 1; flex-wrap: wrap;">
                <span style="font-weight: bold; color: #1f2937; min-width: 65px; font-size: 1.05rem;">段落 ${currentParaNum}</span>
                <span style="color: #16a34a; font-weight: bold; background: #dcfce7; padding: 4px 12px; border-radius: 8px; font-size: 0.85rem;">✓ 已錄音</span>
                <div style="display: flex; gap: 24px; color: #4a5568; font-size: 0.92rem; align-items: center; flex-wrap: wrap;">
                    <div>WER: <strong style="color: #e63946; font-size: 1.05rem;">${(stats.wer_repair_fluency * 100).toFixed(1)}%</strong></div>
                    <div>錯誤數: <strong style="color: #fb923c; font-size: 1.05rem;">${errorCount}</strong></div>
                    <div style="color: #4a5568; border-left: 1px solid #e2e8f0; padding-left: 16px;">nPVI: <strong style="color: #2563eb; font-size: 1.05rem;">${displayNpvi}</strong></div>
                    <div style="color: #4a5568;">Varco: <strong style="color: #10b981; font-size: 1.05rem;">${displayVarco}</strong></div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: #a0aec0; font-size: 0.85rem;">展開對照</span> <span class="arrow-icon" style="transition: transform 0.2s; color: #cbd5e1;">▼</span>
            </div>
        `;

        const body = document.createElement('div');
        body.style.cssText = 'padding: 24px; display: none; background: #ffffff; border-top: 1px solid #edf2f7; flex-direction: column; gap: 24px;';

        const counts = [
            stats.repair_repetition || 0, stats.repair_attempt || 0, stats.repair_restart || 0,
            stats.substitutions || 0, stats.deletions || 0, stats.insertions || 0
        ];

        let cleanAudioUrl = backendAudioUrl || '';
        if (cleanAudioUrl && !cleanAudioUrl.startsWith('/') && !cleanAudioUrl.startsWith('http')) cleanAudioUrl = '/' + cleanAudioUrl;
        if (cleanAudioUrl) cleanAudioUrl += (cleanAudioUrl.includes('?') ? '&' : '?') + 't=' + Date.now();

        // 🚀 注意看這裡！按鈕的 onClick 已經加上 ${currentParaNum}，這樣 JavaScript 才知道去哪裡抓這一段的原始文章！
        body.innerHTML = `
            <div style="display: flex; gap: 24px; width: 100%; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 300px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center;">
                    <div style="font-size: 0.95rem; font-weight: bold; color: #475569; margin-bottom: 12px; align-self: flex-start;">🕸️ 發音錯誤面向分析</div>
                    <div style="position: relative; width: 100%; height: 220px;"><canvas class="radar-canvas"></canvas></div>
                </div>
                <div style="flex: 1; min-width: 300px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; justify-content: center; gap: 20px;">
                    <div style="font-size: 0.95rem; font-weight: bold; color: #475569; margin-bottom: 4px;">🎯 流暢度達標分析 (Bullet Chart)</div>
                    <div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: bold; color: #333; margin-bottom: 6px;"><span>nPVI 節奏指數</span><span>實測: <span style="color: #2563eb;">${parseFloat(displayNpvi)||0}</span> / 標準: 50</span></div>
                        <div style="position: relative; width: 100%; height: 24px; background: #e2e8f0; border-radius: 12px; overflow: hidden;"><div style="width: ${Math.min(((parseFloat(displayNpvi)||0) / 50) * 80, 100)}%; height: 100%; background: #3b82f6; transition: width 1s;"></div><div style="position: absolute; left: 80%; top: 0; bottom: 0; width: 4px; background: #e63946;"></div></div>
                    </div>
                    <div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: bold; color: #333; margin-bottom: 6px;"><span>Varco 語速變異</span><span>實測: <span style="color: #10b981;">${parseFloat(displayVarco)||0}</span> / 標準: 45</span></div>
                        <div style="position: relative; width: 100%; height: 24px; background: #e2e8f0; border-radius: 12px; overflow: hidden;"><div style="width: ${Math.min(((parseFloat(displayVarco)||0) / 45) * 80, 100)}%; height: 100%; background: #10b981; transition: width 1s;"></div><div style="position: absolute; left: 80%; top: 0; bottom: 0; width: 4px; background: #e63946;"></div></div>
                    </div>
                </div>
            </div>
            <div style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 12px 18px; border-radius: 8px;">
                <div style="font-size: 0.9rem; font-weight: bold; color: #475569; margin-bottom: 8px;">🎵 錄音回放 (WAV)：</div>
                <audio src="${cleanAudioUrl}" controls style="width: 100%; height: 36px;" preload="metadata"></audio>
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <div style="font-size: 0.9rem; font-weight: bold; color: #475569;">🔍 點擊錯誤類別，查看發生在哪個單字：</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    <button class="wer-filter-btn" onclick="window.switchWerFilter(this, 'repair_repetition', '${stripId}', ${currentParaNum})" style="padding: 6px 14px; border:none; background: #f1f5f9; color: #475569; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.2s;">Repetition</button>
                    <button class="wer-filter-btn" onclick="window.switchWerFilter(this, 'repair_attempt', '${stripId}', ${currentParaNum})" style="padding: 6px 14px; border:none; background: #f1f5f9; color: #475569; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.2s;">Attempt</button>
                    <button class="wer-filter-btn" onclick="window.switchWerFilter(this, 'repair_restart', '${stripId}', ${currentParaNum})" style="padding: 6px 14px; border:none; background: #f1f5f9; color: #475569; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.2s;">Restart</button>
                    <button class="wer-filter-btn" onclick="window.switchWerFilter(this, 'substitutions', '${stripId}', ${currentParaNum})" style="padding: 6px 14px; border:none; background: #f1f5f9; color: #475569; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.2s;">Substitutions</button>
                    <button class="wer-filter-btn" onclick="window.switchWerFilter(this, 'deletions', '${stripId}', ${currentParaNum})" style="padding: 6px 14px; border:none; background: #f1f5f9; color: #475569; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.2s;">Deletions</button>
                    <button class="wer-filter-btn" onclick="window.switchWerFilter(this, 'insertions', '${stripId}', ${currentParaNum})" style="padding: 6px 14px; border:none; background: #f1f5f9; color: #475569; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.2s;">Insertions</button>
                </div>
                <div class="transcript-display-area" style="margin-top: 8px;">
                    <div style="text-align: center; color: #94a3b8; font-size: 0.95rem; padding: 20px; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
                        請點擊上方的分類按鈕，以顯示逐字稿與標記紅字。
                    </div>
                </div>
            </div>
        `;

        header.addEventListener('click', () => {
            const isHidden = body.style.display === 'none';
            body.style.display = isHidden ? 'flex' : 'none';
            header.querySelector('.arrow-icon').style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
            header.style.background = isHidden ? '#f1f5f9' : '#f8fafc';

            if (isHidden && !body.dataset.chartRendered) {
                body.dataset.chartRendered = 'true';
                const canvas = body.querySelector('.radar-canvas');
                if (canvas) {
                    new Chart(canvas.getContext('2d'), {
                        type: 'radar',
                        data: {
                            labels: ['Repetition', 'Attempt', 'Restart', 'Substitutions', 'Deletions', 'Insertions'],
                            datasets: [{ label: '發生次數', data: counts, backgroundColor: 'rgba(230, 57, 70, 0.2)', borderColor: '#e63946', pointBackgroundColor: '#e63946', borderWidth: 2 }]
                        },
                        options: { responsive: true, maintainAspectRatio: false, scales: { r: { beginAtZero: true, ticks: { stepSize: 1, backdropColor: 'transparent' }, pointLabels: { font: { size: 11, weight: 'bold' }, color: '#475569' } } }, plugins: { legend: { display: false } } }
                    });
                }
            }
        });

        strip.appendChild(header);
        strip.appendChild(body);
        container.appendChild(strip);
    } catch (err) { console.error("❌ 即時渲染失敗：", err); }
}

// ==================== 3. 歷史大禮包總成 ====================
function renderMultipleParagraphsReport(paragraphList, globalStats, mode = 'segment') {
    try {
        const isWhole = mode === 'whole';

        // 💡 whole 模式：只有 paragraph_index = 0 是真正的整篇錄音，
        //    其他段落條目只是分段練習殘留的佔位資料，直接忽略、不參與平均。
        let effectiveList = paragraphList;
        let effectiveGlobalStats = globalStats;

        if (isWhole) {
            const wholeEntry = (paragraphList || []).find(
                p => p.paragraph_index === 0 && p.file_path !== null && p.wer !== null
            );

            effectiveList = wholeEntry ? [wholeEntry] : [];

            // 💡 整篇模式已經是「單一完整結果」，不用再平均，直接拿它自己的數值當總體看板
            effectiveGlobalStats = wholeEntry ? {
                wer_average: wholeEntry.wer,
                total_words: wholeEntry.total_ref_words ?? (globalStats ? globalStats.total_words : 0),
                total_errors: wholeEntry.error_count,
                average_npvi: wholeEntry.npvi,
                average_varco: wholeEntry.varco
            } : null;
        }

        if (document.getElementById('werScoreText')) {
            document.getElementById('werScoreText').innerText =
                effectiveGlobalStats ? (effectiveGlobalStats.wer_average * 100).toFixed(1) + '%' : '0.0%';
        }
        if (document.getElementById('werTotalWords')) {
            document.getElementById('werTotalWords').innerText =
                effectiveGlobalStats ? effectiveGlobalStats.total_words : '0';
        }
        if (document.getElementById('werErrorCount')) {
            document.getElementById('werErrorCount').innerText =
                effectiveGlobalStats ? effectiveGlobalStats.total_errors : '0';
        }
        if (document.getElementById('werAvgNpvi')) {
            document.getElementById('werAvgNpvi').innerText =
                (effectiveGlobalStats && effectiveGlobalStats.average_npvi != null)
                    ? parseFloat(effectiveGlobalStats.average_npvi).toFixed(2) : '0.00';
        }
        if (document.getElementById('werAvgVarco')) {
            document.getElementById('werAvgVarco').innerText =
                (effectiveGlobalStats && effectiveGlobalStats.average_varco != null)
                    ? parseFloat(effectiveGlobalStats.average_varco).toFixed(2) : '0.00';
        }

        // 💡 順手把標題文字也改一下，whole 模式不叫「Total 平均」
        const bannerTitle = document.getElementById('scoreBannerTitle');
        if (bannerTitle) {
            bannerTitle.innerHTML = isWhole
                ? '📊 整篇朗讀流暢度結算看板'
                : '📊 總體朗讀流暢度結算看板 (Total 平均)';
        }

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

        paragraphList.forEach((para) => {
            const hasRecorded = para.file_path !== null && para.wer !== null;
            const stripId = `strip-para-${para.paragraph_index}-${Date.now()}`;

            let extendedReport = {};
            if (para.alignment_report) {
                if (typeof para.alignment_report === 'string') {
                    try { extendedReport = JSON.parse(para.alignment_report); } catch(e) {}
                } else { extendedReport = para.alignment_report; }
            }

            const strip = document.createElement('div');
            strip.id = stripId;
            strip.style.cssText = 'background:#fff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.01); width:100%; box-sizing:border-box; margin-bottom:8px;';

            const alignments = extendedReport.word_alignments || [];
            if (hasRecorded && alignments.length > 0) {
                strip.setAttribute('data-alignment', JSON.stringify(alignments).replace(/'/g, "&apos;"));
            }

            const singleParaNpvi = (hasRecorded && para.npvi != null) ? parseFloat(para.npvi).toFixed(2) : '—';
            const singleParaVarco = (hasRecorded && para.varco != null) ? parseFloat(para.varco).toFixed(2) : '—';
            const statusBadge = hasRecorded 
                ? `<span style="color: #16a34a; font-weight: bold; background: #dcfce7; padding: 4px 12px; border-radius: 8px; font-size: 0.85rem;">✓ 已錄音</span>` 
                : `<span style="color: #64748b; font-weight: bold; background: #f1f5f9; padding: 4px 12px; border-radius: 8px; font-size: 0.85rem;">✕ 未錄音</span>`;

            const header = document.createElement('div');
            header.style.cssText = `padding: 18px 24px; background: ${hasRecorded ? '#f8fafc' : '#fcfcfc'}; display: flex; align-items: center; justify-content: space-between; cursor: ${hasRecorded ? 'pointer' : 'not-allowed'}; opacity: ${hasRecorded ? '1' : '0.65'};`;
            header.innerHTML = `
                <div style="display: flex; align-items: center; gap: 30px; flex: 1; flex-wrap: wrap;">
                    <span style="font-weight: bold; color: #1f2937; min-width: 65px; font-size: 1.05rem;">段落 ${para.paragraph_index}</span>
                    ${statusBadge}
                    <div style="display: flex; gap: 24px; color: #4a5568; font-size: 0.92rem; align-items: center; flex-wrap: wrap;">
                        <div>WER: <strong style="color: #e63946; font-size: 1.05rem;">${hasRecorded ? (para.wer * 100).toFixed(1) + '%' : '—'}</strong></div>
                        <div>錯誤數: <strong style="color: #fb923c; font-size: 1.05rem;">${hasRecorded ? para.error_count : '—'}</strong></div>
                        <div style="color: #4a5568; border-left: 1px solid #e2e8f0; padding-left: 16px;">nPVI: <strong style="color: #2563eb; font-size: 1.05rem;">${singleParaNpvi}</strong></div>
                        <div style="color: #4a5568;">Varco: <strong style="color: #10b981; font-size: 1.05rem;">${singleParaVarco}</strong></div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    ${hasRecorded ? '<span style="color: #a0aec0; font-size: 0.85rem;">展開對照</span> <span class="arrow-icon" style="transition: transform 0.2s; color: #cbd5e1;">▼</span>' : ''}
                </div>
            `;

            const body = document.createElement('div');
            body.style.cssText = 'padding: 24px; display: none; background: #ffffff; border-top: 1px solid #edf2f7; flex-direction: column; gap: 24px;';

            if (hasRecorded) {
                const rawWer = extendedReport.raw_wer_output || {};
                const stats = rawWer.statistics || {}; 
                const counts = [
                    stats.repair_repetition || 0, stats.repair_attempt || 0, stats.repair_restart || 0,
                    stats.substitutions || 0, stats.deletions || 0, stats.insertions || 0
                ];

                let cleanAudioUrl = para.file_path || '';
                if (cleanAudioUrl && !cleanAudioUrl.startsWith('/') && !cleanAudioUrl.startsWith('http')) cleanAudioUrl = '/' + cleanAudioUrl;
                if (cleanAudioUrl) cleanAudioUrl += (cleanAudioUrl.includes('?') ? '&' : '?') + 't=' + Date.now();

                // 🚀 這裡的按鈕同樣加上了 ${para.paragraph_index}
                body.innerHTML = `
                    <div style="display: flex; gap: 24px; width: 100%; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 300px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center;">
                            <div style="font-size: 0.95rem; font-weight: bold; color: #475569; margin-bottom: 12px; align-self: flex-start;">🕸️ 發音錯誤面向分析</div>
                            <div style="position: relative; width: 100%; height: 220px;"><canvas class="radar-canvas"></canvas></div>
                        </div>
                        <div style="flex: 1; min-width: 300px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; justify-content: center; gap: 20px;">
                            <div style="font-size: 0.95rem; font-weight: bold; color: #475569; margin-bottom: 4px;">🎯 流暢度達標分析 (Bullet Chart)</div>
                            <div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: bold; color: #333; margin-bottom: 6px;"><span>nPVI 節奏指數</span><span>實測: <span style="color: #2563eb;">${parseFloat(singleParaNpvi)||0}</span> / 標準: 50</span></div>
                                <div style="position: relative; width: 100%; height: 24px; background: #e2e8f0; border-radius: 12px; overflow: hidden;"><div style="width: ${Math.min(((parseFloat(singleParaNpvi)||0) / 50) * 80, 100)}%; height: 100%; background: #3b82f6; transition: width 1s;"></div><div style="position: absolute; left: 80%; top: 0; bottom: 0; width: 4px; background: #e63946;"></div></div>
                            </div>
                            <div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: bold; color: #333; margin-bottom: 6px;"><span>Varco 語速變異</span><span>實測: <span style="color: #10b981;">${parseFloat(singleParaVarco)||0}</span> / 標準: 45</span></div>
                                <div style="position: relative; width: 100%; height: 24px; background: #e2e8f0; border-radius: 12px; overflow: hidden;"><div style="width: ${Math.min(((parseFloat(singleParaVarco)||0) / 45) * 80, 100)}%; height: 100%; background: #10b981; transition: width 1s;"></div><div style="position: absolute; left: 80%; top: 0; bottom: 0; width: 4px; background: #e63946;"></div></div>
                            </div>
                        </div>
                    </div>
                    <div style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 12px 18px; border-radius: 8px;">
                        <div style="font-size: 0.9rem; font-weight: bold; color: #475569; margin-bottom: 8px;">🎵 錄音回放 (WAV)：</div>
                        <audio src="${cleanAudioUrl}" controls style="width: 100%; height: 36px;" preload="metadata"></audio>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="font-size: 0.9rem; font-weight: bold; color: #475569;">🔍 點擊錯誤類別，查看發生在哪個單字：</div>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            <button class="wer-filter-btn" onclick="window.switchWerFilter(this, 'repair_repetition', '${stripId}', ${para.paragraph_index})" style="padding: 6px 14px; border:none; background: #f1f5f9; color: #475569; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.2s;">Repetition</button>
                            <button class="wer-filter-btn" onclick="window.switchWerFilter(this, 'repair_attempt', '${stripId}', ${para.paragraph_index})" style="padding: 6px 14px; border:none; background: #f1f5f9; color: #475569; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.2s;">Attempt</button>
                            <button class="wer-filter-btn" onclick="window.switchWerFilter(this, 'repair_restart', '${stripId}', ${para.paragraph_index})" style="padding: 6px 14px; border:none; background: #f1f5f9; color: #475569; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.2s;">Restart</button>
                            <button class="wer-filter-btn" onclick="window.switchWerFilter(this, 'substitutions', '${stripId}', ${para.paragraph_index})" style="padding: 6px 14px; border:none; background: #f1f5f9; color: #475569; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.2s;">Substitutions</button>
                            <button class="wer-filter-btn" onclick="window.switchWerFilter(this, 'deletions', '${stripId}', ${para.paragraph_index})" style="padding: 6px 14px; border:none; background: #f1f5f9; color: #475569; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.2s;">Deletions</button>
                            <button class="wer-filter-btn" onclick="window.switchWerFilter(this, 'insertions', '${stripId}', ${para.paragraph_index})" style="padding: 6px 14px; border:none; background: #f1f5f9; color: #475569; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.2s;">Insertions</button>
                        </div>
                        <div class="transcript-display-area" style="margin-top: 8px;">
                            <div style="text-align: center; color: #94a3b8; font-size: 0.95rem; padding: 20px; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
                                請點擊上方的分類按鈕，以顯示逐字稿與標記紅字。
                            </div>
                        </div>
                    </div>
                `;

                header.addEventListener('click', () => {
                    const isHidden = body.style.display === 'none';
                    body.style.display = isHidden ? 'flex' : 'none';
                    header.querySelector('.arrow-icon').style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                    header.style.background = isHidden ? '#f1f5f9' : '#f8fafc';

                    if (isHidden && !body.dataset.chartRendered) {
                        body.dataset.chartRendered = 'true';
                        const canvas = body.querySelector('.radar-canvas');
                        if (canvas) {
                            new Chart(canvas.getContext('2d'), {
                                type: 'radar',
                                data: {
                                    labels: ['Repetition', 'Attempt', 'Restart', 'Substitutions', 'Deletions', 'Insertions'],
                                    datasets: [{ label: '發生次數', data: counts, backgroundColor: 'rgba(230, 57, 70, 0.2)', borderColor: '#e63946', pointBackgroundColor: '#e63946', borderWidth: 2 }]
                                },
                                options: { responsive: true, maintainAspectRatio: false, scales: { r: { beginAtZero: true, ticks: { stepSize: 1, backdropColor: 'transparent' }, pointLabels: { font: { size: 11, weight: 'bold' }, color: '#475569' } } }, plugins: { legend: { display: false } } }
                            });
                        }
                    }
                });
            }

            strip.appendChild(header);
            strip.appendChild(body);
            container.appendChild(strip);
        });

    } catch (err) { console.error("❌ 渲染歷史大禮包失敗:", err); }
}

console.log('[main.js v3] ✓ 已載入');

function toggleSidebar() {
    const sidebar     = document.getElementById('sidebar');
    const showBtn     = document.getElementById('sidebarShowBtn');
    if (!sidebar) return;
 
    const collapsed = sidebar.classList.toggle('is-collapsed');
 
    if (showBtn) {
        showBtn.classList.toggle('is-visible', collapsed);
    }
 
    // 記住使用者的選擇，下次開啟頁面時維持同樣狀態
    try {
        localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0');
    } catch (e) { /* 忽略無痕模式等例外狀況 */ }
}
 
// 💡 頁面載入時還原使用者上次的收合狀態
document.addEventListener('DOMContentLoaded', () => {
    let wasCollapsed = false;
    try {
        wasCollapsed = localStorage.getItem('sidebarCollapsed') === '1';
    } catch (e) { /* 忽略 */ }
 
    if (wasCollapsed) {
        const sidebar = document.getElementById('sidebar');
        const showBtn = document.getElementById('sidebarShowBtn');
        if (sidebar) sidebar.classList.add('is-collapsed');
        if (showBtn) showBtn.classList.add('is-visible');
    }
});

// Kitten's_Choice 各段提示圖片設定
// 格式：每個段落（索引0, 1, 2...）對應三張圖片的路徑
// 請把 src 換成你實際的檔案路徑
var KITTENS_CHOICE_HINTS = [
    // 段落 1（index 0）
    [
        { src: '/static/image/hint/kitten_101.webp', alt: '段落1 提示A' },
        { src: '/static/image/hint/kitten_102.webp', alt: '段落1 提示B' },
        { src: '/static/image/hint/kitten_103.webp', alt: '段落1 提示C' },
    ],
    // 段落 2（index 1）
    [
        { src: '/static/image/hint/kitten_201.webp', alt: '段落2 提示A' },
        { src: '/static/image/hint/kitten_202.webp', alt: '段落2 提示B' },
        { src: '/static/image/hint/kitten_203.webp', alt: '段落2 提示C' },
    ],
    // 段落 3（index 2）
    [
        { src: '/static/image/hint/kitten_301.webp', alt: '段落3 提示A' },
        { src: '/static/image/hint/kitten_302.webp', alt: '段落3 提示B' },
        { src: '/static/image/hint/kitten_303.webp', alt: '段落3 提示C' },
    ],
    // 段落 4（index 3）
    [
        { src: '/static/image/hint/kitten_401.webp', alt: '段落4 提示A' },
        { src: '/static/image/hint/kitten_402.webp', alt: '段落4 提示B' },
        { src: '/static/image/hint/kitten_403.webp', alt: '段落4 提示C' },
    ],
];

var SHARKS_HINTS = [
    // 段落 1（index 0）
    [
        { src: '/static/image/hint/shark_101.webp', alt: '段落1 提示A' },
        { src: '/static/image/hint/shark_102.webp', alt: '段落1 提示B' },
        { src: '/static/image/hint/shark_103.webp', alt: '段落1 提示C' },
    ],
    // 段落 2（index 1）
    [
        { src: '/static/image/hint/shark_201.webp', alt: '段落2 提示A' },
        { src: '/static/image/hint/shark_202.webp', alt: '段落2 提示B' },
        { src: '/static/image/hint/shark_203.webp', alt: '段落2 提示C' },
    ],
    // 段落 3（index 2）
    [
        { src: '/static/image/hint/shark_301.webp', alt: '段落3 提示A' },
        { src: '/static/image/hint/shark_302.webp', alt: '段落3 提示B' },
        { src: '/static/image/hint/shark_303.webp', alt: '段落3 提示C' },
    ],
    // 段落 4（index 3）
    [
        { src: '/static/image/hint/shark_401.webp', alt: '段落4 提示A' },
        { src: '/static/image/hint/shark_402.webp', alt: '段落4 提示B' },
        { src: '/static/image/hint/shark_403.webp', alt: '段落4 提示C' },
    ],
];


var _total      = 0;
var _currentIdx = 0;
var _recorded   = new Set();
var _decorating = false;
var _articleKey = null; // 💡 新增：追蹤目前是「哪一篇/哪一次」，setTotal 靠這個判斷是否真的換了文章

// 全域遮擋狀態（供 renderLyrics 重繪後重新套用）
window._isMasked = false;

let wavesurfer;
let wsRegions;

window.ParagraphUI = (function () {
    'use strict';

    // 【關鍵】所有工具函數都必須在這個 function 作用域內定義
    function buildOverview() {
        const overviewStrip = document.getElementById('paraOverviewStrip');
        if (!overviewStrip) return;
        overviewStrip.innerHTML = '';
        for (var i = 0; i < _total; i++) {
            var pip = document.createElement('div');
            pip.className   = 'para-pip';
            pip.dataset.idx = i;
            pip.title       = '段落 ' + (i + 1);
            pip.textContent = i + 1;
            pip.addEventListener('click', function() {
                var idx = parseInt(this.dataset.idx, 10);
                if (typeof window.goToParagraph === 'function') window.goToParagraph(idx);
            });
            overviewStrip.appendChild(pip);
        }
        refreshOverview();
    }

    function refreshOverview() {
        const overviewStrip = document.getElementById('paraOverviewStrip');
        if (!overviewStrip) return;
        overviewStrip.querySelectorAll('.para-pip').forEach(function (pip) {
            var idx = parseInt(pip.dataset.idx, 10);
            pip.className = 'para-pip';
            if (idx === _currentIdx)     pip.classList.add('pip-current');
            else if (_recorded.has(idx)) pip.classList.add('pip-recorded');
            else                         pip.classList.add('pip-pending');
        });
    }

    // ── Paragraph badge decoration ───────────────────
    function decorateParagraphs() {
        if (!lyricsView) return;
        _decorating = true;
        var paras = lyricsView.querySelectorAll('.lyric-para');
        if (!paras.length) return;

        if (_total === 0) _total = paras.length;
        if (overviewStrip && !overviewStrip.children.length) buildOverview();

        paras.forEach(function (para, domIdx) {
            var idx = parseInt(para.dataset.paraIdx, 10);
            if (isNaN(idx)) idx = domIdx;

            if (para.classList.contains('lyric-current')) _currentIdx = idx;

            // Inject status-row once
            if (!para.querySelector('.lyric-status-row')) {
                var row   = document.createElement('div');
                row.className = 'lyric-status-row';
                var num   = document.createElement('span');
                num.className = 'lyric-para-num';
                num.textContent = '段落 ' + (idx + 1);
                var badge = document.createElement('span');
                badge.className = 'lyric-badge';
                row.appendChild(num);
                row.appendChild(badge);
                para.insertBefore(row, para.firstChild);
            }

            updateParaBadge(para, idx);

            // Click handler (once)
            if (!para.dataset.clickBound) {
                para.dataset.clickBound = '1';
                para.addEventListener('click', function () {
                    if (this.classList.contains('lyric-current')) return;
                    var i = parseInt(this.dataset.paraIdx, 10);
                    if (isNaN(i)) {
                        i = Array.prototype.indexOf.call(
                            lyricsView.querySelectorAll('.lyric-para'), this
                        );
                    }
                    if (typeof window.goToParagraph === 'function') window.goToParagraph(i);
                });
            }

            // Tooltip hint
            para.dataset.hint = para.classList.contains('lyric-current') ? '' : '點擊切換至此段落';

            // Recorded tint
            if (_recorded.has(idx)) para.classList.add('para-recorded');
            else                     para.classList.remove('para-recorded');
        });

        refreshOverview();
        _decorating = false;
    }

    function updateParaBadge(para, idx) {
        var badge = para.querySelector('.lyric-badge');
        if (!badge) return;
        if (para.classList.contains('lyric-current')) {
            badge.className   = 'lyric-badge badge-current';
            badge.textContent = '▶ 目前段落';
        } else if (_recorded.has(idx)) {
            badge.className   = 'lyric-badge badge-recorded';
            badge.textContent = '✓ 已錄音';
        } else {
            badge.className   = 'lyric-badge badge-pending';
            badge.textContent = '○ 待錄音';
        }
    }

    function refreshAll() {
        // 這裡可以呼叫原本的 decorateParagraphs 邏輯
        // 確保你原本 code 裡的 decorateParagraphs 也在這個作用域內
        if (typeof decorateParagraphs === 'function') decorateParagraphs();
        refreshOverview();
    }

    // 暴露給外部的 API
    return {
        setTotal: function (n, key) {
            // 💡 關鍵修正：這個函式原本「每次被呼叫」都會無條件清空 _recorded（已錄音記錄），
            //    但它其實在每次段落重新渲染（包含錄完一段自動跳下一段、或點擊切換段落）都會被呼叫，
            //    導致綠色的「已錄音」標記畫出來沒多久就被下一次重繪清空。
            //    現在改成：只有在「真的換了不同文章/次數」時才重置，同一篇文章內的重繪不會影響已錄音記錄。
            var isSameArticle = (key !== undefined && key !== null)
                ? (key === _articleKey)
                : (n === _total && _total !== 0);

            _total = n;
            if (key !== undefined) _articleKey = key;

            if (!isSameArticle) {
                _recorded   = new Set();
                _currentIdx = 0;
            }
            buildOverview(); // 現在這裡就能找到了
        },
        markRecorded: function (idx) {
            _recorded.add(idx);
            refreshOverview();
        },
        setCurrentIdx: function (idx) {
            _currentIdx = idx;
            refreshOverview();
        }
    };
})();

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

// ══════════════════════════════════════════════════
//  PRESET ARTICLES DATA
// ══════════════════════════════════════════════════
const PRESET_ARTICLES = {
    shark: {
        title: 'Shark',
        emoji: '🦈',
        paragraphs: [
            "What has fins, sharp teeth, and swims in the ocean? A Shark!",
            "Sharks have been around for a very long time. Sharks have lived in the oceans even before dinosaurs! Sharks are fish, and there are over four hundred types of sharks. When they have babies, the babies are called pups.",
            "Sharks lose their teeth, like humans, but they don't just lose their baby teeth. They lose teeth throughout their lives. When a shark loses a tooth, a tooth from another row of teeth will move into its place. New teeth are always growing.",
            "Sharks might look scary, but they are not usually dangerous to people. People are more dangerous to sharks, since people hunt sharks. To be safe, it is a good idea to leave sharks alone if you see them!"
        ]
    },
    kitten: null, // Coming soon
    temp: null    // Coming soon
};

// ══════════════════════════════════════════════════
//  APP STATE
// ══════════════════════════════════════════════════
const state = {
    activeProjectId: null, // 當前選中的專案 ID (例如: 'proj_1714320000000')
    projects: {},          // 存放所有專案資料: { 'id': { article, recordings, currentStep, ... } }

    // 以下為「當前活動專案」的快速引用 (保留原本變數名稱，不影響舊有邏輯)
    currentStep: 0,
    completedSteps: new Set([0]),
    article: null,
    currentParagraph: 0,
    practiceMode: 'segment', // 'segment' = 分段練習, 'whole' = 整篇練習
    recordings: [],        // 儲存本次練習的 Blob 暫存

    // 錄音工具狀態
    mediaRecorder: null,
    audioChunks: [],
    isRecording: false,
    recordingBlob: null,
    timerInterval: null,
    timerSeconds: 0,
    recordState: 'idle'
};



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
    safeBind('clearBtn', 'click', clearSelection);
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
//  FIRST-TIME & PROFILE
// ══════════════════════════════════════════════════
function checkFirstTime() {
    const age = localStorage.getItem('userAge');
    const modal = document.getElementById('firstTimeModal');
    // 💡 防禦性修正：加上元素存在檢查，避免這裡出錯連帶讓 DOMContentLoaded
    //    裡「這行之後」的 bindEvents()、initUserHistory() 等初始化整批失效
    if (!age && modal) {
        modal.classList.add('active');
    }
}

function confirmAge() {
    const input = document.getElementById('modalAge');
    const age = parseInt(input.value);
    if (!age || age < 1 || age > 120) {
        input.style.borderColor = '#e74c3c';
        input.focus();
        return;
    }
    localStorage.setItem('userAge', age);
    const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    profile.age = age;
    localStorage.setItem('userProfile', JSON.stringify(profile));
    document.getElementById('firstTimeModal').classList.remove('active');
    showToast('歡迎！資料已儲存');
}

async function openProfile() {
    // 1. 打開 UI 面板
    document.getElementById('profilePanel').classList.add('open');
    document.getElementById('profileOverlay').classList.add('active');

    try {
        // 2. 向後端要目前 Session 使用者的最新資料
        const res = await fetch('/api/get_user_info');
        const data = await res.json();

        if (data.status === 'success') {
            // 3. 將資料庫的資料填入網頁欄位中
            document.getElementById('profileName').value = data.name || '';
            document.getElementById('profileAge').value = data.age || '';
            document.getElementById('profileUsername').value = data.username || '';
        } else {
            showToast('無法載入使用者資料，請重新登入');
        }
    } catch (err) {
        console.error('載入個人資料失敗:', err);
    }
}

function closeProfile() {
    document.getElementById('profilePanel').classList.remove('open');
    document.getElementById('profileOverlay').classList.remove('active');
}

async function saveProfile() {
    const nameInput = document.getElementById('profileName').value.trim();
    const ageInput = parseInt(document.getElementById('profileAge').value);

    if (!nameInput) { showToast('姓名不能為空喔！'); return; }
    if (!ageInput || ageInput < 1 || ageInput > 120) { showToast('請輸入有效的年齡'); return; }

    try {
        // 將更新後的姓名與年齡傳回後端寫入 users 資料表
        const res = await fetch('/api/update_user_info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: nameInput,
                age: ageInput
            })
        });
        const data = await res.json();

        if (data.status === 'success') {
            showToast('個人資料已成功同步至資料庫 ✓');
            closeProfile();
        } else {
            showToast('儲存失敗，請稍後再試');
        }
    } catch (err) {
        console.error('儲存個人資料失敗:', err);
        showToast('網路錯誤，無法儲存');
    }
}

// ══════════════════════════════════════════════════
//  STEP NAVIGATION  (between Step 1 / 2 / 3)
// ══════════════════════════════════════════════════
function goToStep(step) {
    if (step === state.currentStep) return;
    if (step > 0 && !state.completedSteps.has(step)) return;

    // 若正在錄音，離開前先停止
    if (state.currentStep === 1 && state.isRecording) stopRecording();

    state.currentStep = step;
    updateStepUI();

    if (step === 0) _onEnterStep1();   // 回到選文章：顯示已選文章
    if (step === 1) _onEnterStep2();   // 回到錄音：還原錄音狀態
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

// ══════════════════════════════════════════════════
//  STEP 1 — ARTICLE SELECTION
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

    // 確保抓到的 DOM 不是 null
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
        areaEl.style.display = 'block'; // 確保 CSS 沒有隱藏它
    }
}

function clearSelection() {
    state.article = null;
    document.querySelectorAll('.article-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('selectedPreview').classList.remove('visible');
    document.getElementById('startBtn').disabled = true;
    document.getElementById('readingCountNum').textContent = '—';
    document.getElementById('readingHistoryList').innerHTML = '<p class="dropdown-empty">請先選擇文章</p>';
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
//  練習模式切換：分段練習 / 整篇練習
// ══════════════════════════════════════════════════

/**
 * 💡 關鍵修正：practiceMode（分段/整篇）目前後端完全沒有對應欄位可以存，
 *    只存在瀏覽器記憶體的 state.projects 裡；一旦分頁重新整理、initUserHistory()
 *    重新向後端抓歷史紀錄，這個選擇就會遺失、被迫全部視為預設的「分段練習」。
 *    這裡改用 localStorage（以 project_id 當 key）額外保存一份，
 *    這樣即使重新整理分頁，也能正確還原「這次到底是分段還是整篇」。
 */
const PRACTICE_MODE_STORAGE_KEY = 'practiceModeByProject';

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

async function fetchInitialRecordings() {
    const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const username = profile.username || "guest";
    const articleName = state.article.title;

    try {
        // 向後端請求該文章所有已上傳的段落索引
        // 假設後端有一個路由回傳: { recorded_indices: [1, 2, 5] }
        const res = await fetch(`/get_recorded_indices?username=${username}&article_name=${articleName}`);
        const data = await res.json();

        if (data.recorded_indices && window.ParagraphUI) {
            data.recorded_indices.forEach(idx => {
                // 標記小圓點為「已錄音」狀態 (index 從 0 開始)
                ParagraphUI.markRecorded(idx - 1);
            });
        }
    } catch (e) {
        console.warn("無法取得初始錄音紀錄", e);
    }
}

document.getElementById('uploadArea').addEventListener('click', function(e) {
    // 避免點到 label 時觸發兩次
    if (e.target.closest('label')) return;
    document.getElementById('fileInput').click();
});
// ══════════════════════════════════════════════════
//  STEP 2 — RECORDING CORE (💡 軌道級精準煞車拼接版)
// ══════════════════════════════════════════════════

let currentStream = null;
// 💡 用來儲存每一段「真正講話期間」產生的 Blob 碎片
let recordedSegments = [];

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
        curEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
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
    const totalWords = document.getElementById('werTotalWords');
    const errorCountEl = document.getElementById('werErrorCount');

    if (scoreText) scoreText.textContent = '0.0%';
    if (totalWords) totalWords.textContent = '0';
    if (errorCountEl) errorCountEl.textContent = '0';
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

    // 將所有暫存的有效說話碎片拼成一個完整的大音檔
    const combinedBlob = new Blob(recordedSegments, { type: recordedSegments[0].type });
    state.recordingBlob = combinedBlob; // 供最終上傳使用

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

/** 按下確認上傳鍵：如果還在錄音，幫他自動封裝收尾並傳送 */
async function uploadAudio() {
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

    if (!state.recordingBlob) { showToast('請先錄音再上傳'); return; }

    const btn = document.getElementById('uploadAudioBtn');
    if (btn) { btn.disabled = true; btn.textContent = '上傳中…'; }

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
        const formDataMyBackend = new FormData();
        formDataMyBackend.append("audio_data", wavBlob);
        formDataMyBackend.append("project_id", projectId);
        formDataMyBackend.append("username", username);
        formDataMyBackend.append("article_name", articleName);
        formDataMyBackend.append("paragraph_index", currentPara);
        formDataMyBackend.append("mode", mode);
        console.log(`正在上傳... 模式: ${mode}, 段落索引: ${currentPara}`);

        console.log("正在送出音檔至 Flask 後端處理...");
        const response = await fetch('/upload_audio', { method: 'POST', body: formDataMyBackend });
        const result = await response.json();

        // --- 🏁 核心主流程收尾與報表渲染 (在 main.js 內 uploadAudio 成功接收處) ---
        if (response.ok && result.status === 'success') {
            state.recordings[state.currentParagraph] = state.recordingBlob;

            if (window.ParagraphUI) ParagraphUI.markRecorded(state.currentParagraph);

            if (result.wer_result && result.wer_result.statistics) {
                // 補丁安全防禦：如果後端 statistics 裡沒有 npvi/varco，把外層實體算好的分數注入進去
                if (result.wer_result.npvi !== undefined) {
                    result.wer_result.statistics.npvi = result.wer_result.npvi;
                }
                if (result.wer_result.varco !== undefined) {
                    result.wer_result.statistics.varco = result.wer_result.varco;
                }

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
                if (typeof settleAndShowReport === 'function') {
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
    }
}

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



// ══════════════════════════════════════════════════
//  HISTORY & SESSIONS
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

// ══════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
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

async function uploadAndContinue() {
    const blob = await getRecorderBlob(); // 獲取錄音的 Blob 檔案
    const formData = new FormData();

    // 從頁面元素或變數中提取資訊
    formData.append("audio_data", blob);
    formData.append("username", document.getElementById('profileUsername').value || "guest");
    formData.append("age", document.getElementById('modalAge').value || "0");
    formData.append("article_name", currentArticleId); // 比如 'shark'
    formData.append("reading_count", document.getElementById('readingCountNum').innerText);
    formData.append("paragraph_index", currentParaIndex);

    try {
        const response = await fetch('/upload_audio', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (result.status === 'success') {
            // 設定回放元件的來源
            const playbackAudio = document.getElementById('playbackAudio');
            playbackAudio.src = result.url;
            showToast("錄音已儲存並可回放！");
        }
    } catch (error) {
        console.error("上傳失敗:", error);
    }
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
        // 新增模式防呆：避免重複建立空專案
        const hasEmpty = Object.values(state.projects).find(p => !p.article);
        if (hasEmpty) {
            showToast('請先完成目前的未命名專案');
            await switchProject(hasEmpty.id);
            return;
        }
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
            document.getElementById('chatTitle').textContent = `🔄 複習：${state.article.title}`;
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

// 💡 以下這整段（原本的頂層 state.mediaRecorder.onstop / 重複的 addProjectBtn 綁定 /
//    重複的 window click 監聽）是舊版遺留、與現有 startRecordingSegment() 邏輯重複且
//    參照了不存在的 stream 變數的失效程式碼，會在頁面上沒有 addProjectBtn 元素時直接
//    拋出例外、讓「這行之後」的所有頂層程式碼整個停擺。上面已經用防禦性寫法重新綁定過
//    一次同樣的功能，這裡整段移除，不影響任何現有功能。

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
    } else {
        console.warn('[遮擋警告] 標題既不符合 Kitten 也不符合 Shark，hintSet 為空');
    }

    console.log(`[遮擋觸發] 最終使用段落索引:${safeIdx} 圖片數量: ${hintSet.length}`, hintSet);

    slots.forEach((slot, i) => {
        if (!slot) return;
        const imgData = hintSet[i] || null;
        while (slot.firstChild) slot.removeChild(slot.firstChild);

        if (imgData && imgData.src) {
            const img = document.createElement('img');
            img.src = imgData.src;
            img.alt = imgData.alt || '';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.onerror = function() {
                console.error(`❌ 圖片載入失敗！路徑: ${this.src}`);
                slot.innerHTML = `<div style="font-size:0.65rem; color:#e63946; padding:5px; word-break:break-all;">圖片404<br>${this.src.substring(this.src.lastIndexOf('/'))}</div>`;
            };
            slot.appendChild(img);
        } else {
            const ph = document.createElement('div');
            ph.className = 'mask-img-placeholder';
            ph.style.cssText = 'color: #e63946 !important; font-size: 1.2rem !important; font-weight: bold;';
            ph.textContent = `無圖(Slot${i})`;
            slot.appendChild(ph);
        }
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
        maskBtn.querySelector('.sf-btn-icon').textContent = window._isMasked ? '👁' : '🙈';
        maskBtn.querySelector('.sf-btn-label').textContent = window._isMasked ? '顯示' : '遮擋';
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

/**
 * 💡 將同學後端回傳的 WER 資料與劃線，漂亮地渲染到 Step 3 區塊中
 */
// ══════════════════════════════════════════════════
//  📊 SCORE REPORT RENDERING ENGINE (Step 3 核心綜合渲染引擎)
// ══════════════════════════════════════════════════

/**
 * 💡 1. 單段落即時分析器：在 Step 2 錄音練習時，每錄完一個單段點擊「上傳並繼續」時觸發。
 * 職責：只在 container 內部精準寻找 data-strip-para="${currentParaNum}" 的對應元素做局部替換，絕不胡亂 append 造成大合併！
 */
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
            document.getElementById('werScoreText').innerText = (stats.wer_repair_fluency * 100).toFixed(1) + '%';
        }
        if (document.getElementById('werTotalWords')) {
            document.getElementById('werTotalWords').innerText = stats.total_ref_words;
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

        // 更新大底座的即時錯誤數
        const errorCountEl = document.getElementById('werErrorCount');
        if (errorCountEl) errorCountEl.textContent = errorCount;

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
// 📊 多段落報告總成渲染 (精準拆開資料庫大禮盒)
// ══════════════════════════════════════════════════
function renderMultipleParagraphsReport(paragraphList, globalStats) {
    try {
        if (document.getElementById('werScoreText')) {
            document.getElementById('werScoreText').innerText = globalStats ? (globalStats.wer_average * 100).toFixed(1) + '%' : '0.0%';
        }
        if (document.getElementById('werTotalWords')) {
            document.getElementById('werTotalWords').innerText = globalStats ? globalStats.total_words : '0';
        }
        if (document.getElementById('werErrorCount')) {
            document.getElementById('werErrorCount').innerText = globalStats ? globalStats.total_errors : '0';
        }
        if (document.getElementById('werAvgNpvi')) {
            document.getElementById('werAvgNpvi').innerText = (globalStats && globalStats.average_npvi != null) ? parseFloat(globalStats.average_npvi).toFixed(2) : '0.00';
        }
        if (document.getElementById('werAvgVarco')) {
            document.getElementById('werAvgVarco').innerText = (globalStats && globalStats.average_varco != null) ? parseFloat(globalStats.average_varco).toFixed(2) : '0.00';
        }

        const container = document.getElementById('werParagraphsContainer');
        if (!container) return;
        container.innerHTML = '';

        paragraphList.forEach((para) => {
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

            // 標題列
            const singleParaNpvi = (hasRecorded && para.npvi != null) ? parseFloat(para.npvi).toFixed(2) : '—';
            const singleParaVarco = (hasRecorded && para.varco != null) ? parseFloat(para.varco).toFixed(2) : '—';
            const statusBadge = hasRecorded 
                ? `<span style="color: #16a34a; font-weight: bold; background: #dcfce7; padding: 4px 12px; border-radius: 8px; font-size: 0.85rem;">✓ 已錄音</span>` 
                : `<span style="color: #64748b; font-weight: bold; background: #f1f5f9; padding: 4px 12px; border-radius: 8px; font-size: 0.85rem;">✕ 未錄音</span>`;

            const header = document.createElement('div');
            header.style.cssText = `padding: 18px 24px; background: ${hasRecorded ? '#f8fafc' : '#fcfcfc'}; display: flex; align-items: center; justify-content: space-between; cursor: ${hasRecorded ? 'pointer' : 'not-allowed'}; opacity: ${hasRecorded ? '1' : '0.65'};`;
            header.innerHTML = `
                <div style="display: flex; align-items: center; gap: 30px; flex: 1; flex-wrap: wrap;">
                    <span style="font-weight: bold; color: #1f2937; min-width: 65px; font-size: 1.05rem;">段落 ${para.paragraph_index}</span>
                    ${statusBadge}
                    <div style="display: flex; gap: 24px; color: #4a5568; font-size: 0.92rem; align-items: center; flex-wrap: wrap;">
                        <div>WER: <strong style="color: #e63946; font-size: 1.05rem;">${hasRecorded ? (para.wer * 100).toFixed(1) + '%' : '—'}</strong></div>
                        <div>錯誤數: <strong style="color: #fb923c; font-size: 1.05rem;">${hasRecorded ? para.error_count : '—'}</strong></div>
                        <div style="color: #4a5568; border-left: 1px solid #e2e8f0; padding-left: 16px;">nPVI: <strong style="color: #2563eb; font-size: 1.05rem;">${singleParaNpvi}</strong></div>
                        <div style="color: #4a5568;">Varco: <strong style="color: #10b981; font-size: 1.05rem;">${singleParaVarco}</strong></div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    ${hasRecorded ? '<span style="color: #a0aec0; font-size: 0.85rem;">展開對照</span> <span class="arrow-icon" style="transition: transform 0.2s; color: #cbd5e1;">▼</span>' : ''}
                </div>
            `;

            const body = document.createElement('div');
            body.style.cssText = 'padding: 24px; display: none; background: #ffffff; border-top: 1px solid #edf2f7; flex-direction: column; gap: 24px;';

            if (hasRecorded) {
                // 🚀 【核心修正 3：精準抓取 raw_wer_output.statistics 給雷達圖用】
                const rawWer = extendedReport.raw_wer_output || {};
                const stats = rawWer.statistics || {}; 
                const counts = [
                    stats.repair_repetition || 0,
                    stats.repair_attempt || 0,
                    stats.repair_restart || 0,
                    stats.substitutions || 0,
                    stats.deletions || 0,
                    stats.insertions || 0
                ];

                // 子彈圖設定
                const targetNpvi = 50; 
                const targetVarco = 45;
                const actualNpviNum = parseFloat(singleParaNpvi) || 0;
                const actualVarcoNum = parseFloat(singleParaVarco) || 0;

                const chartsHTML = `
                    <div style="display: flex; gap: 24px; width: 100%; flex-wrap: wrap;">
                        <!-- 左側：WER 錯誤雷達圖 -->
                        <div style="flex: 1; min-width: 300px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center;">
                            <div style="font-size: 0.95rem; font-weight: bold; color: #475569; margin-bottom: 12px; align-self: flex-start;">🕸️ 發音錯誤面向分析</div>
                            <div style="position: relative; width: 100%; height: 220px;">
                                <canvas class="radar-canvas"></canvas>
                            </div>
                        </div>

                        <!-- 右側：nPVI / Varco 子彈圖 -->
                        <div style="flex: 1; min-width: 300px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; justify-content: center; gap: 20px;">
                            <div style="font-size: 0.95rem; font-weight: bold; color: #475569; margin-bottom: 4px;">🎯 流暢度達標分析 (Bullet Chart)</div>
                            
                            <!-- nPVI 子彈圖 -->
                            <div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: bold; color: #333; margin-bottom: 6px;">
                                    <span>nPVI 節奏指數</span>
                                    <span>實測: <span style="color: #2563eb;">${actualNpviNum}</span> / 標準: ${targetNpvi}</span>
                                </div>
                                <div style="position: relative; width: 100%; height: 24px; background: #e2e8f0; border-radius: 12px; overflow: hidden;">
                                    <div style="width: ${Math.min((actualNpviNum / targetNpvi) * 80, 100)}%; height: 100%; background: #3b82f6; transition: width 1s;"></div>
                                    <div style="position: absolute; left: 80%; top: 0; bottom: 0; width: 4px; background: #e63946; z-index: 10;" title="目標標準線"></div>
                                </div>
                            </div>

                            <!-- Varco 子彈圖 -->
                            <div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: bold; color: #333; margin-bottom: 6px;">
                                    <span>Varco 語速變異</span>
                                    <span>實測: <span style="color: #10b981;">${actualVarcoNum}</span> / 標準: ${targetVarco}</span>
                                </div>
                                <div style="position: relative; width: 100%; height: 24px; background: #e2e8f0; border-radius: 12px; overflow: hidden;">
                                    <div style="width: ${Math.min((actualVarcoNum / targetVarco) * 80, 100)}%; height: 100%; background: #10b981; transition: width 1s;"></div>
                                    <div style="position: absolute; left: 80%; top: 0; bottom: 0; width: 4px; background: #e63946; z-index: 10;" title="目標標準線"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                // 🎵 區塊 2：音檔播放器
                let cleanAudioUrl = para.file_path || '';
                if (cleanAudioUrl && !cleanAudioUrl.startsWith('/') && !cleanAudioUrl.startsWith('http')) cleanAudioUrl = '/' + cleanAudioUrl;
                if (cleanAudioUrl) cleanAudioUrl += (cleanAudioUrl.includes('?') ? '&' : '?') + 't=' + Date.now();

                const audioHTML = `
                    <div style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 12px 18px; border-radius: 8px;">
                        <div style="font-size: 0.9rem; font-weight: bold; color: #475569; margin-bottom: 8px;">🎵 錄音回放 (WAV)：</div>
                        <audio src="${cleanAudioUrl}" controls style="width: 100%; height: 36px;" preload="metadata"></audio>
                    </div>
                `;

                // 📝 區塊 3：互動式錯誤篩選逐字稿
                const filterHTML = `
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="font-size: 0.9rem; font-weight: bold; color: #475569;">🔍 點擊錯誤類別，查看發生在哪個單字：</div>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            <button class="wer-filter-btn" onclick="window.switchWerFilter(this, 'repair_repetition', '${stripId}')" style="padding: 6px 14px; border:none; background: #f1f5f9; color: #475569; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.2s;">Repetition</button>
                            <button class="wer-filter-btn" onclick="window.switchWerFilter(this, 'repair_attempt', '${stripId}')" style="padding: 6px 14px; border:none; background: #f1f5f9; color: #475569; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.2s;">Attempt</button>
                            <button class="wer-filter-btn" onclick="window.switchWerFilter(this, 'repair_restart', '${stripId}')" style="padding: 6px 14px; border:none; background: #f1f5f9; color: #475569; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.2s;">Restart</button>
                            <button class="wer-filter-btn" onclick="window.switchWerFilter(this, 'substitutions', '${stripId}')" style="padding: 6px 14px; border:none; background: #f1f5f9; color: #475569; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.2s;">Substitutions</button>
                            <button class="wer-filter-btn" onclick="window.switchWerFilter(this, 'deletions', '${stripId}')" style="padding: 6px 14px; border:none; background: #f1f5f9; color: #475569; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.2s;">Deletions</button>
                            <button class="wer-filter-btn" onclick="window.switchWerFilter(this, 'insertions', '${stripId}')" style="padding: 6px 14px; border:none; background: #f1f5f9; color: #475569; border-radius: 20px; font-weight: bold; cursor: pointer; transition: 0.2s;">Insertions</button>
                        </div>
                        <div class="transcript-display-area" style="display: flex; gap: 20px; flex-wrap: wrap; margin-top: 8px;">
                            <div style="flex: 1; text-align: center; color: #94a3b8; font-size: 0.95rem; padding: 20px; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
                                請點擊上方的分類按鈕，以顯示逐字稿與標記紅字。
                            </div>
                        </div>
                    </div>
                `;

                body.innerHTML = chartsHTML + audioHTML + filterHTML;

                // ── 手風琴展開事件 (延遲加載雷達圖) ──
                header.addEventListener('click', () => {
                    const isHidden = body.style.display === 'none';
                    body.style.display = isHidden ? 'flex' : 'none';
                    header.querySelector('.arrow-icon').style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                    header.style.background = isHidden ? '#f1f5f9' : '#f8fafc';

                    // 如果是展開狀態且尚未繪製過雷達圖
                    if (isHidden && !body.dataset.chartRendered) {
                        body.dataset.chartRendered = 'true';
                        
                        const canvas = body.querySelector('.radar-canvas');
                        if (canvas) {
                            new Chart(canvas.getContext('2d'), {
                                type: 'radar',
                                data: {
                                    labels: ['Repetition', 'Attempt', 'Restart', 'Substitutions', 'Deletions', 'Insertions'],
                                    datasets: [{
                                        label: '發生次數',
                                        data: counts,
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
                                            ticks: { stepSize: 1, backdropColor: 'transparent' },
                                            pointLabels: { font: { size: 11, weight: 'bold' }, color: '#475569' }
                                        }
                                    },
                                    plugins: { legend: { display: false } }
                                }
                            });
                        }
                    }
                });
                body.addEventListener('click', function(e) {
                    const btn = e.target.closest('.wer-filter-btn');
                    if (btn) {
                        const errorType = btn.dataset.type;
                        if (errorType) {
                            window.switchWerFilter(btn, errorType, stripId);
                        }
                    }
                });
            }

            strip.appendChild(header);
            strip.appendChild(body);
            container.appendChild(strip);
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
    const scoreText    = document.getElementById('werScoreText');
    const errorCountEl = document.getElementById('werErrorCount');
    const totalWords   = document.getElementById('werTotalWords');
    const avgNpvi      = document.getElementById('werAvgNpvi');
    const avgVarco     = document.getElementById('werAvgVarco');

    if (scoreText)    scoreText.textContent    = '0.0%';
    if (errorCountEl) errorCountEl.textContent = '0';
    if (totalWords)   totalWords.textContent   = '0';
    if (avgNpvi)       avgNpvi.textContent      = '0.00';
    if (avgVarco)       avgVarco.textContent     = '0.00';

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
            // 💡 新增：帶入這個 project 實際的練習模式
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
            renderMultipleParagraphsReport(resData.paragraph_list, resData.global_stats);

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