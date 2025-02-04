"use client";
import { useState } from "react";

export default function GenerateQuestionPage() {
  const [question, setQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateQuestion = async () => {
    setLoading(true);
    setQuestion(null);

    const topic = "Linear Algebra";
    const prompt = `Can you please give me a question on ${topic}. This question should be a long answer type question and may or may not include numericals. It has to be solved by college students.`;
    const flag = true;
    const endpoint = flag ? "/api/gen-ques" : "/api/gen-ques";
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt}),
    });

    const data = await response.json();
    if (data.question) {
      setQuestion(data.question);
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <button
        onClick={generateQuestion}
        className="px-4 py-2 bg-blue-500 text-white rounded"
        disabled={loading}
      >
        {loading ? "Generating..." : "Generate Question"}
      </button>

      {question && (
        <p className="mt-4 text-lg font-semibold text-center">
          {question}
        </p>
      )}
    </div>
  );
}
