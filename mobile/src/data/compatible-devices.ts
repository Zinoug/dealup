import type { CompatibleDevicesCatalog } from '@/types/domain';

export const compatibleDevicesFallback: CompatibleDevicesCatalog = {
  version: '1.0',
  categories: [
    {
      code: 'IPHONE',
      label: 'iPhone',
      supportedRange: 'iPhone 11 et plus récents, iPhone SE 2 et SE 3',
      assetKey: null,
      models: ['iPhone 11 et générations suivantes', 'iPhone SE 2', 'iPhone SE 3'],
    },
    {
      code: 'MACBOOK',
      label: 'MacBook',
      supportedRange: 'MacBook Air et MacBook Pro avec puce Apple M1 ou plus récente',
      assetKey: null,
      models: ['MacBook Air M1+', 'MacBook Pro M1+'],
    },
  ],
  comingLater: ['iPad', 'Apple Watch', 'Téléphones Android', 'MacBook Intel'],
};
