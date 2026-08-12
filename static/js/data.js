// ══════════════════════════════════════════════════
//  靜態資料與全域狀態
// ══════════════════════════════════════════════════
// 原檔案行內容：state(532)、三組提示陣列 KITTENS_CHOICE_HINTS/SHARKS_HINTS/HILL_HINTS(203–284)。


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

const PRACTICE_MODE_STORAGE_KEY = 'practiceModeByProject';

// Kitten's_Choice 各段提示圖片設定
// 格式：每個段落（索引0, 1, 2...）對應三張圖片的路徑
// 請把 src 換成你實際的檔案路徑
// 💡 翻牌功能：hint 欄位請自行填入該圖片對應的提示文字（點擊圖片翻面後會顯示這段文字）
//    如果想換行，直接在字串裡打 \n 即可，例如：hint: '第一行\n第二行'
var KITTENS_CHOICE_HINTS = [
    // 段落 1（index 0）
    [
        { src: '/static/image/hint/kitten_101.webp', alt: '段落1 提示A', hint: '...plays...\n...loves...' },
        { src: '/static/image/hint/kitten_102.webp', alt: '段落1 提示B', hint: 'Her brother...,too.' },
        { src: '/static/image/hint/kitten_103.webp', alt: '段落1 提示C', hint: 'When...it,\nher brother...play.' },
    ],
    // 段落 2（index 1）
    [
        { src: '/static/image/hint/kitten_201.webp', alt: '段落2 提示A', hint: 'Kitten...fun.' },
        { src: '/static/image/hint/kitten_202.webp', alt: '段落2 提示B', hint: 'Then,...mouse!\n...chase...' },
        { src: '/static/image/hint/kitten_203.webp', alt: '段落2 提示C', hint: 'If...the mouse,\nher brother...toy.' },
    ],
    // 段落 3（index 2）
    [
        { src: '/static/image/hint/kitten_301.webp', alt: '段落3 提示A', hint: '...thinks.\nShe...to play with.' },
        { src: '/static/image/hint/kitten_302.webp', alt: '段落3 提示B', hint: 'If...mouse,\nher toy...her brother.' },
        { src: '/static/image/hint/kitten_303.webp', alt: '段落3 提示C', hint: 'If...toy,\nthe mouse...away.\nWhich...?' },
    ],
    // 段落 4（index 3）
    [
        { src: '/static/image/hint/kitten_401.webp', alt: '段落4 提示A', hint: 'Kitten...mouse' },
        { src: '/static/image/hint/kitten_402.webp', alt: '段落4 提示B', hint: 'She...mice,\nso that...fun.' },
        { src: '/static/image/hint/kitten_403.webp', alt: '段落4 提示C', hint: 'She...mouse,\nbut...after him.\nKitten...choice.' },
    ],
];

var SHARKS_HINTS = [
    // 段落 1（index 0）
    [
        { src: '/static/image/hint/shark_101.webp', alt: '段落1 提示A', hint: '...fins,' },
        { src: '/static/image/hint/shark_102.webp', alt: '段落1 提示B', hint: '...teeth,' },
        { src: '/static/image/hint/shark_103.webp', alt: '段落1 提示C', hint: '...swims...?\nA...!' },
    ],
    // 段落 2（index 1）
    [
        { src: '/static/image/hint/shark_201.webp', alt: '段落2 提示A', hint: 'Sharks...long time.\nSharks...dinosaurs!' },
        { src: '/static/image/hint/shark_202.webp', alt: '段落2 提示B', hint: '...fish,\nand...types...\n' },
        { src: '/static/image/hint/shark_203.webp', alt: '段落2 提示C', hint: '...babies,\n...pups.' },
    ],
    // 段落 3（index 2）
    [
        { src: '/static/image/hint/shark_301.webp', alt: '段落3 提示A', hint: 'Sharks...teeth,\n...humans,' },
        { src: '/static/image/hint/shark_302.webp', alt: '段落3 提示B', hint: 'but...baby teeth.\nThey...lives.' },
        { src: '/static/image/hint/shark_303.webp', alt: '段落3 提示C', hint: 'When...tooth,\n...row...its place.\nNew...growing.' },
    ],
    // 段落 4（index 3）
    [
        { src: '/static/image/hint/shark_401.webp', alt: '段落4 提示A', hint: 'Sharks...scary,\nbut...to people.' },
        { src: '/static/image/hint/shark_402.webp', alt: '段落4 提示B', hint: 'People...to sharks,\nsince...sharks.' },
        { src: '/static/image/hint/shark_403.webp', alt: '段落4 提示C', hint: 'To be...,\n...good idea...if...them!' },
    ],
];

var HILL_HINTS = [
    // 段落 1（index 0）
    [
        { src: '/static/image/hint/Hill_101.webp', alt: '段落1 提示A', hint: '...berries,\n...together.' },
        { src: '/static/image/hint/Hill_102.webp', alt: '段落1 提示B', hint: 'What...sound?\nMonkey...scared.' },
        { src: '/static/image/hint/Hill_103.webp', alt: '段落1 提示C', hint: 'Just...,\nthey...safe place.' },
    ],
    // 段落 2（index 1）
    [
        { src: '/static/image/hint/Hill_201.webp', alt: '段落2 提示A', hint: 'They...home.' },
        { src: '/static/image/hint/Hill_202.webp', alt: '段落2 提示B', hint: 'Bird...,"The rain...Our...help."\nDeer...,"We...,but...!Let\'s...!"' },
        { src: '/static/image/hint/Hill_203.webp', alt: '段落2 提示C', hint: 'First,...rocks.' },
    ],
    // 段落 3（index 2）
    [
        { src: '/static/image/hint/Hill_301.webp', alt: '段落3 提示A', hint: '"One,...!One,...!"' },
        { src: '/static/image/hint/Hill_302.webp', alt: '段落3 提示B', hint: 'Second,...friends.\n"...okay?...safe?"' },
        { src: '/static/image/hint/Hill_303.webp', alt: '段落3 提示C', hint: 'They...trees!' },
    ],
    // 段落 4（index 3）
    [
        { src: '/static/image/hint/Hill_401.webp', alt: '段落4 提示A', hint: 'Their...soil.' },
        { src: '/static/image/hint/Hill_402.webp', alt: '段落4 提示B', hint: 'Everyone...plan!\nThey...seeds.\nThey...trees.' },
        { src: '/static/image/hint/Hill_403.webp', alt: '段落4 提示C', hint: '"Now,...home!"' },
    ],
];