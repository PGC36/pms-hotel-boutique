export interface Promotion {
  id: string;
  code: string;
  name: string;
  description: string;
  discountPercent: number;
  validFrom: Date;
  validTo: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
