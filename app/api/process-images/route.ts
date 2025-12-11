import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker for Node.js
// Set the worker source path for server-side rendering
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve(
    "pdfjs-dist/build/pdf.worker.min.mjs"
  );
} catch (error) {
  // Fallback: use relative path if require.resolve fails
  pdfjsLib.GlobalWorkerOptions.workerSrc = "pdfjs-dist/build/pdf.worker.min.mjs";
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

const SYSTEM_PROMPT = `You are an expert at extracting comments from social media screenshots, PDFs, and images containing comment threads.

CRITICAL: Your ONLY job is to extract comments from this image. Return ONLY valid JSON - no explanations, no markdown formatting, just pure JSON.

EXTRACTION RULES:
1. Extract EVERY comment visible in the image - scan from top to bottom, left to right
2. For each comment, extract:
   - "text": The complete comment text (copy it exactly, don't summarize)
   - "username": The username/handle if visible (omit if not visible)
   - "timestamp": Time/date if visible (e.g., "2h", "1d", "3w ago", "Just now", "Dec 10, 2024")
   - "likes": Like/reaction count if visible (e.g., "5", "12", "1.2K", "1.5K")
3. Include ALL comments - even partial ones, replies, nested comments
4. Don't skip any comments - be exhaustive
5. If a field is not visible, simply omit it (don't include null)

REQUIRED OUTPUT FORMAT (JSON only, no markdown):
{
  "comments": [
    {
      "username": "user1",
      "text": "This is the full comment text exactly as it appears",
      "timestamp": "2h",
      "likes": "5"
    },
    {
      "text": "Another comment without username",
      "timestamp": "1d"
    }
  ]
}

Remember: Return ONLY the JSON object, nothing else. No markdown code blocks, no explanations.`;

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

      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/a8443012-4755-4832-8c30-4121a6cadd1d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:135',message:'Calling LLM API',data:{fileName:displayName,imageSize:base64Image.length,promptLength:SYSTEM_PROMPT.length},timestamp:Date.now(),sessionId:'debug-session',runId:'test-extraction',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      
      // Call Gemini API - use gemini-1.5-flash for reliable vision capabilities
      const model = ai.getGenerativeModel({ 
        model: "gemini-1.5-flash"
      });
      
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Image,
          },
        },
        { text: SYSTEM_PROMPT },
      ]);

      // Extract text from response - handle different response structures
      let responseText = "";
      try {
        responseText = result.response.text();
      } catch (error) {
        // Fallback if response structure is different
        try {
          responseText = (result as any).text || "";
        } catch (e) {
          responseText = "";
        }
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/a8443012-4755-4832-8c30-4121a6cadd1d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:149',message:'LLM raw response received',data:{fileName:displayName,responseLength:responseText.length,responsePreview:responseText.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'test-extraction',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Try to parse JSON from response - handle multiple formats
      let parsedComments: any = { comments: [] };
      try {
        // Strategy 1: Extract JSON from markdown code blocks
        let jsonString = responseText.trim();
        
        // Remove markdown code blocks if present
        const jsonBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonBlockMatch) {
          jsonString = jsonBlockMatch[1].trim();
        }
        
        // Strategy 2: Find JSON object in the text (look for first { to last })
        const firstBrace = jsonString.indexOf('{');
        const lastBrace = jsonString.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonString = jsonString.substring(firstBrace, lastBrace + 1);
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/a8443012-4755-4832-8c30-4121a6cadd1d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:185',message:'JSON extraction attempt',data:{jsonStringLength:jsonString.length,jsonPreview:jsonString.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'test-extraction',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        // Parse the cleaned JSON string
        parsedComments = JSON.parse(jsonString);
        
        // Validate structure
        if (!parsedComments.comments || !Array.isArray(parsedComments.comments)) {
          throw new Error("Invalid JSON structure: missing comments array");
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/a8443012-4755-4832-8c30-4121a6cadd1d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:195',message:'JSON parsed successfully',data:{commentCount:parsedComments.comments.length,firstComment:parsedComments.comments[0]||null},timestamp:Date.now(),sessionId:'debug-session',runId:'test-extraction',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
      } catch (parseError: any) {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/a8443012-4755-4832-8c30-4121a6cadd1d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:199',message:'JSON parse failed',data:{error:parseError.message,responsePreview:responseText.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'test-extraction',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        // If JSON parsing fails, try to extract comments from raw text
        // Look for patterns that might indicate comments
        const commentPatterns = responseText.match(/(?:comment|text|username)[:\s]+["']?([^"'\n]+)["']?/gi);
        if (commentPatterns && commentPatterns.length > 0) {
          parsedComments = {
            comments: commentPatterns.map((pattern: string) => {
              const match = pattern.match(/["']?([^"'\n]+)["']?/);
              return {
                text: match ? match[1] : pattern,
              };
            }),
          };
        } else {
          // Last resort: create a single comment with the raw text
          parsedComments = {
            comments: [
              {
                text: responseText.substring(0, 500), // Limit length
              },
            ],
          };
        }
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

