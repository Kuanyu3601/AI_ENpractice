import os
import re
import shutil
import numpy as np
import whisper
import whisper.tokenizer
import librosa
import torch
import jiwer

# FastAPI 相關模組
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from difflib import SequenceMatcher
from num2words import num2words
from contextlib import asynccontextmanager

# ================= 1. 全域配置與初始化 =================
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MODEL_SIZE = "small"

ml_models = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"--- 啟動生命週期：載入 OpenAI Whisper {MODEL_SIZE} 模型 (Device: {DEVICE}) ---")
    model = whisper.load_model(MODEL_SIZE, device=DEVICE)
    ml_models["model"] = model

    print("正在掃描並物理封鎖詞表中的所有數字 Token...")
    enc = whisper.tokenizer.get_tokenizer(multilingual=model.is_multilingual, language="en")
    
    if hasattr(enc, "encoding") and hasattr(enc.encoding, "n_vocab"):
        vocab_size = enc.encoding.n_vocab
    elif hasattr(enc, "tokenizer") and hasattr(enc.tokenizer, "vocab_size"):
        vocab_size = enc.tokenizer.vocab_size
    else:
        vocab_size = 51865
        
    all_numeric_token_ids = []
    for token_id in range(vocab_size):
        try:
            token_text = enc.decode([token_id])
            if re.search(r'\d', token_text):
                all_numeric_token_ids.append(token_id)
        except:
            continue
    ml_models["suppress_tokens"] = all_numeric_token_ids
    print(f"🎯 成功全面封鎖了 {len(all_numeric_token_ids)} 個隱藏數字 Token！")
    
    yield
    ml_models.clear()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= 2. 核心分析與升級版 DP Repair 邏輯 =================

def convert_numbers_to_words(text):
    def replace(match):
        num_str = match.group()
        try:
            return num2words(int(num_str), lang='en')
        except:
            return num_str
    return re.sub(r'\d+', replace, str(text))

