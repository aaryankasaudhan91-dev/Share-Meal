import { GoogleGenAI, Type } from "@google/genai";

// Use API_KEY directly from environment variables as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    // Updated contents to use { parts: [...] } structure for multimodal requests
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: data,
            },
          },
          {
            text: "Analyze this image of food intended for donation. Is it visually safe and edible? Look for signs of spoilage, mold, or improper handling. Detect the type of food. Respond in JSON format.",
          }
        ]
      },
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

export const verifyPickupImage = async (base64Data: string): Promise<{ isValid: boolean; feedback: string }> => {
  try {
    const data = base64Data.split(',')[1] || base64Data;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: data,
            },
          },
          {
            text: "This image is proof of a volunteer picking up food from a donor. Does it show food containers, boxes, or people handing over items? Respond in JSON format.",
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN, description: "Whether the image looks like a pickup proof" },
            feedback: { type: Type.STRING, description: "Brief confirmation or feedback about the pickup" }
          },
          required: ["isValid", "feedback"]
        }
      }
    });

    return JSON.parse(response.text || '{"isValid": true, "feedback": "Pickup photo processed."}');
  } catch (error) {
    console.error("Gemini Pickup Verification Error:", error);
    return { isValid: true, feedback: "Photo received and logged." };
  }
};

export const verifyDeliveryImage = async (base64Data: string): Promise<{ isValid: boolean; feedback: string }> => {
  try {
    const data = base64Data.split(',')[1] || base64Data;
    // Updated contents to use { parts: [...] } structure for multimodal requests
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: data,
            },
          },
          {
            text: "This image is supposed to be proof of a food delivery drop-off at an orphanage or shelter. Does it show signs of a successful delivery? Look for food packages, building entrances, or people receiving items. Respond in JSON format.",
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN, description: "Whether the image looks like a delivery proof" },
            feedback: { type: Type.STRING, description: "A friendly comment about the delivery verification" }
          },
          required: ["isValid", "feedback"]
        }
      }
    });

    return JSON.parse(response.text || '{"isValid": true, "feedback": "Delivery photo processed."}');
  } catch (error) {
    console.error("Gemini Verification Error:", error);
    return { isValid: true, feedback: "Photo received and logged." };
  }
};

export interface ReverseGeocodeResult {
  line1: string;
  line2: string;
  landmark?: string;
  pincode: string;
}

export const reverseGeocode = async (lat: number, lng: number): Promise<ReverseGeocodeResult | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a logistics and delivery expert.
      Provide a precise, structured address for coordinates: ${lat}, ${lng}.
      
      CRITICAL INSTRUCTION: For the 'landmark' field, identify the most useful navigation landmark nearby (e.g., "Opposite City Mall", "Near St. John School", "Behind Central Bank"). This helps volunteers find the location easily.
      
      Return a VALID JSON object with:
      - line1: Building Name / House Number / Flat No
      - line2: Street / Area / Locality
      - landmark: A distinct, easy-to-find landmark nearby
      - pincode: 6-digit postal code
      
      Example JSON:
      {"line1": "Flat 4B", "line2": "MG Road", "landmark": "Near Central Park", "pincode": "110001"}`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: lat,
              longitude: lng
            }
          }
        },
        // responseMimeType: "application/json" // Incompatible with googleMaps tool
      },
    });

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

export interface RouteOptimizationResult {
  summary: string;
  estimatedDuration: string;
  steps: string[];
  trafficTips: string;
}

export const getOptimizedRoute = async (origin: string, destination: string): Promise<RouteOptimizationResult | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a logistics expert. Plan the most efficient driving route from "${origin}" to "${destination}". 
      Consider standard traffic patterns for a delivery. 
      Respond in VALID JSON format with the following structure:
      {
        "summary": "Brief overview of the route (e.g., Via Main St)",
        "estimatedDuration": "Estimated time (e.g., 15 mins)",
        "steps": ["Step 1", "Step 2", ...],
        "trafficTips": "Advice on potential bottlenecks or shortcuts"
      }`,
      config: {
        tools: [{ googleMaps: {} }], // Use grounding for location context
        // responseMimeType: "application/json" // Incompatible with googleMaps tool
      },
    });
    
    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    console.error("Route Optimization Error:", error);
    return null;
  }
};

export const calculateLiveEta = async (
  origin: { lat: number; lng: number },
  destination: string
): Promise<number | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Calculate the estimated driving time from coordinates ${origin.lat}, ${origin.lng} to "${destination}". 
      Consider current traffic conditions.
      Return ONLY the number of minutes as an integer.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: origin.lat,
              longitude: origin.lng
            }
          }
        }
      },
    });

    const text = response.text || "";
    // Parse response for minutes
    const match = text.match(/(\d+)\s*mins?/);
    if (match) return parseInt(match[1]);
    const numberMatch = text.match(/\d+/);
    return numberMatch ? parseInt(numberMatch[0]) : null;
  } catch (error) {
    console.error("ETA Calculation Error:", error);
    return null;
  }
};
