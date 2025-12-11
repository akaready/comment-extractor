import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker for Node.js
// In Node.js environments, we can disable the worker or use a file path
try {
  // Try to set worker to disabled for Node.js (no worker needed server-side)
  pdfjsLib.GlobalWorkerOptions.workerSrc = false;
} catch (error) {
  // If that doesn't work, try setting a path
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve(
      "pdfjs-dist/build/pdf.worker.min.mjs"
    );
  } catch (fallbackError) {
    // Last resort: disable worker
    (pdfjsLib.GlobalWorkerOptions as any).workerSrc = false;
  }
}

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

    // Helper function to get canvas (lazy load to avoid build-time resolution)
    const getCreateCanvas = (): any => {
      try {
        // Use Function constructor to avoid webpack static analysis
        const requireFunc = new Function('moduleName', 'return require(moduleName)');
        const canvasModule = requireFunc('canvas');
        return canvasModule.createCanvas;
      } catch (error) {
        return null;
      }
    };

    // Helper function to convert PDF pages to images
    const convertPdfToImages = async (pdfBuffer: Buffer): Promise<Buffer[]> => {
      const createCanvas = getCreateCanvas();
      if (!createCanvas) {
        throw new Error("PDF processing is not available. Canvas module is not installed. This feature requires native dependencies that may not be available in all environments.");
      }

      const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
      const pdf = await loadingTask.promise;
      const images: Buffer[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext("2d");

        await page.render({
          canvasContext: context as any,
          viewport: viewport,
        }).promise;

        images.push(canvas.toBuffer("image/png"));
      }

      return images;
    };

    // Helper function to process a single image
    const processImage = async (
      imageBuffer: Buffer,
      mimeType: string,
      fileName: string,
      pageNumber?: number
    ): Promise<ProcessedComment> => {
      const base64Image = imageBuffer.toString("base64");
      const displayName = pageNumber 
        ? `${fileName} (page ${pageNumber})`
        : fileName;

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

      return {
        imageName: displayName,
        comments: parsedComments.comments || [],
        rawResponse: responseText,
      };
    };

    // Process each file
    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
          // Handle PDF files - convert each page to an image
          try {
            const pdfImages = await convertPdfToImages(buffer);
            
            // Process each page as a separate image
            for (let i = 0; i < pdfImages.length; i++) {
              const result = await processImage(
                pdfImages[i],
                "image/png",
                file.name,
                i + 1
              );
              results.push(result);
            }
          } catch (pdfError: any) {
            results.push({
              imageName: file.name,
              comments: [],
              rawResponse: `Error processing PDF: ${pdfError.message}`,
            });
          }
        } else {
          // Handle regular image files
          const result = await processImage(
            buffer,
            file.type || "image/jpeg",
            file.name
          );
          results.push(result);
        }
      } catch (error: any) {
        results.push({
          imageName: file.name,
          comments: [],
          rawResponse: `Error processing file: ${error.message}`,
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

