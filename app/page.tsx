"use client";

import * as React from "react";
import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Download, Settings, Sparkles } from "lucide-react";
import { generateCSV, downloadCSV, type Comment } from "@/lib/csv-export";

interface ProcessedResult {
  imageName: string;
  comments: Array<{
    username?: string;
    text: string;
    timestamp?: string;
    likes?: string;
  }>;
  rawResponse: string;
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [apiKey, setApiKey] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ProcessedResult[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const { toast } = useToast();

  // Load API key from localStorage on mount
  React.useEffect(() => {
    const savedApiKey = localStorage.getItem("gemini_api_key");
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  }, []);

  // Save API key to localStorage when it changes
  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    localStorage.setItem("gemini_api_key", value);
  };

  const handleProcess = async () => {
    if (!apiKey) {
      toast({
        title: "API Key Required",
        description: "Please enter your API key in settings.",
        variant: "destructive",
      });
      setShowSettings(true);
      return;
    }

    if (files.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select at least one image to process.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setResults([]);

    try {
      const formData = new FormData();
      formData.append("apiKey", apiKey);
      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/process-images", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to process images");
      }

      const data = await response.json();
      setResults(data.results);

      const totalComments = data.results.reduce(
        (sum: number, result: ProcessedResult) => sum + result.comments.length,
        0
      );

      toast({
        title: "Processing Complete",
        description: `Extracted ${totalComments} comments from ${data.results.length} image(s).`,
      });
    } catch (error: any) {
      toast({
        title: "Processing Failed",
        description: error.message || "An error occurred while processing images.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportCSV = () => {
    if (results.length === 0) {
      toast({
        title: "No Data to Export",
        description: "Please process images first.",
        variant: "destructive",
      });
      return;
    }

    // Flatten results into comments array
    const allComments: Comment[] = [];
    results.forEach((result) => {
      result.comments.forEach((comment) => {
        allComments.push({
          imageName: result.imageName,
          username: comment.username,
          text: comment.text,
          timestamp: comment.timestamp,
          likes: comment.likes,
        });
      });
    });

    if (allComments.length === 0) {
      toast({
        title: "No Comments Found",
        description: "No comments were extracted from the images.",
        variant: "destructive",
      });
      return;
    }

    const csvContent = generateCSV(allComments);
    const timestamp = new Date().toISOString().split("T")[0];
    downloadCSV(csvContent, `comments_${timestamp}.csv`);

    toast({
      title: "Export Complete",
      description: `Exported ${allComments.length} comments to CSV.`,
    });
  };

  const totalComments = results.reduce(
    (sum, result) => sum + result.comments.length,
    0
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Comment Extractor</h1>
          </div>
          <p className="text-muted-foreground">
            Upload screenshots of social media comments and extract them using AI
          </p>
        </div>

        <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Upload Images</CardTitle>
                    <CardDescription>
                      Drag and drop or click to select screenshot images
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowSettings(!showSettings)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <FileUpload
                  onFilesSelected={setFiles}
                  acceptedFiles={files}
                  maxFiles={50}
                />
              </CardContent>
            </Card>

            {showSettings && (
              <Card>
                <CardHeader>
                  <CardTitle>Settings</CardTitle>
                  <CardDescription>
                    Enter your API key to process images with Nano Banana Pro
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="api-key">API Key</Label>
                    <Input
                      id="api-key"
                      type="password"
                      placeholder="Enter your Gemini API key"
                      value={apiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Your API key is stored locally in your browser
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-4">
              <Button
                onClick={handleProcess}
                disabled={isProcessing || files.length === 0}
                className="flex-1"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Process Images
                  </>
                )}
              </Button>
              {results.length > 0 && (
                <Button
                  onClick={handleExportCSV}
                  variant="outline"
                  size="lg"
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV ({totalComments} comments)
                </Button>
              )}
            </div>

            {results.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                  <CardDescription>
                    Extracted comments from {results.length} image(s)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {results.map((result, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <h3 className="font-semibold mb-2">{result.imageName}</h3>
                        {result.comments.length > 0 ? (
                          <div className="space-y-2">
                            {result.comments.map((comment, commentIndex) => (
                              <div
                                key={commentIndex}
                                className="bg-muted p-3 rounded text-sm"
                              >
                                {comment.username && (
                                  <div className="font-medium text-primary mb-1">
                                    @{comment.username}
                                  </div>
                                )}
                                <div className="mb-1">{comment.text}</div>
                                <div className="text-xs text-muted-foreground flex gap-4">
                                  {comment.timestamp && (
                                    <span>⏱ {comment.timestamp}</span>
                                  )}
                                  {comment.likes && (
                                    <span>❤️ {comment.likes}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No comments extracted from this image.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>How it works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <div className="font-semibold mb-1">1. Upload Screenshots</div>
                  <p className="text-muted-foreground">
                    Drag and drop or select multiple screenshot images containing social media comments.
                  </p>
                </div>
                <div>
                  <div className="font-semibold mb-1">2. Enter API Key</div>
                  <p className="text-muted-foreground">
                    Add your API key in settings. Get one from{" "}
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Google AI Studio
                    </a>
                    .
                  </p>
                </div>
                <div>
                  <div className="font-semibold mb-1">3. Process & Export</div>
                  <p className="text-muted-foreground">
                    Click "Process Images" to extract comments using AI, then export to CSV.
                  </p>
                </div>
              </CardContent>
            </Card>

            {results.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Images Processed:</span>
                    <span className="font-semibold">{results.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Comments:</span>
                    <span className="font-semibold">{totalComments}</span>
                  </div>
                </CardContent>
              </Card>
            )}
        </div>
      </div>
    </div>
  );
}

