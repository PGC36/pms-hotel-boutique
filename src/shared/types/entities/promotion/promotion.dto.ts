export interface PromotionDto {
  id: string;
  code: string;
  name: string;
  description: string;
  discount_percent: number;
  valid_from: string;
  valid_to: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}
