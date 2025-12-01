export type DuckDuckGoResult = {
  Abstract?: string;
  AbstractText?: string;
  AbstractSource?: string;
  AbstractURL?: string;
  Heading?: string;
  Image?: string;
  Answer?: string;
  AnswerType?: string;
  Definition?: string;
  DefinitionSource?: string;
  DefinitionURL?: string;
  Entity?: string;
  RelatedTopics?: Array<{
    Text?: string;
    FirstURL?: string;
    Icon?: { URL?: string };
  }>;
};

export async function searchDuckDuckGo(query: string): Promise<DuckDuckGoResult> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
  const resp = await fetch(url, { method: 'GET' });
  if (!resp.ok) throw new Error(`DuckDuckGo search failed: ${resp.status}`);
  const data = await resp.json();
  return data as DuckDuckGoResult;
}

