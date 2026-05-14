import sharp from 'sharp';

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

type OpenAIResponsesTextResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

type GenerationRequestMode = 'generate' | 'improve';
type PlannerMode = 'planner' | 'static';

type AttemptDiagnostic = {
  attemptNumber: number;
  seamScore: number;
  seamScoreBeforeRepair: number;
  seamScoreAfterRepair: number | null;
  repairAttempted: boolean;
  repairedSelected: boolean;
  aspectRatioPassed: boolean;
};

type GenerationDebugMetadata = {
  generationMode: GenerationRequestMode;
  plannerMode: PlannerMode;
  plannerSucceeded: boolean;
  plannerModel: string | null;
  plannedPromptLength: number;
  imageModel: string;
  attempts: number;
  attemptSeamScores: number[];
  finalSeamScore: number | null;
  selectedAttempt: number | null;
  repairApplied: boolean;
};

type GeneratedPanoramaAttempt = {
  attemptNumber: number;
  revisedPrompt?: string;
  imageDataUrl: string;
  seamScore: number;
  seamScoreBeforeRepair: number;
  seamScoreAfterRepair: number | null;
  repairAttempted: boolean;
  repairedSelected: boolean;
  blendHalfWidth: number | null;
  originalWidth: number | null;
  originalHeight: number | null;
  normalizedWidth: number;
  normalizedHeight: number;
  aspectRatioPassed: boolean;
};

const USER_FACING_GENERATION_ERROR =
  'Could not generate the scene right now. Try another prompt or try again shortly.';
const PLANNER_MODEL = getEnvValue('OPENAI_PANORAMA_PLANNER_MODEL') || 'gpt-4.1-mini';
const ENABLE_PANORAMA_PLANNER = getEnvValue('ENABLE_PANORAMA_PLANNER') !== 'false';
const IMAGE_MODEL = getEnvValue('OPENAI_IMAGE_MODEL') || 'gpt-image-1';
const IMAGE_SIZE = '1536x1024';
const IMAGE_QUALITY = 'medium';
const IMAGE_OUTPUT_FORMAT = 'png';
const NORMAL_MAX_ATTEMPTS = 1;
const IMPROVE_MAX_ATTEMPTS = 1;
const DEBUG_MAX_ATTEMPTS = 2;
const MAX_ROUTE_MS = 25_000;
const NORMALIZED_WIDTH = 1536;
const NORMALIZED_HEIGHT = 768;
const ANALYSIS_WIDTH = 512;
const ANALYSIS_HEIGHT = 256;
const ANALYSIS_STRIP_WIDTH = 12;
const ACCEPTABLE_SEAM_SCORE = 35;
const MIN_SEAM_BLEND_HALF_WIDTH = 48;
const SEAM_BLEND_HALF_WIDTH_RATIO = 0.04;

function getGlobalBuffer() {
  const globalBuffer = (globalThis as unknown as {
    Buffer?: {
      from: (
        value: ArrayBuffer | Uint8Array | string,
        encoding?: string
      ) => Uint8Array & {
        toString: (encoding: string) => string;
      };
    };
  }).Buffer;

  return globalBuffer ?? null;
}

function parseJsonBody(body: unknown) {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as unknown;
    } catch {
      return null;
    }
  }

  return body;
}

function getEnvValue(name: string) {
  const globalProcess = (globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
  }).process;

  return globalProcess?.env?.[name];
}

function getPromptFromBody(body: unknown) {
  const parsedBody = parseJsonBody(body);
  if (!parsedBody || typeof parsedBody !== 'object' || !('prompt' in parsedBody)) {
    return '';
  }

  const prompt = (parsedBody as { prompt?: unknown }).prompt;
  return typeof prompt === 'string' ? prompt.trim() : '';
}

function getGenerationModeFromBody(body: unknown): GenerationRequestMode {
  const parsedBody = parseJsonBody(body);
  if (!parsedBody || typeof parsedBody !== 'object' || !('mode' in parsedBody)) {
    return 'generate';
  }

  return (parsedBody as { mode?: unknown }).mode === 'improve' ? 'improve' : 'generate';
}

