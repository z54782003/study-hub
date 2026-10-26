import "server-only";
import Anthropic from "@anthropic-ai/sdk";

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
}): Promise<AiGrade> {
  if (!hasAi()) throw new Error("Vercel 沒有讀到 ANTHROPIC_API_KEY（設定或修改環境變數後要 Redeploy 才會生效）");
  client ??= new Anthropic();
  // 使用者選的模型：Claude Haiku 5.5（便宜、夠用來批改短句）；Haiku 沒有伺服器端 fallback，拒答時改成自評
  const response = await client.messages
    .create({
      model: "claude-haiku-5-5",
      max_tokens: 2000,
      system: SYSTEM,
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

function explainApiError(e: unknown): never {
  if (e instanceof Anthropic.AuthenticationError) throw new Error("API key 無效（401）：請確認 Vercel 的 ANTHROPIC_API_KEY 有完整貼上");
  if (e instanceof Anthropic.PermissionDeniedError) throw new Error(`API 權限不足（403）：${e.message}`);
  if (e instanceof Anthropic.RateLimitError) throw new Error("API 呼叫太頻繁（429），稍後再試");
  if (e instanceof Anthropic.BadRequestError) throw new Error(`API 請求被拒（400）：${e.message}`);
  if (e instanceof Anthropic.APIError) throw new Error(`API 錯誤 ${e.status ?? ""}：${e.message}`);
  throw e;
}
