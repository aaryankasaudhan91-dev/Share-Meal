
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getFoodSafetyTips = async (foodName: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Provide brief, bulleted safety and storage tips for donating surplus ${foodName}. Focus on hygiene and safe transport. Keep it under 60 words.`,
      config: {
        temperature: 0.7,
      },
    });
    return response.text || "Keep food covered and maintain proper temperature during transport.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Ensure food is handled with clean hands and stored in food-grade containers.";
  }
};

export interface ImageAnalysisResult {
  isSafe: boolean;
  reasoning: string;
  detectedFoodName: string;
  confidence: number;
}

export const analyzeFoodSafetyImage = async (base64Data: string): Promise<ImageAnalysisResult> => {
  try {
    const data = base64Data.split(',')[1] || base64Data;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: data,
          },
        },
        {
          text: "Analyze this image of food intended for donation. Is it visually safe and edible? Look for signs of spoilage, mold, or improper handling. Detect the type of food. Respond in JSON format.",
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSafe: { type: Type.BOOLEAN, description: "Whether the food appears visually safe to eat" },
            reasoning: { type: Type.STRING, description: "Brief explanation of the visual assessment" },
            detectedFoodName: { type: Type.STRING, description: "Name/type of the food detected" },
            confidence: { type: Type.NUMBER, description: "Confidence score from 0 to 1" }
          },
          required: ["isSafe", "reasoning", "detectedFoodName", "confidence"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return result as ImageAnalysisResult;
  } catch (error) {
    console.error("Gemini Image Analysis Error:", error);
    return {
      isSafe: true,
      reasoning: "Visual check unavailable. Please manually ensure food is fresh and safe.",
      detectedFoodName: "",
      confidence: 0
    };
  }
};

export interface ReverseGeocodeResult {
  line1: string;
  line2: string;
  landmark: string;
  pincode: string;
}

export const reverseGeocode = async (lat: number, lng: number): Promise<ReverseGeocodeResult | null> => {
  try {
    // Note: Google Maps grounding is used here to get accurate place info.
    // Maps grounding is only supported in Gemini 2.5 series models.
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `What is the specific street address, area name, nearby landmark, and postal code for coordinates: Latitude ${lat}, Longitude ${lng}? 
      Respond ONLY with a JSON object containing keys: line1, line2, landmark, pincode.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: lat,
              longitude: lng
            }
          }
        }
      },
    });

    // Extracting the potential JSON from text because responseMimeType is not allowed with googleMaps tool.
    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    console.error("Reverse Geocoding Error:", error);
    return null;
  }
};

export const getRouteInsights = async (location: string, userLat?: number, userLng?: number) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Provide a quick summary of the location: "${location}". Identify any major landmarks nearby to help a delivery volunteer find it. If coordinates are provided, consider them the starting point.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: userLat && userLng ? { latitude: userLat, longitude: userLng } : undefined
          }
        }
      },
    });

    const mapsUrl = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.find(c => c.maps)?.maps?.uri;
    return {
      text: response.text || "Location found. Use map for precise navigation.",
      mapsUrl: mapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`
    };
  } catch (error) {
    console.error("Maps Grounding Error:", error);
    return {
      text: "Check location on Google Maps for the best route.",
      mapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`
    };
  }
};