function getPreviousIssueFromBody(body: unknown) {
  const parsedBody = parseJsonBody(body);
  if (!parsedBody || typeof parsedBody !== 'object' || !('previousIssue' in parsedBody)) {
    return '';
  }

  const previousIssue = (parsedBody as { previousIssue?: unknown }).previousIssue;
  return typeof previousIssue === 'string' ? previousIssue.trim() : '';
}

function getDebugFlagFromBody(body: unknown) {
  const parsedBody = parseJsonBody(body);
  if (!parsedBody || typeof parsedBody !== 'object' || !('debug' in parsedBody)) {
    return false;
  }

  return (parsedBody as { debug?: unknown }).debug === true;
}

function getPlannerModeFromBody(body: unknown): PlannerMode {
  const parsedBody = parseJsonBody(body);
  if (!parsedBody || typeof parsedBody !== 'object' || !('plannerMode' in parsedBody)) {
    return 'planner';
  }

  return (parsedBody as { plannerMode?: unknown }).plannerMode === 'static' ? 'static' : 'planner';
}

function buildPanoramaGenerationPrompt(
  userPrompt: string,
  mode: GenerationRequestMode = 'generate',
  previousIssue = ''
) {
  const promptSections = [
    'Create a TRUE full 360-degree equirectangular panoramic image for immersive XR viewing.',
    'The image must be designed as a continuous wraparound panorama for a 360 viewer, not as a standard flat landscape image.',
    'Target a true 2:1 equirectangular panorama composition. The flat image should appear horizontally stretched or distorted in the way proper equirectangular panoramas do, but it should feel spatially correct when viewed inside a 360-degree panorama viewer.',
    'The left edge and right edge must connect seamlessly as one continuous environment. There must be no visible seam, no abrupt change, no split composition, no mismatched sky, no mismatched horizon, no mismatched buildings, no mismatched trees, no mirrored edge break, and no hard perspective transition at the wrap boundary.',
    'Avoid little-planet projection, fisheye circle, radial collapse, center pinch, vortex, tunnel effect, spiral geometry, top-down bowl distortion, split panorama, collage, two-scene image, framed photo, bordered image, cropped composition, or ordinary wide-angle photograph.',
    'Compose the scene at human eye level with a stable horizon and coherent spatial continuity across the entire 360-degree environment.',
    'Do not include people, humans, faces, bodies, silhouettes, crowds, readable text, labels, signs, logos, UI elements, captions, or watermarks.',
    'Produce a high-detail, HD, clean immersive environment suitable for educational XR authoring.'
  ];

  if (mode === 'improve') {
    promptSections.push(
      'This is a regeneration request because the previous output may have failed as a panorama.',
      previousIssue
        ? `Correct the previous failure by making the new image more clearly equirectangular and continuous. Pay extra attention to this issue: ${previousIssue}.`
        : 'Correct the previous failure by making the new image more clearly equirectangular and continuous.',
      'Prioritize exact wraparound continuity, natural left-right seam matching, stable horizon, no radial center pinch, no little-planet projection, no split scene, and no hard seam. The result should load cleanly into a 360-degree viewer.'
    );
  }

  promptSections.push(`User scene concept:\n${userPrompt}`);

  return promptSections.join('\n\n');
}

function hasTimeForAnotherExpensiveStep(startedAt: number, budgetMs = MAX_ROUTE_MS) {
  return Date.now() - startedAt < budgetMs;
}

function getRouteDurationMs(startedAt: number) {
  return Date.now() - startedAt;
}

function buildAttemptPrompt(
  panoramaBrief: string,
  attemptNumber: number
) {
  if (attemptNumber <= 1) {
    return panoramaBrief;
  }

  return [
    panoramaBrief,
    'Important correction for this attempt:',
    'The previous generated panorama did not pass seam-continuity validation. Regenerate the scene as a stronger true equirectangular 360 panorama with natural left-right edge continuity. Make the left and right edges visually match as one continuous environment. Avoid center pinch, radial collapse, split scenes, little-planet projection, and abrupt edge transitions.'
  ].join('\n\n');
}

function extractResponsesOutputText(response: OpenAIResponsesTextResponse) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const nestedText = response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text?.trim() ?? '')
    .filter(Boolean)
    .join('\n')
    .trim();

  return nestedText || '';
}

