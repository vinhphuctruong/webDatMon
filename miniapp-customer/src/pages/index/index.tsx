import React, { Suspense, useEffect } from "react";
import { Box, Page, useNavigate } from "zmp-ui";
import { Inquiry } from "./inquiry";
import { EntryActions } from "./entry-actions";
import { Welcome } from "./welcome";
import { Banner } from "./banner";
import { Categories } from "./categories";
import { Recommend } from "./recommend";
import { ProductList } from "./product-list";
import { clearApiSession, fetchMyProfile } from "services/api";
import { ActiveOrderBanner } from "components/active-order-banner";

const HomePage: React.FunctionComponent = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    fetchMyProfile()
      .then((profile) => {
        if (!active) return;
        // console.log("Profile fetched", profile);
      })
      .catch(() => {
        if (!active) return;
        // Do not force redirect to registration page, allow user to browse home page
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <Page className="relative flex-1 flex flex-col" style={{ background: 'var(--tm-bg)' }}>
      <Welcome />
      <Box className="flex-1 overflow-auto">
        <Suspense>
          <ActiveOrderBanner />
        </Suspense>
        <Inquiry />
        <EntryActions />
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
