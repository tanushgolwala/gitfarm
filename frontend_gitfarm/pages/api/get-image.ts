import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "pexels";
import fs from "fs";
import path from "path";

type PexelsResponse = {
  photos: { src: { original: string } }[];
};

const client = createClient(process.env.PEXELS_API as string);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const response = await client.photos.search({ query: prompt, per_page: 1 });

    if ("error" in response) {
      return res.status(500).json({ error: "Error fetching image from Pexels" });
    }

    const photoUrl = response.photos[0]?.src.original;

    if (!photoUrl) {
      return res.status(404).json({ error: "No image found" });
    }

    // Fetch image data
    const imageResponse = await fetch(photoUrl);
    const buffer = await imageResponse.arrayBuffer();
    const imageBuffer = Buffer.from(buffer);

    // Define save path
    const imagePath = path.join(process.cwd(), "public", "generated", "pexels-image.jpg");

    // Ensure directory exists
    fs.mkdirSync(path.dirname(imagePath), { recursive: true });

    // Write the image to local storage
    fs.writeFileSync(imagePath, imageBuffer);

    return res.status(200).json({ imagePath: "/generated/pexels-image.jpg" });
  } catch (error) {
    console.error("Error fetching image from Pexels:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
}