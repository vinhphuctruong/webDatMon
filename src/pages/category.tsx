import { ProductItem } from "components/product/item";
import React, { FC, Suspense } from "react";
import { useRecoilValue } from "recoil";
import {
  categoriesState,
  productsByCategoryState,
  selectedCategoryIdState,
} from "state";
import { Box, Header, Page, Tabs, Text } from "zmp-ui";

const CategoryPicker: FC = () => {
  const categories = useRecoilValue(categoriesState);
  const selectedCategory = useRecoilValue(selectedCategoryIdState);
  return (
    <Tabs
      scrollable
      defaultActiveKey={selectedCategory}
      className="category-tabs"
    >
      {categories.map((category) => (
        <Tabs.Tab key={category.id} label={category.name}>
          <Suspense>
            <CategoryProducts categoryId={category.id} />
          </Suspense>
        </Tabs.Tab>
      ))}
    </Tabs>
  );
};

const CategoryProducts: FC<{ categoryId: string }> = ({ categoryId }) => {
  const productsByCategory = useRecoilValue(
    productsByCategoryState(categoryId),
  );

  if (productsByCategory.length === 0) {
    return (
      <div className="tm-empty-state" style={{ minHeight: 200 }}>
        <span className="tm-empty-icon">🍽️</span>
        <Text style={{ fontWeight: 600, color: 'var(--tm-text-primary)', marginBottom: 4 }}>
          Chưa có món nào
        </Text>
        <Text size="xSmall" style={{ color: 'var(--tm-text-secondary)' }}>
          Danh mục này chưa có món, hãy thử danh mục khác
        </Text>
      </div>
    );
  }
  return (
    <Box style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12,
      padding: 16,
      background: 'var(--tm-bg)',
    }}>
      {productsByCategory.map((product) => (
        <ProductItem key={product.id} product={product} />
      ))}
    </Box>
  );
};

const CategoryPage: FC = () => {
  return (
    <Page className="flex flex-col" style={{ background: 'var(--tm-bg)' }}>
      <Header title="Danh mục món ăn" />
      <CategoryPicker />
    </Page>
  );
};

export default CategoryPage;