async function createPanoramaGenerationBrief(params: {
  userPrompt: string;
  mode?: GenerationRequestMode;
  previousIssue?: string;
  apiKey: string;
}) {
  const { userPrompt, mode = 'generate', previousIssue = '', apiKey } = params;
  const fallbackPrompt = buildPanoramaGenerationPrompt(userPrompt, mode, previousIssue);
  const plannerInput = [
    'You are an expert panorama prompt planner for XR scene generation.',
    'Rewrite the user prompt into a concise but detailed production brief for an image generation model.',
    'Return only the final image prompt text. Do not return JSON, markdown, headings, bullets, explanations, or surrounding commentary.',
    'The brief must strongly enforce all of the following:',
    '- TRUE full 360-degree equirectangular panorama',
    '- exact 2:1 panorama intent',
    '- continuous immersive XR viewer compatibility',
    '- strong left/right edge continuity',
    '- stable horizon',
    '- human eye-level perspective unless the prompt clearly requires otherwise',
    '- continuous environment across the full horizontal frame',
    '- consistent sky and horizon across the wrap boundary',
    '- edge content that remains visually compatible across the left and right boundaries',
    '- wide equirectangular projection that may look stretched flat but should feel correct in a 360 viewer',
    '- no people, humans, faces, bodies, silhouettes, or crowds',
    '- no readable text, labels, logos, UI, captions, watermarks, or readable signage',
    '- no little-planet projection, fisheye circle, center pinch, vortex, tunnel, spiral, split composition, collage, two-scene image, or ordinary flat landscape photo'
  ];

  if (mode === 'improve') {
    plannerInput.push(
      'This is a regeneration request because the previous panorama may have had a visible seam, weak left-right continuity, warped little-planet behavior, fisheye failure, or unstable viewer structure.',
      previousIssue
        ? `Pay special attention to this previous issue: ${previousIssue}.`
        : 'Prioritize viewer-safe panorama structure over artistic drama.'
    );
  }

  plannerInput.push(`User prompt:\n${userPrompt}`);

  const plannerResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: PLANNER_MODEL,
      input: plannerInput.join('\n\n'),
      max_output_tokens: 450
    })
  });

  const plannerData = (await plannerResponse.json().catch(() => ({}))) as OpenAIResponsesTextResponse;
  const plannedPrompt = extractResponsesOutputText(plannerData);

  if (!plannerResponse.ok) {
    throw new Error(plannerData.error?.message ?? plannerResponse.statusText);
  }

  if (!plannedPrompt) {
    throw new Error('Planner returned an empty panorama brief.');
  }

  return {
    plannedPrompt,
    fallbackPrompt
  };
}

function bytesToDataUrl(bytes: Uint8Array, mimeType: string) {
  const globalBuffer = getGlobalBuffer();
  if (!globalBuffer) {
    throw new Error('Buffer is not available in this runtime.');
  }

  return `data:${mimeType};base64,${globalBuffer.from(bytes).toString('base64')}`;
}

async function fetchImageBytes(url: string) {
  const imageResponse = await fetch(url);
  if (!imageResponse.ok) {
    throw new Error(`Image download failed with status ${imageResponse.status}.`);
  }

  return new Uint8Array(await imageResponse.arrayBuffer());
}

async function getImageMetadata(bytes: Uint8Array) {
  const metadata = await sharp(bytes).metadata();

  return {
    width: metadata.width ?? null,
    height: metadata.height ?? null
  };
}

function isTwoToOne(width: number | null, height: number | null) {
  return width === NORMALIZED_WIDTH && height === NORMALIZED_HEIGHT;
}

async function normalizePanoramaToTwoToOne(bytes: Uint8Array) {
  // gpt-image-1 supports fixed landscape outputs such as 1536x1024.
  // Phase 2 normalizes that valid source image into an exact 2:1 panorama
  // for the viewer; this is not seam repair or true projection correction.
  const buffer = await sharp(bytes)
    .resize({
      width: NORMALIZED_WIDTH,
      height: NORMALIZED_HEIGHT,
      fit: 'cover',
      position: 'centre'
    })
    .png()
    .toBuffer();

  return new Uint8Array(buffer);
}

