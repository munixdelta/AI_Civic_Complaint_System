import { API_BASE_URL_VALUE } from './detectionApi';
import { LocationApiError } from './locationApi';

export async function resolveAuthority({ coordinates, address }) {
  const params = new URLSearchParams({
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  });
  for (const field of ['road', 'area', 'city', 'district', 'state', 'country']) {
    if (address?.[field]) params.set(field, address[field]);
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL_VALUE}/api/v1/authority/resolve?${params}`);
  } catch {
    throw new LocationApiError('Authority information could not be reached.', 0);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new LocationApiError(
      payload?.detail || 'Authority information is temporarily unavailable.',
      response.status,
    );
  }
  return payload;
}
