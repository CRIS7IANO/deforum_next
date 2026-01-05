export type Project = any;

export async function evalRange(
  bridgeUrl: string,
  project: Project,
  start: number,
  end: number
): Promise<any> {
  const res = await fetch(`${bridgeUrl}/evaluate/range`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, start, end })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt);
  }
  return await res.json();
}
