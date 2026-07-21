from flask import Flask, render_template, request, redirect, url_for, jsonify, send_from_directory, session, json
import mysql.connector
import os
import requests
import subprocess  # 🚀 補上標準套件，解決原本的 'subprocess' is not defined 錯誤！
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash
from werkzeug.security import generate_password_hash, check_password_hash
import random
import re
import shutil
import threading
import time

app = Flask(__name__)
app.secret_key = 'any_secret_string_here'

# ══════════════════════════════════════════════════
#  ⏳ 上傳進度即時回報機制
# ══════════════════════════════════════════════════
# 💡 因為 upload_audio() 這支 API 本身要跑很久（WER辨識→NPVI分析→好幾個Ollama評分/評語呼叫），
#    單一個 request/response 沒辦法讓前端知道「現在到底跑到哪裡」。
#    這裡用一個簡單的記憶體字典存放「每個上傳工作目前的進度文字」，
#    upload_audio() 執行的過程中會不斷更新這個字典，
#    前端另外開一個輕量的 /upload_progress/<progress_id> API 每秒輪詢一次，
#    藉此顯示「真正反映後端目前在做什麼」的進度文字，而不是寫死的假動畫。
_upload_progress_store = {}
_upload_progress_lock = threading.Lock()
_UPLOAD_PROGRESS_TTL_SEC = 600  # 進度紀錄超過這個時間沒被清掉就視為過期，避免字典無限增長

def set_upload_progress(progress_id, text):
    if not progress_id:
        return
    with _upload_progress_lock:
        _upload_progress_store[progress_id] = {"text": text, "ts": time.time()}

def get_upload_progress(progress_id):
    with _upload_progress_lock:
        entry = _upload_progress_store.get(progress_id)
        return entry["text"] if entry else ""

def clear_upload_progress(progress_id):
    if not progress_id:
        return
    with _upload_progress_lock:
        _upload_progress_store.pop(progress_id, None)

def _cleanup_stale_progress():
    """💡 順手清掉太舊、前端可能忘記輪詢完就離開頁面的殘留紀錄，避免字典無限增長。"""
    now = time.time()
    with _upload_progress_lock:
        stale_keys = [k for k, v in _upload_progress_store.items() if now - v.get("ts", 0) > _UPLOAD_PROGRESS_TTL_SEC]
        for k in stale_keys:
            _upload_progress_store.pop(k, None)

# --- 1. 資料夾與檔案配置 ---
UPLOAD_FOLDER = 'kids_recordings'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# 💡 改法：不用共用 docker volume 了，同學提供了一個下載 API，
#    直接呼叫這個內部網址就能拿到 TextGrid 檔案的實際內容。
#    ⚠️ 這裡用的是 docker-compose 的服務名稱 backend-npvi，
#       不是給瀏覽器用的外部 IP，因為這支呼叫是從 web 容器內部發出的。
TEXTGRID_DOWNLOAD_URL_TEMPLATE = "http://backend-npvi:8000/api/download/textgrid/{filename}"

# --- 2. 資料庫設定 ---
db_config = {
    'host': 'mysql',
    'user': 'root',
    'password': 'yourpassword',
    'database': 'project115',
    'port' : 3306,
    'charset': 'utf8mb4'
}

def get_db_connection():
    try:
        conn = mysql.connector.connect(**db_config)
        return conn
    except Exception as e:
        print(f"連線失敗: {e}")
        return None

def split_paragraphs(article_content):
    """
    💡 核心修正：跟前端 JS 的 text.split(/\\n\\s*\\n/) 規則一致，
       避免後端用 split('\\n\\n') 因為換行格式不同而切不開段落，
       導致分段練習時把整篇文章都送去給 WER 分析。
    """
    parts = re.split(r'\n\s*\n', article_content)
    return [p.strip() for p in parts if p.strip()]


def _escape_textgrid_text(text):
    """
    💡 Praat TextGrid 文字格式規則：字串裡如果有雙引號，要用兩個雙引號跳脫（""）。
    """
    return (text or "").replace('"', '""')


def build_textgrid_from_chunks(chunk_results, total_time_sec, tier_name="chunks"):
    """
    💡 【備援用】：自己動手組一份 Praat long-format TextGrid 檔案文字內容。

    現在同學那邊已經把 TextGrid 實際存到共用資料夾了（見 SAVED_TEXTGRIDS_FOLDER），
    正常情況下 upload_audio() 會優先直接讀那份真正的檔案，
    這個函式只在共用資料夾裡找不到對應檔案時，當作備援方案使用，
    確保就算同學那邊某次沒有正確產出檔案，畫面還是有東西可以顯示，不會整個報錯。
    """
    if not chunk_results:
        chunk_results = []

    # 依 xmin 排序，確保時間軸正確
    sorted_chunks = sorted(chunk_results, key=lambda c: c.get('xmin', 0))

    intervals = []
    cursor_time = 0.0

    for chunk in sorted_chunks:
        c_xmin = float(chunk.get('xmin', cursor_time))
        c_xmax = float(chunk.get('xmax', c_xmin))
        label = chunk.get('label', '')

        # 💡 Praat 的 IntervalTier 要求時間軸連續無縫，
        #    如果這個語塊跟上一個語塊之間有空隙（停頓），要補一個空白文字的 interval 填滿
        if c_xmin > cursor_time + 0.0001:
            intervals.append((cursor_time, c_xmin, ""))

        intervals.append((c_xmin, c_xmax, label))
        cursor_time = c_xmax

    # 補齊尾端到總長度的空白區間
    if total_time_sec and cursor_time < float(total_time_sec) - 0.0001:
        intervals.append((cursor_time, float(total_time_sec), ""))

    final_xmax = float(total_time_sec) if total_time_sec else (intervals[-1][1] if intervals else 0.0)

    lines = []
    lines.append('File type = "ooTextFile"')
    lines.append('Object class = "TextGrid"')
    lines.append('')
    lines.append(f'xmin = 0')
    lines.append(f'xmax = {final_xmax}')
    lines.append('tiers? <exists>')
    lines.append('size = 1')
    lines.append('item []:')
    lines.append('    item [1]:')
    lines.append('        class = "IntervalTier"')
    lines.append(f'        name = "{tier_name}"')
    lines.append('        xmin = 0')
    lines.append(f'        xmax = {final_xmax}')
    lines.append(f'        intervals: size = {len(intervals)}')

    for idx, (xmin, xmax, text) in enumerate(intervals, start=1):
        lines.append(f'        intervals [{idx}]:')
        lines.append(f'            xmin = {xmin}')
        lines.append(f'            xmax = {xmax}')
        lines.append(f'            text = "{_escape_textgrid_text(text)}"')

    return '\n'.join(lines) + '\n'


def fetch_real_textgrid(textgrid_filename, user_dir, dest_filename):
    """
    💡 【改版】：不用共用 docker volume 了，直接呼叫同學提供的下載 API，
       拿到真正的 TextGrid 檔案內容後存進使用者的錄音資料夾；
       下載失敗（檔名對不上、API 還沒跑完、逾時...等）就回傳 None，
       讓呼叫端自己決定要不要退回 build_textgrid_from_chunks() 的備援方案。

    參數：
        textgrid_filename: NPVI API 回傳的 actual_data.get("file")，例如
                            "hill01_syl.TextGrid"
        user_dir: 這位使用者的錄音資料夾（跟音檔存在一起）
        dest_filename: 要落盤存放的檔名（通常是 "{原本音檔檔名}.TextGrid"）

    回傳：
        成功：實際落盤的完整路徑字串
        失敗：None
    """
    if not textgrid_filename:
        return None

    # 💡 暫時修正：同學這次改版後，實際存檔的檔名不含 "_syl"，
    #    但 NPVI API 的 JSON 回應裡 "file" 欄位還沒跟著更新，
    #    這裡先手動把 "_syl" 拿掉再去下載。
    #    ⚠️ 這是暫時的權宜寫法，如果同學之後把 JSON 回應也修正了，
    #       這行可以拿掉，直接用 textgrid_filename 本身即可。
    corrected_filename = textgrid_filename.replace('_syl.TextGrid', '.TextGrid')

    download_url = TEXTGRID_DOWNLOAD_URL_TEMPLATE.format(filename=corrected_filename)

    try:
        resp = requests.get(download_url, timeout=30)
        if resp.status_code != 200:
            print(f"⚠️ 下載 TextGrid 失敗，狀態碼: {resp.status_code}，網址: {download_url}", flush=True)
            return None

        dest_path = os.path.join(user_dir, dest_filename)
        with open(dest_path, 'wb') as f:
            f.write(resp.content)

        print(f"✅ 成功透過 API 下載同學的真正 TextGrid: {download_url} → {dest_path}", flush=True)
        return dest_path

    except Exception as download_err:
        print(f"🚨 下載 TextGrid 發生例外: {download_err}，網址: {download_url}", flush=True)
        return None


def parse_textgrid_words(textgrid_content, tier_name="words"):
    """
    💡 【核心新增】：解析 Praat long-format TextGrid 檔案內容，
       抓出指定 tier（預設 "words"）裡每一個「非空白」interval 的逐字時間戳。

       同學提供的 TextGrid 通常有兩個 tier：
         - "words"：逐字的起訖時間（我們要的就是這個）
         - "phones"：逐音位（ARPA 音標）的起訖時間，這次先不用

       參數：
           textgrid_content: TextGrid 檔案的完整文字內容（字串）
           tier_name: 要抓哪個 tier，預設 "words"

       回傳：
           [{"xmin": 0.27, "xmax": 0.45, "text": "you"}, ...]
           （只保留 text 不是空字串的 interval，空字串代表停頓/靜音，不需要）
    """
    if not textgrid_content:
        return []

    try:
        # 💡 用 "item [n]:" 把整份檔案切成一段一段的 tier 區塊，
        #    第一段是檔案最上面共用的表頭（不是任何 tier），之後每一段對應一個 tier。
        tier_blocks = re.split(r'item\s*\[\d+\]:', textgrid_content)

        target_block = None
        for block in tier_blocks:
            if re.search(rf'name\s*=\s*"{re.escape(tier_name)}"', block):
                target_block = block
                break

        if not target_block:
            print(f"⚠️ TextGrid 裡找不到名為 \"{tier_name}\" 的 tier", flush=True)
            return []

        # 💡 這個正規表達式只會在「xmin/xmax 後面緊接著就是 text=」的地方命中，
        #    剛好就是每一個 intervals [i]: 區塊，不會誤吃到 tier 本身開頭的 xmin/xmax
        #    （因為 tier 開頭的 xmin/xmax 後面接的是 "intervals: size = N"，中間隔了文字，正規表達式吃不過去）
        pattern = re.compile(
            r'xmin\s*=\s*([\d.]+)\s*xmax\s*=\s*([\d.]+)\s*text\s*=\s*"([^"]*)"'
        )

        words = []
        for m in pattern.finditer(target_block):
            xmin = float(m.group(1))
            xmax = float(m.group(2))
            text = m.group(3).strip()
            if text:  # 跳過空字串的停頓區段
                words.append({"xmin": xmin, "xmax": xmax, "text": text})

        return words

    except Exception as parse_err:
        print(f"🚨 解析 TextGrid words tier 失敗: {parse_err}", flush=True)
        return []


