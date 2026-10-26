# Study Hub

個人一站式學習 App（手機優先的 PWA）。Notion 是唯一的資料庫，App 只負責「今天要做什麼」和「實際練習」。

## P1 功能

- **今日清單** `/`：考試倒數、W3 預習頁、N3 單字批次＋今日文型、NHK Easy、ISI 課堂筆記、今晚複習、TED、閱讀。手動打勾只存在這台裝置。
- **今晚複習** `/review`：合併 W2（日文題庫）與 N3 night quiz。
  - 題庫：`下次複習 ≤ 今天`，❌／未作答優先，每天最多 20 題；對 → D+1→3→7→14→30 下一階，錯 → D+1。關聯單字的熟悉度／答對答錯次數一起更新。
  - N3 單字：到期字最多 10 個＋今日批次抽 10 個（同一天抽樣固定）；只更新 `熟悉度_K`、`上次複習_K`，下次複習交給 Notion 公式。
  - 文型：今日文型（週末＝本週 5 個）＋所有「忘記」的文型。
  - 每答一題就寫回 Notion；結束時勾 Journal 的「🇯🇵 Class Review」並累加 Study hours。
- **N3 單字** `/n3`：Morning brief 的批次，唯讀翻卡。

規則與資料庫 ID 在 `src/lib/config.ts`、`src/lib/srs.ts`（有單元測試）。

## 設定

1. 建一個 Notion integration（https://www.notion.so/profile/integrations），複製 token。
2. 把下列資料庫分享給它（資料庫右上角 ⋯ → Connections）：日文題庫、Vocabulary／單字庫、JLPT テスト 単語、N3 文法補強、ISI 課堂筆記＆錄音、TED Log、Books、Journal，以及「每日預習（W3）」頁。
3. 環境變數（見 `.env.example`）：`NOTION_TOKEN`、`APP_PASSWORD`、`APP_TZ`（預設 Asia/Tokyo）。

## 開發

```bash
npm install
npm test            # SRS／日期規則
npm run typecheck
MOCK=1 MOCK_TODAY=2026-10-27 npm run dev   # 不連 Notion，用假資料看畫面
```

## 部署

Vercel：Import repo → 設定上面三個環境變數 → Deploy。手機用 Safari 開網址 →「分享」→「加入主畫面」。
