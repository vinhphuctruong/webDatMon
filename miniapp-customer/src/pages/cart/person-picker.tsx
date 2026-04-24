import { ActionSheet } from "components/fullscreen-sheet";
import { ListItem } from "components/list-item";
import React, { FC, useState } from "react";
import { createPortal } from "react-dom";
import {
  useRecoilValueLoadable,
  useSetRecoilState,
} from "recoil";
import {
  effectiveCustomerPhoneState,
  manualCustomerContactState,
  requestPhoneTriesState,
  userState,
} from "state";
import { useSnackbar } from "zmp-ui";

export const PersonPicker: FC = () => {
  const [visible, setVisible] = useState(false);
  const snackbar = useSnackbar();
  const user = useRecoilValueLoadable(userState);
  const manualContact = useRecoilValueLoadable(manualCustomerContactState);
  const manualContactValue =
    manualContact.state === "hasValue"
      ? manualContact.contents
      : { name: "", phone: "" };
  const name =
    user.state === "hasValue" && user.contents?.name
      ? String(user.contents.name)
      : manualContactValue.name;
  const phoneLoadable = useRecoilValueLoadable(effectiveCustomerPhoneState);
  const phone =
    phoneLoadable.state === "hasValue" && phoneLoadable.contents
      ? phoneLoadable.contents
      : manualContactValue.phone;
  const setManualContact = useSetRecoilState(manualCustomerContactState);
  const retryPhonePermission = useSetRecoilState(requestPhoneTriesState);

  const inputManualContact = () => {
    const defaultName =
      user.state === "hasValue" && user.contents?.name
        ? String(user.contents.name)
        : name;

    const nextName = window.prompt("Nhập tên khách hàng", defaultName)?.trim();
    if (!nextName) {
      snackbar.openSnackbar({ type: "error", text: "Tên khách hàng không được để trống" });
      return;
    }

    const nextPhone = window.prompt("Nhập SĐT khách hàng", phone)?.trim();
    if (!nextPhone) {
      snackbar.openSnackbar({ type: "error", text: "SĐT khách hàng không được để trống" });
      return;
    }

    setManualContact({ name: nextName, phone: nextPhone });
    snackbar.openSnackbar({ type: "success", text: "Đã cập nhật thông tin người nhận" });
  };

  return (
    <>
      <ListItem title={name || phone ? `${name} - ${phone}` : "Vui lòng cập nhật thông tin"} subtitle="Người nhận đơn" onClick={() => setVisible(true)} />
      {createPortal(
        <ActionSheet
          title="Thông tin người nhận"
          visible={visible}
          onClose={() => setVisible(false)}
          actions={[
            [
              {
                text: "Lấy SĐT từ Zalo",
                onClick: () => {
                  setVisible(false);
                  retryPhonePermission((value) => value + 1);
                  snackbar.openSnackbar({
                    type: "success",
                    text: "Đang lấy số điện thoại từ Zalo...",
                  });
                },
              },
              {
                text: "Nhập tay tên và SĐT",
                onClick: () => {
                  setVisible(false);
                  inputManualContact();
                },
              },
            ],
            [{ text: "Đóng", close: true, danger: true }],
          ]}
        ></ActionSheet>,
        document.body,
      )}
    </>
  );
};

export const RequestPersonPickerPhone: FC = () => <PersonPicker />;
