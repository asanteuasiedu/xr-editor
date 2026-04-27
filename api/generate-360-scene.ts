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
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
  }>;
  error?: {
    message?: string;
  };
};

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
  if (request.method !== 'POST') {
    response.setHeader?.('Allow', 'POST');
    return response.status(405).json({ error: 'Use Generate from the editor to create a scene.' });
  }

  const prompt = getPromptFromBody(request.body);
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
        model: 'gpt-image-2',
        prompt: buildPanoramaPrompt(prompt),
        n: 1,
        size: '2048x1024',
        quality: 'medium',
        output_format: 'png'
      })
    });

    const data = (await openAIResponse.json().catch(() => ({}))) as OpenAIImageGenerationResponse;

    if (!openAIResponse.ok) {
      console.error('OpenAI image generation failed:', data.error?.message ?? openAIResponse.statusText);
      return response.status(502).json({
        error: 'Could not generate the scene right now. Try another prompt or try again shortly.'
      });
    }

    const generatedImage = data.data?.[0];
    if (!generatedImage?.b64_json) {
      return response.status(502).json({
        error: 'The scene was generated without an image result. Try again.'
      });
    }

    return response.status(200).json({
      imageDataUrl: `data:image/png;base64,${generatedImage.b64_json}`,
      revisedPrompt: generatedImage.revised_prompt
    });
  } catch (error) {
    console.error('Scene generation route failed:', error);
    return response.status(502).json({
      error: 'Scene generation could not finish. Check your connection and try again.'
    });
  }
}
