type VercelRequest = {
  method?: string;
  body?: unknown;
};

type VercelResponse = {
  setHeader?: (name: string, value: string) => void;
  status: (statusCode: number) => VercelResponse;
  json: (body: unknown) => void;
};

type OpenAIImageGenerationResponse = {
  output_format?: string;
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
    url?: string;
  }>;
  error?: {
    message?: string;
  };
};

const USER_FACING_GENERATION_ERROR =
  'Could not generate the scene right now. Try another prompt or try again shortly.';
const MAX_GENERATION_ATTEMPTS = 3;
const ACCEPTABLE_SEAM_SCORE = 12;
const MAX_FALLBACK_SEAM_SCORE = 18;
const MAX_ACCEPTABLE_SPLIT_TRANSITION_RATIO = 3.35;
const MAX_ACCEPTABLE_CENTER_TRANSITION_DIFFERENCE = 22;
const MAX_FALLBACK_SPLIT_TRANSITION_RATIO = 4.5;
const MAX_FALLBACK_CENTER_TRANSITION_DIFFERENCE = 30;
const MIN_EDGE_STRIP_WIDTH = 12;
const MAX_EDGE_STRIP_WIDTH = 24;

type GeneratedPanoramaCandidate = {
  imageDataUrl: string;
  revisedPrompt?: string;
  validation: PanoramaValidationResult;
  attemptNumber: number;
};

type DecodedPngImage = {
  width: number;
  height: number;
  pixels: Uint8Array;
};

type PanoramaContinuityEvaluation = {
  seamScore: number;
  stripWidth: number;
  width: number;
  height: number;
};

type PanoramaSuitabilityEvaluation = {
  bucketCount: number;
  meanTransitionDifference: number;
  maxTransitionDifference: number;
  maxTransitionIndex: number;
  centerTransitionDifference: number;
  splitTransitionRatio: number;
};

type PanoramaValidationResult = {
  imageDataUrl: string;
  width: number;
  height: number;
  aspectRatioPassed: boolean;
  wasAspectAdjusted: boolean;
  seamScore: number;
  stripWidth: number;
  meanTransitionDifference: number;
  maxTransitionDifference: number;
  maxTransitionIndex: number;
  centerTransitionDifference: number;
  splitTransitionRatio: number;
  panoramaSuitabilityPassed: boolean;
  minimumRequirementsPassed: boolean;
  accepted: boolean;
};

function getGlobalBuffer() {
  const globalBuffer = (globalThis as unknown as {
    Buffer?: {
      from: (
        value: ArrayBuffer | string,
        encoding?: string
      ) => Uint8Array & {
        toString: (encoding: string) => string;
      };
    };
  }).Buffer;

  return globalBuffer ?? null;
}

async function fetchImageAsDataUrl(url: string, mimeType: string) {
  const imageResponse = await fetch(url);
  if (!imageResponse.ok) {
    throw new Error(`Image download failed with status ${imageResponse.status}.`);
  }

  const arrayBuffer = await imageResponse.arrayBuffer();
  const globalBuffer = getGlobalBuffer();
  if (!globalBuffer) {
    throw new Error('Buffer is not available in this runtime.');
  }

  return `data:${mimeType};base64,${globalBuffer.from(arrayBuffer).toString('base64')}`;
}

function getEnvValue(name: string) {
  const globalProcess = (globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
  }).process;

  return globalProcess?.env?.[name];
}

function getPromptFromBody(body: unknown) {
  if (typeof body === 'string') {
    try {
      return getPromptFromBody(JSON.parse(body));
    } catch {
      return '';
    }
  }

  if (!body || typeof body !== 'object' || !('prompt' in body)) {
    return '';
  }

  const prompt = (body as { prompt?: unknown }).prompt;
  return typeof prompt === 'string' ? prompt.trim() : '';
}

