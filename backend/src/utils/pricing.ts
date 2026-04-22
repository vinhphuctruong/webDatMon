import { DiscountType, Option, OptionGroup, Product } from "@prisma/client";
import { HttpError } from "../lib/http-error";
import { StatusCodes } from "http-status-codes";
import { normalizeSelectedOptions, SelectedOptions } from "./selected-options";

export type ProductWithOptions = Product & {
  optionGroups: (OptionGroup & { options: Option[] })[];
};

export function discountedPrice(product: Product): number {
  if (!product.discountType || !product.discountValue) {
    return product.price;
  }

  if (product.discountType === DiscountType.FIXED) {
    return Math.max(0, product.price - product.discountValue);
  }

  return Math.max(0, Math.round(product.price * (1 - product.discountValue / 100)));
}

export function calculateUnitPrice(
  product: ProductWithOptions,
  selectedInput: unknown,
): { unitPrice: number; selectedOptions: SelectedOptions } {
  const selectedOptions = normalizeSelectedOptions(selectedInput);
  let unitPrice = discountedPrice(product);

  for (const group of product.optionGroups) {
    const requested = selectedOptions[group.key];
    const selectedKeys = requested
      ? Array.isArray(requested)
        ? requested
        : [requested]
      : group.options.filter((option) => option.isDefault).map((option) => option.key);

    if (group.isRequired && selectedKeys.length === 0) {
      throw new HttpError(
        StatusCodes.BAD_REQUEST,
        `Option group '${group.name}' is required`,
      );
    }

    if (selectedKeys.length < group.minSelect || selectedKeys.length > group.maxSelect) {
      throw new HttpError(
        StatusCodes.BAD_REQUEST,
        `Invalid option count for group '${group.name}'`,
      );
    }

    for (const optionKey of selectedKeys) {
      const option = group.options.find((item) => item.key === optionKey);
      if (!option) {
        throw new HttpError(
          StatusCodes.BAD_REQUEST,
          `Option '${optionKey}' does not exist in group '${group.name}'`,
        );
      }
      unitPrice += option.priceDelta;
    }

    if (requested === undefined && selectedKeys.length > 0) {
      selectedOptions[group.key] = group.maxSelect === 1 ? selectedKeys[0] : selectedKeys;
    }
  }

  return { unitPrice, selectedOptions };
}
