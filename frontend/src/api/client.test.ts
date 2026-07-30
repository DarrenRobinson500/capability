// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, auth } from './client';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('api client', () => {
  beforeEach(() => {
    document.cookie = '';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends credentials and no CSRF header on a GET request', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'ok' }));

    await auth.me();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/me/');
    expect(options?.credentials).toBe('include');
    const headers = new Headers(options?.headers);
    expect(headers.has('X-CSRFToken')).toBe(false);
  });

  it('attaches the X-CSRFToken header from the cookie on a POST request', async () => {
    document.cookie = 'csrftoken=abc123';
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1, username: 'x', role: 'EMPLOYEE', employee_id: null, employee_name: null, position_id: null, is_staff: false }));

    await auth.login('x', 'y');

    const [, options] = fetchMock.mock.calls[0];
    const headers = new Headers(options?.headers);
    expect(headers.get('X-CSRFToken')).toBe('abc123');
    expect(options?.body).toBe(JSON.stringify({ username: 'x', password: 'y' }));
  });

  it('throws ApiError with the status and parsed body on a non-2xx response', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async () => jsonResponse({ detail: 'Invalid credentials.' }, 401));

    await expect(auth.login('x', 'wrong')).rejects.toBeInstanceOf(ApiError);
    await expect(auth.login('x', 'wrong')).rejects.toMatchObject({
      status: 401,
      body: { detail: 'Invalid credentials.' },
    });
  });

  it('returns undefined for a 204 No Content response', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const result = await auth.logout();
    expect(result).toBeUndefined();
  });
});
