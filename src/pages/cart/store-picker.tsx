import { ActionSheet } from "components/fullscreen-sheet";
import { ListItem } from "components/list-item";
import React, { FC, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  useRecoilValue,
  useRecoilValueLoadable,
  useSetRecoilState,
} from "recoil";
import {
  customerAddressTextState,
  locationState,
  manualCustomerLocationState,
  manualStoreOverrideState,
  nearbyStoresState,
  requestLocationTriesState,
  selectedStoreIndexState,
  selectedStoreState,
} from "state";
import { Store } from "types/delivery";
import {
  displayDistance,
  isWithinThuDauMotServiceArea,
  parseCoordinatePair,
  THU_DAU_MOT_CENTER,
} from "utils/location";
import { useSnackbar } from "zmp-ui";

const MANUAL_STORE_ID = 999999;

const formatCoordinate = (value: number) =>
  Number.isFinite(value) ? value.toFixed(5) : "--";

export const CustomerLocationPicker: FC = () => {
  const [visible, setVisible] = useState(false);
  const snackbar = useSnackbar();
  const location = useRecoilValueLoadable(locationState);
  const manualLocation = useRecoilValue(manualCustomerLocationState);
  const customerAddressText = useRecoilValue(customerAddressTextState);
  const retry = useSetRecoilState(requestLocationTriesState);
  const setManualLocation = useSetRecoilState(manualCustomerLocationState);
  const setCustomerAddressText = useSetRecoilState(customerAddressTextState);
  const setSelectedStoreIndex = useSetRecoilState(selectedStoreIndexState);

  const subtitle = useMemo(() => {
    if (location.state !== "hasValue" || !location.contents) {
      return "Đang lấy vị trí tại Thủ Dầu Một...";
    }

    const lat = Number(location.contents.latitude);
    const lng = Number(location.contents.longitude);
    const sourceLabel = manualLocation ? "Nhập tay" : "GPS / Mặc định";
    const coordinateLabel = `${formatCoordinate(lat)}, ${formatCoordinate(lng)} · ${sourceLabel}`;

    if (customerAddressText.trim()) {
      return `${customerAddressText.trim()} (${coordinateLabel})`;
    }

    return coordinateLabel;
  }, [location.state, location.contents, manualLocation, customerAddressText]);

  const applyGpsLocation = () => {
    setManualLocation(null);
    retry((value) => value + 1);
    setSelectedStoreIndex(0);
    snackbar.openSnackbar({
      type: "success",
      text: "Đang lấy vị trí GPS trong khu vực Thủ Dầu Một...",
    });
  };

  const applyCustomerAddressText = () => {
    const nextValue = window.prompt(
      "Nhập địa chỉ khách hàng (chi tiết giao hàng)",
      customerAddressText || "Thủ Dầu Một, Bình Dương",
    );

    if (nextValue === null) {
      return;
    }

    const trimmed = nextValue.trim();
    setCustomerAddressText(trimmed);
    snackbar.openSnackbar({
      type: "success",
      text: trimmed ? "Đã cập nhật địa chỉ khách hàng" : "Đã xóa địa chỉ chi tiết của khách hàng",
    });
  };

  const applyManualLocation = () => {
    const input = window.prompt(
      "Nhập tọa độ khách hàng (lat,lng) trong phạm vi Thủ Dầu Một/lân cận",
      `${THU_DAU_MOT_CENTER.lat},${THU_DAU_MOT_CENTER.lng}`,
    );

    if (!input) {
      return;
    }

    const parsed = parseCoordinatePair(input);
    if (!parsed) {
      snackbar.openSnackbar({
        type: "error",
        text: "Tọa độ không hợp lệ. Ví dụ: 10.9804,106.6519",
      });
      return;
    }

    if (!isWithinThuDauMotServiceArea(parsed.lat, parsed.lng)) {
      snackbar.openSnackbar({
        type: "error",
        text: "Vị trí ngoài phạm vi Thủ Dầu Một và lân cận Bình Dương",
      });
      return;
    }

    setManualLocation({
      latitude: String(parsed.lat),
      longitude: String(parsed.lng),
    });
    setSelectedStoreIndex(0);
    snackbar.openSnackbar({
      type: "success",
      text: "Đã cập nhật vị trí khách hàng nhập tay",
    });
  };

  return (
    <>
      <ListItem
        onClick={() => setVisible(true)}
        title="Vị trí giao đến"
        subtitle={subtitle}
      />
      {createPortal(
        <ActionSheet
          title="Vị trí khách hàng"
          visible={visible}
          onClose={() => setVisible(false)}
          actions={[
            [
              {
                text: "Dùng GPS hiện tại",
                onClick: () => {
                  setVisible(false);
                  applyGpsLocation();
                },
              },
              {
                text: "Nhập tọa độ thủ công",
                onClick: () => {
                  setVisible(false);
                  applyManualLocation();
                },
              },
              {
                text: "Nhập địa chỉ chi tiết",
                onClick: () => {
                  setVisible(false);
                  applyCustomerAddressText();
                },
              },
              ...(manualLocation
                ? [
                    {
                      text: "Xóa vị trí nhập tay",
                      onClick: () => {
                        setManualLocation(null);
                        setVisible(false);
                        snackbar.openSnackbar({
                          type: "success",
                          text: "Đã bỏ vị trí nhập tay, quay về GPS/mặc định",
                        });
                      },
                    },
                  ]
                : []),
            ],
            [{ text: "Đóng", close: true, danger: true }],
          ]}
        ></ActionSheet>,
        document.body,
      )}
    </>
  );
};

