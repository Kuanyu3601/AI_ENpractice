import requests
import json
import os

# ================= 設定區 =================
# 1. 確保你的 FastAPI 後端正在運行 (通常是 http://localhost:8000)
API_URL = "http://localhost:8000/api/analyze-reading"

# 2. 填入你準備好的測試音檔名稱
AUDIO_FILE_PATH = "Shark.wav"

# 3. 填入該音檔對應的原始文本
ORIGINAL_TEXT = "what has fine sharp teeth and swims in the ocean a shark sharks have been around for a very long time sharks have lived in the oceans even before dinosaurs sharks are fish and there are over four hundred types of sharks when they have babies the babies are called pups"
# ==========================================

def run_backend_test():
    if not os.path.exists(AUDIO_FILE_PATH):
        print(f"❌ 找不到測試音檔: {AUDIO_FILE_PATH}，請確認檔案放在同一層目錄！")
        return

    print("🚀 正在模擬前端發送請求至 AI 後端 (請稍候，正在進行 Whisper 分析與字錯率比對)...")

    try:
        # 準備要上傳的檔案與表單資料
        with open(AUDIO_FILE_PATH, "rb") as f:
            files = {"audio_file": (AUDIO_FILE_PATH, f, "audio/wav")}
            data = {"original_text": ORIGINAL_TEXT}
            
            # 發送 POST 請求
            response = requests.post(API_URL, files=files, data=data)
            
        # 檢查伺服器是否正常回傳
        if response.status_code == 200:
            result = response.json()
            
            print("\n" + "="*50)
            print(" ✅ 後端分析成功！以下是即將傳給前端渲染器的 JSON 結構：")
            print("="*50 + "\n")
            
            # 使用 json.dumps 將結果漂亮地印出來 (indent=4 負責縮排，ensure_ascii=False 負責顯示中文)
            print(json.dumps(result, indent=4, ensure_ascii=False))
            
            print("\n" + "="*50)
            print(f" 📊 綜合評分 (WER): {result['statistics']['wer_repair_fluency']}")
            print(f" 📝 原始轉錄文本: {result['whisper_raw_text']}")
            print("="*50 + "\n")
            
        else:
            print(f"\n❌ 後端發生錯誤 (HTTP 狀態碼: {response.status_code})")
            print(response.text)

    except requests.exceptions.ConnectionError:
        print("\n❌ 無法連線到後端！請確認你的 Docker (backend-wer) 已經使用 `docker compose up` 啟動。")

if __name__ == "__main__":
    run_backend_test()