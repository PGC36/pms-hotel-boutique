import {
  toDomain as toAmenity,
  type Amenity,
  type AmenityDto,
} from '@/shared/types/entities/amenity';
import {
  toDomain as toProduct,
  type Product,
  type ProductDto,
} from '@/shared/types/entities/product';
import { simulateLatency } from './mockUtils';
import { httpClient } from './http-client';
import { guestRequest } from './guestHttp';
import {
  describeImageAssignmentError,
  toImagesRequest,
  toMediaImageDtos,
  type ApiMediaImage,
} from './mediaService';
import type { MediaImageAssignmentDto } from '@/shared/types/entities/media-image';
import { normalizeAmenityTime } from '@/shared/utils/amenitySchedule';

type ApiAmenity = {
  id: string;
  name: string;
  description?: string;
  category: AmenityDto['category'];
  location?: string;
  opensAt?: string;
  closesAt?: string;
  active: boolean;
  images?: ApiMediaImage[];
  createdAt?: string;
  updatedAt?: string;
};

type ApiProduct = {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: ProductDto['category'];
  priceCents: number;
  currency?: ProductDto['currency'];
  active: boolean;
  images?: ApiMediaImage[];
  createdAt?: string;
  updatedAt?: string;
};

type SaveAmenityData = {
  name: string;
  description?: string;
  category: AmenityDto['category'];
  location?: string;
  /** "HH:mm". En una actualización, ausente conserva la hora guardada y `null` la quita. */
  opensAt?: string | null;
  closesAt?: string | null;
  active?: boolean;
  /** Ausente: no cambia la galería. Lista vacía: quita todas las imágenes. */
  images?: MediaImageAssignmentDto[];
};

type SaveProductData = {
  sku: string;
  name: string;
  description?: string;
  category: ProductDto['category'];
  priceCents: number;
  currency?: ProductDto['currency'];
  active?: boolean;
  /** Ausente: no cambia la galería. Lista vacía: quita todas las imágenes. */
  images?: MediaImageAssignmentDto[];
};

const nowIso = () => new Date().toISOString();

function mapAmenityFromApi(api: ApiAmenity): AmenityDto {
  const createdAt = api.createdAt ?? nowIso();
  return {
    id: api.id,
    name: api.name,
    description: api.description,
    category: api.category,
    location: api.location,
    // El backend envía "HH:mm:ss"; el contrato de amenity es "HH:mm".
    opens_at: normalizeAmenityTime(api.opensAt),
    closes_at: normalizeAmenityTime(api.closesAt),
    active: api.active,
    images: toMediaImageDtos(api.images),
    created_at: createdAt,
    updated_at: api.updatedAt ?? createdAt,
  };
}

function mapProductFromApi(api: ApiProduct): ProductDto {
  const timestamp = api.createdAt ?? nowIso();
  return {
    id: api.id,
    sku: api.sku,
    name: api.name,
    description: api.description,
    category: api.category,
    price_cents: api.priceCents,
    currency: api.currency ?? 'GTQ',
    stock_quantity: 0,
    reorder_level: 0,
    active: api.active,
    images: toMediaImageDtos(api.images),
    created_at: timestamp,
    updated_at: api.updatedAt ?? timestamp,
  };
}

function toAmenityRequest(data: SaveAmenityData) {
  return {
    name: data.name.trim(),
    description: data.description?.trim() || undefined,
    category: data.category,
    location: data.location?.trim() || undefined,
    opensAt: normalizeAmenityTime(data.opensAt),
    closesAt: normalizeAmenityTime(data.closesAt),
    active: data.active ?? true,
    images: toImagesRequest(data.images),
  };
}

function toProductRequest(data: SaveProductData) {
  return {
    sku: data.sku.trim().toUpperCase(),
    name: data.name.trim(),
    description: data.description?.trim() || undefined,
    category: data.category,
    priceCents: data.priceCents,
    currency: data.currency ?? 'GTQ',
    active: data.active ?? true,
    images: toImagesRequest(data.images),
  };
}

/** Traduce los errores de `images` del backend; el resto se propaga igual que antes. */
async function saveRequest<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const imageMessage = describeImageAssignmentError(error);
    if (imageMessage) throw new Error(imageMessage);
    throw error;
  }
}