async function decodeImageToRawRgba(bytes: Uint8Array) {
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data,
    width: info.width,
    height: info.height,
    channels: 4 as const
  };
}

function rollImageHorizontally(
  pixels: Uint8Array,
  width: number,
  height: number,
  channels: number,
  shiftX: number
) {
  const rolled = new Uint8Array(pixels.length);
  const normalizedShift = ((shiftX % width) + width) % width;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = (x + normalizedShift) % width;
      const sourceOffset = (y * width + sourceX) * channels;
      const targetOffset = (y * width + x) * channels;

      for (let channel = 0; channel < channels; channel += 1) {
        rolled[targetOffset + channel] = pixels[sourceOffset + channel];
      }
    }
  }

  return rolled;
}

async function encodeRawRgbaToPng(
  pixels: Uint8Array,
  width: number,
  height: number,
  channels: 4
) {
  const buffer = await sharp(pixels, {
    raw: {
      width,
      height,
      channels
    }
  })
    .png()
    .toBuffer();

  return new Uint8Array(buffer);
}

async function repairPanoramaSeam(bytes: Uint8Array) {
  const decoded = await decodeImageToRawRgba(bytes);
  const halfWidth = Math.floor(decoded.width / 2);
  const center = halfWidth;
  const blendHalfWidth = Math.min(
    Math.max(1, Math.floor(decoded.width / 4)),
    Math.max(MIN_SEAM_BLEND_HALF_WIDTH, Math.round(decoded.width * SEAM_BLEND_HALF_WIDTH_RATIO))
  );
  const rolled = rollImageHorizontally(decoded.data, decoded.width, decoded.height, decoded.channels, halfWidth);
  const repairedRolled = new Uint8Array(rolled);

  for (let y = 0; y < decoded.height; y += 1) {
    for (let offset = 0; offset < blendHalfWidth; offset += 1) {
      const leftX = center - 1 - offset;
      const rightX = center + offset;

      if (leftX < 0 || rightX >= decoded.width) {
        continue;
      }

      const blendProgress = 1 - offset / blendHalfWidth;
      const blendStrength = Math.pow(blendProgress, 1.35) * 0.82;
      const leftOffset = (y * decoded.width + leftX) * decoded.channels;
      const rightOffset = (y * decoded.width + rightX) * decoded.channels;

      for (let channel = 0; channel < decoded.channels; channel += 1) {
        const leftValue = rolled[leftOffset + channel];
        const rightValue = rolled[rightOffset + channel];
        const averageValue = Math.round((leftValue + rightValue) / 2);

        repairedRolled[leftOffset + channel] = Math.round(
          leftValue * (1 - blendStrength) + averageValue * blendStrength
        );
        repairedRolled[rightOffset + channel] = Math.round(
          rightValue * (1 - blendStrength) + averageValue * blendStrength
        );
      }
    }
  }

  const repaired = rollImageHorizontally(
    repairedRolled,
    decoded.width,
    decoded.height,
    decoded.channels,
    decoded.width - halfWidth
  );
  const repairedBytes = await encodeRawRgbaToPng(
    repaired,
    decoded.width,
    decoded.height,
    decoded.channels
  );

  return {
    imageBytes: repairedBytes,
    blendHalfWidth
  };
}

async function calculateSeamScore(bytes: Uint8Array) {
  const { data, info } = await sharp(bytes)
    .resize({
      width: ANALYSIS_WIDTH,
      height: ANALYSIS_HEIGHT,
      fit: 'fill'
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const stripWidth = Math.min(ANALYSIS_STRIP_WIDTH, Math.max(1, Math.floor(info.width / 8)));
  let differenceSum = 0;
  let sampleCount = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < stripWidth; x += 1) {
      const leftOffset = (y * info.width + x) * info.channels;
      const rightOffset = (y * info.width + (info.width - stripWidth + x)) * info.channels;
      const redDifference = Math.abs(data[leftOffset] - data[rightOffset]);
      const greenDifference = Math.abs(data[leftOffset + 1] - data[rightOffset + 1]);
      const blueDifference = Math.abs(data[leftOffset + 2] - data[rightOffset + 2]);

      differenceSum += (redDifference + greenDifference + blueDifference) / 3;
      sampleCount += 1;
    }
  }

  return sampleCount === 0 ? 255 : Math.round((differenceSum / sampleCount) * 100) / 100;
}