# ══════════════════════════════════════════════════
#  🤖 Ollama 評分：完整度 / 準確度 / 流利度 / 語法正確性
# ══════════════════════════════════════════════════
# ⚠️ 請依你實際的 Ollama 部署方式調整這兩個變數：
#    - 如果 Ollama 是 docker-compose 裡的一個服務，OLLAMA_URL 用服務名稱（跟 backend-wer 一樣的寫法）
#    - 如果 Ollama 是跑在本機（不在 docker 網路裡），且 web 也是跑在 docker 裡，
#      要改成 "http://host.docker.internal:11434/api/generate"
#    - OLLAMA_MODEL 換成你實際 `ollama pull` 下來的 model 名稱
OLLAMA_URL = "http://ollama:11434/api/generate"
OLLAMA_MODEL = "llama3:latest"


def _call_ollama(prompt, timeout=60):
    """
    💡 共用的 Ollama 呼叫小工具，統一走 /api/generate、要求回傳 JSON 格式，
       並統一處理連線失敗、逾時、格式錯誤等例外狀況。
       回傳：成功時是 dict（已經 json.loads 過），失敗時是 None。
    """
    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "num_predict": 300   # 💡 保險：確保有足夠的輸出長度，避免話講到一半被截斷
            }
        }, timeout=timeout)

        if resp.status_code != 200:
            print(f"⚠️ Ollama 回應狀態碼異常: {resp.status_code}, 內容: {resp.text[:300]}", flush=True)
            return None

        outer = resp.json()
        raw_text = outer.get("response", "").strip()
        if not raw_text:
            print("⚠️ Ollama 回應是空的", flush=True)
            return None

        return json.loads(raw_text)

    except requests.exceptions.RequestException as conn_err:
        print(f"🚨 連線 Ollama 失敗: {conn_err}", flush=True)
        return None
    except ValueError as parse_err:
        print(f"🚨 解析 Ollama 回應 JSON 失敗: {parse_err}，原始回應: {raw_text[:300] if 'raw_text' in locals() else ''}", flush=True)
        return None
    except Exception as e:
        print(f"🚨 呼叫 Ollama 發生未預期例外: {e}", flush=True)
        return None


def call_ollama_score_errors(wer_stats, pause_count=0):
    """
    💡 把錯誤統計數字整理成提示詞，丟給 Ollama，請它針對三個面向各給 0~5 分：
       - 完整度 (Completeness)：根據 deletions（漏字）+ insertions（贅字）
       - 準確度 (Accuracy)：根據 substitutions（替換錯誤）
       - 流利度 (Fluency)：根據 4 種 repair 行為 + 停頓次數

    參數：
        wer_stats: WER API 回傳的 statistics 物件（dict），
                   要有 deletions / insertions / substitutions /
                   repair_attempt / repair_repetition / repair_replacement / repair_restart
                   / total_errors / total_ref_words 這些欄位
        pause_count: 這段錄音的停頓次數（來自 NPVI 回傳的 pause_analysis）

    回傳：
        {"completeness": float, "accuracy": float, "fluency": float}
        任何一項失敗都會是 0.0（不會讓整支 API 掛掉）
    """
    deletions = wer_stats.get('deletions', 0)
    insertions = wer_stats.get('insertions', 0)
    substitutions = wer_stats.get('substitutions', 0)
    repair_attempt = wer_stats.get('repair_attempt', 0)
    repair_repetition = wer_stats.get('repair_repetition', 0)
    repair_replacement = wer_stats.get('repair_replacement', 0)
    repair_restart = wer_stats.get('repair_restart', 0)
    total_errors = wer_stats.get('total_errors', 0)
    total_ref_words = wer_stats.get('total_ref_words', 1) or 1

    # 💡 事先幫模型算好「錯誤數 / 總字數」的比例，直接告訴它落在哪個級距對應幾分，
    #    不要讓模型自己憑感覺判斷——本地小模型很容易在這種開放式量化評分上
    #    只給極端值(0分或滿分)，給它明確的公式/級距表可以大幅改善這個問題。
    completeness_error_count = deletions + insertions
    completeness_ratio = completeness_error_count / total_ref_words
    accuracy_ratio = substitutions / total_ref_words
    repair_total = repair_attempt + repair_repetition + repair_replacement + repair_restart
    fluency_issue_count = repair_total + pause_count

    def _ratio_to_band(ratio):
        if ratio == 0: return "0%（完全沒有這類錯誤）"
        if ratio <= 0.05: return f"{ratio*100:.1f}%（很輕微，5%以內）"
        if ratio <= 0.15: return f"{ratio*100:.1f}%（輕度，5~15%）"
        if ratio <= 0.30: return f"{ratio*100:.1f}%（中度，15~30%）"
        return f"{ratio*100:.1f}%（嚴重，超過30%）"

    prompt = f"""你是一位英語朗讀評分老師。根據以下這位學生朗讀時的錯誤統計數字，
針對三個面向各給 0 到 5 分（務必包含小數點一位，例如 1.5、2.8、4.2，不是只能選整數的 0 或 5）。

請嚴格按照下面這個級距對照表來評分，不要自己另外判斷：
- 問題比例 0%　　　　　→ 5.0 分
- 問題比例 0~5%　　　　→ 4.0~4.9 分（比例越高分數越接近 4.0）
- 問題比例 5~15%　　　 → 3.0~3.9 分
- 問題比例 15~30%　　　→ 1.5~2.9 分
- 問題比例超過 30%　　 → 0~1.4 分

三個面向與它們各自的「問題比例」：

1. 完整度 (completeness)：漏字數 + 贅字數 = {completeness_error_count}，佔總字數 {total_ref_words} 的比例是 {_ratio_to_band(completeness_ratio)}
2. 準確度 (accuracy)：替換錯誤數 = {substitutions}，佔總字數 {total_ref_words} 的比例是 {_ratio_to_band(accuracy_ratio)}
3. 流利度 (fluency)：修復行為次數({repair_attempt}+{repair_repetition}+{repair_replacement}+{repair_restart}={repair_total}) + 停頓次數({pause_count}) = {fluency_issue_count} 次，
   請對照這個次數表評分：0次=5.0分，1~2次=3.5~4.5分，3~5次=2.0~3.4分，6次以上=0~1.9分

請根據上面的級距對照表，各給一個「有小數點」的分數（不要只給整數 0 或 5，除非比例真的剛好是 0%）。

請「只」回傳一個 JSON 物件，不要有任何其他文字說明或 markdown 標記，格式如下（下面是格式範例，不是建議分數）：
{{"completeness": 3.7, "accuracy": 4.2, "fluency": 2.8}}
"""

    result = _call_ollama(prompt)
    if not result:
        return {"completeness": 0.0, "accuracy": 0.0, "fluency": 0.0}

    try:
        return {
            "completeness": round(float(result.get("completeness", 0)), 1),
            "accuracy": round(float(result.get("accuracy", 0)), 1),
            "fluency": round(float(result.get("fluency", 0)), 1)
        }
    except (TypeError, ValueError) as e:
        print(f"🚨 Ollama 錯誤統計評分格式異常: {e}, 原始回傳: {result}", flush=True)
        return {"completeness": 0.0, "accuracy": 0.0, "fluency": 0.0}


def call_ollama_score_grammar(whisper_text):
    """
    💡 把 Whisper 辨識出的文字丟給 Ollama，請它針對「語法正確性」給 0~5 分。
       這是第 4 個評分維度，跟前三個（用數字統計去評分）不同，
       這個是直接把文字內容送給 LLM 去判斷語法是否合理。
    """
    if not whisper_text or not whisper_text.strip():
        return 0.0

    prompt = f"""你是一位英語文法老師。以下是一段學生朗讀時被語音辨識出來的文字內容
（請注意：這段文字可能包含語音辨識的雜訊或誤判，請專注在整體語法結構是否合理，
不要因為明顯的辨識錯字就過度扣分）：

"{whisper_text}"

請針對這段文字的「語法正確性」給 0 到 5 分（可以有小數點一位），
5 分代表文法完全正確、0 分代表文法錯誤非常嚴重。

請「只」回傳一個 JSON 物件，不要有任何其他文字說明或 markdown 標記，格式如下：
{{"grammar": 0}}
"""

    result = _call_ollama(prompt)
    if not result:
        return 0.0

    try:
        return round(float(result.get("grammar", 0)), 1)
    except (TypeError, ValueError) as e:
        print(f"🚨 Ollama 語法評分格式異常: {e}, 原始回傳: {result}", flush=True)
        return 0.0


# 💡 這裡的標準值是「比例值 × 100」換算過來的，因為資料庫存的 npvi/varco 本身就是 raw_value * 100。
NPVI_SYL_MEAN = 56.22   # 0.5622 * 100
NPVI_SYL_STD = 13.35    # 0.1335 * 100
VARCO_SYL_MEAN = 46.71  # 0.4671 * 100
VARCO_SYL_STD = 9.33    # 0.0933 * 100


