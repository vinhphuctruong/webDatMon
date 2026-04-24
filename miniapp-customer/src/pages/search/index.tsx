import React, { FC } from "react";
import { Header, Page } from "zmp-ui";
import { Inquiry } from "./inquiry";
import { SearchResult } from "./result";

const SearchPage: FC = () => {
  return (
    <Page className="flex flex-col" style={{ background: 'var(--tm-bg)' }}>
      <Header title="Tìm món và quán" />
      <Inquiry />
      <SearchResult />
    </Page>
  );
};

export default SearchPage;
