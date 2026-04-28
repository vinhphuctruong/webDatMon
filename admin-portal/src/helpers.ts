const fmt = new Intl.NumberFormat("vi-VN");
const dtFmt = new Intl.DateTimeFormat("vi-VN", { year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit" });

export const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
export const currency = (v: number|null|undefined) => `${fmt.format(v??0)}đ`;
export const fmtDate = (v: string|null|undefined) => { if(!v) return "-"; const d=new Date(v); return isNaN(d.getTime())?"-":dtFmt.format(d); };
export const shortId = (v: string) => v ? v.slice(0,8) : "-";
export const errMsg = (e: unknown) => e instanceof Error && e.message ? e.message : "Có lỗi xảy ra";

export function statusTag(status: string): string {
  const map: Record<string,string> = {
    APPROVED:"tag tag-success", DELIVERED:"tag tag-success",
    REJECTED:"tag tag-danger", CANCELLED:"tag tag-danger",
    PENDING:"tag tag-warning", CONFIRMED:"tag tag-info",
    PREPARING:"tag tag-purple", PICKED_UP:"tag tag-info",
  };
  return map[status] || "tag tag-info";
}

export function docPreview(label: string, dataUrl: string|null): string {
  if(!dataUrl) return `<div class="doc-preview"><span>${esc(label)}</span><small>Không có</small></div>`;
  return `<div class="doc-preview" style="cursor:pointer" onclick="previewImage(this.querySelector('img').src)"><span>${esc(label)}</span><img src="${dataUrl}" alt="${esc(label)}" loading="lazy"/></div>`;
}

let flashEl: HTMLElement|null = null;
let flashTimer: number|undefined;
export function setFlashEl(el: HTMLElement) { flashEl = el; }
export function flash(msg: string, type: "success"|"error"|"info" = "info") {
  if(!flashEl) return;
  flashEl.className = `flash ${type}`;
  flashEl.textContent = msg;
  if(flashTimer) clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => { if(flashEl){ flashEl.className="flash hidden"; flashEl.textContent=""; }}, 4200);
}