function buildPanoramaPrompt(prompt: string) {
  return [
    'Create a true full 360-degree equirectangular panoramic image intended for immersive XR viewing.',
    'The output must be a seamless wraparound panorama with exact 2:1 composition and natural left-to-right edge continuity.',
    'It must behave like a proper equirectangular projection: when viewed flat it may appear stretched or distorted, but when displayed in a 360-degree panorama viewer it should look spatially correct.',
    'The far left and far right edges must connect naturally as one continuous environment with matching horizon, lighting, architecture, landscape, vegetation, sky, and perspective, with no visible seam, break, or abrupt transition.',
    'Do not create a standard flat composition, split scene, collage, poster layout, two-part image, inset composition, or duplicated edge structures. Avoid abrupt changes in architecture, buildings, trees, terrain, skyline, or lighting across the wrap boundary.',
    'Render the environment in HD / high-detail quality with spatially coherent lighting, environmental continuity, and convincing depth across the full panorama.',
    'The result should feel like an empty immersive environment ready for educational XR authoring and panoramic exploration.',
    'Do not include people, humans, faces, crowds, bodies, silhouettes, characters, or portraits.',
    'Do not include readable text, labels, captions, signs, logos, watermarks, UI elements, interface overlays, or branded graphics.',
    'Avoid framed artwork, poster-like layouts, multi-panel compositions, inset views, fisheye framing, and any non-equirectangular composition cues.',
    `User prompt: ${prompt}`
  ].join('\n\n');
}

function buildAttemptPrompt(prompt: string, attemptNumber: number) {
  if (attemptNumber <= 1) {
    return buildPanoramaPrompt(prompt);
  }

  return [
    buildPanoramaPrompt(prompt),
    'Important correction: the previous image did not read as a proper continuous equirectangular panorama. Regenerate it as a true 360-degree equirectangular environment with exact 2:1 aspect ratio, visible flat-view equirectangular distortion, and seamless wraparound continuity from the left edge to the right edge.'
  ].join('\n\n');
}

function readUint32BigEndian(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function getChunkType(bytes: Uint8Array, offset: number) {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function paethPredictor(left: number, above: number, upperLeft: number) {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);

  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
    return left;
  }

  if (aboveDistance <= upperLeftDistance) {
    return above;
  }

  return upperLeft;
}

let inflateSyncPromise:
  | Promise<(input: Uint8Array) => Uint8Array>
  | null = null;

async function inflateCompressedPngData(input: Uint8Array) {
  if (!inflateSyncPromise) {
    const loadZlibModule = new Function('return import("node:zlib")') as () => Promise<unknown>;
    inflateSyncPromise = loadZlibModule().then((module) => {
      const inflateSync = (module as {
        inflateSync: (value: Uint8Array) => Uint8Array;
      }).inflateSync;

      return (value: Uint8Array) => new Uint8Array(inflateSync(value));
    });
  }

  const inflateSync = await inflateSyncPromise;
  return inflateSync(input);
}

let deflateSyncPromise:
  | Promise<(input: Uint8Array) => Uint8Array>
  | null = null;

async function deflatePngData(input: Uint8Array) {
  if (!deflateSyncPromise) {
    const loadZlibModule = new Function('return import("node:zlib")') as () => Promise<unknown>;
    deflateSyncPromise = loadZlibModule().then((module) => {
      const deflateSync = (module as {
        deflateSync: (value: Uint8Array) => Uint8Array;
      }).deflateSync;

      return (value: Uint8Array) => new Uint8Array(deflateSync(value));
    });
  }

  const deflateSync = await deflateSyncPromise;
  return deflateSync(input);
}

function decodeDataUrlToBytes(dataUrl: string) {
  const base64Payload = dataUrl.match(/^data:[^;]+;base64,(.+)$/)?.[1];
  if (!base64Payload) {
    throw new Error('Generated image data URL is missing base64 content.');
  }

  const globalBuffer = getGlobalBuffer();
  if (!globalBuffer) {
    throw new Error('Buffer is not available in this runtime.');
  }

  return new Uint8Array(globalBuffer.from(base64Payload, 'base64'));
}

