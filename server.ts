/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

// Ensure Gemini API key is available
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY environment variable is missing.");
}

// Initialize Gemini client with proper User-Agent header for telemetry
const ai = new GoogleGenAI({
  apiKey: apiKey || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase body size limits for audio file uploads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // ═══ API ENDPOINTS ═══

  // AI-Driven Chord progression engine endpoint
  app.post('/api/suggest-chord', async (req, res) => {
    try {
      const { chords } = req.body;
      if (!Array.isArray(chords)) {
        res.status(400).json({ error: 'chords must be an array' });
        return;
      }

      const chordString = chords.map(c => `${c.root}${c.type}`).join(', ');
      const prompt = `
        You are a professional session musician and music producer.
        Given this chord progression: ${chordString || 'None (starting fresh)'}.
        Suggest the next single logical chord to continue this sequence in a soulful, professional, and interesting way.
        Return a JSON object with:
        - "root": string (one of: C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
        - "type": string (one of: maj, min, 7, maj7, min7, dim, aug, sus4, 9)
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              root: { 
                type: Type.STRING, 
                description: 'The musical root note, e.g. C or F#' 
              },
              type: { 
                type: Type.STRING, 
                description: 'The chord type/quality, e.g. maj7 or min7' 
              }
            },
            required: ['root', 'type']
          }
        }
      });

      const text = response.text?.trim() || '{}';
      const result = JSON.parse(text);
      res.json(result);
    } catch (error: any) {
      console.error('Suggest chord API failed:', error);
      res.status(500).json({ error: error?.message || 'Failed to suggest next chord' });
    }
  });

  // Audio Analysis adaptation / Sonic parsing endpoint
  app.post('/api/analyze-audio', async (req, res) => {
    try {
      const { audio, mimeType, mode, styleContext } = req.body;
      if (!audio || !mimeType) {
        res.status(400).json({ error: 'audio (base64) and mimeType are required' });
        return;
      }

      const isInterpolation = mode === 'Interpolation';
      const isHumming = mode === 'Humming';

      let promptText = "";
      if (isHumming) {
        promptText = `
          HUMMING TO MIDI MODE:
          The user is humming, singing, or beatboxing a musical idea. Analyze the audio carefully and extract:
          1. The implied chords or harmony of the hummed phrase.
          2. The general character, tempo feel, and rhythm.
          
          Convert these into:
          - hummedChords: array of objects { root: string, type: string, duration: number } representing the implied chord progression (4-8 chords). Each chord root should be standard (C, C#, D, D#, E, F, F#, G, G#, A, A#, B) and type should be standard (maj, min, 7, maj7, min7, dim, aug, sus4, 9) and duration is beats (e.g. 4).
          - hummedMelody: A descriptive summary string of the lead melody notes, rhythm, and timing.
          - genre: A suitable genre like "Jazz", "Soul", "Lofi", "Funk", etc.
          - vibe: A suitable vibe like "Chill", "Smooth", "Gritty", "Lush", etc.
          - groove: An integer from 0 to 100.
          - sparseness: An integer from 0 to 100.
          - pocket: An integer from 0 to 100.
          
          Return a JSON object matching this schema.
        `;
      } else if (isInterpolation) {
        promptText = `
          HARMONIC INTERPOLATION MODE:
          Analyze this audio recording and extract its harmonic essence (key, mood, chord movements).
          Generate a BRAND NEW, legally distinct chord progression (4-8 chords) that evokes the exact same emotional response, feeling, and tension as the original, but is not a direct plagiarized copy.
          Use modified extensions, different intervals, or creative re-harmonization.
          
          Return a JSON object with:
          - genre: string
          - vibe: string
          - groove: number (0-100)
          - sparseness: number (0-100)
          - pocket: number (0-100)
          - interpolatedChords: array of objects { root: string, type: string, duration: number } representing the new progression.
        `;
      } else {
        promptText = `
          ADAPTIVE SESSION PLAYER STYLE ANALYSIS:
          Analyze this audio reference. 
          ${styleContext ? `The user has also requested adaptation context: "${styleContext}".` : ''}
          Determine the musical groove, feel, pocket, and performance parameters so that an AI session musician can accompany it perfectly.
          
          Extract and return:
          - genre: string (e.g., "Jazz", "Soul", "Funk", "Hip Hop", "R&B", "House", "Ambient", "Synthwave", "Rock")
          - vibe: string (e.g., "Smooth", "Gritty", "Chill", "Energetic", "Dark", "Warm", "Lush")
          - groove: number (0-100, where 0 is rigid/stiff and 100 is highly swung/grooving)
          - sparseness: number (0-100, where 0 is extremely busy and 100 is highly sparse/minimal)
          - pocket: number (0-100, where 0 is loose/behind-the-beat and 100 is perfectly on-the-grid/quantized)
          
          Return a JSON object matching this schema.
        `;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
          {
            inlineData: {
              mimeType,
              data: audio
            }
          },
          { text: promptText }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              genre: { type: Type.STRING },
              vibe: { type: Type.STRING },
              groove: { type: Type.INTEGER },
              sparseness: { type: Type.INTEGER },
              pocket: { type: Type.INTEGER },
              interpolatedChords: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    root: { type: Type.STRING },
                    type: { type: Type.STRING },
                    duration: { type: Type.INTEGER }
                  },
                  required: ['root', 'type', 'duration']
                }
              },
              hummedChords: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    root: { type: Type.STRING },
                    type: { type: Type.STRING },
                    duration: { type: Type.INTEGER }
                  },
                  required: ['root', 'type', 'duration']
                }
              },
              hummedMelody: { type: Type.STRING }
            },
            required: ['genre', 'vibe', 'groove', 'sparseness', 'pocket']
          }
        }
      });

      const text = response.text?.trim() || '{}';
      const result = JSON.parse(text);
      res.json(result);
    } catch (error: any) {
      console.error('Analyze audio API failed:', error);
      res.status(500).json({ error: error?.message || 'Failed to analyze audio' });
    }
  });

  // ═══ VITE OR STATIC ASSETS SERVING ═══

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
