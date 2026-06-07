export const runtime = 'nodejs';

const STORE = globalThis.__threadsGenStore ?? new Map();
globalThis.__threadsGenStore = STORE;

export async function GET(req, { params }) {
  const { id } = await params;
  const entry = STORE.get(id);
  if (!entry) {
    return new Response('Not found or expired (fallback STORE)', { status: 404 });
  }
  const filename = encodeURIComponent(entry.name || 'output.xlsx');

  return new Response(entry.buffer, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename*=UTF-8''${filename}`,
      'content-length': String(entry.size),
    },
  });
}