async function decodePngDataUrl(dataUrl: string): Promise<DecodedPngImage> {
  const bytes = decodeDataUrlToBytes(dataUrl);
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

  if (bytes.length < pngSignature.length || !pngSignature.every((value, index) => bytes[index] === value)) {
    throw new Error('Generated image is not a valid PNG payload.');
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let compressionMethod = 0;
  let filterMethod = 0;
  let interlaceMethod = 0;
  const idatChunks: Uint8Array[] = [];

  for (let offset = pngSignature.length; offset + 8 <= bytes.length; ) {
    const length = readUint32BigEndian(bytes, offset);
    const type = getChunkType(bytes, offset + 4);
    const chunkDataStart = offset + 8;
    const chunkDataEnd = chunkDataStart + length;
    const chunkCrcEnd = chunkDataEnd + 4;

    if (chunkCrcEnd > bytes.length) {
      throw new Error('Generated PNG chunk is truncated.');
    }

    const chunkData = bytes.slice(chunkDataStart, chunkDataEnd);

    if (type === 'IHDR') {
      width = readUint32BigEndian(chunkData, 0);
      height = readUint32BigEndian(chunkData, 4);
      bitDepth = chunkData[8];
      colorType = chunkData[9];
      compressionMethod = chunkData[10];
      filterMethod = chunkData[11];
      interlaceMethod = chunkData[12];
    } else if (type === 'IDAT') {
      idatChunks.push(chunkData);
    } else if (type === 'IEND') {
      break;
    }

    offset = chunkCrcEnd;
  }

  if (!width || !height || !idatChunks.length) {
    throw new Error('Generated PNG is missing required image data.');
  }

  if (bitDepth !== 8 || compressionMethod !== 0 || filterMethod !== 0 || interlaceMethod !== 0) {
    throw new Error('Generated PNG uses an unsupported format for continuity checks.');
  }

  const channelsByColorType = new Map<number, number>([
    [0, 1],
    [2, 3],
    [4, 2],
    [6, 4]
  ]);
  const channelCount = channelsByColorType.get(colorType);

  if (!channelCount) {
    throw new Error(`Generated PNG color type ${colorType} is not supported for continuity checks.`);
  }

  const rowLength = width * channelCount;
  const compressedLength = idatChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const compressed = new Uint8Array(compressedLength);
  let compressedOffset = 0;

  for (const chunk of idatChunks) {
    compressed.set(chunk, compressedOffset);
    compressedOffset += chunk.length;
  }

  const inflated = await inflateCompressedPngData(compressed);
  const expectedInflatedLength = height * (rowLength + 1);
  if (inflated.length < expectedInflatedLength) {
    throw new Error('Generated PNG pixel payload is shorter than expected.');
  }

  const previousRow = new Uint8Array(rowLength);
  const reconstructedRow = new Uint8Array(rowLength);
  const pixels = new Uint8Array(width * height * 4);
  let inflatedOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[inflatedOffset];
    inflatedOffset += 1;
    const filteredRow = inflated.subarray(inflatedOffset, inflatedOffset + rowLength);
    inflatedOffset += rowLength;

    switch (filterType) {
      case 0:
        reconstructedRow.set(filteredRow);
        break;
      case 1:
        for (let index = 0; index < rowLength; index += 1) {
          const left = index >= channelCount ? reconstructedRow[index - channelCount] : 0;
          reconstructedRow[index] = (filteredRow[index] + left) & 0xff;
        }
        break;
      case 2:
        for (let index = 0; index < rowLength; index += 1) {
          reconstructedRow[index] = (filteredRow[index] + previousRow[index]) & 0xff;
        }
        break;
      case 3:
        for (let index = 0; index < rowLength; index += 1) {
          const left = index >= channelCount ? reconstructedRow[index - channelCount] : 0;
          const above = previousRow[index];
          reconstructedRow[index] = (filteredRow[index] + Math.floor((left + above) / 2)) & 0xff;
        }
        break;
      case 4:
        for (let index = 0; index < rowLength; index += 1) {
          const left = index >= channelCount ? reconstructedRow[index - channelCount] : 0;
          const above = previousRow[index];
          const upperLeft = index >= channelCount ? previousRow[index - channelCount] : 0;
          reconstructedRow[index] = (filteredRow[index] + paethPredictor(left, above, upperLeft)) & 0xff;
        }
        break;
      default:
        throw new Error(`Generated PNG uses unsupported filter type ${filterType}.`);
    }

    for (let x = 0; x < width; x += 1) {
      const sourceOffset = x * channelCount;
      const targetOffset = (y * width + x) * 4;

      if (colorType === 0) {
        const value = reconstructedRow[sourceOffset];
        pixels[targetOffset] = value;
        pixels[targetOffset + 1] = value;
        pixels[targetOffset + 2] = value;
        pixels[targetOffset + 3] = 255;
      } else if (colorType === 2) {
        pixels[targetOffset] = reconstructedRow[sourceOffset];
        pixels[targetOffset + 1] = reconstructedRow[sourceOffset + 1];
        pixels[targetOffset + 2] = reconstructedRow[sourceOffset + 2];
        pixels[targetOffset + 3] = 255;
      } else if (colorType === 4) {
        const value = reconstructedRow[sourceOffset];
        pixels[targetOffset] = value;
        pixels[targetOffset + 1] = value;
        pixels[targetOffset + 2] = value;
        pixels[targetOffset + 3] = reconstructedRow[sourceOffset + 1];
      } else {
        pixels[targetOffset] = reconstructedRow[sourceOffset];
        pixels[targetOffset + 1] = reconstructedRow[sourceOffset + 1];
        pixels[targetOffset + 2] = reconstructedRow[sourceOffset + 2];
        pixels[targetOffset + 3] = reconstructedRow[sourceOffset + 3];
      }
    }

    previousRow.set(reconstructedRow);
  }

  return { width, height, pixels };
}

