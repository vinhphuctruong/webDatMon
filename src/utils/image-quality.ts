export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export interface ImageValidationSuccess {
  ok: true;
  dataUrl: string;
  qualityScore: number;
}

export interface ImageValidationFailure {
  ok: false;
  error: string;
}

export type ImageValidationResult = ImageValidationSuccess | ImageValidationFailure;

export interface ValidateImageOptions {
  maxFileSizeBytes?: number;
  minQualityScore?: number;
}

const DEFAULT_MAX_FILE_SIZE_BYTES = 6 * 1024 * 1024;
const DEFAULT_MIN_QUALITY_SCORE = 110;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không đọc được ảnh"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Ảnh không hợp lệ"));
    image.src = src;
  });
}

export async function calculateImageQualityScore(dataUrl: string): Promise<number> {
  const image = await loadImage(dataUrl);

  const maxDimension = 320;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(32, Math.round(image.width * scale));
  const height = Math.max(32, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Không thể phân tích chất lượng ảnh");
  }

  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const gray = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const p = index * 4;
      gray[index] = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
    }
  }

  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const laplacian =
        gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width] - 4 * gray[i];

      sum += laplacian;
      sumSq += laplacian * laplacian;
      count += 1;
    }
  }

  if (count === 0) {
    return 0;
  }

  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return Number.isFinite(variance) ? Math.max(0, variance) : 0;
}

export async function validateImageForSubmission(
  file: File,
  options: ValidateImageOptions = {},
): Promise<ImageValidationResult> {
  const maxFileSizeBytes = options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;
  const minQualityScore = options.minQualityScore ?? DEFAULT_MIN_QUALITY_SCORE;

  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return {
      ok: false,
      error: "Định dạng ảnh không hợp lệ. Chỉ hỗ trợ JPG, PNG hoặc WEBP.",
    };
  }

  if (file.size > maxFileSizeBytes) {
    return {
      ok: false,
      error: "Ảnh quá lớn. Vui lòng chọn ảnh dưới 6MB.",
    };
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    const qualityScore = await calculateImageQualityScore(dataUrl);

    if (qualityScore < minQualityScore) {
      return {
        ok: false,
        error:
          "Ảnh có dấu hiệu bị mờ. Vui lòng chụp lại rõ nét hơn, đủ sáng và giữ tay ổn định.",
      };
    }

    return {
      ok: true,
      dataUrl,
      qualityScore,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Không thể xử lý ảnh đã chọn",
    };
  }
}
