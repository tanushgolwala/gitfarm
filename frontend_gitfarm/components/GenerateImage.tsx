"use client";
import { useState } from "react";

export default function GenerateImagePage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateImage = async () => {
    setLoading(true);
    setImageUrl(null);

    const imputprompt = 'Turing Machine';
    const flag = true;
    const endpoint = flag ? "/api/generate-image" : "/api/get-image";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt: imputprompt }),
    });


    const data = await response.json();
    if (data.imagePath) {
      setImageUrl(data.imagePath);
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <button
        onClick={generateImage}
        className="px-4 py-2 bg-blue-500 text-white rounded"
        disabled={loading}
      >
        {loading ? "Generating..." : "Generate Image"}
      </button>

      {imageUrl && (
        <a
          href={imageUrl}
          download
          className="mt-4 px-4 py-2 bg-green-500 text-white rounded"
        >
          Download Image
        </a>
      )}
    </div>
  );
}