function createCrc32Table() {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
}

const CRC32_TABLE = createCrc32Table();

function calculateCrc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createPngChunk(type: string, data: Uint8Array) {
  const typeBytes = new Uint8Array([
    type.charCodeAt(0),
    type.charCodeAt(1),
    type.charCodeAt(2),
    type.charCodeAt(3)
  ]);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);

  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  view.setUint32(8 + data.length, calculateCrc32(crcInput));

  return chunk;
}

function concatenateByteArrays(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return combined;
}

function encodePngBytesSync(image: DecodedPngImage) {
  const rowLength = image.width * 4;
  const rawRows = new Uint8Array(image.height * (rowLength + 1));
  let rawOffset = 0;

  for (let y = 0; y < image.height; y += 1) {
    rawRows[rawOffset] = 0;
    rawOffset += 1;
    const sourceOffset = y * rowLength;
    rawRows.set(image.pixels.subarray(sourceOffset, sourceOffset + rowLength), rawOffset);
    rawOffset += rowLength;
  }

  return rawRows;
}

async function encodePngDataUrl(image: DecodedPngImage) {
  const rawRows = encodePngBytesSync(image);
  const compressed = await deflatePngData(rawRows);
  const pngSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, image.width);
  ihdrView.setUint32(4, image.height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const pngBytes = concatenateByteArrays([
    pngSignature,
    createPngChunk('IHDR', ihdr),
    createPngChunk('IDAT', compressed),
    createPngChunk('IEND', new Uint8Array(0))
  ]);
  const globalBuffer = getGlobalBuffer();
  if (!globalBuffer) {
    throw new Error('Buffer is not available in this runtime.');
  }

  return `data:image/png;base64,${globalBuffer.from(pngBytes.buffer).toString('base64')}`;
}

function enforceTwoToOneAspectRatio(image: DecodedPngImage) {
  const exactAspect = image.width === image.height * 2;
  if (exactAspect) {
    return {
      image,
      wasAdjusted: false
    };
  }

  let targetHeight = image.height;
  let targetWidth = image.height * 2;

  if (targetWidth > image.width) {
    targetWidth = image.width - (image.width % 2);
    targetHeight = Math.floor(targetWidth / 2);
  }

  if (targetHeight <= 0 || targetWidth <= 0) {
    throw new Error('Generated image could not be cropped to a valid 2:1 panorama.');
  }

  const cropX = Math.max(0, Math.floor((image.width - targetWidth) / 2));
  const cropY = Math.max(0, Math.floor((image.height - targetHeight) / 2));
  const croppedPixels = new Uint8Array(targetWidth * targetHeight * 4);

  for (let y = 0; y < targetHeight; y += 1) {
    const sourceOffset = ((cropY + y) * image.width + cropX) * 4;
    const targetOffset = y * targetWidth * 4;
    croppedPixels.set(
      image.pixels.subarray(sourceOffset, sourceOffset + targetWidth * 4),
      targetOffset
    );
  }

  return {
    image: {
      width: targetWidth,
      height: targetHeight,
      pixels: croppedPixels
    },
    wasAdjusted: true
  };
}