def clean_text_english(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', '', text) 
    text = text.replace('\n', ' ').replace('\r', ' ')
    return " ".join(text.split())

def get_similarity(word_a, word_b):
    if not word_a or not word_b or word_a == "—" or word_b == "—":
        return 0.0
    return SequenceMatcher(None, word_a, word_b).ratio()

def apply_repair_logic(full_details, search_window=35, overlap_threshold=0.5):
    n = len(full_details)
    chunks = []
    current_chunk = []
    for idx in range(n):
        if full_details[idx]["比對結果"] == "INS 多字":
            current_chunk.append(idx)
        else:
            if current_chunk:
                chunks.append(current_chunk)
                current_chunk = []
    if current_chunk:
        chunks.append(current_chunk)
        
    STOP_WORDS = {"the", "a", "an", "and", "or", "but", "is", "are", "am", "was", "were", 
                  "to", "in", "on", "at", "of", "it", "i", "you", "he", "she", "they", 
                  "we", "for", "with", "this", "that", "there", "here"}
        
    for chunk in chunks:
        start_idx = chunk[0]
        end_idx = chunk[-1]
        
        past_words = [
            full_details[j]["辨識單字 (Hypothesis)"]
            for j in range(max(0, start_idx - search_window), start_idx)
            if full_details[j]["辨識單字 (Hypothesis)"] != "—"
        ]
        future_words = [
            full_details[j]["原始單字 (Reference)"]
            for j in range(end_idx + 1, min(n, end_idx + 1 + search_window))
            if full_details[j]["原始單字 (Reference)"] != "—"
        ]
        
        # === 0. 優先抓出結巴 (Stutter) ===
        # 💡 結巴的單字絕對不能當作跨行重啟的錨點，必須在第一時間隔離！
        stutter_indices = set()
        for idx in chunk:
            hyp_w = full_details[idx]["辨識單字 (Hypothesis)"]
            prev_w = full_details[idx-1]["辨識單字 (Hypothesis)"] if idx > 0 else None
            next_w = full_details[idx+1]["辨識單字 (Hypothesis)"] if idx < n-1 else None
            
            # 只要跟前一個字或後一個字一模一樣，它就是結巴
            if (prev_w == hyp_w) or (next_w == hyp_w):
                stutter_indices.add(idx)

        # === 1. 尋找強勢錨點 (Anchor) ===
        has_past_anchor = False
        has_future_anchor = False
        anchor_past_words = set()
        anchor_future_words = set()
        
        for idx in chunk:
            # 💡 結巴的字直接跳過，不參與錨點判定
            if idx in stutter_indices:
                continue
                
            hyp_w = full_details[idx]["辨識單字 (Hypothesis)"]
            if len(hyp_w) > 2 and hyp_w not in STOP_WORDS:
                if hyp_w in past_words:
                    has_past_anchor = True
                    anchor_past_words.add(hyp_w)
                elif hyp_w in future_words:
                    has_future_anchor = True
                    anchor_future_words.add(hyp_w)
                    
        # === 2. 標記處理 ===
        for idx in chunk:
            row = full_details[idx]
            hyp_w = row["辨識單字 (Hypothesis)"]
            
            # 優先處理結巴：直接發放標記，不再往下追究
            if idx in stutter_indices:
                row["比對結果"] = "INS 結巴 (重複)"
                row["說明"] = f"結巴：連續重複唸出單字 '{hyp_w}'"
                continue
            
            # 處理有錨點的連坐處罰
            if has_past_anchor:
                if hyp_w in anchor_past_words:
                    row["比對結果"] = "INS 句式重啟 (跨行重讀)"
                    row["說明"] = f"跨行重啟：回溯重新朗讀歷史詞彙 '{hyp_w}'"
                else:
                    row["比對結果"] = "INS 句式重啟 (重啟誤讀)"
                    row["說明"] = f"重啟誤讀：在重新尋找段落時，不慎發出的雜音或誤讀 '{hyp_w}'"
                continue 
                
            elif has_future_anchor:
                if hyp_w in anchor_future_words:
                    row["比對結果"] = "INS 句式跳讀 (跨行提早讀)"
                    row["說明"] = f"跨行跳讀：提早唸到後方尚未抵達的詞彙 '{hyp_w}'"
                else:
                    row["比對結果"] = "INS 句式跳讀 (跳讀誤讀)"
                    row["說明"] = f"跳讀誤讀：在提早跳讀時，不慎發出的雜音或誤讀 '{hyp_w}'"
                continue 

            # === 3. 沒有錨點：嚴格審核單字 (發音嘗試 or 純粹多字) ===
            LOOK_AHEAD_LIMIT = 2
            target_w_next = None
            for j in range(idx + 1, min(n, idx + 1 + LOOK_AHEAD_LIMIT)):
                if full_details[j]["原始單字 (Reference)"] != "—":
                    target_w_next = full_details[j]["原始單字 (Reference)"]
                    break
            target_w_prev = None
            for j in range(idx - 1, max(-1, idx - 1 - LOOK_AHEAD_LIMIT), -1):
                if full_details[j]["原始單字 (Reference)"] != "—":
                    target_w_prev = full_details[j]["原始單字 (Reference)"]
                    break
                    
            sim_next = get_similarity(hyp_w, target_w_next) if target_w_next else 0.0
            sim_prev = get_similarity(hyp_w, target_w_prev) if target_w_prev else 0.0
            
            best_target, best_sim, direction = None, 0.0, ""
            if sim_prev > sim_next:
                best_target, best_sim, direction = target_w_prev, sim_prev, "prev"
            elif sim_next > sim_prev:
                best_target, best_sim, direction = target_w_next, sim_next, "next"
            else:
                if target_w_next and hyp_w and hyp_w[0] == target_w_next[0]:
                    best_target, best_sim, direction = target_w_next, sim_next, "next"
                elif target_w_prev and hyp_w and hyp_w[0] == target_w_prev[0]:
                    best_target, best_sim, direction = target_w_prev, sim_prev, "prev"
                else:
                    best_target, best_sim, direction = target_w_next, sim_next, "next"
            
            if best_target and best_sim >= overlap_threshold:
                if direction == "next":
                    row["比對結果"] = "INS 詞語重疊 (向後嘗試)"
                    row["說明"] = f"嘗試發音：'{hyp_w}' 為 '{best_target}' 的發音嘗試 (相似度 {best_sim:.2f})"
                else:
                    row["比對結果"] = "INS 詞語重疊 (向前拖延)"
                    row["說明"] = f"尾音拖延：'{hyp_w}' 為 '{best_target}' 的拖延發音 (相似度 {best_sim:.2f})"
            else:
                row["比對結果"] = "INS 多字"
                row["說明"] = f"多字：模型多認出單字 '{hyp_w}'"
                
    return full_details

def map_to_frontend_category(status_str):
    """將中文的細部標籤，精準對應回前端 CSS 認識的 Category"""
    if "正確" in status_str: return "Match"
    if "DEL" in status_str: return "Delete"
    if "SUB" in status_str: return "Substitute"
    if "結巴" in status_str: return "Repair_Repetition"
    if "重疊" in status_str: return "Repair_Attempt"  # 💡 新增：發音嘗試與拖延
    if "重啟" in status_str: return "Repair_Restart"
    if "跳讀" in status_str: return "Repair_Restart" 
    if "更正" in status_str: return "Substitute"
    return "Insert" # 單純的多字雜音

# ================= 3. API 路由接口 =================

@app.post("/api/analyze-reading")
async def analyze_reading(
    audio_file: UploadFile = File(...), 
    original_text: str = Form(...)
):
    if not audio_file.filename.endswith(('.wav', '.mp3', '.m4a')):
        raise HTTPException(status_code=400, detail="不支援的音訊格式")

    temp_audio_path = f"temp_{audio_file.filename}"
    with open(temp_audio_path, "wb") as buffer:
        shutil.copyfileobj(audio_file.file, buffer)

    try:
        y, sr = librosa.load(temp_audio_path, sr=16000)
        duration = librosa.get_duration(y=y, sr=sr)
        
        intervals = librosa.effects.split(y, top_db=30)
        chunks = []
        if len(intervals) == 0:
            chunks.append({"chunk": y, "offset": 0.0})
        else:
            start_sample = 0
            target_samples = int(8 * sr)
            for idx, (speech_start, speech_end) in enumerate(intervals):
                if (speech_end - start_sample) >= target_samples or idx == len(intervals) - 1:
                    if idx < len(intervals) - 1:
                        next_speech_start = intervals[idx + 1][0]
                        cut_point = (speech_end + next_speech_start) // 2
                    else:
                        cut_point = len(y)
                    chunks.append({"chunk": y[start_sample:cut_point], "offset": start_sample / sr})
                    start_sample = cut_point

        model = ml_models["model"]
        suppress_tokens = ml_models["suppress_tokens"]
        full_transcribed_texts = []

        for chunk_data in chunks:
            chunk_audio = chunk_data["chunk"]
            if len(chunk_audio) < int(sr * 0.5): continue

            chunk_result = model.transcribe(
                chunk_audio,
                language="en", 
                beam_size=5, 
                suppress_tokens=suppress_tokens, 
                temperature=0, 
                condition_on_previous_text=False
            )
            if chunk_result["text"].strip():
                full_transcribed_texts.append(chunk_result["text"].strip())

        whisper_raw_text = " ".join(full_transcribed_texts)
        reference_str = clean_text_english(convert_numbers_to_words(original_text))
        hypothesis_str = clean_text_english(whisper_raw_text)

        if not reference_str:
            raise HTTPException(status_code=400, detail="提供的原始文本無效或為空")

        out = jiwer.process_words(reference_str, hypothesis_str)
        ref_words, hyp_words = out.references[0], out.hypotheses[0]
        
        full_details = []
        current_error_ref = []
        current_error_hyp = []

        def flush_errors():
            nonlocal full_details, current_error_ref, current_error_hyp
            if not current_error_ref and not current_error_hyp:
                return
                
            R = current_error_ref
            H = current_error_hyp
            m, n = len(R), len(H)
            
            dp = [[(0, 0.0)] * (n + 1) for _ in range(m + 1)]
            backtrack = [[None] * (n + 1) for _ in range(m + 1)]
            
            for i in range(1, m + 1):
                dp[i][0] = (i, 0.0)
                backtrack[i][0] = 'DEL'
            for j in range(1, n + 1):
                dp[0][j] = (j, 0.0)
                backtrack[0][j] = 'INS'
                
            for i in range(1, m + 1):
                for j in range(1, n + 1):
                    rw, hw = R[i-1], H[j-1]
                    sim = get_similarity(rw, hw)
                    
                    if rw == hw:
                        cost_sub = dp[i-1][j-1][0]
                        sim_sub = dp[i-1][j-1][1] + 1.0
                    else:
                        cost_sub = dp[i-1][j-1][0] + 1
                        sim_sub = dp[i-1][j-1][1] + sim
                        
                    cost_ins = dp[i][j-1][0] + 1
                    sim_ins = dp[i][j-1][1]
                    
                    cost_del = dp[i-1][j][0] + 1
                    sim_del = dp[i-1][j][1]
                    
                    options = [
                        (-cost_sub, sim_sub, 'SUB'),
                        (-cost_ins, sim_ins, 'INS'),
                        (-cost_del, sim_del, 'DEL')
                    ]
                    
                    best_opt = max(options, key=lambda x: (x[0], x[1]))
                    dp[i][j] = (-best_opt[0], best_opt[1])
                    backtrack[i][j] = best_opt[2]
                    
            i, j = m, n
            path = []
            while i > 0 or j > 0:
                step = backtrack[i][j]
                if step == 'SUB':
                    path.append(('SUB', i-1, j-1))
                    i -= 1; j -= 1
                elif step == 'DEL':
                    path.append(('DEL', i-1, None))
                    i -= 1
                elif step == 'INS':
                    path.append(('INS', None, j-1))
                    j -= 1
            path.reverse()
            
            for action, ri, hi in path:
                if action == 'SUB':
                    rw, hw = R[ri], H[hi]
                    if rw == hw:
                        full_details.append({"比對結果": "正確 (HIT)", "原始單字 (Reference)": rw, "辨識單字 (Hypothesis)": hw, "說明": "錯位匹配成功（正確）"})
                    else:
                        full_details.append({"比對結果": "SUB 替換", "原始單字 (Reference)": rw, "辨識單字 (Hypothesis)": hw, "說明": f"單字錯誤：原本為 '{rw}'，被辨識成 '{hw}'"})
                elif action == 'DEL':
                    full_details.append({"比對結果": "DEL 漏字", "原始單字 (Reference)": R[ri], "辨識單字 (Hypothesis)": "—", "說明": f"漏字：跳讀或漏掉單字 '{R[ri]}'"})
                elif action == 'INS':
                    full_details.append({"比對結果": "INS 多字", "原始單字 (Reference)": "—", "辨識單字 (Hypothesis)": H[hi], "說明": f"多字：模型多認出單字 '{H[hi]}'"})

        for chunk in out.alignments[0]:
            type_ = chunk.type
            r_sub = ref_words[chunk.ref_start_idx : chunk.ref_end_idx]
            h_sub = hyp_words[chunk.hyp_start_idx : chunk.hyp_end_idx]
            
            if type_ == 'equal':
                flush_errors()
                current_error_ref = []
                current_error_hyp = []
                for w in r_sub:
                    full_details.append({
                        "比對結果": "正確 (HIT)", 
                        "原始單字 (Reference)": w, 
                        "辨識單字 (Hypothesis)": w, 
                        "說明": "朗讀正確"
                    })
            else:
                current_error_ref.extend(r_sub)
                current_error_hyp.extend(h_sub)
                
        flush_errors() 
        
        for idx, row in enumerate(full_details, 1):
            new_row = {"序號": idx}
            new_row.update(row)
            full_details[idx-1] = new_row

        full_details = apply_repair_logic(full_details, search_window=35, overlap_threshold=0.4)

        actual_hits = sum(1 for r in full_details if "正確 (HIT)" in r["比對結果"])
        actual_subs = sum(1 for r in full_details if "SUB" in r["比對結果"])
        actual_dels = sum(1 for r in full_details if "DEL" in r["比對結果"])
        actual_inss = sum(1 for r in full_details if "INS" in r["比對結果"])
        total_n = actual_hits + actual_subs + actual_dels
        calculated_wer = ((actual_subs + actual_dels + actual_inss) / total_n) if total_n > 0 else 0

        alignment_report = []
        for row in full_details:
            alignment_report.append({
                "Category": map_to_frontend_category(row["比對結果"]),
                "Reference": row["原始單字 (Reference)"],
                "Hypothesis": row["辨識單字 (Hypothesis)"],
                "Detail": row["說明"]
            })

        return {
            "status": "success",
            "filename": audio_file.filename,
            "duration_seconds": round(duration, 2),
            "whisper_raw_text": hypothesis_str,
            "statistics": {
                "wer_repair_fluency": round(calculated_wer, 4),
                "total_ref_words": total_n,
                "substitutions": actual_subs,
                "deletions": actual_dels,
                "insertions": actual_inss
            },
            "alignment_report": alignment_report
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"後端處理錯誤: {str(e)}")
        
    finally:
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)

