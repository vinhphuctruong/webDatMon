import _ from "lodash";
import { useEffect, useRef, useState } from "react";
import { matchStatusBarColor } from "utils/device";
import { EventName, events, Payment } from "zmp-sdk";
import { useNavigate, useSnackbar } from "zmp-ui";
import { useRecoilValueLoadable, useSetRecoilState } from "recoil";
import { cartState, remoteStoresState, storesState } from "state";
import { fetchCart } from "services/backend";

export function useMatchStatusTextColor(visible?: boolean) {
  const changedRef = useRef(false);
  useEffect(() => {
    if (changedRef.current) {
      matchStatusBarColor(visible ?? false);
    } else {
      changedRef.current = true;
    }
  }, [visible]);
}

const originalScreenHeight = window.innerHeight;

export function useVirtualKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const detectKeyboardOpen = () => {
      setVisible(window.innerHeight + 160 < originalScreenHeight);
    };
    window.addEventListener("resize", detectKeyboardOpen);
    return () => {
      window.removeEventListener("resize", detectKeyboardOpen);
    };
  }, []);

  return visible;
}

export const useHandlePayment = () => {
  const navigate = useNavigate();
  useEffect(() => {
    events.on(EventName.OpenApp, (data) => {
      if (data?.path) {
        navigate(data?.path, {
          state: data,
        });
      }
    });

    events.on(EventName.OnDataCallback, (resp) => {
      const { appTransID, eventType } = resp;
      if (appTransID || eventType === "PAY_BY_CUSTOM_METHOD") {
        navigate("/result", {
          state: resp,
        });
      }
    });

    events.on(EventName.PaymentClose, (data = {}) => {
      const { zmpOrderId } = data;
      navigate("/result", {
        state: { data: { zmpOrderId } },
      });
    });
  }, []);
};

export const useSyncBackendState = () => {
  const setCart = useSetRecoilState(cartState);
  const setStores = useSetRecoilState(storesState);
  const remoteStores = useRecoilValueLoadable(remoteStoresState);
  const hasSession = !!localStorage.getItem("zaui_food_session");

  useEffect(() => {
    if (!hasSession) return;
    fetchCart()
      .then(setCart)
      .catch((error) => {
        console.warn("Sync cart from backend failed", error);
      });
  }, [hasSession]);

  useEffect(() => {
    if (!hasSession) return;
    if (remoteStores.state === "hasValue") {
      setStores(remoteStores.contents);
    }
  }, [hasSession, remoteStores.state, remoteStores.contents]);
};

export function useToBeImplemented() {
  const snackbar = useSnackbar();
  return () =>
    snackbar.openSnackbar({
      type: "success",
      text: "Chức năng dành cho các bên tích hợp phát triển...",
    });
}
