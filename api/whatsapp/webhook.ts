export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge') ?? '';

  // Debe coincidir con el token que pusiste en Meta
  if (mode === 'subscribe' && token === 'mi_token_verificacion_123') {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Error de verificación', { status: 403 });
}

export async function POST(req: Request) {
  // Aquí podrás procesar los eventos entrantes de WhatsApp
  return new Response('EVENT_RECEIVED', { status: 200 });
}
