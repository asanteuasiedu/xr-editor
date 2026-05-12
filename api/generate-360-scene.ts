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
const MIN_EDGE_STRIP_WIDTH = 12;
const MAX_EDGE_STRIP_WIDTH = 24;

type GeneratedPanoramaCandidate = {
  imageDataUrl: string;
  revisedPrompt?: string;
  seamScore: number | null;
  attemptNumber: number;
};

type PanoramaContinuityEvaluation = {
  seamScore: number;
  stripWidth: number;
  width: number;
  height: number;
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
    'Create a seamless 360-degree immersive panoramic environment intended for XR viewing.',
    'The result must be a full equirectangular-style wraparound panorama with natural left-to-right edge continuity and no visible seam.',
    'The far left and far right edges must connect naturally as one continuous environment with matching horizon, lighting, architecture, landscape, vegetation, sky, and perspective.',
    'Avoid split compositions, collage-like layouts, mismatched halves, duplicated structures at the seam, abrupt perspective breaks, cropped framing, borders, or sudden changes in lighting, architecture, trees, buildings, terrain, or skyline across the wrap boundary.',
    'Render the environment in HD / high-detail quality with spatially coherent lighting, environmental continuity, and convincing depth across the full panorama.',
    'The result should feel like an empty immersive environment ready for educational XR authoring and panoramic exploration.',
    'Do not include people, humans, faces, crowds, bodies, silhouettes, characters, or portraits.',
    'Do not include readable text, labels, captions, signs, logos, watermarks, UI elements, interface overlays, or branded graphics.',
    'Avoid framed artwork, poster-like layouts, multi-panel compositions, inset views, fisheye framing, and any non-equirectangular composition cues.',
    `User scene concept: ${prompt}`
  ].join('\n\n');
}

function buildAttemptPrompt(prompt: string, attemptNumber: number) {
  if (attemptNumber <= 1) {
    return buildPanoramaPrompt(prompt);
  }

  return [
    buildPanoramaPrompt(prompt),
    'Important correction: the previous attempt had a visible wrap seam. Regenerate this as a more continuous panoramic environment where the left and right image edges connect naturally with no abrupt break, duplicated structures, perspective jump, or lighting shift at the seam.'
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

async function decodePngDataUrl(dataUrl: string) {
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

  return {
    width,
    height,
    pixels
  };
}

async function evaluatePanoramaContinuity(imageDataUrl: string): Promise<PanoramaContinuityEvaluation> {
  const decodedImage = await decodePngDataUrl(imageDataUrl);
  const stripWidth = Math.min(
    MAX_EDGE_STRIP_WIDTH,
    Math.max(MIN_EDGE_STRIP_WIDTH, Math.round(decodedImage.width * 0.012))
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

  if (candidate.seamScore === null) {
    return currentBest.seamScore === null && candidate.attemptNumber < currentBest.attemptNumber;
  }

  if (currentBest.seamScore === null) {
    return true;
  }

  return candidate.seamScore < currentBest.seamScore;
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
    promptLength: prompt.length
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
        let seamEvaluation: PanoramaContinuityEvaluation | null = null;

        try {
          seamEvaluation = await evaluatePanoramaContinuity(normalizedImage.imageDataUrl);
        } catch (continuityError) {
          console.warn('[generate-360-scene] Continuity scoring skipped', {
            attemptNumber,
            message:
              continuityError instanceof Error ? continuityError.message : 'Unknown continuity error'
          });
        }

        const candidate: GeneratedPanoramaCandidate = {
          imageDataUrl: normalizedImage.imageDataUrl,
          revisedPrompt: normalizedImage.revisedPrompt,
          seamScore: seamEvaluation?.seamScore ?? null,
          attemptNumber
        };

        if (isBetterCandidate(candidate, bestCandidate)) {
          bestCandidate = candidate;
        }

        const accepted = candidate.seamScore === null || candidate.seamScore <= ACCEPTABLE_SEAM_SCORE;
        console.info('[generate-360-scene] Continuity evaluation complete', {
          attemptNumber,
          seamScore: candidate.seamScore,
          stripWidth: seamEvaluation?.stripWidth ?? null,
          width: seamEvaluation?.width ?? null,
          height: seamEvaluation?.height ?? null,
          accepted,
          willRetry: !accepted && attemptNumber < MAX_GENERATION_ATTEMPTS
        });

        if (accepted) {
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
      seamScore: bestCandidate.seamScore
    });

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
