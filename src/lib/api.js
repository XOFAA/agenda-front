const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export class ApiError extends Error {
  constructor(message, code, details, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

function buildUrl(path, query) {
  const url = new URL(`${API_URL}${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

export async function apiRequest(path, { method = 'GET', token, body, query } = {}) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      payload?.erro?.mensagem || 'Erro na requisicao.',
      payload?.erro?.codigo || 'ERRO_DESCONHECIDO',
      payload?.erro?.detalhes,
      response.status,
    );
  }

  if (payload?.sucesso && 'dados' in payload) {
    return payload.dados;
  }

  if (payload?.sucesso && !('dados' in payload)) {
    return payload;
  }

  return payload;
}

export { API_URL };
