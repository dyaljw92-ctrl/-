import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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
    Return only the words as a JSON array of strings.
    Example: ["apple", "banana", "cat"]
  `;

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
    Write a VERY SIMPLE and short story for primary school students (ages 7-12) using ALL these words: ${words.join(", ")}.
    
    CRITICAL RULE: 
    - Use "Stepping Stone" vocabulary (very basic words like 'cat', 'run', 'big', 'happy') for 80% of the story.
    - Use the target words (${words.join(", ")}) as the "protagonists" (main focus) for the remaining 20%.
    - The story should be easy to understand, fun, and use basic sentence structures.
    - The theme can be about animals, school life, or a simple magical adventure.
    
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
