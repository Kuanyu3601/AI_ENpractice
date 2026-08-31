// ══════════════════════════════════════════════════
//  版面與段落元件
// ══════════════════════════════════════════════════
// 原檔案內容：toggleSidebar(101)、collapseSidebar(139)、relayoutMobileControls(168)、ParagraphUI IIFE(297–443
 

// ══════════════════════════════════════════════════
//  1. 側邊欄位收合
// ══════════════════════════════════════════════════
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

    document.body.classList.toggle('sidebar-open', !collapsed);
}

function collapseSidebar() {
    const sidebar = document.getElementById('sidebar');
    const showBtn = document.getElementById('sidebarShowBtn');
    if (!sidebar || sidebar.classList.contains('is-collapsed')) return;

    sidebar.classList.add('is-collapsed');
    if (showBtn) showBtn.classList.add('is-visible');

    try {
        localStorage.setItem('sidebarCollapsed', '1');
    } catch (e) { /* 忽略無痕模式等例外狀況 */ }

    document.body.classList.remove('sidebar-open');
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

    document.body.classList.toggle('sidebar-open', !wasCollapsed);
});

document.addEventListener('click', (e) => {
    if (window.innerWidth > 768) return;   // 只在手機版生效

    const sidebar = document.getElementById('sidebar');
    if (!sidebar || sidebar.classList.contains('is-collapsed')) return;

    const clickedInsideSidebar = sidebar.contains(e.target);
    const clickedToggleBtn = e.target.closest('#sidebarShowBtn, #sidebarHideBtn, #navHistoryBtn');

    if (!clickedInsideSidebar && !clickedToggleBtn) {
        collapseSidebar();
    }
});

// ══════════════════════════════════════════════════
//  ２. 手機版控制列搬移（RWD）
// ══════════════════════════════════════════════════
function relayoutMobileControls() {
    const functionEl    = document.getElementById('function');
    const mobileRow      = document.getElementById('mobileControlsRow');
    const lyricsWrapper  = document.getElementById('lyricsWrapper');
    const lyricsView     = document.getElementById('lyricsView');
    if (!functionEl || !mobileRow || !lyricsWrapper || !lyricsView) return;

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // 手機版：把按鈕搬進段落列所在的共用列（跟在段落按鈕後面，形成同一排）
        if (functionEl.parentElement !== mobileRow) {
            mobileRow.appendChild(functionEl);
        }
    } else {
        // 桌面版：搬回原本位置（字幕區 #lyricsView 之前）
        if (functionEl.parentElement !== lyricsWrapper || functionEl.nextElementSibling !== lyricsView) {
            lyricsWrapper.insertBefore(functionEl, lyricsView);
        }
    }
}

document.addEventListener('DOMContentLoaded', relayoutMobileControls);
window.addEventListener('resize', () => {
    clearTimeout(window._controlsRelayoutTimer);
    window._controlsRelayoutTimer = setTimeout(relayoutMobileControls, 80);
});

// ══════════════════════════════════════════════════
//  3. 段落
// ══════════════════════════════════════════════════

var _total      = 0;
var _currentIdx = 0;
var _recorded   = new Set();
var _decorating = false;
var _articleKey = null; // 💡 新增：追蹤目前是「哪一篇/哪一次」，setTotal 靠這個判斷是否真的換了文章

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

