import fs from "node:fs/promises";
import path from "node:path";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY is required");

const root = path.resolve(import.meta.dirname, "..");
const knowledgeDir = path.join(root, "knowledge");
const requestedDate = process.argv[2];
const date = requestedDate || new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

const files = await fs.readdir(knowledgeDir);
const recentTitles = [];
for (const file of files.filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort().slice(-60)) {
  try {
    const item = JSON.parse(await fs.readFile(path.join(knowledgeDir, file), "utf8"));
    if (item.title) recentTitles.push(item.title);
  } catch {
    // Ignore malformed historical entries and continue generating.
  }
}

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["category", "title", "summary", "why", "prompt", "sources"],
  properties: {
    category: { type: "string", enum: ["科学", "历史", "文化", "经济", "技术", "心理", "健康", "地理"] },
    title: { type: "string", minLength: 6, maxLength: 40 },
    summary: { type: "string", minLength: 45, maxLength: 180 },
    why: { type: "string", minLength: 35, maxLength: 150 },
    prompt: { type: "string", minLength: 15, maxLength: 80 },
    sources: {
      type: "array", minItems: 1, maxItems: 2,
      items: {
        type: "object", additionalProperties: false, required: ["name", "url"],
        properties: {
          name: { type: "string", minLength: 2, maxLength: 60 },
          url: { type: "string", pattern: "^https://.+" },
        },
      },
    },
  },
};

const prompt = `为一位成年专业人士生成一条中文“每日新知”。
目标是准确、简洁、可在3分钟内读完，并提出一个能连接日常生活的思考问题。
主题必须属于给定八个类别之一，优先选择稳定、有广泛价值、非时效新闻的知识。
使用网页搜索核实事实。来源必须是大学、政府、国际组织、博物馆、学术出版物或高质量百科的具体HTTPS页面。
不要提供医疗诊断、投资建议或争议性政治观点。
避免与最近标题重复：${recentTitles.join("；") || "暂无历史标题"}
日期：${date}`;

const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: "gpt-5.5",
    reasoning: { effort: "low" },
    tools: [{ type: "web_search", search_context_size: "low" }],
    input: prompt,
    text: {
      verbosity: "low",
      format: { type: "json_schema", name: "daily_knowledge", strict: true, schema },
    },
  }),
});

if (!response.ok) throw new Error(`OpenAI API failed: ${response.status} ${await response.text()}`);
const payload = await response.json();
const text = payload.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;
if (!text) throw new Error("OpenAI response did not contain output_text");

const knowledge = JSON.parse(text);
for (const source of knowledge.sources) {
  const url = new URL(source.url);
  if (url.protocol !== "https:") throw new Error(`Invalid source URL: ${source.url}`);
  const sourceResponse = await fetch(source.url, {
    method: "GET",
    redirect: "follow",
    headers: { "User-Agent": "restart-daily-knowledge-check/1.0" },
    signal: AbortSignal.timeout(15000),
  });
  if (sourceResponse.status === 404 || sourceResponse.status >= 500) {
    throw new Error(`Source is unavailable: ${source.url} (${sourceResponse.status})`);
  }
  await sourceResponse.body?.cancel();
}

const output = JSON.stringify({ ...knowledge, date, generatedAt: new Date().toISOString() }, null, 2) + "\n";
await fs.writeFile(path.join(knowledgeDir, `${date}.json`), output);
await fs.writeFile(path.join(knowledgeDir, "latest.json"), output);
console.log(`Generated daily knowledge for ${date}: ${knowledge.title}`);
