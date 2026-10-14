export type MediaTarget = 'roomType' | 'product' | 'amenity' | 'inventoryItem';

export type MediaVariant = 'thumb' | 'medium' | 'large';

export interface MediaImageUrls {
  thumb: string;
  medium: string;
  large: string;
}

export interface MediaImage {
  id: string;
  altText?: string;
  position: number;
  primary: boolean;
  width: number;
  height: number;
  urls: MediaImageUrls;
}

export interface MediaUpload {
  id: string;
  target: MediaTarget;
  contentType: string;
  sizeBytes: number;
  width: number;
  height: number;
  urls: MediaImageUrls;
  expiresAt: Date;
}

export interface MediaImageAssignment {
  mediaId: string;
  altText?: string;
  primary?: boolean;
}
