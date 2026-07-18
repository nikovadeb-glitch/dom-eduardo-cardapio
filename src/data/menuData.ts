/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import initialData from "./menuData.json";

export interface RestaurantInfo {
  name: string;
  tagline: string;
  foundedYear: number;
  aboutText: string;
  coverImage: string;
  paymentInfo: {
    methods: string[];
    couvertText: string;
  };
  contact: {
    instagram: string;
    instagramUrl: string;
    whatsapp: string;
    whatsappUrl: string;
    phone: string;
    address: string;
    addressMapUrl: string;
    hours: {
      days: string;
      time: string;
    }[];
  };
}

export interface MenuCategory {
  id: string;
  name: string;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  subcategoryId?: string; // Used strictly for Bebidas subcategories
  name: string;
  description: string;
  price: number | "A Consultar";
  image: string;
  isHighlight?: boolean;
  isOutOfStock?: boolean;
}

export interface GalleryItem {
  id: string;
  title: string;
  image: string;
}

export interface DailyPromotion {
  id: string;
  title: string;
  description: string;
  price?: number | string;
  image?: string;
  isArchived?: boolean;
}

export interface FullMenuDataset {
  adminPassword?: string;
  restaurantInfo: RestaurantInfo;
  menuCategories: MenuCategory[];
  beverageSubcategories: MenuCategory[];
  menuItems: MenuItem[];
  galleryItems: GalleryItem[];
  promotions?: DailyPromotion[];
}

// Export the initial values statically in case API fetch hasn't completed or as fallbacks
export const restaurantInfo: RestaurantInfo = initialData.restaurantInfo;
export const menuCategories: MenuCategory[] = initialData.menuCategories;
export const beverageSubcategories: MenuCategory[] = initialData.beverageSubcategories;
export const menuItems: MenuItem[] = initialData.menuItems as MenuItem[];
export const galleryItems: GalleryItem[] = initialData.galleryItems;
export const promotions: DailyPromotion[] = (initialData as any).promotions || [];
export const adminPassword = initialData.adminPassword || "8111";

