import { FC, useEffect, useRef } from "react";
import { useNavigate, useSnackbar } from "zmp-ui";
import { useSetRecoilState } from "recoil";
import { onSessionExpired } from "services/api";
import { refreshActiveOrdersAtom, cartState } from "state";

/**
 * Listens for global session-expired events (fired from apiFetch when a 401/403
 * indicates the token is invalid or the role is wrong). Shows a snackbar
 * notification, clears cached Recoil state, and redirects to the login page.
 *
 * Mount this once inside the Layout so it's always active.
 */
export const SessionExpiredGuard: FC = () => {
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const handledRef = useRef(false);
  const setRefreshOrders = useSetRecoilState(refreshActiveOrdersAtom);
  const setCart = useSetRecoilState(cartState);

  useEffect(() => {
    const unsubscribe = onSessionExpired((reason) => {
      // Prevent multiple simultaneous redirects
      if (handledRef.current) return;
      handledRef.current = true;

      // Clear cached Recoil state so banners/cart don't show stale data
      setRefreshOrders((n) => n + 1);
      setCart([]);

      snackbar.openSnackbar({
        type: "error",
        text: reason || "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
        duration: 3500,
      });

      // Small delay so the user can read the toast before redirect
      setTimeout(() => {
        navigate("/login?required=1", { replace: true });
        // Allow future session events after navigation
        setTimeout(() => { handledRef.current = false; }, 2000);
      }, 800);
    });

    return unsubscribe;
  }, [navigate, snackbar, setRefreshOrders, setCart]);

  return null;
};
