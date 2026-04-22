import { Category, Option, OptionGroup, Product, ProductCategory, Store } from "@prisma/client";
import { discountedPrice } from "./pricing";

export type ProductEntity = Product & {
  store: Store;
  categories: (ProductCategory & { category: Category })[];
  optionGroups: (OptionGroup & { options: Option[] })[];
};

export function toProductResponse(product: ProductEntity) {
  return {
    id: product.id,
    externalId: product.externalId,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    price: product.price,
    finalPrice: discountedPrice(product),
    discount: product.discountType
      ? {
          type: product.discountType,
          value: product.discountValue,
        }
      : null,
    rating: product.rating,
    soldCount: product.soldCount,
    deliveryFee: product.deliveryFee,
    isAvailable: product.isAvailable,
    store: {
      id: product.store.id,
      name: product.store.name,
      rating: product.store.rating,
      etaMinutesMin: product.store.etaMinutesMin,
      etaMinutesMax: product.store.etaMinutesMax,
      address: product.store.address,
      isOpen: product.store.isOpen,
    },
    categories: product.categories.map((item) => ({
      id: item.category.id,
      key: item.category.key,
      name: item.category.name,
      iconUrl: item.category.iconUrl,
    })),
    optionGroups: product.optionGroups
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((group) => ({
        id: group.id,
        key: group.key,
        name: group.name,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        isRequired: group.isRequired,
        options: group.options
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((option) => ({
            id: option.id,
            key: option.key,
            name: option.name,
            priceDelta: option.priceDelta,
            isDefault: option.isDefault,
          })),
      })),
  };
}
