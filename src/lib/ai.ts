import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { N3Detail } from "./n3Detail";

export type AiGrade = { correct: boolean; feedback: string; suggestion: string };

let client: Anthropic | null = null;

export function hasAi(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM = `你是日本語學校的日文老師，批改一位中文母語、程度約 N4–N3 的學生的練習題。

判斷學生答案是否可接受：
- 意思和參考答案一致、文法正確、符合題目指定的句型或形式，就算對；不需要和參考答案一字不差（同義詞、語序不同、敬體常體一致的自然說法都可以）。
- 題目指定的句型沒用到、助詞錯、動詞或形容詞變化錯、意思不同、漏譯，就算錯。
- 只有錯字或假名小錯（例如長音、促音、濁音）也算錯，因為學校考試會扣分。

feedback 用繁體中文，最多兩句：對的話說明為什麼可以；錯的話具體指出錯在哪裡。
suggestion 是學生答案改正後的日文（答對且已經很自然就留空字串）。`;

// 單字・漢字・文型的記憶測驗（題目是「寫出讀音和意思」這類）
const RECALL_SYSTEM = `你是日本語學校的日文老師，批改一位中文母語、程度約 N4–N3 的學生的單字／漢字／文型記憶測驗。

判斷學生是否記得：
- 讀音：必須正確。平假名或片假名都可以；長音、促音、濁音、拗音寫錯算錯。
- 中文意思：意思相同或相近就算對（同義詞、簡體字、多寫一點說明都可以）；意思不同或太籠統算錯。
- 漢字題：寫出任一個正確讀音（音読み或訓読み皆可）＋正確意思就算對。
- 文型題：說對主要意思或用法就算對，不用一字不差；例句用法正確也算對。
- 題目要求的部分（例如讀音）沒有寫，就算錯。

feedback 用繁體中文，最多兩句：對的話簡短肯定；錯的話具體說錯在哪。
suggestion 是簡短的完整正確答案（例：もくひょう／目標）。答對時留空字串。`;

const SCHEMA = {
  type: "object",
  properties: {
    correct: { type: "boolean" },
    feedback: { type: "string" },
    suggestion: { type: "string" },
  },
  required: ["correct", "feedback", "suggestion"],
  additionalProperties: false,
};

/** 對不上參考答案時才呼叫。任何失敗都丟出看得懂的錯誤訊息，畫面會顯示原因並改成自評。 */
export async function gradeWithAi(input: {
  question: string;
  reference: string;
  explanation: string;
  answer: string;
  /** recall＝單字・漢字・文型記憶測驗；預設是題庫練習題 */
  mode?: "exercise" | "recall";
}): Promise<AiGrade> {
  if (!hasAi()) throw new Error("Vercel 沒有讀到 ANTHROPIC_API_KEY（設定或修改環境變數後要 Redeploy 才會生效）");
  client ??= new Anthropic();
  // 使用者選的模型：Claude Haiku 5.5（便宜、夠用來批改短句）；Haiku 沒有伺服器端 fallback，拒答時改成自評
  const response = await client.messages
    .create({
      model: "claude-haiku-5-5",
      max_tokens: 2000,
      system: input.mode === "recall" ? RECALL_SYSTEM : SYSTEM,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            `題目：${input.question}`,
            `參考答案：${input.reference}`,
            input.explanation ? `解析：${input.explanation}` : "",
            `學生答案：${input.answer}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    })
    .catch(explainApiError);
  if (response.stop_reason === "refusal") throw new Error("AI 拒絕批改這一題");
  if (response.stop_reason === "max_tokens") throw new Error("AI 回覆太長被截斷");
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let parsed: AiGrade;
  try {
    parsed = JSON.parse(text) as AiGrade;
  } catch {
    throw new Error(`AI 回覆不是 JSON：${text.slice(0, 80)}`);
  }
  if (typeof parsed.correct !== "boolean") throw new Error("AI 回覆缺少 correct 欄位");
  return parsed;
}

const DETAIL_SYSTEM = `你是日本語學校的日文老師，替一位中文母語、程度約 N4–N3、正在背 N3 單字和文型的學生寫單字或文型的詳解卡。

- 說明一律用繁體中文（台灣用語），簡短具體，不要客套。
- usage：意思和用法重點，2–4 句（何時用、語感、正式或口語、常見錯誤）。
- forms：只有文型要寫，列出接續方式（例：動詞た形＋ばかり）；單字留空陣列。
- collocations：單字寫 2–4 個常用搭配（日文＋中文）；文型可留空陣列。
- examples：3 句自然的日文例句，程度 N3 左右，要用到該單字或文型；kana 是整句的平假名讀音（不用空格）；zh 是中文翻譯。
- compare：和意思相近、容易混淆的詞或文型比較，1–2 句；沒有就留空字串。`;

const DETAIL_SCHEMA = {
  type: "object",
  properties: {
    usage: { type: "string" },
    forms: { type: "array", items: { type: "string" } },
    collocations: {
      type: "array",
      items: { type: "object", properties: { ja: { type: "string" }, zh: { type: "string" } }, required: ["ja", "zh"], additionalProperties: false },
    },
    examples: {
      type: "array",
      items: {
        type: "object",
        properties: { ja: { type: "string" }, kana: { type: "string" }, zh: { type: "string" } },
        required: ["ja", "kana", "zh"],
        additionalProperties: false,
      },
    },
    compare: { type: "string" },
  },
  required: ["usage", "forms", "collocations", "examples", "compare"],
  additionalProperties: false,
};

/** N3 單字／文型詳解：只在 Notion 內文還沒有詳解時呼叫一次 */
export async function generateN3Detail(input: { kind: "word" | "grammar"; fields: Record<string, string> }): Promise<N3Detail> {
  if (!hasAi()) throw new Error("Vercel 沒有讀到 ANTHROPIC_API_KEY");
  client ??= new Anthropic();
  const response = await client.messages
    .create({
      model: "claude-haiku-5-5",
      max_tokens: 3000,
      system: DETAIL_SYSTEM,
      output_config: { effort: "low", format: { type: "json_schema", schema: DETAIL_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            input.kind === "word" ? "請寫這個 N3 單字的詳解：" : "請寫這個 N3 文型的詳解：",
            ...Object.entries(input.fields)
              .filter(([, v]) => v)
              .map(([k, v]) => `${k}：${v}`),
          ].join("\n"),
        },
      ],
    })
    .catch(explainApiError);
  if (response.stop_reason !== "end_turn") throw new Error(`AI 沒有寫完（${response.stop_reason}）`);
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const d = JSON.parse(text) as N3Detail;
  const one = (s: string) => s.replace(/[\n｜＝]/g, " ").trim();
  // 存回 Notion 時一行一段、用「｜」「＝」分欄，所以內容裡不能有這些字元
  return {
    usage: d.usage.trim(),
    forms: d.forms.map(one).filter(Boolean),
    collocations: d.collocations.map((c) => ({ ja: one(c.ja), zh: one(c.zh) })).filter((c) => c.ja),
    examples: d.examples.map((e) => ({ ja: one(e.ja), kana: one(e.kana), zh: one(e.zh) })).filter((e) => e.ja),
    compare: d.compare.trim(),
  };
}

function explainApiError(e: unknown): never {
  if (e instanceof Anthropic.AuthenticationError) throw new Error("API key 無效（401）：請確認 Vercel 的 ANTHROPIC_API_KEY 有完整貼上");
  if (e instanceof Anthropic.PermissionDeniedError) throw new Error(`API 權限不足（403）：${e.message}`);
  if (e instanceof Anthropic.RateLimitError) throw new Error("API 呼叫太頻繁（429），稍後再試");
  if (e instanceof Anthropic.BadRequestError) throw new Error(`API 請求被拒（400）：${e.message}`);
  if (e instanceof Anthropic.APIError) throw new Error(`API 錯誤 ${e.status ?? ""}：${e.message}`);
  throw e;
}
