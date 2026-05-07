import React, { FC, useState } from "react";
import { Box, Header, Page, Text, Button, Icon, useSnackbar } from "zmp-ui";
import { useRecoilState } from "recoil";
import { savedAddressesState, SavedAddress } from "state";
import { AddressSearchSheet, AddressSearchResult } from "components/address-search-sheet";

type AddressType = "home" | "office";

/* ── Address Form (shared between Create & Edit) ──────────── */

interface AddressFormProps {
  title: string;
  selectedAddress: AddressSearchResult | null;
  label: AddressType;
  name: string;
  phone: string;
  note: string;
  isDefault: boolean;
  onChangeLabel: (v: AddressType) => void;
  onChangeName: (v: string) => void;
  onChangePhone: (v: string) => void;
  onChangeNote: (v: string) => void;
  onChangeDefault: (v: boolean) => void;
  onChangeAddress: () => void;
  onBack: () => void;
  onSave: () => void;
  saveText: string;
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  borderBottom: "1px solid #e8e8e8",
  padding: "16px 0",
  fontSize: 15,
  outline: "none",
  background: "transparent",
  fontFamily: "Inter, sans-serif",
  color: "#1a1a2e",
};

const AddressForm: FC<AddressFormProps> = ({
  title,
  selectedAddress,
  label,
  name,
  phone,
  note,
  isDefault,
  onChangeLabel,
  onChangeName,
  onChangePhone,
  onChangeNote,
  onChangeDefault,
  onChangeAddress,
  onBack,
  onSave,
  saveText,
}) => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "#fff",
      display: "flex",
      flexDirection: "column",
    }}
  >
    {/* Header - below Zalo system bar */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "14px 16px",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 50px)",
        borderBottom: "1px solid #f0f0f0",
        background: "#fff",
        position: "relative",
        zIndex: 10000,
      }}
    >
      <div onClick={onBack} style={{ padding: 8, cursor: "pointer", marginLeft: -4 }}>
        <Icon icon="zi-arrow-left" style={{ fontSize: 24 }} />
      </div>
      <Text
        style={{
          flex: 1,
          textAlign: "center",
          fontSize: 18,
          fontWeight: 600,
          marginRight: 32,
        }}
      >
        {title}
      </Text>
    </div>

    {/* Form body */}
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div
        style={{
          background: "#fff",
          padding: "4px 20px 20px",
        }}
      >
        {/* Họ và tên */}
        <input
          type="text"
          placeholder="Họ và tên"
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
          style={fieldStyle}
        />

        {/* Số điện thoại */}
        <input
          type="tel"
          placeholder="Số điện thoại"
          value={phone}
          onChange={(e) => onChangePhone(e.target.value)}
          style={fieldStyle}
        />

        {/* Địa chỉ (click to open search) */}
        <div
          onClick={onChangeAddress}
          style={{
            ...fieldStyle,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
            color: selectedAddress ? "#1a1a2e" : "#999",
          }}
        >
          <span
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              paddingRight: 8,
            }}
          >
            {selectedAddress?.fullName || "Tỉnh/Thành phố, Quận/Huyện, Tên đường, Số nhà"}
          </span>
          <Icon icon="zi-chevron-right" style={{ fontSize: 20, color: "#ccc", flexShrink: 0 }} />
        </div>

        {/* Ghi chú chi tiết */}
        <input
          type="text"
          placeholder="Ghi chú (Hẻm, tầng, cổng phụ, mốc dễ tìm...)"
          value={note}
          onChange={(e) => onChangeNote(e.target.value)}
          style={fieldStyle}
        />
      </div>

      {/* Đặt làm mặc định */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 20px",
          borderTop: "8px solid #f4f5f6",
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: 500 }}>Đặt làm địa chỉ mặc định</Text>
        <div
          onClick={() => onChangeDefault(!isDefault)}
          style={{
            width: 48,
            height: 28,
            borderRadius: 14,
            background: isDefault ? "var(--tm-primary)" : "#ddd",
            position: "relative",
            cursor: "pointer",
            transition: "background 0.2s",
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "#fff",
              position: "absolute",
              top: 2,
              left: isDefault ? 22 : 2,
              transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          />
        </div>
      </div>

      {/* Loại địa chỉ */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "14px 20px",
          gap: 12,
          borderTop: "1px solid #f0f0f0",
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: 500, marginRight: 8 }}>Loại địa chỉ:</Text>
        {(
          [
            { key: "office" as AddressType, text: "Văn Phòng" },
            { key: "home" as AddressType, text: "Nhà Riêng" },
          ] as const
        ).map((item) => (
          <div
            key={item.key}
            onClick={() => onChangeLabel(item.key)}
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              border: `1.5px solid ${label === item.key ? "var(--tm-primary)" : "#ddd"}`,
              background: label === item.key ? "var(--tm-primary-light)" : "#fff",
              color: label === item.key ? "var(--tm-primary)" : "#666",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {item.text}
          </div>
        ))}
      </div>
    </div>

    {/* Save button */}
    <div style={{ padding: "12px 20px 20px", borderTop: "1px solid #f0f0f0" }}>
      <button
        onClick={onSave}
        style={{
          width: "100%",
          padding: "14px",
          borderRadius: 8,
          border: "none",
          background: "var(--tm-primary)",
          color: "#fff",
          fontSize: 15,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1,
          cursor: "pointer",
        }}
      >
        {saveText}
      </button>
    </div>
  </div>
);

