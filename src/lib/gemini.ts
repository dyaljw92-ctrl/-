import { GoogleGenAI, Type } from "@google/genai";

// Robust API Key detection for different environments
const getApiKey = () => {
  if (import.meta.env?.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
  try {
    if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  } catch (e) {}
  return "";
};

const getOpenRouterKey = () => {
  if (import.meta.env?.VITE_OPENROUTER_API_KEY) return import.meta.env.VITE_OPENROUTER_API_KEY;
  return "";
};

const apiKey = getApiKey();
const openRouterKey = getOpenRouterKey();

console.log("✨ Magic System Initializing...");
if (openRouterKey) console.log("✅ OpenRouter Key detected.");
else if (apiKey) console.log("✅ Gemini Key detected.");
else console.warn("❌ No API Key detected. Please set VITE_GEMINI_API_KEY or VITE_OPENROUTER_API_KEY in Vercel.");

const ai = new GoogleGenAI({ apiKey: apiKey || "dummy_key" });

async function callOpenRouter(prompt: string, isImage: boolean = false, base64Image?: string) {
  const model = "google/gemini-2.0-flash-001"; // OpenRouter model name
  
  const messages: any[] = [
    {
      role: "user",
      content: isImage ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
      ] : prompt
    }
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openRouterKey}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "Hogwarts Word Wizard",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      response_format: { type: "json_object" }
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

export interface WordDetail {
  word: string;
  ipa: string;
  meaning: string;
  sentenceA: string;
  sentenceB: string;
  sentenceC: string;
}

export interface StoryData {
  title: string;
  contentEn: string;
  contentZh: string;
  wordsUsed: string[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
  type: 'fill' | 'match' | 'creative';
}

export async function recognizeWordsFromImage(base64Image: string): Promise<string[]> {
  const prompt = `
    You are a magical owl that can read any text.
    Look at this image and extract all the English words you see. 
    Focus on vocabulary words that are suitable for primary school students.
    Return only the words as a JSON object with a "words" array.
    Example: {"words": ["apple", "banana", "cat"]}
  `;

  if (openRouterKey) {
    const text = await callOpenRouter(prompt, true, base64Image.split(",")[1] || base64Image);
    const result = JSON.parse(text || '{"words": []}');
    return result.words;
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1] || base64Image,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          words: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["words"]
      }
    }
  });

  const result = JSON.parse(response.text || '{"words": []}');
  return result.words;
}

export async function generateWizardContent(words: string[]) {
  const prompt = `
    You are a friendly magical teacher. I will provide a list of English words: ${words.join(", ")}.
    
    Phase 1: Story Creation
    Write a VERY SIMPLE, short, and FUNNY JOKE (幽默小笑话) for primary school students (ages 7-12) using ALL these words: ${words.join(", ")}.
    
    CRITICAL RULES for the JOKE: 
    - The content MUST be a joke, a riddle, or a funny situation that makes children laugh.
    - The humor should be innocent and suitable for kids.
    - Use "Stepping Stone" vocabulary (very basic words like 'cat', 'run', 'big', 'happy') for 80% of the content.
    - Use the target words (${words.join(", ")}) as the "punchline" or key elements of the joke.
    - The joke should be easy to understand, fun, and use basic sentence structures.
    - The theme can be about animals, school life, or a simple magical adventure.
    - Ensure the English level is strictly for beginners (A1 level).
    
    Output the story in both English and Chinese. 
    Bold the target words in the English version using **word** format.

    Phase 2: Word Breakdown
    For each word, provide:
    - Core meaning (simple Chinese).
    - IPA (phonetic transcription).
    - Sentence A (Basic): A very simple daily life context.
    - Sentence B (Scenario): A simple sentence related to the story above.
    - Sentence C (Challenge): A slightly longer sentence with a simple grammar point (like "can", "is/are", or simple past).

    Phase 3: Assessment
    - 3 simple multiple choice questions based on the story and words.

    Return the result in JSON format with the following structure:
    {
      "story": { "title": "string", "contentEn": "string", "contentZh": "string" },
      "wordDetails": [
        { "word": "string", "ipa": "string", "meaning": "string", "sentenceA": "string", "sentenceB": "string", "sentenceC": "string" }
      ],
      "quiz": [
        { "question": "string", "options": ["string"], "answer": "string", "type": "string" }
      ]
    }
  `;

  if (openRouterKey) {
    const text = await callOpenRouter(prompt);
    return JSON.parse(text || "{}");
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          story: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              contentEn: { type: Type.STRING },
              contentZh: { type: Type.STRING }
            },
            required: ["title", "contentEn", "contentZh"]
          },
          wordDetails: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                ipa: { type: Type.STRING },
                meaning: { type: Type.STRING },
                sentenceA: { type: Type.STRING },
                sentenceB: { type: Type.STRING },
                sentenceC: { type: Type.STRING }
              },
              required: ["word", "ipa", "meaning", "sentenceA", "sentenceB", "sentenceC"]
            }
          },
          quiz: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING },
                type: { type: Type.STRING }
              },
              required: ["question", "options", "answer", "type"]
            }
          }
        },
        required: ["story", "wordDetails", "quiz"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}
