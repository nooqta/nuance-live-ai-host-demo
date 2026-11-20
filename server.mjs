// Nuance Live demo for noqta.tn: serves index.html and mints session tokens.
// Run: node server.mjs  (reads NUANCE_API_KEY from .env next to this file)
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const dir = new URL(".", import.meta.url).pathname;
for (const line of readFileSync(dir + ".env", "utf8").split("\n")) {
  const m = line.match(/^(\w+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2];
}
const API = "https://api.nuancelabs.ai";
const KEY = process.env.NUANCE_API_KEY;
const PORT = Number(process.env.PORT ?? 5177);
const PERSONAS = ["sam", "sonia", "mira"];

const NAMES = { sam: "Sami", sonia: "Sonia", mira: "Mira" };

const SERVICES = [
  ["ai-agents", "AI support and operations agents", "Agents that answer customers on WhatsApp, the website and email, and do back-office tasks."],
  ["automation", "Workflow automation", "Connect the tools a company already uses so repetitive steps run on their own."],
  ["analytics", "Power BI and smart analytics", "Dashboards on top of company data, with an AI layer you can ask questions in plain words."],
  ["web-apps", "Websites and custom apps", "Business websites, portals and mobile apps, built multilingual and right-to-left ready."],
  ["einvoicing", "E-invoicing integration", "Connecting invoicing systems to Saudi ZATCA and similar e-invoicing platforms."],
  ["agentx", "AgentX", "Our own platform that runs a team of AI agents for a company, each with its own job."],
];

const SYSTEM_PROMPT = (name) => `You are ${name}, the front-desk host on the Noqta website. Noqta is a software and AI company based in Tunisia that works with small and mid-size companies in Tunisia, Saudi Arabia and the Gulf. You are warm, brief and plain-spoken. Keep every reply to two or three short sentences, then ask one question.

Your job: find out what the visitor's business does and what slows it down, point them to the one Noqta service that fits, and offer a free call with the team.

Noqta services:
${SERVICES.map(([, t, d]) => `- ${t}: ${d}`).join("\n")}

Rules:
- When you name a service to the visitor, hand it off so it shows on their screen. Say "Let me put that on your screen", not "it's there".
- When the visitor wants to talk to the team, get a quote or book a call, ask for their first name and what they need in one line, then hand it off to show the contact options. Say you are bringing up the options.
- You don't know prices. Noqta gives a quote after a short call. Say so if asked.
- You do not give tax, legal or financial advice. For e-invoicing rules, say the team confirms what applies to their case on the call.
- If you don't know something, say so and offer the call.`;

const TOOLS = [
  {
    type: "function",
    name: "show_service",
    description: "Shows one Noqta service card on the visitor's screen.",
    parameters: {
      type: "object",
      properties: { service: { type: "string", enum: SERVICES.map(([id]) => id) } },
      required: ["service"],
    },
  },
  {
    type: "function",
    name: "show_contact",
    description: "Shows the contact options (WhatsApp, contact form) with the visitor's name and need filled in.",
    parameters: {
      type: "object",
      properties: { first_name: { type: "string" }, need: { type: "string" } },
      required: ["need"],
    },
  },
];

async function mint(persona, visitor) {
  const r = await fetch(`${API}/session-tokens`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      interface: "nuance_live",
      personality: { persona_id: persona, system_prompt: SYSTEM_PROMPT(NAMES[persona]) },
      interface_setup: {
        delegation: {
          type: "responses",
          responses: {
            model: "default",
            instructions:
              "Call show_service with the one service the persona named. Call show_contact when the visitor wants to talk to the team. Answer in one short sentence.",
            tools: TOOLS,
            reasoning: { effort: "low" },
          },
        },
        video: { input: { camera: false } },
        runtime_tools: { end_call: true },
      },
      end_user_id: createHash("sha256").update(visitor).digest("hex").slice(0, 32),
    }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text}`);
  const body = JSON.parse(text);
  if (body.warnings?.length) console.warn("mint warnings:", JSON.stringify(body.warnings));
  return body.token;
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "POST" && url.pathname === "/api/token") {
      const persona = PERSONAS.includes(url.searchParams.get("persona")) ? url.searchParams.get("persona") : "mira";
      const token = await mint(persona, req.socket.remoteAddress ?? "local");
      console.info(new Date().toISOString(), "token minted for", persona);
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ token }));
    } else if (url.pathname === "/api/usage") {
      const r = await fetch(`${API}/usage`, { headers: { Authorization: `Bearer ${KEY}` } });
      res.writeHead(r.status, { "Content-Type": "application/json" }).end(await r.text());
    } else if (url.pathname === "/api/services") {
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(SERVICES));
    } else if (url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html" }).end(readFileSync(dir + "index.html"));
    } else res.writeHead(404).end();
  } catch (e) {
    console.error(new Date().toISOString(), String(e));
    res.writeHead(500).end(String(e.message ?? e));
  }
}).listen(PORT, () => console.info(`Nuance demo on http://localhost:${PORT}`));