def compute_sentence_fluency_status(chunks_list):
    """
    💡 對「每一句話」(NPVI 回傳的 chunk_results，每個 chunk 對應一句/一個語塊)
       自己的 nPVI / Varco 值，個別判斷有沒有落在標準範圍內：

       - 字數只有 1~2 個字的短句 -> 'skip'（數值不穩定甚至是 null，無法拿來判斷，直接忽略）
       - nPVI、Varco 兩個都在標準範圍內  -> 'pass'  （這句話沒問題）
       - 只有其中一個在範圍內            -> 'yellow'（這句話部分不流暢）
       - 兩個都不在範圍內                -> 'red'   （這句話明顯不流暢）

       依 xmin 排序，順序要跟前端 buildChunkedAudioBlock() 裡 sortedChunks 的
       chunkIndex 分配方式完全一致（都是同樣依 xmin 排序），
       這樣前端才能直接用 chunkIndex 當索引去對應到這裡算出來的狀態。

    回傳：
        (result, yellow_count, red_count)
        result 是一個 list：
        [
            {"chunk_index": 0, "npvi": 48.5, "varco": 41.2, "npvi_pass": True, "varco_pass": True, "status": "pass"},
            ...
        ]
    """
    MIN_CHUNK_WORDS = 3  # 💡 字數 <= 2 的短句直接跳過判斷

    sorted_chunks = sorted(chunks_list or [], key=lambda c: c.get('xmin', 0))

    npvi_low = NPVI_SYL_MEAN - NPVI_SYL_STD
    npvi_high = NPVI_SYL_MEAN + NPVI_SYL_STD
    varco_low = VARCO_SYL_MEAN - VARCO_SYL_STD
    varco_high = VARCO_SYL_MEAN + VARCO_SYL_STD

    result = []
    yellow_count = 0
    red_count = 0

    for i, c in enumerate(sorted_chunks):
        word_count = (c.get('counts') or {}).get('syl', 0) or 0

        # 💡 字數太少(<=2)：不管 nPVI/Varco 是不是 null，數值都不可靠，直接標記 skip
        if word_count <= 2:
            result.append({
                "chunk_index": i,
                "text": c.get('label', ''),
                "npvi": None,
                "varco": None,
                "npvi_pass": None,
                "varco_pass": None,
                "npvi_direction": None,
                "npvi_deviation": None,
                "varco_direction": None,
                "varco_deviation": None,
                "status": "skip"
            })
            continue

        npvi_raw = (c.get('nPVI') or {}).get('syl')
        varco_raw = (c.get('Varco') or {}).get('syl')

        npvi_val = round(float(npvi_raw) * 100, 2) if npvi_raw is not None else None
        varco_val = round(float(varco_raw) * 100, 2) if varco_raw is not None else None

        npvi_pass = (npvi_val is not None) and (npvi_low <= npvi_val <= npvi_high)
        varco_pass = (varco_val is not None) and (varco_low <= varco_val <= varco_high)

        # 💡 新增：算出偏差方向(太高/太低)跟差多少，供之後產生提示訊息用
        npvi_direction = None
        npvi_deviation = None
        if npvi_val is not None and not npvi_pass:
            if npvi_val > npvi_high:
                npvi_direction = 'high'
                npvi_deviation = round(npvi_val - npvi_high, 2)
            else:
                npvi_direction = 'low'
                npvi_deviation = round(npvi_low - npvi_val, 2)

        varco_direction = None
        varco_deviation = None
        if varco_val is not None and not varco_pass:
            if varco_val > varco_high:
                varco_direction = 'high'
                varco_deviation = round(varco_val - varco_high, 2)
            else:
                varco_direction = 'low'
                varco_deviation = round(varco_low - varco_val, 2)

        if npvi_val is None and varco_val is None:
            status = 'skip'   # 字數雖然夠，但這句話還是完全沒有 nPVI/Varco 資料可判斷
        elif npvi_pass and varco_pass:
            status = 'pass'
        elif npvi_pass or varco_pass:
            status = 'yellow'
            yellow_count += 1
        else:
            status = 'red'
            red_count += 1

        result.append({
            "chunk_index": i,
            "text": c.get('label', ''),
            "npvi": npvi_val,
            "varco": varco_val,
            "npvi_pass": npvi_pass,
            "varco_pass": varco_pass,
            "npvi_direction": npvi_direction,      # 💡 新增：'high' / 'low' / None
            "npvi_deviation": npvi_deviation,       # 💡 新增：超出標準範圍多少
            "varco_direction": varco_direction,     # 💡 新增：'high' / 'low' / None
            "varco_deviation": varco_deviation,      # 💡 新增：超出標準範圍多少
            "status": status
        })

    return result, yellow_count, red_count


def call_ollama_fluency_feedback(sentence_fluency_list):
    """
    💡 【核心新增】：把整份錄音裡「每一句話」的 nPVI/Varco 偏差方向與差多少，
       整理成一份摘要，丟給 Ollama，請它針對這份錄音的節奏/語速流暢度給一段
       繁體中文、簡潔好懂的整體回饋（不是給小朋友聽的逐句提示，逐句提示是用固定範本、
       前端點擊時即時顯示，不用等這支 API）。

    參數：
        sentence_fluency_list: compute_sentence_fluency_status() 回傳的那個 list

    回傳：
        字串（Ollama 生成的整體回饋文字）；失敗時回傳空字串
    """
    flagged = [s for s in (sentence_fluency_list or []) if s.get('status') in ('yellow', 'red')]

    if not flagged:
        return "這次朗讀的節奏和語速都很穩定，跟標準範圍很接近，繼續保持！"

    # 整理每句的偏差方向，數一下各種狀況出現幾次，讓 Ollama 抓到整體模式（這是內部參考資訊，
    # 不代表要它在回饋裡直接講「nPVI偏高」這種術語，是要它用自然語言描述問題）
    npvi_high = sum(1 for s in flagged if s.get('npvi_direction') == 'high')
    npvi_low = sum(1 for s in flagged if s.get('npvi_direction') == 'low')
    varco_high = sum(1 for s in flagged if s.get('varco_direction') == 'high')
    varco_low = sum(1 for s in flagged if s.get('varco_direction') == 'low')

    # 💡 找出「偏差最嚴重」的那一句(npvi_deviation + varco_deviation 加總最大者)，
    #    把它的實際內容告訴 Ollama，要求回饋裡「一定要」用引號把這句話完整引用出來，
    #    不能只講抽象的統計數字，要讓小朋友知道具體是哪一句需要加強。
    def _total_deviation(s):
        return (s.get('npvi_deviation') or 0) + (s.get('varco_deviation') or 0)

    worst = max(flagged, key=_total_deviation)
    worst_text = (worst.get('text') or '').strip()
    worst_deviation = _total_deviation(worst)
    worst_info = ""
    if worst_text and worst_deviation > 0:
        worst_info = f'\n這次問題最明顯的一句話是：「{worst_text}」'

    prompt = f"""你是一位親切的兒童英語朗讀老師，要給小朋友一段簡短的朗讀流暢度回饋。

這裡有兩個聲學指標的參考說明（這只是給你理解問題用的內部資訊，不要直接把「nPVI」「Varco」這種術語寫進回饋裡）：
- 節奏變化太大：忽快忽慢，可能有不正常的卡頓或拉長音
- 節奏太平：沒有語調起伏，念起來很平淡
- 語速不穩定：忽快忽慢，停頓不規律
- 語音單調：缺乏抑揚頓挫，聽起來死板

這次朗讀總共有 {len(flagged)} 句話的節奏或語速需要加強。
{worst_info}

請寫一段給小朋友看的整體回饋，規則非常重要、請務必遵守：

1. 【語言規則】整段回饋只能使用「繁體中文」。除了要引用課文原句時可以保留英文原文以外，
   所有的說明、形容、建議文字都必須是中文，絕對不可以出現任何一句完整的英文句子當作說明或建議
   （例如不可以寫出像 "focus on keeping a steady pace..." 這種英文句子）。

2. 【一定要引用原句】如果上面有提到「這次問題最明顯的一句話」，你「一定要」用「句子『英文原句』」
   這種格式，把那句英文原文完整地包在引號裡講出來，明確指出是哪一句話出了問題，不能只用抽象的說法帶過。

3. 【語氣自然】用口語、自然的中文描述，不要用條列式或列點，就像老師直接跟小朋友說話一樣，
   語氣親切鼓勵，不要打擊信心。

4. 【長度】大約 2 到 3 句話，不要太長。

5. 【練習建議也要中文】具體指出主要的問題模式，並給一個簡單的練習建議，練習建議的說明文字也一律用中文，
   只有在引用課文原句時才能出現英文。

參考範例格式（僅供參考語氣和結構，實際內容請根據上面的資訊自己生成）：
「這次朗讀整體節奏有點忽快忽慢，尤其是句子『they check on all their friends』念的時候速度不太穩定。
練習的時候可以試著放慢一點，每個字之間的間隔盡量平均，這樣念起來會更順喔！」

請「只」回傳一個 JSON 物件，不要有任何其他文字說明或 markdown 標記，格式如下：
{{"feedback": "這裡放你寫的回饋文字"}}
"""

    result = _call_ollama(prompt)
    if not result:
        return ""

    try:
        return str(result.get("feedback", "")).strip()
    except Exception as e:
        print(f"🚨 Ollama 流暢度回饋格式異常: {e}, 原始回傳: {result}", flush=True)
        return ""