export const catalogService = {
  async getProducts(): Promise<Product[]> {
    await simulateLatency();
    const products = await httpClient.get<ApiProduct[]>('/room-service/products');
    return products.map(mapProductFromApi).map(toProduct);
  },
  async getAdminProducts(): Promise<Product[]> {
    await simulateLatency();
    const products = await httpClient.get<ApiProduct[]>('/admin/room-service/products');
    return products.map(mapProductFromApi).map(toProduct);
  },
  async createAdminProduct(data: SaveProductData): Promise<Product> {
    await simulateLatency();
    if (!data.name.trim()) throw new Error('El producto requiere nombre.');
    if (!data.sku.trim()) throw new Error('El producto requiere SKU.');
    if (!Number.isInteger(data.priceCents) || data.priceCents < 1) {
      throw new Error('El precio debe ser un entero mayor o igual a 1.');
    }

    const product = await saveRequest(() =>
      httpClient.post<ApiProduct>('/admin/room-service/products', toProductRequest(data)),
    );
    return toProduct(mapProductFromApi(product));
  },
  async updateAdminProduct(id: string, data: Partial<SaveProductData>): Promise<Product> {
    await simulateLatency();
    if (
      data.priceCents !== undefined &&
      (!Number.isInteger(data.priceCents) || data.priceCents < 1)
    ) {
      throw new Error('El precio debe ser un entero mayor o igual a 1.');
    }
    const current = (await this.getAdminProducts()).find((product) => product.id === id);
    if (!current) throw new Error(`No existe el producto ${id}.`);
    const product = await saveRequest(() =>
      httpClient.put<ApiProduct>(
        `/admin/room-service/products/${id}`,
        toProductRequest({
          sku: data.sku ?? current.sku,
          name: data.name ?? current.name,
          description: data.description ?? current.description,
          category:
            data.category ??
            (current.category === 'foodAndBeverage' ? 'food_and_beverage' : current.category),
          priceCents: data.priceCents ?? current.priceCents,
          currency: data.currency ?? current.currency,
          active: data.active ?? current.active,
          images: data.images,
        }),
      ),
    );
    return toProduct(mapProductFromApi(product));
  },
  async getAmenities(): Promise<Amenity[]> {
    await simulateLatency();
    const amenities = await httpClient.get<ApiAmenity[]>('/admin/amenities?active=true');
    return amenities.map(mapAmenityFromApi).map(toAmenity);
  },
  // Portal del huésped (INT-12): rutas `/guest/...` con el JWT de huésped, sin mock de respaldo.
  async getGuestAmenities(): Promise<Amenity[]> {
    const amenities = await guestRequest(
      () => httpClient.get<ApiAmenity[]>('/guest/amenities'),
      'No fue posible cargar las amenidades.',
    );
    return amenities.map(mapAmenityFromApi).map(toAmenity);
  },
  /** Menú del huésped: solo productos activos (`GET /guest/room-service/products`). */
  async getGuestProducts(): Promise<Product[]> {
    const products = await guestRequest(
      () => httpClient.get<ApiProduct[]>('/guest/room-service/products'),
      'No fue posible cargar el menú.',
    );
    return products.map(mapProductFromApi).map(toProduct);
  },
  async getAdminAmenities(): Promise<Amenity[]> {
    await simulateLatency();
    const amenities = await httpClient.get<ApiAmenity[]>('/admin/amenities');
    return amenities.map(mapAmenityFromApi).map(toAmenity);
  },
  async createAmenity(data: SaveAmenityData): Promise<Amenity> {
    await simulateLatency();
    if (!data.name.trim()) throw new Error('La amenidad requiere nombre.');

    const amenity = await saveRequest(() =>
      httpClient.post<ApiAmenity>('/admin/amenities', toAmenityRequest(data)),
    );
    return toAmenity(mapAmenityFromApi(amenity));
  },
  async updateAmenity(id: string, data: Partial<SaveAmenityData>): Promise<Amenity> {
    await simulateLatency();
    const current = (await this.getAdminAmenities()).find((amenity) => amenity.id === id);
    if (!current) throw new Error(`No existe la amenidad ${id}.`);
    const amenity = await saveRequest(() =>
      httpClient.put<ApiAmenity>(
        `/admin/amenities/${id}`,
        toAmenityRequest({
          name: data.name ?? current.name,
          description: data.description ?? current.description,
          category: data.category ?? current.category,
          location: data.location ?? current.location,
          // `undefined` conserva el horario guardado; `null` lo quita (servicio continuo).
          opensAt: data.opensAt === undefined ? current.opensAt : data.opensAt,
          closesAt: data.closesAt === undefined ? current.closesAt : data.closesAt,
          active: data.active ?? current.active,
          images: data.images,
        }),
      ),
    );
    return toAmenity(mapAmenityFromApi(amenity));
  },
};
export default catalogService;
