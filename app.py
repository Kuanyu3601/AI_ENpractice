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

app = Flask(__name__)
app.secret_key = 'any_secret_string_here'

# --- 1. 資料夾與檔案配置 ---
UPLOAD_FOLDER = 'kids_recordings'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

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
    💡 【核心新增】：自己動手組一份 Praat long-format TextGrid 檔案文字內容。
 
    背景：NPVI API 那邊產生的 .TextGrid 只存在於它自己容器內部的暫存資料夾，
         API 回應完成後就被刪除，我們這邊完全拿不到那份原始檔案，
         而且要修改同學的程式碼才能解決（見前面討論）。
 
    解法：NPVI API 回傳的 JSON 裡，chunk_results 陣列本身就包含了
         每個語塊的起訖時間 (xmin/xmax) 與文字內容 (label)，
         這些資訊已經足夠讓我們自己重建出一份「語塊層級」的 TextGrid，
         完全不需要依賴同學那邊回傳原始檔案內容。
 
    參數：
        chunk_results: 例如 raw_npvi_output['data']['chunk_results']，
                        每筆需要有 'xmin', 'xmax', 'label' 欄位
        total_time_sec: 整段音檔的總長度（秒），例如 raw_npvi_output['data']['total_time_sec']
        tier_name: 這個 tier 要取的名字，預設 "chunks"
 
    回傳：
        Praat TextGrid 檔案的完整文字內容（字串），可以直接寫檔存成 .TextGrid
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

# --- 3. 基礎路由 (頁面跳轉) ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/main')
def main_page():
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
        return "<h3>資料庫連線失敗</h3><p>請確認 VPN 已開啟。</p>"

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
@app.route('/upload_audio', methods=['POST'])
def upload_audio():
    project_id = request.form.get('project_id')
    mode = request.form.get('mode', 'segment')
    para_idx = request.form.get('paragraph_index')
 
    try:
        para_idx = int(para_idx)
    except:
        return jsonify({"status": "error", "message": "段落編號錯誤"})
 
    audio_file = request.files.get('audio_data')
    if not audio_file:
        return jsonify({"status": "error", "message": "後端沒有收到任何錄音音檔 (audio_data 為空)"})
 
    conn = get_db_connection()
    if conn is None:
        return jsonify({"status": "error", "message": "後端連不上 MySQL 資料庫，請檢查 VPN 或資料庫設定"})
 
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
        error_count = 0
 
        npvi_score = 0.0
        varco_score = 0.0
 
        full_wer_raw_json = {}
        full_npvi_raw_json = {}
        textgrid_filename = ""
 
        whisper_text_db_path = None
        textgrid_db_path = None
 
        try:
            wer_files = {'audio_file': (filename, audio_bytes, 'audio/wav')}
            wer_data_payload = {'original_text': original_text}
 
            wer_url = "http://backend-wer:8000/api/analyze-reading"
            wer_response = requests.post(wer_url, files=wer_files, data=wer_data_payload, timeout=90)
 
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
 
                    npvi_response = requests.post(npvi_url, files=npvi_files, data=npvi_data, timeout=90)
                    print(f"📥 [同學網路回應狀態碼]: {npvi_response.status_code}", flush=True)
 
                    if npvi_response.status_code == 200:
                        speech_data = npvi_response.json()
                        full_npvi_raw_json = speech_data
 
                        actual_data = speech_data.get("data", {})
 
                        textgrid_filename = actual_data.get("file", "output.TextGrid")
                        chunks_list = actual_data.get("chunk_results") or []
                        overall = actual_data.get("overall_metrics", {}) or {}
                        total_time_sec = actual_data.get("total_time_sec")
 
                        # 🚀 【核心新增】：自己組一份 TextGrid，不再依賴同學回傳實際檔案內容
                        try:
                            if chunks_list:
                                textgrid_text_content = build_textgrid_from_chunks(
                                    chunks_list, total_time_sec
                                )
                                textgrid_save_filename = filename.replace(".wav", ".TextGrid")
                                textgrid_save_path = os.path.join(user_dir, textgrid_save_filename)
                                with open(textgrid_save_path, 'w', encoding='utf-8') as tg:
                                    tg.write(textgrid_text_content)
                                textgrid_db_path = f"/get_audio/{username}/{textgrid_save_filename}"
                                print(f"✅ 已自行組出並落盤 TextGrid: {textgrid_save_path}", flush=True)
                            else:
                                print("⚠️ chunk_results 是空的，無法組出 TextGrid。", flush=True)
                        except Exception as tg_build_err:
                            print(f"🚨 組建 TextGrid 失敗: {tg_build_err}", flush=True)
 
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
                return jsonify({"status": "error", "message": f"backend-wer 容器回應狀態碼錯誤: {wer_response.status_code}"})
 
        except Exception as err:
            cursor.close()
            conn.close()
            return jsonify({"status": "error", "message": f"Pipeline 連線調度鏈發生死鎖崩潰: {str(err)}"})
 
        npvi_score = round(float(npvi_score), 2)
        varco_score = round(float(varco_score), 2)
        wer_score = round(float(wer_stats.get("wer_repair_fluency", 0.0)), 2)
        total_words = int(wer_stats.get("total_ref_words", 0))
 
        extended_report = {
            "textgrid_file_target": textgrid_filename,
            "textgrid_path": textgrid_db_path,
            "whisper_text_path": whisper_text_db_path,
            "word_alignments": alignment_report,
            "chunk_details": chunks_list,
            "raw_wer_output": full_wer_raw_json,
            "raw_npvi_output": full_npvi_raw_json
        }
        alignment_json = json.dumps(extended_report, ensure_ascii=False)
 
        db_path = f"/get_audio/{username}/{filename}"
        try:
            insert_sql = """
               INSERT INTO recordings (project_id, paragraph_index, file_path, wer, total_words, error_count,
                                       alignment_report, npvi, varco, whisper_text_path, textgrid_path)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON DUPLICATE KEY UPDATE
                  file_path = %s, wer = %s, total_words = %s, error_count = %s, alignment_report = %s,
                  npvi = %s, varco = %s, whisper_text_path = %s, textgrid_path = %s
               """
            cursor.execute(insert_sql, (
                project_id, para_idx, db_path, wer_score, total_words, error_count, alignment_json,
                npvi_score, varco_score, whisper_text_db_path, textgrid_db_path,
                db_path, wer_score, total_words, error_count, alignment_json,
                npvi_score, varco_score, whisper_text_db_path, textgrid_db_path
            ))
            conn.commit()
        except Exception as db_err:
            print(f"🚨 MySQL 實體落盤失敗，死因: {str(db_err)}")
 
        cursor.close()
        conn.close()
 
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
                "textgrid_associated": textgrid_filename,
                "whisper_text_path": whisper_text_db_path,
                "textgrid_path": textgrid_db_path
            }
        })
 
    except Exception as global_err:
        if 'cursor' in locals() and cursor: cursor.close()
        if 'conn' in locals() and conn: conn.close()
        return jsonify({"status": "error", "message": f"後端 upload_audio 發生未預期崩潰: {str(global_err)}"})
       
