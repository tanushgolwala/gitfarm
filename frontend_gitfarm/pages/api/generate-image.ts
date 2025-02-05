import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

const model = "@cf/stabilityai/stable-diffusion-xl-base-1.0";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const ACCOUNT_ID = process.env.ACCOUNT_ID;
    const API_KEY = process.env.API_KEY;
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      }
    );

    const buffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(buffer);

    const timestamp = Date.now();
    const imagePath = path.join(
      process.cwd(),
      "public",
      "generated",
      `img_${timestamp}.png`
    );
    fs.mkdirSync(path.dirname(imagePath), { recursive: true });
    fs.writeFileSync(imagePath, imageBuffer);

    return res
      .status(200)
      .json({ imagePath: `/generated/img_${timestamp}.png` });
  } catch (error) {
    console.error("Error generating image:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
