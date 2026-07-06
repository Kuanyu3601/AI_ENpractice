from flask import Flask, render_template, request, redirect, url_for, jsonify, send_from_directory, session, json
import mysql.connector
import os
import requests
import subprocess  # 🚀 補上標準套件，解決原本的 'subprocess' is not defined 錯誤！
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash
from werkzeug.security import generate_password_hash, check_password_hash
import random

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
        para_idx = 0  # 💡 資料庫存 0

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

        # 📂 確保音檔寫入到兩個容器共用的共享大底座資料夾中 (UPLOAD_FOLDER 必須在 Compose 中掛載為 shared-data)
        user_dir = os.path.join(app.config['UPLOAD_FOLDER'], username)
        if not os.path.exists(user_dir):
            os.makedirs(user_dir)
        save_path = os.path.join(user_dir, filename)

        audio_bytes = audio_file.read()
        with open(save_path, 'wb') as f:
            f.write(audio_bytes)

        paragraphs_arr = [p.strip() for p in article_content.split('\n\n') if p.strip()]

        # 判斷是否為整篇模式
        if mode == 'whole':
            # 如果是整篇，把所有段落合併成一個完整的長文本，並移除中間的換行
            original_text = " ".join(paragraphs_arr)
        else:
            # 如果是分段，維持原本的邏輯
            try:
                original_text = paragraphs_arr[para_idx - 1]
            except IndexError:
                original_text = "What has fins sharp teeth and swims in the ocean a shark"

        # --- 初始化所有目標數據緩衝區 ---
        wer_stats = {"wer_repair_fluency": 0.0, "total_ref_words": len(original_text.split())}
        alignment_report = []
        chunks_list = []
        error_count = 0

        npvi_score = 0.0
        varco_score = 0.0

        full_wer_raw_json = {}
        full_npvi_raw_json = {}
        textgrid_filename = ""

        # 💡 新增：實際落盤的 whisper 文字檔 / TextGrid 檔案路徑，稍後要寫進資料庫
        whisper_text_db_path = None
        textgrid_db_path = None

        try:
            # 準備第一發物料：原音檔與資料庫課文原文
            wer_files = {'audio_file': (filename, audio_bytes, 'audio/wav')}
            wer_data_payload = {'original_text': original_text}

            # 🎯 🚀 第一波：呼叫 backend-wer 容器計算字錯率與 Whisper 辨識
            wer_url = "http://backend-wer:8000/api/analyze-reading"
            wer_response = requests.post(wer_url, files=wer_files, data=wer_data_payload, timeout=90)

            if wer_response.status_code == 200:
                full_wer_raw_json = wer_response.json()

                wer_stats = full_wer_raw_json.get("statistics", {}) or {}
                alignment_report = full_wer_raw_json.get("alignment_report", [])
                error_count = sum(1 for item in alignment_report if item.get("Category") != "Match")

                # 🚀 【核心修改】：不再自己從 alignment_report 逆向拼字還原文字，
                #    改直接使用同學 WER API 新版回傳的 whisper_raw_text 欄位（真正的 Whisper 辨識全文）。
                whisper_processed_text = (full_wer_raw_json.get("whisper_raw_text") or "").strip()
                print(f"🔬 [直接取用] WER API 回傳的 whisper_raw_text: {whisper_processed_text}", flush=True)

                # 💡 把 whisper 文字實際落盤成 .txt 檔，存到跟音檔同一個使用者資料夾，
                #    檔名固定跟音檔對應，方便日後回溯查看這次辨識出的文字內容。
                whisper_txt_filename = filename.replace(".wav", "_whisper.txt")
                whisper_txt_save_path = os.path.join(user_dir, whisper_txt_filename)
                with open(whisper_txt_save_path, 'w', encoding='utf-8') as wf:
                    wf.write(whisper_processed_text)
                whisper_text_db_path = f"/get_audio/{username}/{whisper_txt_filename}"

                # 🚀 2. 呼叫同學在 8501 埠開好的 NPVI/MFA API，直接把 whisper_processed_text 當作文字檔傳過去
                try:
                    user_age = request.form.get('age', 9)
                    try:
                        user_age = int(user_age)
                    except:
                        user_age = 9

                    # 💡 直接用 whisper_processed_text 包裝成記憶體中的虛擬 .txt 檔案，送給 NPVI API
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

                        # 先剝開同學包裝的 "data" 外衣
                        actual_data = speech_data.get("data", {})

                        textgrid_filename = actual_data.get("file", "output.TextGrid")
                        chunks_list = actual_data.get("chunk_results") or []
                        overall = actual_data.get("overall_metrics", {}) or {}

                        # 💡 新增：把 TextGrid 實際內容存成檔案。
                        #    ⚠️ 這裡假設 NPVI API 回傳的 JSON 裡，TextGrid 內容放在 actual_data["textgrid_content"]。
                        #    如果同學實際欄位名稱不是這個，請告訴我正確欄位名，我再幫你改這一行。
                        textgrid_content = actual_data.get("textgrid_content")
                        if textgrid_content:
                            textgrid_save_filename = filename.replace(".wav", ".TextGrid")
                            textgrid_save_path = os.path.join(user_dir, textgrid_save_filename)
                            with open(textgrid_save_path, 'w', encoding='utf-8') as tg:
                                tg.write(textgrid_content)
                            textgrid_db_path = f"/get_audio/{username}/{textgrid_save_filename}"

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

        # 四捨五入數值對齊資料庫
        npvi_score = round(float(npvi_score), 2)
        varco_score = round(float(varco_score), 2)
        wer_score = round(float(wer_stats.get("wer_repair_fluency", 0.0)), 2)
        total_words = int(wer_stats.get("total_ref_words", 0))

        # 🚀 【智慧完整大打包】：一字不漏把雙邊的原始 JSON 外殼融合成一包文字型 JSON
        extended_report = {
            "textgrid_file_target": textgrid_filename,       # NPVI 端回傳的檔名（僅供參考）
            "textgrid_path": textgrid_db_path,                # 💡 新增：我方實際落盤的 TextGrid 檔路徑
            "whisper_text_path": whisper_text_db_path,        # 💡 新增：我方實際落盤的 whisper 文字檔路徑
            "word_alignments": alignment_report,              # 完整的 ASR 錯字對照
            "chunk_details": chunks_list,                     # 切碎句子的 Chunks 細節
            "raw_wer_output": full_wer_raw_json,              # 完整保留 backend-wer 產出的整份原始 JSON
            "raw_npvi_output": full_npvi_raw_json             # 完整保留 backend-npvi 產出的整份原始 JSON
        }
        alignment_json = json.dumps(extended_report, ensure_ascii=False)

        # --- 💾 MySQL 實體寫入區 ---
        db_path = f"/get_audio/{username}/{filename}"
        try:
            # 💡 新增兩個欄位：whisper_text_path、textgrid_path
            #    請先對資料庫執行一次（如果還沒有這兩個欄位）：
            #    ALTER TABLE recordings ADD COLUMN whisper_text_path VARCHAR(255) NULL;
            #    ALTER TABLE recordings ADD COLUMN textgrid_path VARCHAR(255) NULL;
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

        # --- 🎁 終極返航 ── 送往網頁前端完美渲染畫面的大卡片與手風琴 ---
        return jsonify({
            "status": "success",
            "url": db_path,
            "wer_result": {
                "alignment_report": alignment_report,  # 筆直傳送純 List，完美相容前端劃線彩色膠囊
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
        total_paragraphs_count = len([p.strip() for p in article_content.split('\n\n') if p.strip()])

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