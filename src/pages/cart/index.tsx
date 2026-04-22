import React, { FC } from "react";
import { Header, Page } from "zmp-ui";
import { CartItems } from "./cart-items";
import { CartPreview } from "./preview";
import { TermsAndPolicies } from "./term-and-policies";
import { Delivery } from "./delivery";
import { useVirtualKeyboardVisible } from "hooks";

const CartPage: FC = () => {
  const keyboardVisible = useVirtualKeyboardVisible();

  return (
    <Page
      className="flex flex-col"
      style={{
        background: 'var(--tm-bg)',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Header title="Giỏ hàng" showBackIcon={false} />
      {/* Scrollable content area */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 8,
      }}>
        <CartItems />
        <div className="tm-divider" />
        <Delivery />
        <div className="tm-divider" />
        <TermsAndPolicies />
      </div>
      {/* Fixed bottom: preview + order button */}
      {!keyboardVisible && <CartPreview />}
    </Page>
  );
};

export default CartPage;
