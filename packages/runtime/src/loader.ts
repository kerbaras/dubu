// Fetches and compiles the tofu wasm module, reporting download progress.
export async function loadModule(url: string, progress: (loaded: number, total: number) => void) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`failed to fetch ${url}: ${res.status}`);
  const total = Number(res.headers.get("x-uncompressed-length") ?? res.headers.get("content-length") ?? 0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    progress(loaded, total);
  }
  const bytes = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) (bytes.set(c, off), (off += c.length));
  return WebAssembly.compile(bytes);
}
