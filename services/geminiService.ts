
import { GoogleGenAI, Type } from "@google/genai";
import { AIInsight } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export async function getProductivityInsight(secondsRemaining: number, taskCount: number): Promise<AIInsight> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `I have ${secondsRemaining} seconds left in my day and ${taskCount} tasks on my list. Give me a very short, punchy productivity insight or motivational quote (max 15 words) and an urgency level.`,
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
    return result as AIInsight;
  } catch (error) {
    console.error("Gemini insight failed:", error);
    return {
      tip: "Every second counts. Keep moving forward.",
      urgency: 'medium'
    };
  }
}