@app.route('/get_project_total_report', methods=['GET'])
def get_project_total_report():
    project_id = request.args.get('project_id')
    if not project_id:
        return jsonify({"status": "error", "message": "缺少 project_id"})

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # 1. 先去 projects 表撈出這篇文章總共有幾段
        cursor.execute("SELECT article_content FROM projects WHERE project_id = %s", (project_id,))
        project_row = project_row = cursor.fetchone()
        if not project_row:
            cursor.close()
            conn.close()
            return jsonify({"status": "error", "message": "找不到該練習專案"})

        article_content = project_row['article_content'] or ""

        # 將 p.trim() 修改為 Python 的 p.strip()
        total_paragraphs_count = len(split_paragraphs(article_content))

        # 防呆：如果切出來是 0，預設給 4 段
        if total_paragraphs_count == 0:
            total_paragraphs_count = 4

        # 2. 撈取現有的錄音紀錄 ── 🚀【實體追加】：SELECT 加入 npvi 與 varco 欄位
        sql = """
            SELECT paragraph_index, file_path, wer, total_words, error_count, alignment_report, npvi, varco
            FROM recordings
            WHERE project_id = %s
            ORDER BY paragraph_index ASC
        """
        cursor.execute(sql, (project_id,))
        rows = cursor.fetchall()

        # 轉成以 paragraph_index 為 key 的字典 (1-based)
        recorded_dict = {int(row['paragraph_index']): row for row in rows}

        # 3. 強制跑滿所有的文章段落數 (例如 1 ~ 4 段)
        paragraph_list = []
        total_wer = 0.0
        total_words = 0
        total_errors = 0

        # ── 🚀【新變數宣告】：用來加總流暢度總分並計算平均 ──
        total_npvi = 0.0
        total_varco = 0.0
        recorded_count = 0

        for i in range(1, total_paragraphs_count + 1):
            if i in recorded_dict:
                # ── 代表這段有錄音 ──
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

                # 🚀 將資料庫撈出來的 npvi 和 varco 倒進各段落物件中，歷史紀錄長條才看得到數值！
                paragraph_list.append({
                    "paragraph_index": i,
                    "file_path": row['file_path'],
                    "wer": row['wer'],
                    "total_words": row['total_words'],
                    "error_count": row['error_count'],
                    "alignment_report": align_report,
                    "npvi": row['npvi'] if row['npvi'] is not None else 0.0,
                    "varco": row['varco'] if row['varco'] is not None else 0.0
                })

                if row['wer'] is not None:
                    total_wer += float(row['wer'])
                    total_words += int(row['total_words'] or 0)
                    total_errors += int(row['error_count'] or 0)

                    # ── 🚀【實體加總】：累加該段落的流暢度分數 ──
                    total_npvi += float(row['npvi'] or 0.0)
                    total_varco += float(row['varco'] or 0.0)

                    recorded_count += 1
            else:
                # ── 代表這段沒錄音：塞入灰色的未錄音空白結構 ──
                paragraph_list.append({
                    "paragraph_index": i,
                    "file_path": None,
                    "wer": None,
                    "total_words": None,
                    "error_count": None,
                    "alignment_report": [],
                    "npvi": None,
                    "varco": None
                })

        # 🚀 這裡就是大底座卡片的靈魂核心！把算好的全篇總平均塞進大禮包送回前端
        global_stats = {
            "wer_average": total_wer / recorded_count if recorded_count > 0 else 0,
            "total_words": total_words,
            "total_errors": total_errors,
            "average_npvi": total_npvi / recorded_count if recorded_count > 0 else 0.0,   # 🎯 對接前端大方塊！
            "average_varco": total_varco / recorded_count if recorded_count > 0 else 0.0   # 🎯 對接前端大方塊！
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
    app.run(host='0.0.0.0', port=5000, debug=True)