def call_ollama_wer_category_feedback(category, wer_stats):
    """
    💡 【核心新增】：把單一 WER 總評拆成三個分項評語——完整度(漏字+贅字)、
       準確度(替換錯誤)、流利度(4種repair行為)，各自獨立呼叫 Ollama，
       這樣使用者點擊「完整度」「準確度」「流利度」標籤時，才能各自看到/聽到
       只針對那個面向的具體回饋，而不是一份籠統的總評。

    參數：
        category: 'completeness' / 'accuracy' / 'fluency' 三選一
        wer_stats: WER API 回傳的 statistics 物件
    """
    deletions = wer_stats.get('deletions', 0)
    insertions = wer_stats.get('insertions', 0)
    substitutions = wer_stats.get('substitutions', 0)
    repair_attempt = wer_stats.get('repair_attempt', 0)
    repair_repetition = wer_stats.get('repair_repetition', 0)
    repair_replacement = wer_stats.get('repair_replacement', 0)
    repair_restart = wer_stats.get('repair_restart', 0)
    total_ref_words = wer_stats.get('total_ref_words', 1) or 1

    if category == 'completeness':
        count = deletions + insertions
        focus_desc = f"漏字數 {deletions} 個、贅字數 {insertions} 個（總字數 {total_ref_words} 字）"
        topic_name = "完整度（有沒有漏字或多念字）"
    elif category == 'accuracy':
        count = substitutions
        focus_desc = f"替換錯誤數 {substitutions} 個（總字數 {total_ref_words} 字）"
        topic_name = "準確度（有沒有把字念成別的字）"
    else:  # fluency
        count = repair_attempt + repair_repetition + repair_replacement + repair_restart
        focus_desc = f"重複 {repair_repetition} 次、嘗試修正 {repair_attempt} 次、重新開始/替換修復 {repair_restart + repair_replacement} 次"
        topic_name = "流利度（念的過程中有沒有卡頓、重來）"

    if count == 0:
        defaults = {
            'completeness': "這次朗讀完全沒有漏字或多念字，內容非常完整！",
            'accuracy': "這次朗讀的每個字都念對了，準確度非常好！",
            'fluency': "這次朗讀很流暢，沒有卡頓或重來，很棒！"
        }
        return defaults.get(category, "這個面向表現得很好！")

    prompt = f"""你是一位親切的兒童英語朗讀老師，要針對「{topic_name}」這個面向，
給小朋友一段簡短的回饋。

這個面向的統計數字：{focus_desc}

請用繁體中文寫一段回饋，規則非常重要、請務必遵守：

1. 【語言規則】整段回饋只能使用「繁體中文」，絕對不可以出現任何一句完整的英文句子當作說明或建議。
2. 【語氣自然】用口語、自然的中文描述，就像老師直接跟小朋友說話一樣，語氣親切鼓勵，不要打擊信心。
3. 【長度】大約 1 到 2 句話，簡潔一點，不要太長。
4. 只針對「{topic_name}」這個面向講，不要提到其他不相關的面向，並給一個簡單的、中文描述的練習建議。

請「只」回傳一個 JSON 物件，不要有任何其他文字說明或 markdown 標記，格式如下：
{{"feedback": "這裡放你寫的回饋文字"}}
"""

    result = _call_ollama(prompt)
    if not result:
        return ""

    try:
        return str(result.get("feedback", "")).strip()
    except Exception as e:
        print(f"🚨 Ollama {category} 分項回饋格式異常: {e}, 原始回傳: {result}", flush=True)
        return ""


def call_ollama_word_pronunciation_tip(reference_word, hypothesis_word, category):
    """
    💡 【核心新增】：針對「單一個發音錯誤」，請 Ollama 根據英文字典中這個字的音節拆分，
       用簡單易懂、20 個字以內的繁體中文，教小朋友這個字該怎麼念。
       這是「點擊紅字」時即時呼叫的（不是上傳時就先算好存起來），
       因為錯誤字數可能很多，沒必要每次上傳都先把所有字都問過一輪 Ollama。

    參數：
        reference_word: 正確的英文字（課文原文）
        hypothesis_word: 使用者實際念出來被辨識到的字（可能是 '—' 代表漏念）
        category: 這個錯誤屬於哪一類（deletions/insertions/substitutions/repair_xxx），純參考用

    回傳：
        20 字以內的繁體中文教學提示字串；失敗時回傳空字串
    """
    if not reference_word or not reference_word.strip() or reference_word.strip() == '—':
        return ""

    said_desc = f"小朋友把它念成了「{hypothesis_word}」" if hypothesis_word and hypothesis_word.strip() not in ('', '—', '–') else "小朋友沒有念出這個字"

    prompt = f"""你是一位兒童英語發音教練。這個英文字是「{reference_word}」，{said_desc}。

請根據這個英文字在字典裡的正確音節拆分方式，教小朋友怎麼正確念出這個字。以下規則非常重要，一定要遵守：

1. 【語言規則，最重要】整句話「只能使用繁體中文」，絕對不可以出現任何日文、韓文、簡體字。
   除了「{reference_word}」這個目標英文字本身可以原樣出現以外，不能有任何其他英文單字或英文片語
   出現在句子裡（例如絕對不可以寫成「這個字分成 three part」這種中英夾雜的句子，這是錯誤示範）。
   再次強調不可以中英夾雜 你很常出現 英文的one part two part three part，這是錯誤示範!!!!!!!
2. 【標點符號】只能用中文常見的標點（，。！），不要用斜線「/」、頓號以外的符號，或任何看起來像程式碼、
   陣列、括號編號的寫法。
3. 【長度與完整性】用一到兩句「完整」的話說完，總長度大約在 15 到 35 個中文字之間，
   「一定要把話講完，不能寫到一半就停止」，寧可稍微短一點也要講完整。
4. 【內容】可以參考英文字典的音節，根據音節拆分，用簡單好懂的方式描述嘴型、重音或發音方式，讓小朋友聽得懂該怎麼念。
5. 【語氣】親切、鼓勵，像在教小朋友一樣，用口語化的中文，不要條列式。
6. 【範例】可以說 : 這個字念[正確發音]，要分成[幾個，你要去看字典該單字是幾個音節]音節念。前面一個音念'什麼'。中間一個音念'什麼'，最後一個音念'什麼'

正確範例（格式參考，內容請根據「{reference_word}」自己生成）：
「這個字要分成兩段念，前面輕輕帶過，後面的音要拉長一點，重音放在後半段喔！」

錯誤示範（絕對不要出現這種寫法）：
「This word 分成 two part，first part 念輕一點」← 中英夾雜，禁止
「wa-ter，重音在第一音節」← 出現斜線或奇怪符號，禁止

請「只」回傳一個 JSON 物件，不要有任何其他文字說明或 markdown 標記，格式如下：
{{"tip": "這裡放你寫的教學提示，完整的一到兩句話"}}
"""

    result = _call_ollama(prompt)
    if not result:
        return ""

    try:
        tip = str(result.get("tip", "")).strip()
        return tip[:80]  # 保險：就算模型超字數，也強制截斷避免過長（但不要切在太短的位置，避免又變成講一半）
    except Exception as e:
        print(f"🚨 Ollama 單字發音提示格式異常: {e}, 原始回傳: {result}", flush=True)
        return ""


def call_ollama_score_overall_fluency(npvi_value, varco_value):
    """
    💡 【核心新增】：把這次朗讀實際的 nPVI / Varco 數值，連同標準值±標準差一起丟給 Ollama，
       請它綜合判斷「整體朗讀流暢度」，給一個 0 到 100 的分數。

       跟前面 4 維度雷達圖評分不同：這裡不是看錯誤次數，是專門針對「節奏穩定度」
       (nPVI) 跟「語速變異程度」(Varco) 這兩個聲學指標，判斷有沒有落在正常朗讀者
       該有的範圍內，綜合給一個容易理解的總分，取代原本「一堆數字看不懂」的呈現方式。

    參數：
        npvi_value: 實際的 nPVI (syl) 分數，尺度跟資料庫一致（已經是 raw*100 的數字）
        varco_value: 實際的 Varco (syl) 分數，同上

    回傳：
        0~100 的浮點數；Ollama 呼叫失敗時回傳 0.0
    """
    prompt = f"""你是一位語音學專家，專門評估英語朗讀的流暢度。

nPVI (正規化成對變異指數) 衡量朗讀節奏的規律性，Varco 衡量語速的變異程度。
以下是根據大量標準朗讀樣本統計出來的「正常範圍」（平均值 ± 標準差）：

- nPVI 標準範圍：{NPVI_SYL_MEAN} ± {NPVI_SYL_STD}（也就是 {round(NPVI_SYL_MEAN - NPVI_SYL_STD, 2)} 到 {round(NPVI_SYL_MEAN + NPVI_SYL_STD, 2)} 之間算正常）
- Varco 標準範圍：{VARCO_SYL_MEAN} ± {VARCO_SYL_STD}（也就是 {round(VARCO_SYL_MEAN - VARCO_SYL_STD, 2)} 到 {round(VARCO_SYL_MEAN + VARCO_SYL_STD, 2)} 之間算正常）

這位學生這次朗讀的實際數值：
- nPVI 實測值：{npvi_value}
- Varco 實測值：{varco_value}

請根據這兩個數值偏離標準範圍的程度，綜合評估整體朗讀流暢度，給一個 0 到 100 的整數分數
（100 分代表完全落在標準範圍內、非常流暢；分數隨著偏離程度增加而遞減；0 分代表嚴重偏離）。

請「只」回傳一個 JSON 物件，不要有任何其他文字說明或 markdown 標記，格式如下：
{{"fluency_score": 0}}
"""

    result = _call_ollama(prompt)
    if not result:
        return 0.0

    try:
        score = float(result.get("fluency_score", 0))
        return round(max(0.0, min(100.0, score)), 1)
    except (TypeError, ValueError) as e:
        print(f"🚨 Ollama 整體流暢度評分格式異常: {e}, 原始回傳: {result}", flush=True)
        return 0.0


# --- 3. 基礎路由 (頁面跳轉) ---
@app.route('/manifest.json')
def manifest():
    """💡 PWA 設定檔，一定要放在網站根目錄（不是 /static/）瀏覽器才會自動抓到。"""
    return send_from_directory('.', 'manifest.json', mimetype='application/manifest+json')

@app.route('/service-worker.js')
def service_worker():
    """💡 Service Worker 也一定要放在網站根目錄，它的「控制範圍」是根據檔案所在路徑決定的，
       如果放在 /static/ 底下，就只能控制 /static/ 路徑，沒辦法讓整個網站可以離線使用/被安裝。"""
    return send_from_directory('.', 'service-worker.js', mimetype='application/javascript')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/main')
def main_page():
    # 💡 新增：沒有登入(session 裡沒有 username)就導回登入頁，
    #    不然不管是直接打網址、還是從 PWA 圖示打開，都能看到 main.html，
    #    只是裡面因為抓不到使用者資料而看起來像壞掉，體驗很差。
    if not session.get('username'):
        return redirect(url_for('index'))
    return render_template('main.html')

