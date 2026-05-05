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

function getGlobalBuffer() {
  const globalBuffer = (globalThis as unknown as {
    Buffer?: {
      from: (value: ArrayBuffer) => {
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
    'Create a seamless 2:1 equirectangular panoramic environment for a 360-degree XR learning editor.',
    'The image should feel immersive, wide, continuous, and suitable as the surrounding scene media for learner exploration.',
    'Avoid framed composition, posters, close-up subjects, split panels, visible borders, or cropped single-object layouts.',
    `User request: ${prompt}`
  ].join('\n\n');
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
    const openAIResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: buildPanoramaPrompt(prompt),
        n: 1,
        size: '1536x1024',
        quality: 'medium',
        output_format: 'png'
      })
    });

    const data = (await openAIResponse.json().catch(() => ({}))) as OpenAIImageGenerationResponse;
    const generatedImage = data.data?.[0];
    console.info('[generate-360-scene] OpenAI response received', {
      status: openAIResponse.status,
      ok: openAIResponse.ok,
      topLevelKeys: Object.keys(data ?? {}),
      firstImageKeys: generatedImage ? Object.keys(generatedImage) : [],
      hasBase64Image: Boolean(generatedImage?.b64_json),
      hasImageUrl: Boolean(generatedImage?.url)
    });

    if (!openAIResponse.ok) {
      console.error('OpenAI image generation failed:', data.error?.message ?? openAIResponse.statusText);
      return response.status(502).json({
        error: USER_FACING_GENERATION_ERROR
      });
    }

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
      return response.status(502).json({
        error: USER_FACING_GENERATION_ERROR
      });
    }

    return response.status(200).json({
      imageDataUrl,
      revisedPrompt: generatedImage.revised_prompt
    });
  } catch (error) {
    console.error('Scene generation route failed:', error);
    return response.status(502).json({
      error: USER_FACING_GENERATION_ERROR
    });
  }
}
