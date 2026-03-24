/**
 * Comprime una imagen para uso como fondo del boleto (PDF).
 * Reduce tamaño y peso para evitar PDFs gigantes y exceso de memoria en Cloud Functions.
 */

const MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.72;

/**
 * Comprime un File de imagen: redimensiona a ancho máximo y convierte a JPEG.
 * @param file - Archivo de imagen (jpeg, png, webp, etc.)
 * @returns Nuevo File comprimido (JPEG)
 */
export function compressImageForBoleto(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const scale = width > MAX_WIDTH ? MAX_WIDTH / width : 1;
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo obtener contexto del canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Error al comprimir la imagen'));
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const compressedFile = new File([blob], `${baseName}_boleto.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Error al cargar la imagen'));
    };

    img.src = url;
  });
}

/** Fondo del lienzo del mapa en admin: máxima compresión para ahorrar Storage. */
const MAP_BG_MAX_WIDTH = 800;
const MAP_BG_JPEG_QUALITY = 0.52;

export function compressImageForMapBackground(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const scale = width > MAP_BG_MAX_WIDTH ? MAP_BG_MAX_WIDTH / width : 1;
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo obtener contexto del canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Error al comprimir la imagen'));
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const compressedFile = new File([blob], `${baseName}_mapbg.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        'image/jpeg',
        MAP_BG_JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Error al cargar la imagen'));
    };

    img.src = url;
  });
}