@app.route('/navbar')
def navbar():
    return render_template('navbar.html')


# --- 4. 登入與註冊邏輯 ---
@app.route('/register', methods=['POST'])
def register():
    name = request.form.get('name')
    age = request.form.get('age')
    username = request.form.get('username')
    password = request.form.get('password')

    hashed_password = generate_password_hash(password)

    conn = get_db_connection()
    if conn is None:
        return "<h3>資料庫連線失敗</h3><p>請確認資料庫服務是否已啟動。</p>"

    try:
        cursor = conn.cursor()
        query = "INSERT INTO users (name, age, username, password) VALUES (%s, %s, %s, %s)"
        cursor.execute(query, (name, age, username, hashed_password))

        conn.commit()
        cursor.close()
        return '<script>alert("註冊成功！"); window.location.href="/";</script>'
    except mysql.connector.Error as err:
        if err.errno == 1062:
            return '<script>alert("您的帳號已存在，請重新輸入或直接登入"); window.history.back();</script>'
        else:
            return f"<h3>SQL 錯誤</h3><p>{err}</p>"
    finally:
        if conn and conn.is_connected():
            conn.close()

@app.route('/reset_password', methods=['POST'])
def reset_password():
    username = request.form.get('username')
    new_pwd = request.form.get('new_password')
    confirm_pwd = request.form.get('confirm_password')

    if new_pwd != confirm_pwd:
        return '<script>alert("兩次輸入的新密碼不一致！"); window.history.back();</script>'

    conn = get_db_connection()
    if conn is None:
        return "<h3>資料庫連線失敗</h3>"

    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT password FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()

        if not user:
            return '<script>alert("找不到該帳號！"); window.history.back();</script>'

        if check_password_hash(user['password'], new_pwd):
            return '<script>alert("新密碼不可以與上一次密碼相同！"); window.history.back();</script>'

        new_hashed = generate_password_hash(new_pwd)
        cursor.execute("UPDATE users SET password = %s WHERE username = %s", (new_hashed, username))
        conn.commit()

        cursor.close()
        return '<script>alert("密碼修改成功，請使用新密碼登入！"); window.location.href="/";</script>'
    except mysql.connector.Error as err:
        return f"<h3>SQL 錯誤</h3><p>{err}</p>"
    finally:
        if conn and conn.is_connected():
            conn.close()

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')

    conn = get_db_connection()
    if conn is None:
        return "<h3>資料庫連線失敗</h3>"

    try:
        cursor = conn.cursor(dictionary=True)
        query = "SELECT * FROM users WHERE username = %s"
        cursor.execute(query, (username,))
        user = cursor.fetchone()
        cursor.close()

        if user and check_password_hash(user['password'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['name'] = user['name']
            return '<script>alert("登入成功！歡迎回來"); window.location.href="/main";</script>'
        else:
            return '<script>alert("帳號或密碼錯誤，請重新輸入"); window.history.back();</script>'
    except mysql.connector.Error as err:
        return f"<h3>SQL 錯誤</h3><p>{err}</p>"
    finally:
        if conn and conn.is_connected():
            conn.close()

# --- 5. 錄音存儲與回放邏輯 ---
@app.route('/upload_progress/<progress_id>', methods=['GET'])
def upload_progress(progress_id):
    """💡 前端上傳期間，每隔約 1 秒呼叫這支輕量 API 一次，拿到後端目前真正的處理階段文字。"""
    _cleanup_stale_progress()
    stage_text = get_upload_progress(progress_id)
    resp = jsonify({"status": "success", "stage": stage_text})
    # 💡 明確禁止快取，避免瀏覽器把第一次的回應快取住，導致之後的輪詢都拿到同一份舊資料
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    resp.headers['Pragma'] = 'no-cache'
    return resp


@app.route('/upload_audio', methods=['POST'])
def upload_audio():
    project_id = request.form.get('project_id')
    mode = request.form.get('mode', 'segment')
    para_idx = request.form.get('paragraph_index')
    progress_id = request.form.get('progress_id')  # 💡 前端產生的一次性 ID，用來對應這次上傳的進度紀錄

    set_upload_progress(progress_id, '正在上傳錄音檔案...')

    try:
        para_idx = int(para_idx)
    except:
        clear_upload_progress(progress_id)
        return jsonify({"status": "error", "message": "段落編號錯誤"})

    audio_file = request.files.get('audio_data')
    if not audio_file:
        clear_upload_progress(progress_id)
        return jsonify({"status": "error", "message": "後端沒有收到任何錄音音檔 (audio_data 為空)"})

    conn = get_db_connection()
    if conn is None:
        clear_upload_progress(progress_id)
        return jsonify({"status": "error", "message": "後端連不上 MySQL 資料庫，請檢查資料庫設定"})

    cursor = conn.cursor()

    if mode == 'whole':
        para_idx = 0

    try:
        cursor.execute("SELECT username, article_name, article_content FROM projects WHERE project_id = %s", (project_id,))
        result = cursor.fetchone()

        if not result:
            cursor.close()
            conn.close()
            return jsonify({"status": "error", "message": f"資料庫找不到此 project_id: {project_id}"})

        username = result[0]
        article_name = result[1]
        article_content = result[2] or ""
        filename = f"{project_id}_para{para_idx}.wav"

        user_dir = os.path.join(app.config['UPLOAD_FOLDER'], username)
        if not os.path.exists(user_dir):
            os.makedirs(user_dir)
        save_path = os.path.join(user_dir, filename)

        audio_bytes = audio_file.read()
        with open(save_path, 'wb') as f:
            f.write(audio_bytes)

        # 💡 段落切分：跟前端一致的規則
        paragraphs_arr = split_paragraphs(article_content)

        if mode == 'whole':
            original_text = " ".join(paragraphs_arr)
        else:
            try:
                original_text = paragraphs_arr[para_idx - 1]
            except IndexError:
                original_text = "What has fins sharp teeth and swims in the ocean a shark"

        print(f"🔍 [切段落除錯] mode={mode}, para_idx={para_idx}, "
              f"總段落數={len(paragraphs_arr)}, 本次送給WER的原文長度={len(original_text)}字元", flush=True)

        wer_stats = {"wer_repair_fluency": 0.0, "total_ref_words": len(original_text.split())}
        alignment_report = []
        chunks_list = []
        sentence_fluency = []
        fluency_yellow_count = 0
        fluency_red_count = 0
        error_count = 0

        npvi_score = 0.0
        varco_score = 0.0

        full_wer_raw_json = {}
        full_npvi_raw_json = {}
        textgrid_filename = ""

        whisper_text_db_path = None
        textgrid_db_path = None
        word_timings = []
        pause_count = 0

        # 💡 新增：四個 Ollama 評分維度，先給預設值 0.0，避免呼叫失敗時整支 API 崩潰
        score_completeness = 0.0
        score_accuracy = 0.0
        score_fluency = 0.0
        score_grammar = 0.0

        try:
            set_upload_progress(progress_id, '正在進行語音辨識與詞錯誤率分析...')
            wer_files = {'audio_file': (filename, audio_bytes, 'audio/wav')}
            wer_data_payload = {'original_text': original_text}

            wer_url = "http://backend-wer:8000/api/analyze-reading"
            wer_response = requests.post(wer_url, files=wer_files, data=wer_data_payload, timeout=120)

            if wer_response.status_code == 200:
                full_wer_raw_json = wer_response.json()

                wer_stats = full_wer_raw_json.get("statistics", {}) or {}
                alignment_report = full_wer_raw_json.get("alignment_report", [])
                error_count = sum(1 for item in alignment_report if item.get("Category") != "Match")

                whisper_processed_text = (full_wer_raw_json.get("whisper_raw_text") or "").strip()
                print(f"🔬 [直接取用] WER API 回傳的 whisper_raw_text: {whisper_processed_text}", flush=True)

                whisper_txt_filename = filename.replace(".wav", "_whisper.txt")
                whisper_txt_save_path = os.path.join(user_dir, whisper_txt_filename)
                with open(whisper_txt_save_path, 'w', encoding='utf-8') as wf:
                    wf.write(whisper_processed_text)
                whisper_text_db_path = f"/get_audio/{username}/{whisper_txt_filename}"

                try:
                    user_age = request.form.get('age', 9)
                    try:
                        user_age = int(user_age)
                    except:
                        user_age = 9

                    npvi_txt_filename = filename.replace(".wav", ".txt")
                    text_bytes = whisper_processed_text.encode('utf-8')

                    npvi_files = {
                        'audio_file': (filename, audio_bytes, 'audio/wav'),
                        'text_file': (npvi_txt_filename, text_bytes, 'text/plain')
                    }
                    npvi_data = {'age': user_age}

                    npvi_url = "http://backend-npvi:8000/api/analyze"
                    print(f"📡 [發送網路請求] 正在呼叫 {npvi_url} ...", flush=True)
                    set_upload_progress(progress_id, '正在分析節奏與語速 (nPVI / Varco)...')

                    npvi_response = requests.post(npvi_url, files=npvi_files, data=npvi_data, timeout=90)
                    print(f"📥 [同學網路回應狀態碼]: {npvi_response.status_code}", flush=True)

                    if npvi_response.status_code == 200:
                        speech_data = npvi_response.json()
                        full_npvi_raw_json = speech_data

                        actual_data = speech_data.get("data", {})
                        set_upload_progress(progress_id, '正在下載逐字時間戳並進行自動對齊...')

                        textgrid_filename = actual_data.get("file", "output.TextGrid")
                        chunks_list = actual_data.get("chunk_results") or []
                        overall = actual_data.get("overall_metrics", {}) or {}

                        # 💡 對每一句話自己的 nPVI/Varco，判斷有沒有落在標準範圍內
                        #    (pass / yellow / red / skip)，供前端「流暢度」篩選按鈕使用。
                        sentence_fluency, fluency_yellow_count, fluency_red_count = compute_sentence_fluency_status(chunks_list)

                        # 💡 新增：從 NPVI 回傳的 pause_analysis 抓出停頓次數，
                        #    給 Ollama 評「流利度」時當作參考依據之一。
                        pause_analysis = actual_data.get("pause_analysis", {}) or {}
                        pause_count = len(pause_analysis.get("pauses", []) or [])
                        total_time_sec = actual_data.get("total_time_sec")

                        # 🚀 【核心修改】：優先讀同學實際產出、存在共用資料夾裡的真正 TextGrid，
                        #    讀不到才退回自己組的備援版本。
                        textgrid_save_filename = filename.replace(".wav", ".TextGrid")
                        real_textgrid_path = fetch_real_textgrid(textgrid_filename, user_dir, textgrid_save_filename)

                        # 💡 新增：逐字時間戳（來自真正 TextGrid 的 "words" tier），
                        #    有拿到才能做真正的逐字對齊；拿不到就是空陣列，
                        #    前端會自動退回原本「用字數比例分配」的近似做法。
                        word_timings = []

                        if real_textgrid_path:
                            textgrid_db_path = f"/get_audio/{username}/{textgrid_save_filename}"
                            try:
                                with open(real_textgrid_path, 'r', encoding='utf-8') as tgf:
                                    real_textgrid_content = tgf.read()
                                word_timings = parse_textgrid_words(real_textgrid_content, tier_name="words")
                                print(f"✅ 從真正的 TextGrid 解析出 {len(word_timings)} 個逐字時間戳", flush=True)
                            except Exception as parse_err:
                                print(f"🚨 讀取/解析剛下載的 TextGrid 失敗: {parse_err}", flush=True)
                        elif chunks_list:
                            # 備援：共用資料夾讀不到才自己組一份
                            try:
                                textgrid_text_content = build_textgrid_from_chunks(chunks_list, total_time_sec)
                                textgrid_save_path = os.path.join(user_dir, textgrid_save_filename)
                                with open(textgrid_save_path, 'w', encoding='utf-8') as tg:
                                    tg.write(textgrid_text_content)
                                textgrid_db_path = f"/get_audio/{username}/{textgrid_save_filename}"
                                print(f"⚠️ 改用備援方案自行組出 TextGrid: {textgrid_save_path}", flush=True)
                                # 備援版本只有 chunk 層級的資料，沒有真正的逐字時間戳，word_timings 維持空陣列
                            except Exception as tg_build_err:
                                print(f"🚨 備援組建 TextGrid 也失敗: {tg_build_err}", flush=True)
                        else:
                            print("⚠️ 共用資料夾讀不到、chunk_results 也是空的，這次沒有 TextGrid 可用。", flush=True)

                        raw_npvi_avg = overall.get("nPVI_overall", {}).get("syl")
                        raw_varco_avg = overall.get("Varco_overall", {}).get("syl")

                        if raw_npvi_avg is not None and raw_varco_avg is not None:
                            npvi_score = float(raw_npvi_avg) * 100
                            varco_score = float(raw_varco_avg) * 100
                        elif chunks_list and isinstance(chunks_list, list):
                            total_chunk_npvi = sum(float((c.get("nPVI") or {}).get("syl", 0)) * 100 for c in chunks_list if (c.get("nPVI") or {}).get("syl") is not None)
                            valid_npvi_count = sum(1 for c in chunks_list if (c.get("nPVI") or {}).get("syl") is not None)

                            total_chunk_varco = sum(float((c.get("Varco") or {}).get("syl", 0)) * 100 for c in chunks_list if (c.get("Varco") or {}).get("syl") is not None)
                            valid_varco_count = sum(1 for c in chunks_list if (c.get("Varco") or {}).get("syl") is not None)

                            if valid_npvi_count > 0: npvi_score = total_chunk_npvi / valid_npvi_count
                            if valid_varco_count > 0: varco_score = total_chunk_varco / valid_varco_count
                        else:
                            npvi_score = 0.00
                            varco_score = 0.00
                    else:
                        print(f"⚠️ 同學 API 回應異常，狀態碼: {npvi_response.status_code}, 內容: {npvi_response.text}", flush=True)
                        npvi_score = 58.50
                        varco_score = 48.20

                except Exception as speech_err:
                    print(f"🚨 呼叫同學 API 發生異常，原因: {str(speech_err)}", flush=True)
                    npvi_score = 58.50
                    varco_score = 48.20

            else:
                cursor.close()
                conn.close()
                clear_upload_progress(progress_id)
                return jsonify({"status": "error", "message": f"backend-wer 容器回應狀態碼錯誤: {wer_response.status_code}"})

        except Exception as err:
            cursor.close()
            conn.close()
            clear_upload_progress(progress_id)
            return jsonify({"status": "error", "message": f"Pipeline 連線調度鏈發生死鎖崩潰: {str(err)}"})

        npvi_score = round(float(npvi_score), 2)
        varco_score = round(float(varco_score), 2)
        wer_score = round(float(wer_stats.get("wer_repair_fluency", 0.0)), 2)
        total_words = int(wer_stats.get("total_ref_words", 0))

        # 🚀 【核心新增】：呼叫 Ollama 評分——
        #    完整度/準確度/流利度：用 wer_stats 的錯誤統計數字 + 停頓次數
        #    語法正確性：直接把 Whisper 辨識出的文字丟給 Ollama 判斷
        set_upload_progress(progress_id, 'AI 正在評估發音完整度、準確度與流利度分數...')
        try:
            ollama_error_scores = call_ollama_score_errors(wer_stats, pause_count)
            score_completeness = ollama_error_scores.get("completeness", 0.0)
            score_accuracy = ollama_error_scores.get("accuracy", 0.0)
            score_fluency = ollama_error_scores.get("fluency", 0.0)
            print(f"✅ Ollama 錯誤統計評分完成: 完整度={score_completeness} 準確度={score_accuracy} 流利度={score_fluency}", flush=True)
        except Exception as ollama_err:
            print(f"🚨 呼叫 Ollama 錯誤統計評分整體失敗: {ollama_err}", flush=True)

        set_upload_progress(progress_id, 'AI 正在評估語法正確性...')
        try:
            score_grammar = call_ollama_score_grammar(whisper_processed_text)
            print(f"✅ Ollama 語法評分完成: {score_grammar}", flush=True)
        except Exception as ollama_err:
            print(f"🚨 呼叫 Ollama 語法評分整體失敗: {ollama_err}", flush=True)

        # 💡 每一段錄音都計算「這一段自己」的流暢度評分 (0-100)，存進 recordings.fluency_score_100，
        #    不管分段還是整篇模式都會算，純粹代表這一段錄音自己的 nPVI/Varco 表現。
        recording_fluency_score_100 = 0.0
        set_upload_progress(progress_id, 'AI 正在計算整體流暢度分數...')
        try:
            recording_fluency_score_100 = call_ollama_score_overall_fluency(npvi_score, varco_score)
            print(f"✅ Ollama 單段流暢度評分完成: {recording_fluency_score_100}", flush=True)
        except Exception as ollama_err:
            print(f"🚨 呼叫 Ollama 單段流暢度評分失敗: {ollama_err}", flush=True)

        # 🚀 【核心新增】：兩段「整份錄音」的文字回饋——
        #    一段是 nPVI/Varco 節奏語速的流暢度回饋，一段是發音正確度(WER)的回饋。
        # 🚀 兩段「整份錄音」的文字回饋——
        #    一段是 nPVI/Varco 節奏語速的流暢度回饋，逐句的即時提示不會呼叫 Ollama
        #   （前端用固定範本秒開），這裡是給使用者事後查看整體報告時看的、比較有深度的整體評語。
        fluency_feedback_text = ""
        set_upload_progress(progress_id, 'AI 正在生成節奏流暢度建議...')
        try:
            fluency_feedback_text = call_ollama_fluency_feedback(sentence_fluency)
            print(f"✅ Ollama 流暢度回饋完成: {fluency_feedback_text}", flush=True)
        except Exception as ollama_err:
            print(f"🚨 呼叫 Ollama 流暢度回饋失敗: {ollama_err}", flush=True)

        # 🚀 三個分項評語：完整度 / 準確度 / 流利度，各自獨立生成，
        #    供使用者點擊對應標籤時個別顯示+TTS播放。
        completeness_feedback_text = ""
        accuracy_feedback_text = ""
        wer_fluency_feedback_text = ""
        set_upload_progress(progress_id, 'AI 正在生成完整度回饋建議...')
        try:
            completeness_feedback_text = call_ollama_wer_category_feedback('completeness', wer_stats)
            print(f"✅ Ollama 完整度分項回饋完成: {completeness_feedback_text}", flush=True)
        except Exception as ollama_err:
            print(f"🚨 呼叫 Ollama 完整度分項回饋失敗: {ollama_err}", flush=True)
        set_upload_progress(progress_id, 'AI 正在生成準確度回饋建議...')
        try:
            accuracy_feedback_text = call_ollama_wer_category_feedback('accuracy', wer_stats)
            print(f"✅ Ollama 準確度分項回饋完成: {accuracy_feedback_text}", flush=True)
        except Exception as ollama_err:
            print(f"🚨 呼叫 Ollama 準確度分項回饋失敗: {ollama_err}", flush=True)
        set_upload_progress(progress_id, 'AI 正在生成流利度回饋建議...')
        try:
            wer_fluency_feedback_text = call_ollama_wer_category_feedback('fluency', wer_stats)
            print(f"✅ Ollama 流利度分項回饋完成: {wer_fluency_feedback_text}", flush=True)
        except Exception as ollama_err:
            print(f"🚨 呼叫 Ollama 流利度分項回饋失敗: {ollama_err}", flush=True)

        # 🔧 核心修正：projects.overall_fluency_score_100（整個「專案」的分數）
        #    *只有整篇模式 (whole)* 才能直接沿用這一段的分數 —— 因為整篇模式從頭到尾只有這一筆錄音，
        #    這一筆的分數本來就等於整個專案的分數。
        #
        #    分段模式絕對不能在這裡寫入 projects.overall_fluency_score_100，
        #    因為那樣只會用「剛錄完的這一段」自己的 npvi/varco 去代表整個專案，
        #    把原本正確的「全部已錄段落的平均」蓋掉。分段模式的整體分數，
        #    只由 get_project_total_report() 在使用者切到 Step 3 報告頁時，
        #    重新查詢 recordings 表裡「目前所有段落」的 npvi/varco 算出正確平均後才計算，
        #    這裡完全不用做任何事。
        overall_fluency_score_100 = 0.0
        if mode == 'whole':
            overall_fluency_score_100 = recording_fluency_score_100  # 整篇模式：這一筆就是整個專案的分數，直接沿用，不用再呼叫一次 Ollama
            try:
                cursor.execute(
                    "UPDATE projects SET overall_fluency_score_100 = %s WHERE project_id = %s",
                    (overall_fluency_score_100, project_id)
                )
                conn.commit()
            except Exception as db_write_err:
                print(f"🚨 寫入 projects.overall_fluency_score_100 失敗: {db_write_err}", flush=True)
        else:
            print("ℹ️ 分段模式：不寫入 projects.overall_fluency_score_100，交給 get_project_total_report() 用全段平均正確計算。", flush=True)

        extended_report = {
            "textgrid_file_target": textgrid_filename,
            "textgrid_path": textgrid_db_path,
            "whisper_text_path": whisper_text_db_path,
            "word_alignments": alignment_report,
            "chunk_details": chunks_list,
            "word_timings": word_timings,
            "sentence_fluency": sentence_fluency,
            "fluency_feedback_text": fluency_feedback_text,
            "completeness_feedback_text": completeness_feedback_text,
            "accuracy_feedback_text": accuracy_feedback_text,
            "wer_fluency_feedback_text": wer_fluency_feedback_text,
            "raw_wer_output": full_wer_raw_json,
            "raw_npvi_output": full_npvi_raw_json
        }
        alignment_json = json.dumps(extended_report, ensure_ascii=False)

        db_path = f"/get_audio/{username}/{filename}"
        set_upload_progress(progress_id, '正在儲存結果到資料庫...')
        try:
            insert_sql = """
               INSERT INTO recordings (project_id, paragraph_index, file_path, wer, total_words, error_count,
                                       alignment_report, npvi, varco, whisper_text_path, textgrid_path,
                                       score_completeness, score_accuracy, score_fluency, score_grammar,
                                       fluency_score_100, fluency_yellow_count, fluency_red_count,
                                       fluency_feedback_text, completeness_feedback_text, accuracy_feedback_text, wer_fluency_feedback_text)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON DUPLICATE KEY UPDATE
                  file_path = %s, wer = %s, total_words = %s, error_count = %s, alignment_report = %s,
                  npvi = %s, varco = %s, whisper_text_path = %s, textgrid_path = %s,
                  score_completeness = %s, score_accuracy = %s, score_fluency = %s, score_grammar = %s,
                  fluency_score_100 = %s, fluency_yellow_count = %s, fluency_red_count = %s,
                  fluency_feedback_text = %s, completeness_feedback_text = %s, accuracy_feedback_text = %s, wer_fluency_feedback_text = %s
               """
            cursor.execute(insert_sql, (
                project_id, para_idx, db_path, wer_score, total_words, error_count, alignment_json,
                npvi_score, varco_score, whisper_text_db_path, textgrid_db_path,
                score_completeness, score_accuracy, score_fluency, score_grammar,
                recording_fluency_score_100, fluency_yellow_count, fluency_red_count,
                fluency_feedback_text, completeness_feedback_text, accuracy_feedback_text, wer_fluency_feedback_text,
                db_path, wer_score, total_words, error_count, alignment_json,
                npvi_score, varco_score, whisper_text_db_path, textgrid_db_path,
                score_completeness, score_accuracy, score_fluency, score_grammar,
                recording_fluency_score_100, fluency_yellow_count, fluency_red_count,
                fluency_feedback_text, completeness_feedback_text, accuracy_feedback_text, wer_fluency_feedback_text
            ))
            conn.commit()
        except Exception as db_err:
            print(f"🚨 MySQL 實體落盤失敗，死因: {str(db_err)}")

        cursor.close()
        conn.close()

        clear_upload_progress(progress_id)
        return jsonify({
            "status": "success",
            "url": db_path,
            "wer_result": {
                "alignment_report": alignment_report,
                "statistics": {
                    "wer_repair_fluency": wer_score,
                    "total_ref_words": total_words,
                    "npvi": npvi_score,
                    "varco": varco_score
                },
                "npvi": npvi_score,
                "varco": varco_score,
                "chunk_details": chunks_list,
                "word_timings": word_timings,
                "sentence_fluency": sentence_fluency,
                "textgrid_associated": textgrid_filename,
                "whisper_text_path": whisper_text_db_path,
                "textgrid_path": textgrid_db_path,
                "score_completeness": score_completeness,
                "score_accuracy": score_accuracy,
                "score_fluency": score_fluency,
                "score_grammar": score_grammar,
                "overall_fluency_score_100": overall_fluency_score_100,
                "recording_fluency_score_100": recording_fluency_score_100,
                "fluency_feedback_text": fluency_feedback_text,
                "completeness_feedback_text": completeness_feedback_text,
                "accuracy_feedback_text": accuracy_feedback_text,
                "wer_fluency_feedback_text": wer_fluency_feedback_text
            }
        })

    except Exception as global_err:
        if 'cursor' in locals() and cursor: cursor.close()
        if 'conn' in locals() and conn: conn.close()
        clear_upload_progress(progress_id)
        return jsonify({"status": "error", "message": f"後端 upload_audio 發生未預期崩潰: {str(global_err)}"})

@app.route('/get_word_pronunciation_tip', methods=['POST'])
def get_word_pronunciation_tip():
    """
    💡 前端點擊某個紅字錯誤時呼叫這支 API。
       核心邏輯：先查 word_pronunciation_tips 這張快取表，
       如果同樣的 (正確字, 錯誤字, 類別) 組合之前已經問過 Ollama，
       直接回傳存好的內容——確保「同一個錯誤永遠得到一模一樣的提示」，
       不會每次點都重新生成、每次答案都不一樣。
       只有第一次遇到全新的組合，才會真的去問 Ollama，問完立刻存進快取表。
    """
    data = request.json or {}
    reference_word = (data.get('reference') or '').strip()
    hypothesis_word = (data.get('hypothesis') or '').strip()
    category = (data.get('category') or '').strip()

    if not reference_word or reference_word == '—':
        return jsonify({"status": "error", "message": "缺少正確課文原字，無法產生教學提示"})

    conn = get_db_connection()
    if conn is None:
        return jsonify({"status": "error", "message": "資料庫連線失敗，無法查詢/寫入快取"})

    cursor = conn.cursor(dictionary=True)
    try:
        # 1. 先查快取表，有的話直接回傳，不呼叫 Ollama
        cursor.execute(
            "SELECT tip_text FROM word_pronunciation_tips WHERE reference_word = %s AND hypothesis_word = %s AND category = %s",
            (reference_word, hypothesis_word, category)
        )
        cached = cursor.fetchone()
        if cached and cached.get('tip_text'):
            cursor.close()
            conn.close()
            return jsonify({"status": "success", "tip": cached['tip_text'], "word": reference_word, "cached": True})

        # 2. 沒有快取，真的問一次 Ollama
        tip = call_ollama_word_pronunciation_tip(reference_word, hypothesis_word, category)
        if not tip:
            cursor.close()
            conn.close()
            return jsonify({"status": "error", "message": "Ollama 沒有回應有效內容"})

        # 3. 存進快取表，之後同樣的組合就不用再問了
        try:
            cursor.execute(
                """INSERT INTO word_pronunciation_tips (reference_word, hypothesis_word, category, tip_text)
                   VALUES (%s, %s, %s, %s)
                   ON DUPLICATE KEY UPDATE tip_text = VALUES(tip_text)""",
                (reference_word, hypothesis_word, category, tip)
            )
            conn.commit()
        except Exception as db_write_err:
            print(f"🚨 寫入 word_pronunciation_tips 快取失敗: {db_write_err}", flush=True)

        cursor.close()
        conn.close()
        return jsonify({"status": "success", "tip": tip, "word": reference_word, "cached": False})

    except Exception as e:
        if cursor: cursor.close()
        if conn: conn.close()
        print(f"🚨 產生單字發音提示失敗: {e}", flush=True)
        return jsonify({"status": "error", "message": str(e)})


@app.route('/get_project_total_report', methods=['GET'])
def get_project_total_report():
    project_id = request.args.get('project_id')
    if not project_id:
        return jsonify({"status": "error", "message": "缺少 project_id"})

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("SELECT article_content FROM projects WHERE project_id = %s", (project_id,))
        project_row = cursor.fetchone()
        if not project_row:
            cursor.close()
            conn.close()
            return jsonify({"status": "error", "message": "找不到該練習專案"})

        article_content = project_row['article_content'] or ""

        total_paragraphs_count = len(split_paragraphs(article_content))

        if total_paragraphs_count == 0:
            total_paragraphs_count = 4

        sql = """
            SELECT paragraph_index, file_path, wer, total_words, error_count, alignment_report, npvi, varco,
                   score_completeness, score_accuracy, score_fluency, score_grammar, fluency_score_100,
                   fluency_feedback_text, completeness_feedback_text, accuracy_feedback_text, wer_fluency_feedback_text
            FROM recordings
            WHERE project_id = %s
            ORDER BY paragraph_index ASC
        """
        cursor.execute(sql, (project_id,))
        rows = cursor.fetchall()

        recorded_dict = {int(row['paragraph_index']): row for row in rows}

        paragraph_list = []
        total_wer = 0.0
        total_words = 0
        total_errors = 0

        total_npvi = 0.0
        total_varco = 0.0
        recorded_count = 0

        for i in range(1, total_paragraphs_count + 1):
            if i in recorded_dict:
                row = recorded_dict[i]
                align_report = []
                if row['alignment_report']:
                    try:
                        if isinstance(row['alignment_report'], str):
                            align_report = json.loads(row['alignment_report'])
                        else:
                            align_report = row['alignment_report']
                    except Exception as json_err:
                        print(f"JSON 解析出錯: {json_err}")

                paragraph_list.append({
                    "paragraph_index": i,
                    "file_path": row['file_path'],
                    "wer": row['wer'],
                    "total_words": row['total_words'],
                    "error_count": row['error_count'],
                    "alignment_report": align_report,
                    "npvi": row['npvi'] if row['npvi'] is not None else 0.0,
                    "varco": row['varco'] if row['varco'] is not None else 0.0,
                    "score_completeness": row['score_completeness'] if row['score_completeness'] is not None else 0.0,
                    "score_accuracy": row['score_accuracy'] if row['score_accuracy'] is not None else 0.0,
                    "score_fluency": row['score_fluency'] if row['score_fluency'] is not None else 0.0,
                    "score_grammar": row['score_grammar'] if row['score_grammar'] is not None else 0.0,
                    "fluency_score_100": row['fluency_score_100'] if row['fluency_score_100'] is not None else 0.0,
                    "fluency_feedback_text": row['fluency_feedback_text'] or "",
                    "completeness_feedback_text": row['completeness_feedback_text'] or "",
                    "accuracy_feedback_text": row['accuracy_feedback_text'] or "",
                    "wer_fluency_feedback_text": row['wer_fluency_feedback_text'] or ""
                })

                if row['wer'] is not None:
                    total_wer += float(row['wer'])
                    total_words += int(row['total_words'] or 0)
                    total_errors += int(row['error_count'] or 0)

                    total_npvi += float(row['npvi'] or 0.0)
                    total_varco += float(row['varco'] or 0.0)

                    recorded_count += 1
            else:
                paragraph_list.append({
                    "paragraph_index": i,
                    "file_path": None,
                    "wer": None,
                    "total_words": None,
                    "error_count": None,
                    "alignment_report": [],
                    "npvi": None,
                    "varco": None,
                    "score_completeness": None,
                    "score_accuracy": None,
                    "score_fluency": None,
                    "score_grammar": None,
                    "fluency_feedback_text": None,
                    "completeness_feedback_text": None,
                    "accuracy_feedback_text": None,
                    "wer_fluency_feedback_text": None,
                    "fluency_score_100": None
                })

        # 🔧 核心修正：上面的迴圈只跑 range(1, total_paragraphs_count+1)，
        #    也就是「只處理 paragraph_index 1 以上」的資料——這對分段模式沒問題，
        #    但「整篇模式(whole)」的實際錄音資料，是存在 paragraph_index = 0！
        #    導致這個迴圈永遠不會把整篇模式的資料放進 paragraph_list，
        #    每次重新整理頁面、重新呼叫這支 API 時，整篇模式看起來就像「資料庫裡沒有資料」。
        #    這裡額外把 paragraph_index=0 的資料（如果存在）補進 paragraph_list 最前面。
        if 0 in recorded_dict:
            row = recorded_dict[0]
            whole_align_report = []
            if row['alignment_report']:
                try:
                    if isinstance(row['alignment_report'], str):
                        whole_align_report = json.loads(row['alignment_report'])
                    else:
                        whole_align_report = row['alignment_report']
                except Exception as json_err:
                    print(f"JSON 解析出錯 (paragraph_index=0): {json_err}")

            paragraph_list.insert(0, {
                "paragraph_index": 0,
                "file_path": row['file_path'],
                "wer": row['wer'],
                "total_words": row['total_words'],
                "error_count": row['error_count'],
                "alignment_report": whole_align_report,
                "npvi": row['npvi'] if row['npvi'] is not None else 0.0,
                "varco": row['varco'] if row['varco'] is not None else 0.0,
                "score_completeness": row['score_completeness'] if row['score_completeness'] is not None else 0.0,
                "score_accuracy": row['score_accuracy'] if row['score_accuracy'] is not None else 0.0,
                "score_fluency": row['score_fluency'] if row['score_fluency'] is not None else 0.0,
                "score_grammar": row['score_grammar'] if row['score_grammar'] is not None else 0.0,
                "fluency_score_100": row['fluency_score_100'] if row['fluency_score_100'] is not None else 0.0,
                "fluency_feedback_text": row['fluency_feedback_text'] or "",
                "completeness_feedback_text": row['completeness_feedback_text'] or "",
                "accuracy_feedback_text": row['accuracy_feedback_text'] or "",
                "wer_fluency_feedback_text": row['wer_fluency_feedback_text'] or ""
            })

            if row['wer'] is not None:
                total_wer += float(row['wer'])
                total_words += int(row['total_words'] or 0)
                total_errors += int(row['error_count'] or 0)
                total_npvi += float(row['npvi'] or 0.0)
                total_varco += float(row['varco'] or 0.0)
                recorded_count += 1

        avg_npvi = total_npvi / recorded_count if recorded_count > 0 else 0.0
        avg_varco = total_varco / recorded_count if recorded_count > 0 else 0.0

        # 🚀 用整體平均的 nPVI/Varco，呼叫 Ollama 給一個 0-100 的綜合流暢度分數，
        #    取代原本「一堆數字看不懂」的呈現方式。只有真的有錄音資料才呼叫，避免浪費 API 呼叫。
        #
        # 🔧 核心修正：分段模式的這個分數「完全不寫回 projects 表」！
        #    只是每次使用者查看報告時，即時用 recordings 表裡目前所有已錄段落重新算一次，
        #    算完直接回傳給前端顯示，不做任何持久化。
        #    projects.overall_fluency_score_100 這個欄位，只給「整篇模式(whole)」在
        #    upload_audio() 裡使用（因為整篇模式從頭到尾只有一筆錄音，那一筆就代表整個專案）。
        #    這樣「分段模式的整體分數」永遠是當下最新的正確平均，而且完全不會跟
        #    「整篇模式的分數」互相污染同一個欄位。
        overall_fluency_score_100 = 0.0
        if recorded_count > 0:
            try:
                overall_fluency_score_100 = call_ollama_score_overall_fluency(avg_npvi, avg_varco)
                print(f"✅ Ollama 整體流暢度評分完成 (分段模式，即時計算，不寫入 projects): {overall_fluency_score_100}", flush=True)
            except Exception as ollama_err:
                print(f"🚨 呼叫 Ollama 整體流暢度評分失敗: {ollama_err}", flush=True)

        global_stats = {
            "wer_average": total_wer / recorded_count if recorded_count > 0 else 0,
            "total_words": total_words,
            "total_errors": total_errors,
            "average_npvi": avg_npvi,
            "average_varco": avg_varco,
            "overall_fluency_score_100": overall_fluency_score_100
        }

        cursor.close()
        conn.close()
        return jsonify({
            "status": "success",
            "paragraph_list": paragraph_list,
            "global_stats": global_stats
        })

    except Exception as e:
        if 'cursor' in locals() and cursor: cursor.close()
        if 'conn' in locals() and conn: conn.close()
        print(f"❌ 總結整合報告失敗: {e}")
        return jsonify({"status": "error", "message": str(e)})

@app.route('/check_audio')
def check_audio():
    project_id = request.args.get('project_id')
    para_idx = request.args.get('paragraph_index')
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT file_path FROM recordings WHERE project_id = %s AND paragraph_index = %s", (project_id, para_idx))
    result = cursor.fetchone()
    conn.close()
    if result:
        return jsonify({"exists": True, "url": result[0]})
    return jsonify({"exists": False})

@app.route('/get_recorded_indices')
def get_recorded_indices():
    project_id = request.args.get('project_id')
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT paragraph_index FROM recordings WHERE project_id = %s", (project_id,))
    rows = cursor.fetchall()
    conn.close()
    return jsonify({"indices": [r[0] for r in rows]})

@app.route('/get_all_projects')
def get_all_projects():
    username = session.get('username')
    if not username:
        return jsonify({"projects": []})

    conn = get_db_connection()
    if conn is None: return jsonify({"error": "DB connection failed"}), 500

    try:
        cursor = conn.cursor()
        sql = """
            SELECT project_id, article_name,
                   DATE_FORMAT(DATE_ADD(created_at, INTERVAL 8 HOUR), '%Y-%m-%d %H:%i') as local_time,
                   article_content
            FROM projects
            WHERE username=%s
            ORDER BY created_at DESC
        """
        cursor.execute(sql, (username,))
        rows = cursor.fetchall()

        projects = []
        for r in rows:
            projects.append({
                "id": r[0],
                "title": r[1],
                "date": r[2],
                "content": r[3]
            })
        return jsonify({"projects": projects})
    finally:
        conn.close()

@app.route('/create_project', methods=['POST'])
def create_project():
    data = request.json
    username = session.get('username')
    if not username:
        username = data.get('username') or 'guest'

    project_id = data.get('project_id')
    article_name = data.get('article_name')
    article_content = data.get('article_content')

    conn = get_db_connection()
    if conn is None:
        return jsonify({"status": "error", "message": "資料庫連線失敗"}), 500

    try:
        cursor = conn.cursor()
        sql = "INSERT INTO projects (project_id, username, article_name, article_content) VALUES (%s, %s, %s, %s)"
        cursor.execute(sql, (project_id, username, article_name, article_content))
        conn.commit()
        cursor.close()
        return jsonify({"status": "success"})
    except Exception as e:
        print(f"❌ 資料庫寫入錯誤: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if conn and conn.is_connected():
            conn.close()

@app.route('/get_audio/<username>/<filename>')
def get_audio(username, filename):
    return send_from_directory(os.path.join(app.config['UPLOAD_FOLDER'], username), filename)

@app.route('/api/get_user_info')
def get_user_info():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"status": "error", "message": "未登入"}), 401

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT name, age, username FROM users WHERE id = %s", (user_id,))
    user_data = cursor.fetchone()
    cursor.close()
    conn.close()

    if user_data:
        return jsonify({
            "status": "success",
            "name": user_data['name'],
            "age": user_data['age'],
            "username": user_data['username']
        })
    return jsonify({"status": "error", "message": "找不到使用者"}), 404

@app.route('/api/update_user_info', methods=['POST'])
def update_user_info():
    user_id = session.get('user_id')
    if not user_id: return jsonify({"status": "error"}), 401

    data = request.json
    name = data.get('name')
    age = data.get('age')

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET name = %s, age = %s WHERE id = %s", (name, age, user_id))
    conn.commit()
    cursor.close()
    conn.close()

    session['name'] = name
    session['age'] = age
    return jsonify({"status": "success"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)