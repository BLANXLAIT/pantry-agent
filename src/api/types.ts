/**
 * Kroger API Types
 * Generated from OpenAPI specifications
 */

// Auth types
export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  refresh_token?: string;
}

export interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope: string;
}

// Location types
export interface Location {
  locationId: string;
  storeNumber: string;
  divisionNumber: string;
  chain: string;
  name: string;
  address: {
    addressLine1: string;
    city: string;
    state: string;
    zipCode: string;
    county?: string;
  };
  geolocation: {
    latitude: number;
    longitude: number;
    latLng: string;
  };
  phone?: string;
  hours?: StoreHours;
  departments?: Department[];
}

export interface StoreHours {
  timezone: string;
  gmtOffset: string;
  open24: boolean;
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
}

export interface DayHours {
  open: string;
  close: string;
  open24: boolean;
}

export interface Department {
  departmentId: string;
  name: string;
}

export interface LocationsResponse {
  data: Location[];
  meta: {
    pagination: Pagination;
  };
}

// Product types
export interface Product {
  productId: string;
  upc: string;
  productPageURI?: string;
  brand?: string;
  description: string;
  categories?: string[];
  images?: ProductImage[];
  items?: ProductItem[];
  aisleLocations?: AisleLocation[];
  temperature?: {
    indicator: string;
    heatSensitive: boolean;
  };
}

export interface ProductImage {
  perspective: string;
  featured?: boolean;
  sizes: {
    size: string;
    url: string;
  }[];
}

export interface ProductItem {
  itemId: string;
  size?: string;
  soldBy?: string;
  inventory?: {
    stockLevel: string;
  };
  price?: {
    regular: number;
    promo?: number;
  };
  fulfillment?: {
    curbside: boolean;
    delivery: boolean;
    inStore: boolean;
    shipToHome: boolean;
  };
}

export interface AisleLocation {
  bayNumber?: string;
  description?: string;
  number?: string;
  side?: string;
  shelfNumber?: string;
  shelfPositionInBay?: string;
}

export interface ProductsResponse {
  data: Product[];
  meta: {
    pagination: Pagination;
  };
}

// Cart types
export interface CartItem {
  upc: string;
  quantity: number;
  modality?: 'PICKUP' | 'DELIVERY';
}

export interface CartAddRequest {
  items: CartItem[];
}

// Profile types
export interface Profile {
  id: string;
}

// Common types
export interface Pagination {
  start: number;
  limit: number;
  total: number;
}

export interface APIError {
  timestamp?: number;
  code?: string;
  reason?: string;
  error?: string;
  error_description?: string;
}
