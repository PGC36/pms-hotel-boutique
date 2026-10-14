import { guestRequest } from './guestHttp';
import { httpClient } from './http-client';

export type HousekeepingServiceOption = {
  id: string;
  name: string;
  description: string;
  active: boolean;
};

type HousekeepingServiceDto = {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
};

const map = (item: HousekeepingServiceDto): HousekeepingServiceOption => ({
  id: item.id,
  name: item.name,
  description: item.description ?? '',
  active: item.active,
});

export const housekeepingCatalogService = {
  async getGuestServices(): Promise<HousekeepingServiceOption[]> {
    return (
      await guestRequest(
        () => httpClient.get<HousekeepingServiceDto[]>('/guest/housekeeping/services'),
        'No fue posible cargar las opciones de limpieza.',
      )
    ).map(map);
  },
  async getServices(): Promise<HousekeepingServiceOption[]> {
    return (await httpClient.get<HousekeepingServiceDto[]>('/housekeeping/services')).map(map);
  },
  async saveService(
    data: { name: string; description: string; active?: boolean },
    id?: string,
  ): Promise<HousekeepingServiceOption> {
    const dto = id
      ? await httpClient.put<HousekeepingServiceDto>(`/housekeeping/services/${id}`, data)
      : await httpClient.post<HousekeepingServiceDto>('/housekeeping/services', data);
    return map(dto);
  },
};
