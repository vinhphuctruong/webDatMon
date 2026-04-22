import React, { Suspense } from "react";
import { Box, Page } from "zmp-ui";
import { Inquiry } from "./inquiry";
import { Welcome } from "./welcome";
import { Banner } from "./banner";
import { Categories } from "./categories";
import { Recommend } from "./recommend";
import { ProductList } from "./product-list";

const HomePage: React.FunctionComponent = () => {
  return (
    <Page className="relative flex-1 flex flex-col" style={{ background: 'var(--tm-bg)' }}>
      <Welcome />
      <Box className="flex-1 overflow-auto">
        <Inquiry />
        <Banner />
        <div className="tm-divider" />
        <Suspense>
          <Categories />
        </Suspense>
        <div className="tm-divider" />
        <Recommend />
        <div className="tm-divider" />
        <ProductList />
        <div style={{ height: 16 }} />
      </Box>
    </Page>
  );
};

export default HomePage;
