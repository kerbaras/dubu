// Downloads and compiles the tofu wasm module on the UI thread so it can be
// handed (structured-cloned) to any number of workers without refetching.
async function readAll(res: Response, total: number, progress: (n: number, t: number) => void) {
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    progress(loaded, Math.max(total, loaded));
  }
  const bytes = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) (bytes.set(c, off), (off += c.length));
  return bytes;
}

const isGzip = (b: Uint8Array) => b[0] === 0x1f && b[1] === 0x8b;

export async function loadModule(url: string, total: number, progress: (loaded: number, total: number) => void) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to fetch ${url}: ${res.status}`);
  let bytes: Uint8Array | ArrayBuffer = await readAll(res, total, progress);
  // Some hosts decompress .gz transparently (Content-Encoding); others don't.
  if (isGzip(bytes)) {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
    bytes = await new Response(stream).arrayBuffer();
  }
  return WebAssembly.compile(bytes as BufferSource);
}
