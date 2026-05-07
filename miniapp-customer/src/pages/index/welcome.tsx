import React, { FC } from "react";
import { Box, Text, useNavigate } from "zmp-ui";
import { useRecoilValueLoadable, useRecoilValue } from "recoil";
import { userState, customerAddressDisplayState } from "state";

export const Welcome: FC = () => {
  const deliveryAddress = useRecoilValue(customerAddressDisplayState);
  const user = useRecoilValueLoadable(userState);
  const navigate = useNavigate();

  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  React.useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("zaui_food_session"));
  }, []);

  const avatarUrl =
    user.state === "hasValue" && user.contents?.avatar
      ? user.contents.avatar
      : null;

  return (
    <div className="tm-header-gradient">
      <Box flex alignItems="center" justifyContent="space-between">
        <Box 
          flex 
          alignItems="center" 
          className="space-x-3 flex-1 min-w-0"
          onClick={() => navigate("/addresses")}
          style={{ cursor: "pointer" }}
        >
          {/* Location icon */}
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" fill="#fff"/>
            </svg>
          </div>
          <Box className="min-w-0 flex-1">
            <Text size="xxSmall" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
              Giao đến
            </Text>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Text.Title size="small" style={{ color: '#fff', fontSize: 14, fontWeight: 600 }} className="truncate">
                {deliveryAddress}
              </Text.Title>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                <path d="M8 10L12 14L16 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </Box>
        </Box>
        {/* Avatar */}
        {isLoggedIn && (
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)',
            border: '2px solid rgba(255,255,255,0.5)',
            overflow: 'hidden', flexShrink: 0
          }}>
            {avatarUrl ? (
              <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
            )}
          </div>
        )}
      </Box>
    </div>
  );
};
