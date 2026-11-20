import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '15mb' }));

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sanitizeSvgPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length < 4) return null;
  if (!/^[Mm]/.test(trimmed)) return null;
  if (!/[0-9]/.test(trimmed)) return null;
  return trimmed;
}

app.post('/api/generate-laser-design', async (req, res) => {
  try {
    const {
      prompt,
      archetype = 'ornament',
      theme = 'general',
      widthMm = 100,
      heightMm = 100,
      referenceImageBase64,
      referenceMimeType,
    } = req.body ?? {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Please enter a design idea prompt.' });
    }

    const ai = getGeminiClient();

    const systemInstruction = `You are a master CAD vector engineer designing 100% laser-ready SVG paths for an AtomStack X20 Pro 20W diode laser cutter and engraver.
You output clean SVG path 'd' strings inside a normalized 0 0 100 100 coordinate box (x from 2 to 98, y from 2 to 98 so nothing clips).
Follow strict laser-manufacturing rules:
1. cutPaths: Closed continuous outer perimeter paths (ending with Z) and any interior cutout holes or hanging loops (e.g., 4-unit diameter keyring hole near top center if ornament/keychain). Keep cuts structurally connected so pieces don't fall apart unexpectedly.
2. scorePaths: Crisp open or closed vector hairline accent paths (borders, geometric ribs, delicate leaves, inner outlines) rendered as stroked hairlines.
3. engravePaths: Closed filled vector artwork paths (silhouettes, icons, bold botanical leaves, snowflakes, hearts, bunnies, festive motifs) that will be filled solid black for raster/fill engraving.
4. Use clean cubic/quadratic curves (C, Q), arcs (A), lines (L), and M/Z commands with 1-2 decimal precision. Never include XML tags, <svg>, or attributes—ONLY raw path 'd' strings in the arrays.
5. Respect the requested archetype (${archetype}) and seasonal/event theme (${theme}). Make artwork visually balanced, recognizable, and richly detailed for laser crafting.`;

    const userText = `Create a laser-ready design in a 0..100 normalized coordinate space (target physical scale ${widthMm}mm x ${heightMm}mm).
Archetype: ${archetype}
Theme: ${theme}
Idea: ${prompt.trim()}
Include crisp cutPaths (outer silhouette + hanging hole if ornament/keychain/tag), scorePaths (fine vector accent lines), and engravePaths (bold filled graphic motifs). If the prompt explicitly requests a short centerpiece word or phrase, return it in suggestedText; otherwise leave suggestedText empty.`;

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    if (
      typeof referenceImageBase64 === 'string' &&
      referenceImageBase64.length > 0 &&
      typeof referenceMimeType === 'string'
    ) {
      const cleanedBase64 = referenceImageBase64.replace(/^data:[^;]+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: referenceMimeType,
          data: cleanedBase64,
        },
      });
    }
    parts.push({ text: userText });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Short descriptive name of the laser design.',
            },
            cutPaths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Closed SVG path d strings for laser cutting (outer silhouette, hanging holes, cutouts).',
            },
            scorePaths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'SVG path d strings for vector scoring lines and fine borders.',
            },
            engravePaths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Closed SVG path d strings for solid-fill laser engraving motifs.',
            },
            suggestedText: {
              type: Type.STRING,
              description: 'Optional short centerpiece label if explicitly requested in the prompt.',
            },
          },
          required: ['title', 'cutPaths', 'scorePaths', 'engravePaths'],
        },
      },
    });

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      return res.status(502).json({ error: 'Model returned an empty response. Please try refining your prompt.' });
    }

    const parsed = JSON.parse(rawText) as {
      title?: string;
      cutPaths?: unknown[];
      scorePaths?: unknown[];
      engravePaths?: unknown[];
      suggestedText?: string;
    };

    const cutPaths = (parsed.cutPaths ?? []).map(sanitizeSvgPath).filter((p): p is string => Boolean(p));
    const scorePaths = (parsed.scorePaths ?? []).map(sanitizeSvgPath).filter((p): p is string => Boolean(p));
    const engravePaths = (parsed.engravePaths ?? []).map(sanitizeSvgPath).filter((p): p is string => Boolean(p));

    if (cutPaths.length === 0 && scorePaths.length === 0 && engravePaths.length === 0) {
      return res.status(422).json({
        error: 'Could not extract valid vector geometry from the generated design. Try a clearer shape description.',
      });
    }

    return res.json({
      title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : 'AI Laser Design',
      cutPaths,
      scorePaths,
      engravePaths,
      suggestedText: typeof parsed.suggestedText === 'string' ? parsed.suggestedText.trim() : '',
    });
  } catch (err: unknown) {
    console.error('Error generating laser design:', err);
    const message = err instanceof Error ? err.message : 'Failed to generate laser design.';
    const status = message.includes('PERMISSION_DENIED') || message.includes('API_KEY') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

type ChatPersona = 'combined' | 'technician' | 'designer';
type ChatRoutingMode = 'auto' | 'fast' | 'general' | 'deep';

function selectChatModelAndThinking(
  routingMode: ChatRoutingMode,
  latestPrompt: string
): { model: 'gemini-3.1-flash-lite' | 'gemini-4-hydrogen'; thinkingLevel: ThinkingLevel } {
  if (routingMode === 'fast') {
    return { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL };
  }
  if (routingMode === 'deep') {
    return { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.XHIGH };
  }
  if (routingMode === 'general') {
    return { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.HIGH };
  }

  const lower = latestPrompt.toLowerCase();
  const deepKeywords = [
    'kerf',
    'char',
    'charring',
    'burn',
    'focus',
    'air assist',
    'troubleshoot',
    'why',
    'failed',
    'pass',
    'passes',
    'nest',
    'batch',
    'calculate',
    'acrylic',
    'slate',
    'anodized',
    'dither',
    'dpi',
    'power',
    'speed',
  ];
  const fastKeywords = [
    'tagline',
    'quote',
    'phrase',
    'message',
    'short',
    'list',
    'ideas',
    'gift text',
    'title',
    'greeting',
  ];

  const isComplex =
    latestPrompt.length > 140 ||
    deepKeywords.some((kw) => lower.includes(kw));
  if (isComplex) {
    return { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.XHIGH };
  }

  const isFast =
    latestPrompt.length <= 75 &&
    fastKeywords.some((kw) => lower.includes(kw));
  if (isFast) {
    return { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL };
  }

  return { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.HIGH };
}

function buildChatSystemInstruction(
  persona: ChatPersona,
  bedContext?: {
    materialName?: string;
    materialThickness?: string;
    softwareName?: string;
    elementCount?: number;
    selectedSummary?: string | null;
  }
): string {
  const personaGuide =
    persona === 'technician'
      ? `You are an expert AtomStack X20 Pro (20W quad-diode, 400 x 400 mm bed, 0.08 x 0.10 mm spot) laser technician and LightBurn / LaserGRBL / AtomStack Studio specialist. Give exact, practical parameter guidance (mm/min speed, % power, passes, air assist, kerf compensation, material focus, masking tape, and slate/anodized-metal inversion tips).`
      : persona === 'designer'
        ? `You are a creative laser-craft and personalized gift designer specializing in seasonal ornaments (Valentine's Day, Christmas, Easter), wedding & event signage, coasters, and name tags. Give crisp engraving text ideas, layout balance suggestions, font pairings, and AI generator prompt formulations.`
        : `You are BeamForge Studio's All-in-One Laser Craft & AtomStack X20 Pro Advisor, combining deep 20W diode laser hardware mastery (LightBurn, LaserGRBL, AtomStack Studio, kerf, speed/power, dithering) with creative event, seasonal, and gift design expertise.`;

  const contextLines = [
    bedContext?.materialName
      ? `Active Material: ${bedContext.materialName} (${bedContext.materialThickness ?? ''})`
      : null,
    bedContext?.softwareName ? `Target Software: ${bedContext.softwareName}` : null,
    typeof bedContext?.elementCount === 'number'
      ? `Objects on 400x400mm Bed: ${bedContext.elementCount}`
      : null,
    bedContext?.selectedSummary ? `Selected Item: ${bedContext.selectedSummary}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  return `${personaGuide}

Keep responses concise, structured, and immediately actionable inside a narrow workspace side drawer (around 80-220 words unless the user asks for detailed tables or lists). Never invent telemetry or fake file exports.
${contextLines ? `\nCurrent Studio Context: ${contextLines}` : ''}`;
}

app.post('/api/chat', async (req, res) => {
  try {
    const {
      messages,
      persona = 'combined',
      routingMode = 'auto',
      bedContext,
    } = req.body ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Conversation history is empty.' });
    }

    const validTurns = messages
      .filter(
        (m): m is { role: 'user' | 'assistant'; text: string } =>
          Boolean(m) &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.text === 'string' &&
          m.text.trim().length > 0
      )
      .slice(-20);

    if (validTurns.length === 0 || validTurns[validTurns.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'Please enter a message to send.' });
    }

    const latestPrompt = validTurns[validTurns.length - 1].text.trim();
    const { model, thinkingLevel } = selectChatModelAndThinking(
      routingMode as ChatRoutingMode,
      latestPrompt
    );

    const ai = getGeminiClient();
    const contents = validTurns.map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.text.trim() }],
    }));

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: buildChatSystemInstruction(
          persona as ChatPersona,
          bedContext
        ),
        thinkingConfig: { thinkingLevel },
      },
    });

    const reply = (response.text ?? '').trim();
    if (!reply) {
      return res.status(502).json({
        error: 'The assistant returned an empty response. Please try rephrasing.',
      });
    }

    return res.json({
      reply,
      modelUsed: model,
    });
  } catch (err: unknown) {
    console.error('Error in /api/chat:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to reach Gemini assistant.';
    const status =
      message.includes('PERMISSION_DENIED') || message.includes('API_KEY')
        ? 403
        : 500;
    return res.status(status).json({ error: message });
  }
});

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BeamForge Studio running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
