import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for processing multiple images

interface ProcessedComment {
  imageName: string;
  comments: Array<{
    username?: string;
    text: string;
    timestamp?: string;
    likes?: string;
  }>;
  rawResponse: string;
}

const SYSTEM_PROMPT = `You are an expert at extracting comments from social media screenshots (Instagram, Twitter, Facebook, etc.).

Analyze the image and extract ALL comments visible in the screenshot. For each comment, extract:
1. Username (if visible)
2. Comment text (full text)
3. Timestamp (if visible, e.g., "2h", "1d", "3w ago")
4. Like count (if visible)

Return the data in a structured JSON format like this:
{
  "comments": [
    {
      "username": "username1",
      "text": "Full comment text here",
      "timestamp": "2h",
      "likes": "5"
    },
    {
      "username": "username2",
      "text": "Another comment",
      "timestamp": "1d",
      "likes": "12"
    }
  ]
}

If a field is not visible or cannot be determined, use null or omit it. Be thorough and extract every comment you can see.`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const apiKey = formData.get("apiKey") as string;
    const files = formData.getAll("files") as File[];

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const results: ProcessedComment[] = [];

    // Process each image
    for (const file of files) {
      try {
        // Convert file to base64
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString("base64");

        // Determine MIME type
        const mimeType = file.type || "image/jpeg";

        // Call Nano Banana Pro API
        const response = await ai.models.generateContent({
          model: "nano-banana-pro",
          contents: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Image,
              },
            },
            { text: SYSTEM_PROMPT },
          ],
        });

        const responseText = response.text || "";
        
        // Try to parse JSON from response
        let parsedComments: any = { comments: [] };
        try {
          // Extract JSON from response (might be wrapped in markdown code blocks)
          const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                          responseText.match(/```\s*([\s\S]*?)\s*```/) ||
                          responseText.match(/\{[\s\S]*\}/);
          
          if (jsonMatch) {
            parsedComments = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          } else {
            // Fallback: try to parse the entire response as JSON
            parsedComments = JSON.parse(responseText);
          }
        } catch (parseError) {
          // If JSON parsing fails, create a single comment with the raw text
          parsedComments = {
            comments: [
              {
                text: responseText,
              },
            ],
          };
        }

        results.push({
          imageName: file.name,
          comments: parsedComments.comments || [],
          rawResponse: responseText,
        });
      } catch (error: any) {
        results.push({
          imageName: file.name,
          comments: [],
          rawResponse: `Error processing image: ${error.message}`,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("Error processing images:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process images" },
      { status: 500 }
    );
  }
}