function evaluatePanoramaContinuity(decodedImage: DecodedPngImage): PanoramaContinuityEvaluation {
  const stripWidth = Math.min(
    MAX_EDGE_STRIP_WIDTH,
    Math.max(1, Math.min(Math.floor(decodedImage.width / 4), Math.max(MIN_EDGE_STRIP_WIDTH, Math.round(decodedImage.width * 0.012))))
  );
  let meanColorDifference = 0;
  let meanLumaDifference = 0;
  let meanGradientDifference = 0;
  let previousLeftLuma: number | null = null;
  let previousRightLuma: number | null = null;

  for (let y = 0; y < decodedImage.height; y += 1) {
    let leftRed = 0;
    let leftGreen = 0;
    let leftBlue = 0;
    let rightRed = 0;
    let rightGreen = 0;
    let rightBlue = 0;

    for (let x = 0; x < stripWidth; x += 1) {
      const leftPixelOffset = (y * decodedImage.width + x) * 4;
      const rightPixelOffset = (y * decodedImage.width + (decodedImage.width - stripWidth + x)) * 4;

      leftRed += decodedImage.pixels[leftPixelOffset];
      leftGreen += decodedImage.pixels[leftPixelOffset + 1];
      leftBlue += decodedImage.pixels[leftPixelOffset + 2];
      rightRed += decodedImage.pixels[rightPixelOffset];
      rightGreen += decodedImage.pixels[rightPixelOffset + 1];
      rightBlue += decodedImage.pixels[rightPixelOffset + 2];
    }

    const averageLeftRed = leftRed / stripWidth;
    const averageLeftGreen = leftGreen / stripWidth;
    const averageLeftBlue = leftBlue / stripWidth;
    const averageRightRed = rightRed / stripWidth;
    const averageRightGreen = rightGreen / stripWidth;
    const averageRightBlue = rightBlue / stripWidth;
    const rowColorDifference =
      (Math.abs(averageLeftRed - averageRightRed) +
        Math.abs(averageLeftGreen - averageRightGreen) +
        Math.abs(averageLeftBlue - averageRightBlue)) /
      3;
    const leftLuma = averageLeftRed * 0.2126 + averageLeftGreen * 0.7152 + averageLeftBlue * 0.0722;
    const rightLuma = averageRightRed * 0.2126 + averageRightGreen * 0.7152 + averageRightBlue * 0.0722;

    meanColorDifference += rowColorDifference;
    meanLumaDifference += Math.abs(leftLuma - rightLuma);

    if (previousLeftLuma !== null && previousRightLuma !== null) {
      meanGradientDifference += Math.abs(
        (leftLuma - previousLeftLuma) - (rightLuma - previousRightLuma)
      );
    }

    previousLeftLuma = leftLuma;
    previousRightLuma = rightLuma;
  }

  const averageColorDifference = meanColorDifference / decodedImage.height;
  const averageLumaDifference = meanLumaDifference / decodedImage.height;
  const averageGradientDifference =
    meanGradientDifference / Math.max(1, decodedImage.height - 1);
  const seamScore =
    (((averageColorDifference * 0.7) +
      (averageLumaDifference * 0.2) +
      (averageGradientDifference * 0.1)) /
      255) *
    100;

  return {
    seamScore: Math.round(seamScore * 100) / 100,
    stripWidth,
    width: decodedImage.width,
    height: decodedImage.height
  };
}

