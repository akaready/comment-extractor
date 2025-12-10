export interface Comment {
  imageName: string;
  username?: string;
  text: string;
  timestamp?: string;
  likes?: string;
}

export function generateCSV(comments: Comment[]): string {
  // CSV header
  const headers = ["Image Name", "Username", "Comment Text", "Timestamp", "Likes"];
  
  // Escape CSV values (handle commas, quotes, newlines)
  const escapeCSV = (value: string | undefined | null): string => {
    if (!value) return "";
    // Replace quotes with double quotes and wrap in quotes if contains comma, quote, or newline
    const escaped = value.replace(/"/g, '""');
    if (escaped.includes(",") || escaped.includes('"') || escaped.includes("\n")) {
      return `"${escaped}"`;
    }
    return escaped;
  };

  // Build CSV rows
  const rows = comments.map((comment) => [
    escapeCSV(comment.imageName),
    escapeCSV(comment.username),
    escapeCSV(comment.text),
    escapeCSV(comment.timestamp),
    escapeCSV(comment.likes),
  ]);

  // Combine header and rows
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  return csvContent;
}

export function downloadCSV(csvContent: string, filename: string = "comments.csv") {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

