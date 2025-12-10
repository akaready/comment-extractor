"use client";

import * as React from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  acceptedFiles?: File[];
  maxFiles?: number;
}

export function FileUpload({
  onFilesSelected,
  acceptedFiles = [],
  maxFiles = 100,
}: FileUploadProps) {
  const onDrop = React.useCallback(
    (newFiles: File[]) => {
      const remainingSlots = maxFiles - acceptedFiles.length;
      if (remainingSlots <= 0) {
        return;
      }
      const filesToAdd = newFiles.slice(0, remainingSlots);
      onFilesSelected([...acceptedFiles, ...filesToAdd]);
    },
    [onFilesSelected, maxFiles, acceptedFiles]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
    },
    multiple: true,
    noClick: false,
    noKeyboard: false,
  });

  const removeFile = (index: number) => {
    const newFiles = acceptedFiles.filter((_, i) => i !== index);
    onFilesSelected(newFiles);
  };

  const rootProps = getRootProps();
  const { className: rootClassName, ...restRootProps } = rootProps;

  return (
    <div className="space-y-4">
      <div
        {...restRootProps}
        className={cn(
          rootClassName,
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        )}
      >
        <input 
          {...getInputProps()} 
          className="hidden"
        />
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="rounded-full bg-primary/10 p-4">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="text-lg font-medium">
              {isDragActive
                ? "Drop images here"
                : "Drag & drop images here"}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              or click to select files
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports PNG, JPG, JPEG, GIF, WEBP
            </p>
          </div>
        </div>
      </div>

      {acceptedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {acceptedFiles.length} file{acceptedFiles.length !== 1 ? "s" : ""} selected
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {acceptedFiles.map((file, index) => (
              <Card key={index} className="relative group overflow-hidden">
                <div className="aspect-square relative">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="p-2">
                  <p className="text-xs truncate" title={file.name}>
                    {file.name}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

