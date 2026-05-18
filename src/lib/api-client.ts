async function parseError(response: Response): Promise<never> {
  const text = await response.text();
  let parsedError: string | undefined;

  try {
    const parsed = JSON.parse(text) as { error?: string };
    parsedError = parsed.error;
  } catch {
    // Fall back to the raw response body when it is not JSON.
  }

  if (parsedError) throw new Error(parsedError);
  if (text) throw new Error(text);
  throw new Error(`Request failed with status ${response.status}`);
}

export async function postJson<TResponse, TBody>(url: string, body: TBody): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return parseError(response);
  }

  return (await response.json()) as TResponse;
}