function evaluatePanoramaSuitability(decodedImage: DecodedPngImage): PanoramaSuitabilityEvaluation {
  const bucketCount = Math.max(16, Math.min(64, Math.floor(decodedImage.width / 24)));
  const bucketSums = Array.from({ length: bucketCount }, () => ({
    red: 0,
    green: 0,
    blue: 0,
    count: 0
  }));

  for (let y = 0; y < decodedImage.height; y += 1) {
    for (let x = 0; x < decodedImage.width; x += 1) {
      const bucketIndex = Math.min(bucketCount - 1, Math.floor((x / decodedImage.width) * bucketCount));
      const pixelOffset = (y * decodedImage.width + x) * 4;
      const bucket = bucketSums[bucketIndex];

      bucket.red += decodedImage.pixels[pixelOffset];
      bucket.green += decodedImage.pixels[pixelOffset + 1];
      bucket.blue += decodedImage.pixels[pixelOffset + 2];
      bucket.count += 1;
    }
  }

  const bucketAverages = bucketSums.map((bucket) => ({
    red: bucket.red / Math.max(1, bucket.count),
    green: bucket.green / Math.max(1, bucket.count),
    blue: bucket.blue / Math.max(1, bucket.count)
  }));
  const transitions = bucketAverages.slice(1).map((bucket, index) => {
    const previousBucket = bucketAverages[index];
    return (
      (Math.abs(bucket.red - previousBucket.red) +
        Math.abs(bucket.green - previousBucket.green) +
        Math.abs(bucket.blue - previousBucket.blue)) /
      3
    );
  });
  const meanTransitionDifference =
    transitions.reduce((sum, difference) => sum + difference, 0) / Math.max(1, transitions.length);
  let maxTransitionDifference = 0;
  let maxTransitionIndex = 0;

  transitions.forEach((difference, index) => {
    if (difference > maxTransitionDifference) {
      maxTransitionDifference = difference;
      maxTransitionIndex = index;
    }
  });

  const centerTransitionDifference = transitions[Math.floor(transitions.length / 2)] ?? 0;
  const splitTransitionRatio = Math.round(
    (maxTransitionDifference / Math.max(1, meanTransitionDifference)) * 100
  ) / 100;

  return {
    bucketCount,
    meanTransitionDifference: Math.round(meanTransitionDifference * 100) / 100,
    maxTransitionDifference: Math.round(maxTransitionDifference * 100) / 100,
    maxTransitionIndex,
    centerTransitionDifference: Math.round(centerTransitionDifference * 100) / 100,
    splitTransitionRatio
  };
}

async function validateGeneratedPanorama(imageDataUrl: string): Promise<PanoramaValidationResult> {
  const decodedImage = await decodePngDataUrl(imageDataUrl);
  const aspectAdjustedImage = enforceTwoToOneAspectRatio(decodedImage);
  const continuity = evaluatePanoramaContinuity(aspectAdjustedImage.image);
  const suitability = evaluatePanoramaSuitability(aspectAdjustedImage.image);
  const aspectRatioPassed = aspectAdjustedImage.image.width === aspectAdjustedImage.image.height * 2;
  const panoramaSuitabilityPassed =
    suitability.splitTransitionRatio <= MAX_ACCEPTABLE_SPLIT_TRANSITION_RATIO &&
    suitability.centerTransitionDifference <= MAX_ACCEPTABLE_CENTER_TRANSITION_DIFFERENCE;
  const accepted =
    aspectRatioPassed &&
    continuity.seamScore <= ACCEPTABLE_SEAM_SCORE &&
    panoramaSuitabilityPassed;
  const minimumRequirementsPassed =
    aspectRatioPassed &&
    continuity.seamScore <= MAX_FALLBACK_SEAM_SCORE &&
    suitability.splitTransitionRatio <= MAX_FALLBACK_SPLIT_TRANSITION_RATIO &&
    suitability.centerTransitionDifference <= MAX_FALLBACK_CENTER_TRANSITION_DIFFERENCE;
  const finalImageDataUrl = aspectAdjustedImage.wasAdjusted
    ? await encodePngDataUrl(aspectAdjustedImage.image)
    : imageDataUrl;

  return {
    imageDataUrl: finalImageDataUrl,
    width: aspectAdjustedImage.image.width,
    height: aspectAdjustedImage.image.height,
    aspectRatioPassed,
    wasAspectAdjusted: aspectAdjustedImage.wasAdjusted,
    seamScore: continuity.seamScore,
    stripWidth: continuity.stripWidth,
    meanTransitionDifference: suitability.meanTransitionDifference,
    maxTransitionDifference: suitability.maxTransitionDifference,
    maxTransitionIndex: suitability.maxTransitionIndex,
    centerTransitionDifference: suitability.centerTransitionDifference,
    splitTransitionRatio: suitability.splitTransitionRatio,
    panoramaSuitabilityPassed,
    minimumRequirementsPassed,
    accepted
  };
}

