export interface CompressImageResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  targetMet: boolean;
}

const TARGET_SIZE_BYTES = 100 * 1024;
const MAX_DIMENSION = 1600;

export async function compressImageFile(file: File): Promise<CompressImageResult> {
  if (!file.type.startsWith('image/')) {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      targetMet: file.size <= TARGET_SIZE_BYTES,
    };
  }

  if (file.size <= TARGET_SIZE_BYTES) {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      targetMet: true,
    };
  }

  const image = await loadImage(file);
  let width = image.width;
  let height = image.height;
  const longestSide = Math.max(width, height);

  if (longestSide > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / longestSide;
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      targetMet: file.size <= TARGET_SIZE_BYTES,
    };
  }

  let quality = 0.86;
  let attempts = 0;
  let blob = await renderCompressedBlob(canvas, context, image, width, height, quality);

  while (blob.size > TARGET_SIZE_BYTES && attempts < 8) {
    attempts += 1;

    if (quality > 0.46) {
      quality -= 0.08;
    } else {
      width = Math.max(720, Math.round(width * 0.88));
      height = Math.max(720, Math.round(height * 0.88));
    }

    blob = await renderCompressedBlob(canvas, context, image, width, height, quality);
  }

  const compressedFile = new File(
    [blob],
    buildCompressedFileName(file.name),
    {
      type: blob.type,
      lastModified: file.lastModified,
    },
  );

  return {
    file: compressedFile,
    originalSize: file.size,
    compressedSize: compressedFile.size,
    targetMet: compressedFile.size <= TARGET_SIZE_BYTES,
  };
}

function buildCompressedFileName(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf('.');
  const basename = lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName;
  return `${basename}-compressed.jpg`;
}

async function renderCompressedBlob(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  width: number,
  height: number,
  quality: number,
) {
  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, quality);
  if (!blob) {
    throw new Error('图片压缩失败');
  }
  return blob;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality);
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('图片读取失败'));
    };

    image.src = objectUrl;
  });
}
