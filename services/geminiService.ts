
import { GoogleGenAI, Type } from "@google/genai";
import { AIInsight } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const FALLBACK_INSIGHTS: AIInsight[] = [
  { tip: "Every second counts. Keep moving forward.", urgency: 'medium' },
  { tip: "Focus on the process, not just the clock.", urgency: 'low' },
  { tip: "Time is the only currency you can't earn back.", urgency: 'high' },
  { tip: "Great things are done by a series of small things brought together.", urgency: 'low' }
];

export async function getProductivityInsight(secondsRemaining: number, taskCount: number): Promise<AIInsight & { source: 'api' | 'cache' | 'fallback' }> {
  const now = Date.now();
  const lastFetch = localStorage.getItem('tempo_last_fetch');
  const lastData = localStorage.getItem('tempo_last_insight');
  const lockUntil = localStorage.getItem('tempo_api_lock');

  // 1. Check if we are in a "Cool Down" period after a 429 error
  if (lockUntil && now < parseInt(lockUntil)) {
    console.warn("API is currently cooling down due to rate limits.");
    if (lastData) return { ...JSON.parse(lastData), source: 'cache' };
    return { ...FALLBACK_INSIGHTS[0], source: 'fallback' };
  }

  // 2. Check if we have a fresh enough cache (within 6 hours)
  if (lastFetch && lastData) {
    const timePassed = now - parseInt(lastFetch);
    const cooldown = 6 * 60 * 60 * 1000; // 6 hours cache for productivity tips
    if (timePassed < cooldown) {
      return { ...JSON.parse(lastData), source: 'cache' };
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Context: ${secondsRemaining} seconds left today, ${taskCount} active tasks. Task: Give a short, punchy productivity tip (max 10 words). Tone: Stoic.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tip: { type: Type.STRING },
            urgency: { type: Type.STRING, enum: ['low', 'medium', 'high'] }
          },
          required: ["tip", "urgency"]
        }
      }
    });

    const result = JSON.parse(response.text);
    localStorage.setItem('tempo_last_fetch', now.toString());
    localStorage.setItem('tempo_last_insight', JSON.stringify(result));
    localStorage.removeItem('tempo_api_lock'); // Reset lock on success
    return { ...result, source: 'api' };
  } catch (error: any) {
    if (error?.message?.includes('429') || error?.status === 429) {
      // Set a 1-hour lock if we hit quota
      const oneHourLock = now + (60 * 60 * 1000);
      localStorage.setItem('tempo_api_lock', oneHourLock.toString());
      console.warn("429 Exhausted: Locking API for 1 hour.");
    }
    
    if (lastData) return { ...JSON.parse(lastData), source: 'cache' };
    return { ...FALLBACK_INSIGHTS[Math.floor(Math.random() * FALLBACK_INSIGHTS.length)], source: 'fallback' };
  }
}