async function normalizeGeneratedImagePayload(data: OpenAIImageGenerationResponse) {
  const generatedImage = data.data?.[0];
  let imageBytes: Uint8Array | null = null;

  if (generatedImage?.b64_json) {
    const globalBuffer = getGlobalBuffer();
    if (!globalBuffer) {
      throw new Error('Buffer is not available in this runtime.');
    }

    imageBytes = new Uint8Array(globalBuffer.from(generatedImage.b64_json, 'base64'));
  } else if (generatedImage?.url) {
    imageBytes = await fetchImageBytes(generatedImage.url);
  }

  if (!imageBytes) {
    throw new Error('No usable image payload was returned from generation.');
  }

  return {
    imageBytes,
    revisedPrompt: generatedImage?.revised_prompt
  };
}

async function processGeneratedImage(
  imageBytes: Uint8Array,
  revisedPrompt: string | undefined,
  attemptNumber: number,
  options: {
    runQualityControl: boolean;
    allowRepair: boolean;
    startedAt: number;
  }
): Promise<GeneratedPanoramaAttempt> {
  const originalMetadata = await getImageMetadata(imageBytes);
  const normalizedBytes = await normalizePanoramaToTwoToOne(imageBytes);
  const normalizedMetadata = await getImageMetadata(normalizedBytes);
  const seamScoreBeforeRepair = options.runQualityControl ? await calculateSeamScore(normalizedBytes) : 0;
  let finalBytes = normalizedBytes;
  let seamScore = seamScoreBeforeRepair;
  let seamScoreAfterRepair: number | null = null;
  let repairAttempted = false;
  let repairedSelected = false;
  let blendHalfWidth: number | null = null;

  if (
    options.runQualityControl &&
    options.allowRepair &&
    seamScoreBeforeRepair > ACCEPTABLE_SEAM_SCORE &&
    hasTimeForAnotherExpensiveStep(options.startedAt)
  ) {
    repairAttempted = true;

    try {
      const repairedResult = await repairPanoramaSeam(normalizedBytes);
      seamScoreAfterRepair = await calculateSeamScore(repairedResult.imageBytes);
      blendHalfWidth = repairedResult.blendHalfWidth;

      if (seamScoreAfterRepair < seamScoreBeforeRepair) {
        finalBytes = repairedResult.imageBytes;
        seamScore = seamScoreAfterRepair;
        repairedSelected = true;
      }
    } catch {
      seamScoreAfterRepair = null;
    }
  }

  const finalMetadata = repairedSelected
    ? await getImageMetadata(finalBytes)
    : normalizedMetadata;
  const imageDataUrl = bytesToDataUrl(finalBytes, 'image/png');

  return {
    attemptNumber,
    revisedPrompt,
    imageDataUrl,
    seamScore,
    seamScoreBeforeRepair,
    seamScoreAfterRepair,
    repairAttempted,
    repairedSelected,
    blendHalfWidth,
    originalWidth: originalMetadata.width,
    originalHeight: originalMetadata.height,
    normalizedWidth: finalMetadata.width ?? NORMALIZED_WIDTH,
    normalizedHeight: finalMetadata.height ?? NORMALIZED_HEIGHT,
    aspectRatioPassed: isTwoToOne(finalMetadata.width, finalMetadata.height)
  };
}

function isBetterAttempt(
  candidate: GeneratedPanoramaAttempt,
  currentBest: GeneratedPanoramaAttempt | null
) {
  if (!currentBest) {
    return true;
  }

  if (candidate.aspectRatioPassed !== currentBest.aspectRatioPassed) {
    return candidate.aspectRatioPassed;
  }

  if (candidate.seamScore !== currentBest.seamScore) {
    return candidate.seamScore < currentBest.seamScore;
  }

  return candidate.attemptNumber < currentBest.attemptNumber;
}

