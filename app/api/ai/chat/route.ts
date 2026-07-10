import { NextResponse } from 'next/server';
import { searchTracker, searchHubspot } from '@/lib/ai-tools';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_tracker',
      description:
        'Search the presales tracker records by fuzzy matching customer, person (AM), assessment name, QB topics, notes, or JD file names. Returns matching records with all fields (except JD file contents). Use this whenever the user asks about past requests, precedents, or tracker analytics.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Search text. E.g. a customer name, role type, AM name, or topic. Use empty string to get recent records.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_hubspot',
      description:
        'Search HubSpot for deals and companies matching a query. Returns non-confidential fields only (deal name, stage, pipeline, owner, target close date, days open, days since activity, industry, country). Deal amounts and personal contact info are deliberately NOT available. Use when the user asks about a customer\'s deal status or sales pipeline context.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search text. E.g. a customer or company name.',
          },
        },
        required: ['query'],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are the analytics assistant for the iMocha Presales Tracker.

Today's date is ${new Date().toISOString().slice(0, 10)}.

Your job is to help the presales team (Subham + colleagues) answer questions about their pipeline:
- "Have we done a similar request before? What did we deliver?"
- "What's the stage of this deal in HubSpot?"
- "Which AM has the highest TARA attach rate?"
- "How busy is Raj this quarter?"

Guidance:
1. Use tools to fetch real data. Never invent record IDs, customer names, or numbers.
2. Always ground answers in what the tools returned. When you cite a record or deal, mention its identifying field (customer name, or deal name) so the user can find it.
3. Be concise. Give the answer in 2-4 sentences unless the user asks for detail. Use short bullet lists when comparing multiple items.
4. HubSpot deal amounts are NOT available to you. Do not speculate on deal size.
5. If a search returns nothing relevant, say so plainly — don't fabricate matches.
6. When comparing "similar past requests" for a new customer/role, prioritize matches on customer name AND assessment name AND role type. Show the outcome (status + TARA created) — that's what the user cares about most.`;

async function executeTool(name: string, argsJson: string): Promise<string> {
  try {
    const args = JSON.parse(argsJson || '{}');
    if (name === 'search_tracker') {
      const results = await searchTracker(String(args.query ?? ''));
      return JSON.stringify({ results });
    }
    if (name === 'search_hubspot') {
      const results = await searchHubspot(String(args.query ?? ''));
      return JSON.stringify(results);
    }
    return JSON.stringify({ error: `unknown tool: ${name}` });
  } catch (e) {
    return JSON.stringify({ error: (e as Error).message });
  }
}

export async function POST(req: Request) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'OPENROUTER_API_KEY is not set. Add it in .env.local (and in Vercel env vars for production).',
      },
      { status: 500 },
    );
  }
  const model = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-4-20250514';

  let body: { messages: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }

  const userMessages = body.messages ?? [];
  const working: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...userMessages,
  ];

  const toolLog: Array<{ tool: string; query: string }> = [];

  // Tool-use loop. Cap iterations so a runaway model can't burn tokens.
  for (let i = 0; i < 6; i++) {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': process.env.NEXTAUTH_URL ?? 'https://presales-tracker-sigma.vercel.app',
        'X-Title': 'Presales Tracker AI',
      },
      body: JSON.stringify({
        model,
        messages: working,
        tools: TOOLS,
        temperature: 0.2,
        max_tokens: 1200,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { ok: false, error: `OpenRouter ${res.status}: ${err.slice(0, 300)}` },
        { status: 500 },
      );
    }

    const data = await res.json();
    const msg = data.choices?.[0]?.message as ChatMessage | undefined;
    if (!msg) {
      return NextResponse.json({ ok: false, error: 'no message in response' }, { status: 500 });
    }

    if (!msg.tool_calls?.length) {
      return NextResponse.json({
        ok: true,
        content: msg.content ?? '',
        toolLog,
      });
    }

    // Log + execute tool calls, feed results back for next iteration
    working.push(msg);
    for (const tc of msg.tool_calls) {
      let queryArg = '';
      try {
        const parsed = JSON.parse(tc.function.arguments || '{}');
        queryArg = String(parsed.query ?? '');
      } catch {
        // ignore
      }
      toolLog.push({ tool: tc.function.name, query: queryArg });
      const toolResult = await executeTool(tc.function.name, tc.function.arguments);
      working.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: toolResult,
      });
    }
  }

  return NextResponse.json(
    { ok: false, error: 'AI tool loop exhausted (6 iterations)' },
    { status: 500 },
  );
}
