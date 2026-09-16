import { API_BASE_URL_VALUE } from './detectionApi';

export class ComplaintCaseApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ComplaintCaseApiError';
    this.status = status;
  }
}

async function requestJson(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new ComplaintCaseApiError('The CVKI case service could not be reached.', 0);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ComplaintCaseApiError(payload?.detail || 'The CVKI case request failed.', response.status);
  }
  return payload;
}

export function createCvkiCase(payload) {
  return requestJson(`${API_BASE_URL_VALUE}/api/v1/complaint/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function getCvkiCaseStatus(referenceId) {
  return requestJson(`${API_BASE_URL_VALUE}/api/v1/complaint/cases/${encodeURIComponent(referenceId)}/status`);
}