# ================= 4. 後端獨立視覺化測試介面 =================

@app.get("/test-ui", response_class=HTMLResponse)
async def test_ui():
    """純粹為了後端獨立測試用的內建網頁，直接在 FastAPI 中呈現。"""
    html_content = """
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <title>FastAPI 語音朗讀差異渲染模擬器</title>
        <style>
            body { background-color: #0d0d0d; color: #ffffff; font-family: sans-serif; padding: 40px; }
            .control-panel { background: #1a1a1a; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            input, textarea, button { width: 100%; margin-bottom: 10px; padding: 10px; border-radius: 4px; box-sizing: border-box; }
            textarea { height: 80px; resize: none; background: #2d2d2d; color: white; border: 1px solid #444; }
            button { background: #4ade80; color: #000; font-weight: bold; border: none; cursor: pointer; font-size: 16px; }
            button:hover { background: #22c55e; }
            
            .report-dark-container { background-color: #121212; padding: 24px; border-radius: 12px; margin-top: 20px; border: 1px solid #333; }
            .visual-diff-box { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 32px; }
            .word-pair { display: flex; flex-direction: column; align-items: center; padding: 6px 10px; border-radius: 6px; }
            .word-pair.highlight-bg { background-color: rgba(248, 113, 113, 0.15); } /* 替換錯誤的微紅背景 */
            
            .ref-word { font-size: 1.1rem; font-weight: bold; margin-bottom: 8px; color: #fff; }
            .hyp-word { font-size: 1rem; }

            /* ================= 專屬色彩診斷系統 ================= */
            .status-match { color: #4ade80; } /* 綠色：完美 */
            .status-delete { color: #9ca3af; text-decoration: line-through; } /* 灰色刪除線：漏讀 */
            .status-substitute { color: #f87171; font-weight: bold; } /* 紅色：完全唸錯 */
            .status-insert { color: #fbbf24; } /* 黃色：單純多字/雜音 */

            /* Repair 系列細分 */
            .status-repair-repetition { color: #fb923c; text-decoration: underline wavy #fb923c; text-underline-offset: 4px; } /* 橘色波浪：結巴 */
            .status-repair-attempt { color: #f472b6; text-decoration: underline dashed #f472b6; text-underline-offset: 4px; } /* 粉紅虛線：發音嘗試 */
            .status-repair-restart { color: #a78bfa; text-decoration: underline dotted #a78bfa; text-underline-offset: 4px; } /* 紫色點線：跳讀重啟 */
            /* ==================================================== */

            .detail-table { width: 100%; border-collapse: collapse; color: #e5e5e5; font-size: 0.95rem; margin-bottom: 24px; }
            .detail-table th, .detail-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #333; }
            .detail-table th { color: #9ca3af; font-weight: normal; }

            .summary-footer { display: flex; justify-content: space-around; padding-top: 16px; border-top: 1px solid #333; color: #9ca3af; text-align: center; }
            .summary-footer strong { display: block; color: #ffffff; font-size: 1.5rem; margin-top: 8px; }
        </style>
    </head>
    <body>
        <h2>🎙️ FastAPI 內建測試與渲染器 (全彩診斷版)</h2>
        
        <div class="control-panel">
            <label>1. 上傳測試音檔 (.wav)</label>
            <input type="file" id="audioFile" accept="audio/*">
            
            <label>2. 輸入原始文本 (Reference)</label>
            <textarea id="originalText">The quick brown fox jumps over the lazy dog.</textarea>
            
            <button id="analyzeBtn" onclick="runAnalysis()">開始分析與渲染</button>
            <div id="loadingText" style="display:none; color:#fb923c; margin-top:10px;">⏳ 後端 AI 瘋狂運算中，請稍候...</div>
        </div>

        <div id="scoreReport"></div>

        <script>
            async function runAnalysis() {
                const audioInput = document.getElementById('audioFile');
                const textInput = document.getElementById('originalText');
                const btn = document.getElementById('analyzeBtn');
                const loading = document.getElementById('loadingText');
                const reportDiv = document.getElementById('scoreReport');

                if (audioInput.files.length === 0) {
                    alert("請先選擇音檔！"); return;
                }

                btn.disabled = true;
                loading.style.display = 'block';
                reportDiv.innerHTML = '';

                const formData = new FormData();
                formData.append("audio_file", audioInput.files[0]);
                formData.append("original_text", textInput.value);

                try {
                    const response = await fetch("/api/analyze-reading", { method: "POST", body: formData });
                    if (!response.ok) throw new Error("API 發生錯誤");
                    const data = await response.json();
                    
                    renderDifferenceReport(data.alignment_report, data.statistics);
                } catch (err) {
                    reportDiv.innerHTML = `<h3 style="color:red;">❌ 分析失敗：${err.message}</h3>`;
                } finally {
                    btn.disabled = false;
                    loading.style.display = 'none';
                }
            }

            function renderDifferenceReport(alignmentReport, stats) {
                const reportDiv = document.getElementById('scoreReport');
                let visualHTML = '<div class="visual-diff-box">';
                let tableHTML = `
                    <table class="detail-table">
                        <thead>
                            <tr>
                                <th>原文 (Reference)</th>
                                <th>辨識 (Hypothesis)</th>
                                <th>類別</th>
                                <th>備註</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                let errorCount = 0;

                alignmentReport.forEach(item => {
                    if (item.Category !== 'Match') errorCount++;

                    let cssClass = 'status-match';
                    let isHighlighted = false;
                    
                    // 💡 精確對應全新的色彩類別
                    if (item.Category === 'Delete') { cssClass = 'status-delete'; } 
                    else if (item.Category === 'Substitute') { cssClass = 'status-substitute'; isHighlighted = true; } 
                    else if (item.Category === 'Insert') { cssClass = 'status-insert'; }
                    else if (item.Category === 'Repair_Repetition') { cssClass = 'status-repair-repetition'; }
                    else if (item.Category === 'Repair_Attempt') { cssClass = 'status-repair-attempt'; }
                    else if (item.Category === 'Repair_Restart') { cssClass = 'status-repair-restart'; }

                    visualHTML += `
                        <div class="word-pair ${isHighlighted ? 'highlight-bg' : ''}">
                            <div class="ref-word">${item.Reference}</div>
                            <div class="hyp-word ${cssClass}">${item.Hypothesis}</div>
                        </div>
                    `;

                    tableHTML += `
                        <tr>
                            <td>${item.Reference === '—' ? '' : item.Reference}</td>
                            <td>${item.Hypothesis === '—' ? '' : item.Hypothesis}</td>
                            <td><span class="${cssClass}">${item.Category}</span></td>
                            <td style="color: #9ca3af;">${item.Detail || ''}</td>
                        </tr>
                    `;
                });

                visualHTML += '</div>';
                tableHTML += '</tbody></table>';

                const summaryHTML = `
                    <div class="summary-footer">
                        <div><span>總字數</span><strong>${stats.total_ref_words}</strong></div>
                        <div><span>錯誤標記</span><strong>${errorCount}</strong></div>
                        <div><span>綜合 WER</span><strong>${(stats.wer_repair_fluency * 100).toFixed(1)}%</strong></div>
                    </div>
                `;

                reportDiv.innerHTML = `
                    <div class="report-dark-container">
                        ${visualHTML}
                        ${tableHTML}
                        ${summaryHTML}
                    </div>
                `;
            }
        </script>
    </body>
    </html>
    """
    return html_content

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)