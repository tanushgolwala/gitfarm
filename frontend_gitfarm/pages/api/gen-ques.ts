"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { prompt } = req.body;
  const newprompt = `Can you please give me a question on ${prompt}. This question should be a long answer type question and may or may not include numericals. It has to be solved by college students. Keep it short, and to the point, in bullet points, since I want these points in a PPT presentation`;

  if (!prompt) {
    return res.status(400).json({ error: "Topic is required" });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(newprompt);
    const response = result.response;
    const question = response.text();

    return res.status(200).json({ question });
  } catch (error) {
    console.error("Error generating question:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
