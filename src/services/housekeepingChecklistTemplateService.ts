import { httpClient } from './http-client';

export type HousekeepingChecklistTemplate = {
  code: string;
  name: string;
  items: string[];
  updatedAt: string;
};

export const housekeepingChecklistTemplateService = {
  get: () => httpClient.get<HousekeepingChecklistTemplate>('/housekeeping/checklist-template'),
  update: (items: string[]) =>
    httpClient.put<HousekeepingChecklistTemplate>('/housekeeping/checklist-template', { items }),
};
