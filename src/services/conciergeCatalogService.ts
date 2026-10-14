import { guestRequest } from './guestHttp';
import { httpClient } from './http-client';

export type ConciergeServiceOption = {
  id: string;
  name: string;
  description: string;
  active: boolean;
};

type ConciergeServiceDto = {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
};

const map = (item: ConciergeServiceDto): ConciergeServiceOption => ({
  id: item.id,
  name: item.name,
  description: item.description ?? '',
  active: item.active,
});

export const conciergeCatalogService = {
  async getGuestServices(): Promise<ConciergeServiceOption[]> {
    return (
      await guestRequest(
        () => httpClient.get<ConciergeServiceDto[]>('/guest/concierge/services'),
        'No fue posible cargar los servicios de conserjería.',
      )
    ).map(map);
  },
  async getServices(): Promise<ConciergeServiceOption[]> {
    return (await httpClient.get<ConciergeServiceDto[]>('/concierge/services')).map(map);
  },
  async saveService(
    data: { name: string; description: string; active?: boolean },
    id?: string,
  ): Promise<ConciergeServiceOption> {
    const dto = id
      ? await httpClient.put<ConciergeServiceDto>(`/concierge/services/${id}`, data)
      : await httpClient.post<ConciergeServiceDto>('/concierge/services', data);
    return map(dto);
  },
};