export const StorePicker: FC = () => {
  const [visible, setVisible] = useState(false);
  const snackbar = useSnackbar();
  const nearbyStores = useRecoilValueLoadable(nearbyStoresState);
  const setSelectedStoreIndex = useSetRecoilState(selectedStoreIndexState);
  const selectedStoreLoadable = useRecoilValueLoadable(selectedStoreState);
  const selectedStore =
    selectedStoreLoadable.state === "hasValue" ? selectedStoreLoadable.contents : undefined;
  const manualStore = useRecoilValue(manualStoreOverrideState);
  const setManualStore = useSetRecoilState(manualStoreOverrideState);

  const stores =
    nearbyStores.state === "hasValue"
      ? (nearbyStores.contents as (Store & { distance?: number })[])
      : [];

  const availableStores = manualStore
    ? stores.filter((store) => store.id !== manualStore.id)
    : stores;

  const applyManualStore = () => {
    const coordinateInput = window.prompt(
      "Nhập tọa độ quán (lat,lng) trong phạm vi Thủ Dầu Một/lân cận",
      `${THU_DAU_MOT_CENTER.lat},${THU_DAU_MOT_CENTER.lng}`,
    );

    if (!coordinateInput) {
      return;
    }

    const parsed = parseCoordinatePair(coordinateInput);
    if (!parsed) {
      snackbar.openSnackbar({
        type: "error",
        text: "Tọa độ quán không hợp lệ. Ví dụ: 10.9804,106.6519",
      });
      return;
    }

    if (!isWithinThuDauMotServiceArea(parsed.lat, parsed.lng)) {
      snackbar.openSnackbar({
        type: "error",
        text: "Quán phải nằm trong Thủ Dầu Một hoặc khu vực lân cận Bình Dương",
      });
      return;
    }

    const name =
      window.prompt("Nhập tên quán", "Quán nhập tay Bình Dương")?.trim() ||
      "Quán nhập tay Bình Dương";
    const address =
      window.prompt("Nhập địa chỉ quán", "Thủ Dầu Một, Bình Dương")?.trim() ||
      "Thủ Dầu Một, Bình Dương";
    const phone =
      window.prompt("Nhập SĐT quán", "0274 3622 899")?.trim() ||
      "0274 3622 899";

    setManualStore({
      id: MANUAL_STORE_ID,
      name,
      address,
      phone,
      lat: parsed.lat,
      long: parsed.lng,
      eta: "15-25 phút",
      rating: 4.7,
    });
    setSelectedStoreIndex(0);
    snackbar.openSnackbar({
      type: "success",
      text: "Đã cập nhật vị trí quán nhập tay",
    });
  };

  if (!selectedStore || selectedStoreLoadable.state === "loading") {
    return <RequestStorePickerLocation />;
  }

  return (
    <>
      <ListItem
        onClick={() => setVisible(true)}
        title={selectedStore.name}
        subtitle={`${selectedStore.address}${selectedStore.phone ? ` · ${selectedStore.phone}` : ""}`}
      />
      {nearbyStores.state === "hasValue" &&
        createPortal(
          <ActionSheet
            title="Chọn quán phục vụ gần bạn"
            visible={visible}
            onClose={() => setVisible(false)}
            actions={[
              [
                {
                  text: "Nhập tọa độ quán thủ công",
                  onClick: () => {
                    setVisible(false);
                    applyManualStore();
                  },
                },
                ...(manualStore
                  ? [
                      {
                        text: "Bỏ quán nhập tay",
                        onClick: () => {
                          setManualStore(null);
                          setSelectedStoreIndex(0);
                          setVisible(false);
                          snackbar.openSnackbar({
                            type: "success",
                            text: "Đã quay về danh sách quán gần bạn",
                          });
                        },
                      },
                    ]
                  : []),
              ],
              availableStores.map((store: Store & { distance?: number }, i) => ({
                text: store.distance
                  ? `${store.name} · ${store.phone ?? "Chưa có SĐT"} · ${store.eta ?? "20-30 phút"} · ${displayDistance(store.distance)}`
                  : `${store.name} · ${store.phone ?? "Chưa có SĐT"}`,
                highLight: store.id === selectedStore?.id,
                onClick: () => {
                  setManualStore(null);
                  setSelectedStoreIndex(i);
                },
              })),
              [{ text: "Đóng", close: true, danger: true }],
            ]}
          ></ActionSheet>,
          document.body,
        )}
    </>
  );
};

export const RequestStorePickerLocation: FC = () => {
  const retry = useSetRecoilState(requestLocationTriesState);
  return (
    <ListItem
      onClick={() => retry((r) => r + 1)}
      title="Chọn quán giao hàng"
      subtitle="Bật GPS hoặc nhập tay để đề xuất quán trong khu vực Thủ Dầu Một"
    />
  );
};
