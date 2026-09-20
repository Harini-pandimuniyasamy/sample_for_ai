const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

const TOKEN_KEY = 'docuclean_auth_token';

export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setAuthToken = (token: string | null): void => {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore
  }
};

const getHeaders = (isMultipart = false): HeadersInit => {
  const headers: Record<string, string> = {};
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// =========================================================================
// Auth API
// =========================================================================
export const authApi = {
  async register(fullName: string, email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ fullName, email, password }),
    });
    return res.json();
  },

  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async getMe() {
    const token = getAuthToken();
    if (!token) return null;

    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: 'GET',
        headers: getHeaders(),
      });
      if (!res.ok) {
        setAuthToken(null);
        return null;
      }
      return res.json();
    } catch {
      return null;
    }
  },
};

// =========================================================================
// Documents API
// =========================================================================
export const documentsApi = {
  async upload(file: File, options: string[] = ['remove-spaces', 'fix-line-breaks', 'correct-ocr']) {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('options', JSON.stringify(options));

    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData,
    });
    return res.json();
  },

  async submitText(
    text: string,
    title?: string,
    options: string[] = ['remove-spaces', 'fix-line-breaks', 'correct-ocr']
  ) {
    const res = await fetch(`${API_BASE}/documents/text`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ text, title, options }),
    });
    return res.json();
  },

  async getMyDocuments() {
    const res = await fetch(`${API_BASE}/documents/my-documents`, {
      method: 'GET',
      headers: getHeaders(),
    });
    return res.json();
  },

  async getById(id: string) {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    return res.json();
  },

  async download(id: string, fileName?: string) {
    return this.downloadCleaned(id, fileName);
  },

  async downloadCleaned(id: string, fileName?: string) {
    const token = getAuthToken();
    const url = `${API_BASE}/documents/${id}/download-cleaned${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!res.ok) {
      throw new Error('Download failed');
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName || 'cleaned_document';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);

    return true;
  },

  async downloadOriginal(id: string, fileName?: string) {
    const token = getAuthToken();
    const url = `${API_BASE}/documents/${id}/download-original${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!res.ok) {
      throw new Error('Original file download failed');
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName || 'original_document';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);

    return true;
  },

  async view(id: string) {
    const res = await fetch(`${API_BASE}/documents/${id}/view?format=json`, {
      method: 'GET',
      headers: getHeaders(),
    });
    return res.json();
  },

  async delete(id: string) {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json();
  },
};