async function normalizeGeneratedImagePayload(data: OpenAIImageGenerationResponse) {
  const generatedImage = data.data?.[0];
  let imageDataUrl: string | null = null;

  if (generatedImage?.b64_json) {
    const outputFormat = data.output_format?.trim() || 'png';
    imageDataUrl = `data:image/${outputFormat};base64,${generatedImage.b64_json}`;
  } else if (generatedImage?.url) {
    imageDataUrl = await fetchImageAsDataUrl(generatedImage.url, 'image/png');
  }

  console.info('[generate-360-scene] Image payload normalized', {
    hasImageDataUrl: Boolean(imageDataUrl),
    imageDataUrlPrefix: imageDataUrl?.slice(0, 30) ?? null,
    imageDataUrlIsDataImage: imageDataUrl?.startsWith('data:image/') ?? false
  });

  if (!imageDataUrl) {
    throw new Error('No usable image payload was returned from generation.');
  }

  return {
    imageDataUrl,
    revisedPrompt: generatedImage?.revised_prompt
  };
}

function isBetterCandidate(
  candidate: GeneratedPanoramaCandidate,
  currentBest: GeneratedPanoramaCandidate | null
) {
  if (!currentBest) {
    return true;
  }

  const candidatePenalty =
    (candidate.validation.aspectRatioPassed ? 0 : 100) +
    candidate.validation.seamScore +
    Math.max(0, candidate.validation.splitTransitionRatio - MAX_ACCEPTABLE_SPLIT_TRANSITION_RATIO) * 10 +
    Math.max(0, candidate.validation.centerTransitionDifference - MAX_ACCEPTABLE_CENTER_TRANSITION_DIFFERENCE);
  const currentPenalty =
    (currentBest.validation.aspectRatioPassed ? 0 : 100) +
    currentBest.validation.seamScore +
    Math.max(0, currentBest.validation.splitTransitionRatio - MAX_ACCEPTABLE_SPLIT_TRANSITION_RATIO) * 10 +
    Math.max(0, currentBest.validation.centerTransitionDifference - MAX_ACCEPTABLE_CENTER_TRANSITION_DIFFERENCE);

  if (candidatePenalty !== currentPenalty) {
    return candidatePenalty < currentPenalty;
  }

  return candidate.attemptNumber < currentBest.attemptNumber;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  console.info('[generate-360-scene] Route hit', {
    method: request.method
  });

  if (request.method !== 'POST') {
    response.setHeader?.('Allow', 'POST');
    return response.status(405).json({ error: 'Use Generate from the editor to create a scene.' });
  }

  const prompt = getPromptFromBody(request.body);
  console.info('[generate-360-scene] Prompt received', {
    promptLength: prompt.length,
    promptPreview: prompt.slice(0, 120)
  });
  if (!prompt) {
    return response.status(400).json({ error: 'Describe the scene you want to generate first.' });
  }

  const apiKey = getEnvValue('OPENAI_API_KEY');
  if (!apiKey) {
    return response.status(500).json({
      error: 'Scene generation is not configured yet. Add the server API key and try again.'
    });
  }

  try {
    let bestCandidate: GeneratedPanoramaCandidate | null = null;

    for (let attemptNumber = 1; attemptNumber <= MAX_GENERATION_ATTEMPTS; attemptNumber += 1) {
      const wrappedPrompt = buildAttemptPrompt(prompt, attemptNumber);
      console.info('[generate-360-scene] Wrapped prompt prepared', {
        attemptNumber,
        promptLength: wrappedPrompt.length
      });

      try {
        const openAIResponse = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-image-1',
            prompt: wrappedPrompt,
            n: 1,
            size: '1536x1024',
            quality: 'medium',
            output_format: 'png'
          })
        });

        const data = (await openAIResponse.json().catch(() => ({}))) as OpenAIImageGenerationResponse;
        const generatedImage = data.data?.[0];
        console.info('[generate-360-scene] OpenAI response received', {
          attemptNumber,
          status: openAIResponse.status,
          ok: openAIResponse.ok,
          topLevelKeys: Object.keys(data ?? {}),
          firstImageKeys: generatedImage ? Object.keys(generatedImage) : [],
          hasBase64Image: Boolean(generatedImage?.b64_json),
          hasImageUrl: Boolean(generatedImage?.url)
        });

        if (!openAIResponse.ok) {
          throw new Error(data.error?.message ?? openAIResponse.statusText);
        }

        const normalizedImage = await normalizeGeneratedImagePayload(data);
        const validation = await validateGeneratedPanorama(normalizedImage.imageDataUrl);

        const candidate: GeneratedPanoramaCandidate = {
          imageDataUrl: validation.imageDataUrl,
          revisedPrompt: normalizedImage.revisedPrompt,
          validation,
          attemptNumber
        };

        if (isBetterCandidate(candidate, bestCandidate)) {
          bestCandidate = candidate;
        }

        console.info('[generate-360-scene] Continuity evaluation complete', {
          attemptNumber,
          width: validation.width,
          height: validation.height,
          aspectRatioPassed: validation.aspectRatioPassed,
          wasAspectAdjusted: validation.wasAspectAdjusted,
          seamScore: validation.seamScore,
          stripWidth: validation.stripWidth,
          splitTransitionRatio: validation.splitTransitionRatio,
          centerTransitionDifference: validation.centerTransitionDifference,
          maxTransitionDifference: validation.maxTransitionDifference,
          panoramaSuitabilityPassed: validation.panoramaSuitabilityPassed,
          accepted: validation.accepted,
          minimumRequirementsPassed: validation.minimumRequirementsPassed,
          willRetry: !validation.accepted && attemptNumber < MAX_GENERATION_ATTEMPTS
        });

        if (validation.accepted) {
          return response.status(200).json({
            imageDataUrl: candidate.imageDataUrl,
            revisedPrompt: candidate.revisedPrompt
          });
        }
      } catch (generationError) {
        console.error('[generate-360-scene] Generation attempt failed', {
          attemptNumber,
          message: generationError instanceof Error ? generationError.message : 'Unknown generation error',
          hasBestCandidate: Boolean(bestCandidate)
        });

        if (!bestCandidate) {
          throw generationError;
        }

        break;
      }
    }

    if (!bestCandidate) {
      return response.status(502).json({
        error: USER_FACING_GENERATION_ERROR
      });
    }

    console.info('[generate-360-scene] Returning best available panorama candidate', {
      attemptNumber: bestCandidate.attemptNumber,
      width: bestCandidate.validation.width,
      height: bestCandidate.validation.height,
      seamScore: bestCandidate.validation.seamScore,
      splitTransitionRatio: bestCandidate.validation.splitTransitionRatio,
      minimumRequirementsPassed: bestCandidate.validation.minimumRequirementsPassed
    });

    if (!bestCandidate.validation.minimumRequirementsPassed) {
      return response.status(502).json({
        error: USER_FACING_GENERATION_ERROR
      });
    }

    return response.status(200).json({
      imageDataUrl: bestCandidate.imageDataUrl,
      revisedPrompt: bestCandidate.revisedPrompt
    });
  } catch (error) {
    console.error('Scene generation route failed:', error);
    return response.status(502).json({
      error: USER_FACING_GENERATION_ERROR
    });
  }
}
