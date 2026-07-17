// Web search via NanoGPT (same NANOGPT_API_KEY already used by the app).
// Docs: POST https://nano-gpt.com/api/web

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type SearchResponse = {
  provider: "nanogpt" | "none";
  query: string;
  results: SearchResult[];
  answer?: string;
  error?: string;
};

export function shouldWebSearch(userText: string, force?: boolean): boolean {
  if (force) return true;
  const t = (userText || "").toLowerCase();
  return /pesquis|concorr|nicho|benchmark|mercado|tend[eê]nc|serp|ads library|competidor|comparar nicho|refer[eê]ncia de mercado/.test(
    t,
  );
}

function normalizeResults(data: unknown): SearchResult[] {
  const arr = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.results)
      ? (data as any).results
      : Array.isArray((data as any)?.data)
        ? (data as any).data
        : [];

  return arr
    .map((r: any) => {
      const url = String(r?.url ?? r?.link ?? r?.href ?? "");
      if (!url) return null;
      return {
        title: String(r?.title ?? r?.name ?? url),
        url,
        snippet: String(r?.content ?? r?.snippet ?? r?.description ?? r?.text ?? "").slice(0, 400),
      };
    })
    .filter(Boolean) as SearchResult[];
}

export async function webSearch(
  query: string,
  opts?: { maxResults?: number; apiKey?: string },
): Promise<SearchResponse> {
  const q = query.trim().slice(0, 500);
  if (!q) return { provider: "none", query: q, results: [], error: "empty_query" };

  const apiKey = opts?.apiKey || Deno.env.get("NANOGPT_API_KEY");
  if (!apiKey) {
    return { provider: "none", query: q, results: [], error: "NANOGPT_API_KEY_missing" };
  }

  const max = opts?.maxResults ?? 5;

  try {
    // Prefer sourced answer (summary + sources) via Linkup on NanoGPT billing
    const res = await fetch("https://nano-gpt.com/api/web", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: q,
        provider: "linkup",
        depth: "standard",
        outputType: "sourcedAnswer",
      }),
    });

    const raw = await res.text();
    if (!res.ok) {
      // Fallback: raw search results
      const res2 = await fetch("https://nano-gpt.com/api/web", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: q,
          provider: "linkup",
          depth: "standard",
          outputType: "searchResults",
        }),
      });
      const raw2 = await res2.text();
      if (!res2.ok) {
        throw new Error(`nanogpt_web_${res.status}/${res2.status}: ${raw.slice(0, 160)}`);
      }
      const data2 = JSON.parse(raw2);
      const results = normalizeResults(data2?.data ?? data2).slice(0, max);
      return { provider: "nanogpt", query: q, results };
    }

    const data = JSON.parse(raw);
    const payload = data?.data ?? data;
    let answer: string | undefined;
    if (typeof payload === "string") answer = payload.slice(0, 1200);
    else if (typeof payload?.answer === "string") answer = payload.answer.slice(0, 1200);
    else if (typeof payload?.sourcedAnswer === "string") answer = payload.sourcedAnswer.slice(0, 1200);
    else if (typeof payload?.content === "string") answer = payload.content.slice(0, 1200);

    const results = normalizeResults(
      payload?.sources ?? payload?.results ?? payload?.citations ?? payload,
    ).slice(0, max);

    // If sourcedAnswer returned no parseable sources, still keep the answer
    if (!results.length && answer) {
      return {
        provider: "nanogpt",
        query: q,
        results: [],
        answer,
      };
    }

    return { provider: "nanogpt", query: q, results, answer };
  } catch (e: any) {
    console.error("nanogpt web search failed", e?.message ?? e);
    return {
      provider: "none",
      query: q,
      results: [],
      error: String(e?.message ?? e).slice(0, 200),
    };
  }
}

export function formatSearchForPrompt(search: SearchResponse): string {
  if (search.provider === "none") {
    return `WEB_SEARCH: indisponível (${search.error ?? "erro"}). Use conhecimento geral e deixe claro que é estimativa.`;
  }
  const lines = search.results.map(
    (r, i) => `[${i + 1}] ${r.title} — ${r.url}\n${r.snippet}`,
  );
  return [
    `WEB_SEARCH (provider=nanogpt/linkup, query="${search.query}"):`,
    search.answer ? `Resumo: ${search.answer}` : "",
    ...lines,
    "Cite as fontes pelo número/URL ao usar esses dados. Não invente URLs.",
  ]
    .filter(Boolean)
    .join("\n");
}
