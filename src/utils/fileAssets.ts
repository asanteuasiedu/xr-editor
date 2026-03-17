const LARGE_IMAGE_WARNING_BYTES = 8 * 1024 * 1024;

type ImageFileResult =
  | { ok: true; dataUrl: string; warning?: string }
  | { ok: false; error: string };

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Unable to read this file. Try another image.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to read this file. Try another image.'));
        return;
      }

      resolve(reader.result);
    };

    reader.readAsDataURL(file);
  });
}

export async function imageFileToDataUrl(file: File): Promise<ImageFileResult> {
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: 'Unsupported file type. Please upload an image file.' };
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    const warning =
      file.size > LARGE_IMAGE_WARNING_BYTES
        ? 'Large image uploaded. Embedded files can significantly increase local draft and export size.'
        : undefined;

    return { ok: true, dataUrl, warning };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to read this image file.'
    };
  }
}