/* ── Main Page ────────────────────────────────────────────── */

const AddressesPage: FC = () => {
  const [addresses, setAddresses] = useRecoilState(savedAddressesState);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [selectedAddress, setSelectedAddress] = useState<AddressSearchResult | null>(null);
  const [formLabel, setFormLabel] = useState<AddressType>("home");
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formDefault, setFormDefault] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const snackbar = useSnackbar();

  const resetForm = () => {
    setSelectedAddress(null);
    setFormLabel("home");
    setFormName("");
    setFormPhone("");
    setFormNote("");
    setFormDefault(false);
    setEditingId(null);
  };

  /* ── Create flow ──────────── */

  const handleStartCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleSearchConfirm = (result: AddressSearchResult) => {
    setSelectedAddress(result);
    setIsSearchOpen(false);
    setIsFormOpen(true);
  };

  /* ── Edit flow ────────────── */

  const handleStartEdit = (addr: SavedAddress) => {
    setEditingId(addr.id);
    setFormName(addr.contactName);
    setFormPhone(addr.contactPhone);
    setFormNote(addr.note || "");
    setFormDefault(addresses.findIndex((a) => a.id === addr.id) === 0); // first = default
    setFormLabel(addr.label.toLowerCase().includes("văn phòng") || addr.label.toLowerCase() === "office" ? "office" : "home");

    // Parse stored address back into search result
    const notePart = addr.note ? ` (${addr.note})` : "";
    const cleanAddress = addr.address.replace(notePart, "").trim();
    setSelectedAddress({
      lat: addr.lat,
      lng: addr.long,
      streetName: cleanAddress.split(",")[0] || addr.label,
      fullName: cleanAddress,
    });

    setIsFormOpen(true);
  };

  /* ── Save (create or update) ── */

  const handleSave = () => {
    if (!formName.trim()) {
      snackbar.openSnackbar({ type: "error", text: "Vui lòng nhập họ và tên" });
      return;
    }
    if (!formPhone.trim()) {
      snackbar.openSnackbar({ type: "error", text: "Vui lòng nhập số điện thoại" });
      return;
    }
    if (!selectedAddress) {
      snackbar.openSnackbar({ type: "error", text: "Vui lòng chọn địa chỉ" });
      return;
    }

    const labelText = formLabel === "office" ? "Văn Phòng" : "Nhà Riêng";

    const entry: SavedAddress = {
      id: editingId || Math.random().toString(36).substring(7),
      label: labelText,
      address: selectedAddress.fullName,
      lat: selectedAddress.lat,
      long: selectedAddress.lng,
      contactName: formName.trim(),
      contactPhone: formPhone.trim(),
      note: formNote.trim() || undefined,
    };

    if (editingId) {
      let updated = addresses.map((a) => (a.id === editingId ? entry : a));
      if (formDefault) {
        updated = [entry, ...updated.filter((a) => a.id !== editingId)];
      }
      setAddresses(updated);
      snackbar.openSnackbar({ type: "success", text: "Cập nhật địa chỉ thành công" });
    } else {
      if (formDefault) {
        setAddresses([entry, ...addresses]);
      } else {
        setAddresses([...addresses, entry]);
      }
      snackbar.openSnackbar({ type: "success", text: "Thêm địa chỉ thành công" });
    }

    setIsFormOpen(false);
    resetForm();
  };

  /* ── Delete ────────────────── */

  const handleDelete = (id: string) => {
    setAddresses(addresses.filter((a) => a.id !== id));
    snackbar.openSnackbar({ type: "success", text: "Đã xóa địa chỉ" });
  };

  /* ── Render ─────────────────── */

  return (
    <Page style={{ background: "var(--tm-bg)" }}>
      <Header title="Địa chỉ đã lưu" showBackIcon />
      <Box style={{ padding: "16px", paddingBottom: 80 }}>
        {addresses.length === 0 ? (
          <Box className="flex flex-col items-center justify-center" style={{ padding: "48px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📍</div>
            <Text style={{ color: "var(--tm-text-secondary)", fontWeight: 500 }}>
              Bạn chưa có địa chỉ nào được lưu
            </Text>
          </Box>
        ) : (
          addresses.map((addr, i) => (
            <div
              key={addr.id}
              className="tm-card"
              style={{ padding: "14px 16px", marginBottom: 12 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "var(--tm-primary-light)",
                      color: "var(--tm-primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      icon={
                        addr.label.toLowerCase().includes("nhà") ? "zi-home" : "zi-location"
                      }
                    />
                  </div>
                  <div>
                    <Text style={{ fontWeight: 600, fontSize: 15 }}>{addr.label}</Text>
                    {i === 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--tm-primary)",
                          fontWeight: 600,
                          marginLeft: 6,
                          background: "var(--tm-primary-light)",
                          padding: "1px 6px",
                          borderRadius: 4,
                        }}
                      >
                        Mặc định
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 2 }}>
                  <div
                    onClick={() => handleStartEdit(addr)}
                    style={{ color: "var(--tm-primary)", padding: 4, cursor: "pointer" }}
                  >
                    <Icon icon="zi-edit" />
                  </div>
                  <div
                    onClick={() => handleDelete(addr.id)}
                    style={{ color: "var(--tm-danger)", padding: 4, cursor: "pointer" }}
                  >
                    <Icon icon="zi-delete" />
                  </div>
                </div>
              </div>

              <Text size="small" style={{ color: "var(--tm-text-secondary)", marginBottom: 2, lineHeight: 1.4 }}>
                {addr.address}
              </Text>
              {addr.note && (
                <Text size="xSmall" style={{ color: "var(--tm-text-tertiary)", fontStyle: "italic", marginBottom: 2 }}>
                  📝 {addr.note}
                </Text>
              )}
              <Text size="xSmall" style={{ color: "var(--tm-text-tertiary)" }}>
                {addr.contactName} · {addr.contactPhone}
              </Text>
            </div>
          ))
        )}
      </Box>

      {/* Fixed bottom button */}
      <Box
        style={{
          padding: "12px 16px",
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#fff",
          borderTop: "1px solid var(--tm-border)",
        }}
      >
        <Button
          fullWidth
          onClick={handleStartCreate}
          style={{ background: "var(--tm-primary)", color: "#fff", fontWeight: 600 }}
        >
          Thêm địa chỉ mới
        </Button>
      </Box>

      {/* Search sheet */}
      <AddressSearchSheet
        visible={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onConfirm={handleSearchConfirm}
      />

      {/* Address form (Create / Edit) */}
      {isFormOpen && (
        <AddressForm
          title={editingId ? "Chỉnh sửa địa chỉ" : "Địa chỉ mới"}
          selectedAddress={selectedAddress}
          label={formLabel}
          name={formName}
          phone={formPhone}
          note={formNote}
          isDefault={formDefault}
          onChangeLabel={setFormLabel}
          onChangeName={setFormName}
          onChangePhone={setFormPhone}
          onChangeNote={setFormNote}
          onChangeDefault={setFormDefault}
          onChangeAddress={() => {
            setIsFormOpen(false);
            setIsSearchOpen(true);
          }}
          onBack={() => {
            setIsFormOpen(false);
            resetForm();
          }}
          onSave={handleSave}
          saveText="Hoàn thành"
        />
      )}
    </Page>
  );
};

export default AddressesPage;
