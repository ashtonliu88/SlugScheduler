import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"

export async function POST(req: Request) {
  const { messages } = await req.json()

  // In a real application, you would connect this to your RAG system
  // that has knowledge of UCSC courses and requirements
  const result = streamText({
    model: openai("gpt-4o"),
    messages,
    system: `You are a helpful course recommendation assistant for UC Santa Cruz.
    You help students find courses, understand requirements, and plan their academic journey.
    You have knowledge of UCSC's course catalog, major requirements, and general education requirements.
    If a student has uploaded their transcript, you can provide personalized recommendations based on their academic history.
    Always be supportive, informative, and help students make the best decisions for their academic goals.`,
  })

  return result.toDataStreamResponse()
}