function buildAttemptDiagnostic(attempt: GeneratedPanoramaAttempt): AttemptDiagnostic {
  return {
    attemptNumber: attempt.attemptNumber,
    seamScore: attempt.seamScore,
    seamScoreBeforeRepair: attempt.seamScoreBeforeRepair,
    seamScoreAfterRepair: attempt.seamScoreAfterRepair,
    repairAttempted: attempt.repairAttempted,
    repairedSelected: attempt.repairedSelected,
    aspectRatioPassed: attempt.aspectRatioPassed
  };
}

function buildDebugMetadata(params: {
  plannerMode: PlannerMode;
  plannerSucceeded: boolean;
  plannedPromptLength: number;
  mode: GenerationRequestMode;
  attemptDiagnostics: AttemptDiagnostic[];
  selectedAttempt: GeneratedPanoramaAttempt | null;
}): GenerationDebugMetadata {
  const {
    plannerMode,
    plannerSucceeded,
    plannedPromptLength,
    attemptDiagnostics,
    selectedAttempt
  } = params;

  return {
    generationMode: params.mode,
    plannerMode,
    plannerSucceeded,
    plannerModel: plannerMode === 'planner' ? PLANNER_MODEL : null,
    plannedPromptLength,
    imageModel: IMAGE_MODEL,
    attempts: attemptDiagnostics.length,
    attemptSeamScores: attemptDiagnostics.map((attempt) => attempt.seamScore),
    finalSeamScore: selectedAttempt?.seamScore ?? null,
    selectedAttempt: selectedAttempt?.attemptNumber ?? null,
    repairApplied: selectedAttempt?.repairedSelected ?? false
  };
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const startedAt = Date.now();
  console.info('[generate-360-scene] Route hit', {
    method: request.method,
    maxRouteMs: MAX_ROUTE_MS
  });

  if (request.method !== 'POST') {
    response.setHeader?.('Allow', 'POST');
    return response.status(405).json({ error: 'Use Generate from the editor to create a scene.' });
  }

  const prompt = getPromptFromBody(request.body);
  const mode = getGenerationModeFromBody(request.body);
  const previousIssue = getPreviousIssueFromBody(request.body);
  const debug = getDebugFlagFromBody(request.body);
  const plannerMode = getPlannerModeFromBody(request.body);
  const shouldUseFastPath = mode === 'generate' && !debug;
  const maxAttempts = debug ? DEBUG_MAX_ATTEMPTS : mode === 'improve' ? IMPROVE_MAX_ATTEMPTS : NORMAL_MAX_ATTEMPTS;
  const shouldRunQualityControl = !shouldUseFastPath;
  const shouldAllowDeterministicRepair = !shouldUseFastPath;
  const shouldRunPlanner =
    plannerMode === 'planner' &&
    !shouldUseFastPath &&
    ENABLE_PANORAMA_PLANNER &&
    hasTimeForAnotherExpensiveStep(startedAt);
  console.info('[generate-360-scene] Prompt received', {
    promptLength: prompt.length,
    mode,
    debug,
    plannerMode,
    plannerEnabled: shouldRunPlanner,
    plannerAllowedByEnv: ENABLE_PANORAMA_PLANNER,
    maxAttempts,
    qualityControlEnabled: shouldRunQualityControl
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

  let bestAttempt: GeneratedPanoramaAttempt | null = null;
  const attemptDiagnostics: AttemptDiagnostic[] = [];
  let failurePhase = 'setup';

  try {
    let basePrompt = buildPanoramaGenerationPrompt(prompt, mode, previousIssue);
    let planningSucceeded = false;

    if (shouldRunPlanner) {
      failurePhase = 'planner';
      try {
        const plannerResult = await createPanoramaGenerationBrief({
          userPrompt: prompt,
          mode,
          previousIssue,
          apiKey
        });
        basePrompt = plannerResult.plannedPrompt;
        planningSucceeded = true;
        console.info('[generate-360-scene] Panorama planning succeeded', {
          mode,
          plannerMode,
          plannerModel: PLANNER_MODEL,
          plannedPromptLength: basePrompt.length,
          plannedPromptPreview: basePrompt.slice(0, 200)
        });
      } catch (plannerError) {
        console.warn('[generate-360-scene] Panorama planning failed, using fallback prompt', {
          mode,
          plannerMode,
          plannerModel: PLANNER_MODEL,
          message: plannerError instanceof Error ? plannerError.message : 'Unknown planner error',
          fallbackPromptLength: basePrompt.length
        });
      }
    } else {
      console.info('[generate-360-scene] Static panorama prompt selected', {
        mode,
        plannerMode,
        plannerEnabled: false,
        fallbackPromptLength: basePrompt.length
      });
    }

    for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
      if (!hasTimeForAnotherExpensiveStep(startedAt)) {
        console.warn('[generate-360-scene] Skipping additional expensive work due to route time budget', {
          mode,
          debug,
          plannerMode,
          attemptNumber,
          elapsedMs: getRouteDurationMs(startedAt),
          bestAttemptAvailable: Boolean(bestAttempt)
        });
        break;
      }

      failurePhase = `attempt-${attemptNumber}-prompt`;
      const wrappedPrompt = buildAttemptPrompt(basePrompt, attemptNumber);
      console.info('[generate-360-scene] Wrapped prompt prepared', {
        mode,
        plannerMode,
        attemptNumber,
        promptLength: wrappedPrompt.length,
        planningSucceeded,
        plannerModel: planningSucceeded ? PLANNER_MODEL : null,
        model: IMAGE_MODEL,
        size: IMAGE_SIZE,
        elapsedMs: getRouteDurationMs(startedAt)
      });

      failurePhase = `attempt-${attemptNumber}-image-generation`;
      const openAIResponse = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: IMAGE_MODEL,
          prompt: wrappedPrompt,
          n: 1,
          size: IMAGE_SIZE,
          quality: IMAGE_QUALITY,
          output_format: IMAGE_OUTPUT_FORMAT
        })
      });

      const data = (await openAIResponse.json().catch(() => ({}))) as OpenAIImageGenerationResponse;
      const generatedImage = data.data?.[0];
      console.info('[generate-360-scene] OpenAI response received', {
        mode,
        plannerMode,
        attemptNumber,
        status: openAIResponse.status,
        ok: openAIResponse.ok,
        topLevelKeys: Object.keys(data ?? {}),
        firstImageKeys: generatedImage ? Object.keys(generatedImage) : [],
        hasBase64Image: Boolean(generatedImage?.b64_json),
        hasImageUrl: Boolean(generatedImage?.url)
      });

      if (!openAIResponse.ok) {
        console.error('[generate-360-scene] OpenAI image generation failed', {
          mode,
          plannerMode,
          attemptNumber,
          status: openAIResponse.status,
          message: data.error?.message ?? openAIResponse.statusText
        });
        return response.status(502).json({
          error: USER_FACING_GENERATION_ERROR
        });
      }

      let processedAttempt: GeneratedPanoramaAttempt | null = null;
      try {
        failurePhase = `attempt-${attemptNumber}-normalization`;
        const normalizedImage = await normalizeGeneratedImagePayload(data);
        failurePhase = `attempt-${attemptNumber}-processing`;
        processedAttempt = await processGeneratedImage(
          normalizedImage.imageBytes,
          normalizedImage.revisedPrompt,
          attemptNumber,
          {
            runQualityControl: shouldRunQualityControl,
            allowRepair: shouldAllowDeterministicRepair,
            startedAt
          }
        );
      } catch (processingError) {
        console.error('[generate-360-scene] Image normalization failed', {
          mode,
          plannerMode,
          attemptNumber,
          message: processingError instanceof Error ? processingError.message : 'Unknown processing error'
        });
      }

      if (!processedAttempt) {
        continue;
      }

      attemptDiagnostics.push(buildAttemptDiagnostic(processedAttempt));

      if (isBetterAttempt(processedAttempt, bestAttempt)) {
        bestAttempt = processedAttempt;
      }

      const passedThreshold =
        processedAttempt.aspectRatioPassed &&
        (!shouldRunQualityControl || processedAttempt.seamScore <= ACCEPTABLE_SEAM_SCORE);

      console.info('[generate-360-scene] Attempt analyzed', {
        mode,
        plannerMode,
        attemptNumber,
        originalWidth: processedAttempt.originalWidth,
        originalHeight: processedAttempt.originalHeight,
        normalizedWidth: processedAttempt.normalizedWidth,
        normalizedHeight: processedAttempt.normalizedHeight,
        aspectRatioPassed: processedAttempt.aspectRatioPassed,
        seamScoreBeforeRepair: processedAttempt.seamScoreBeforeRepair,
        repairAttempted: processedAttempt.repairAttempted,
        seamScoreAfterRepair: processedAttempt.seamScoreAfterRepair,
        repairedSelected: processedAttempt.repairedSelected,
        blendHalfWidth: processedAttempt.blendHalfWidth,
        seamScore: processedAttempt.seamScore,
        passedThreshold,
        retryTriggered: !passedThreshold && attemptNumber < maxAttempts && hasTimeForAnotherExpensiveStep(startedAt),
        elapsedMs: getRouteDurationMs(startedAt)
      });

      if (passedThreshold) {
        failurePhase = `attempt-${attemptNumber}-response-assembly`;
        const debugMetadata = debug
          ? buildDebugMetadata({
              plannerMode,
              plannerSucceeded: planningSucceeded,
              plannedPromptLength: basePrompt.length,
              mode,
              attemptDiagnostics,
              selectedAttempt: processedAttempt
            })
          : undefined;

        console.info('[generate-360-scene] Returning accepted panorama attempt', {
          mode,
          plannerMode,
          plannerSucceeded: planningSucceeded,
          imageModel: IMAGE_MODEL,
          attempts: attemptDiagnostics.length,
          returnedAttempt: processedAttempt.attemptNumber,
          repairApplied: processedAttempt.repairedSelected,
          seamScoreBeforeRepair: processedAttempt.seamScoreBeforeRepair,
          seamScoreAfterRepair: processedAttempt.seamScoreAfterRepair,
          repairedSelected: processedAttempt.repairedSelected,
          seamScore: processedAttempt.seamScore,
          routeDurationMs: getRouteDurationMs(startedAt)
        });

        return response.status(200).json({
          imageDataUrl: processedAttempt.imageDataUrl,
          revisedPrompt: processedAttempt.revisedPrompt ?? basePrompt,
          ...(debugMetadata ? { debug: debugMetadata } : {})
        });
      }
    }

    if (!bestAttempt) {
      return response.status(502).json({
        error: USER_FACING_GENERATION_ERROR
      });
    }

    failurePhase = 'best-attempt-response-assembly';
    console.info('[generate-360-scene] Returning best available panorama attempt', {
      mode,
      plannerMode,
      plannerSucceeded: planningSucceeded,
      imageModel: IMAGE_MODEL,
      attempts: attemptDiagnostics.length,
      returnedAttempt: bestAttempt.attemptNumber,
      repairApplied: bestAttempt.repairedSelected,
      originalWidth: bestAttempt.originalWidth,
      originalHeight: bestAttempt.originalHeight,
      normalizedWidth: bestAttempt.normalizedWidth,
      normalizedHeight: bestAttempt.normalizedHeight,
      seamScoreBeforeRepair: bestAttempt.seamScoreBeforeRepair,
      seamScoreAfterRepair: bestAttempt.seamScoreAfterRepair,
      repairedSelected: bestAttempt.repairedSelected,
      seamScore: bestAttempt.seamScore,
      routeDurationMs: getRouteDurationMs(startedAt)
    });

    const debugMetadata = debug
      ? buildDebugMetadata({
          plannerMode,
          plannerSucceeded: planningSucceeded,
          plannedPromptLength: basePrompt.length,
          mode,
          attemptDiagnostics,
          selectedAttempt: bestAttempt
        })
      : undefined;

    return response.status(200).json({
      imageDataUrl: bestAttempt.imageDataUrl,
      revisedPrompt: bestAttempt.revisedPrompt ?? basePrompt,
      ...(debugMetadata ? { debug: debugMetadata } : {})
    });
  } catch (error) {
    const stackPreview =
      error instanceof Error && typeof error.stack === 'string'
        ? error.stack.split('\n').slice(0, 4).join('\n')
        : undefined;

    console.error('[generate-360-scene] Scene generation route failed', {
      mode,
      plannerMode,
      debug,
      failurePhase,
      routeDurationMs: getRouteDurationMs(startedAt),
      errorName: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : 'Unknown error',
      stackPreview
    });
    return response.status(502).json({
      error: USER_FACING_GENERATION_ERROR
    });
  }
}
