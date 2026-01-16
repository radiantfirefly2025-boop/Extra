
import { GoogleGenAI, Type } from "@google/genai";
import { AIInsight } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const FALLBACK_INSIGHTS: AIInsight[] = [
  { tip: "Every second counts. Keep moving forward.", urgency: 'medium' },
  { tip: "Focus on the process, not just the clock.", urgency: 'low' },
  { tip: "Small progress is still progress.", urgency: 'low' },
  { tip: "Time is the only currency you can't earn back.", urgency: 'high' }
];

export async function getProductivityInsight(secondsRemaining: number, taskCount: number): Promise<AIInsight> {
  const now = Date.now();
  const lastFetch = localStorage.getItem('tempo_last_fetch');
  const lastData = localStorage.getItem('tempo_last_insight');
  
  // Rate limit: Only call API if 4 hours passed OR task count changed significantly
  // and we have a cached version we can use in the meantime.
  if (lastFetch && lastData) {
    const timePassed = now - parseInt(lastFetch);
    const cooldown = 4 * 60 * 60 * 1000; // 4 hours
    if (timePassed < cooldown) {
      return JSON.parse(lastData);
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
    return result as AIInsight;
  } catch (error: any) {
    // Specifically handle 429 Resource Exhausted
    if (error?.message?.includes('429') || error?.status === 429) {
      console.warn("Gemini Rate Limit Hit. Using cached or fallback insight.");
    } else {
      console.error("Gemini insight failed:", error);
    }
    
    // Return last successful insight if available, otherwise pick a random fallback
    if (lastData) return JSON.parse(lastData);
    return FALLBACK_INSIGHTS[Math.floor(Math.random() * FALLBACK_INSIGHTS.length)];
  }
}
