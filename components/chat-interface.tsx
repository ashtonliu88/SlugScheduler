"use client"

import type React from "react"

import { useState } from "react"
import { useChat } from "ai/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, Upload, Bot, User } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

export default function ChatInterface() {
  const [transcriptUploaded, setTranscriptUploaded] = useState(false)
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: "/api/chat",
  })

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // In a real app, you would process the file here
    if (e.target.files && e.target.files.length > 0) {
      setTranscriptUploaded(true)
      // You would send the file to your backend here
    }
  }

  return (
    <div className="flex flex-col h-[70vh]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Course Assistant</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex gap-2">
              <Upload size={16} />
              Upload Transcript
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Your Transcript</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="transcript">
                  Upload your academic transcript to get personalized course recommendations
                </Label>
                <Input id="transcript" type="file" accept=".pdf,.doc,.docx" onChange={handleFileUpload} />
              </div>
              {transcriptUploaded && (
                <p className="text-green-600 text-sm">
                  Transcript uploaded successfully! The assistant can now provide personalized recommendations.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 p-4 border rounded-lg">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
            <Bot size={48} className="mb-4 text-[#003c6c]" />
            <h3 className="text-lg font-medium">Welcome to the UCSC Course Assistant!</h3>
            <p className="max-w-md mt-2">
              Ask me about courses, requirements, or upload your transcript for personalized recommendations.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <Card key={index} className={`${message.role === "user" ? "bg-blue-50" : "bg-white"}`}>
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <Avatar className={message.role === "user" ? "bg-blue-100" : "bg-yellow-100"}>
                      <AvatarFallback>
                        {message.role === "user" ? <User size={18} /> : <Bot size={18} />}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium mb-1">{message.role === "user" ? "You" : "Course Assistant"}</p>
                      <div className="text-sm">{message.content}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={input}
          onChange={handleInputChange}
          placeholder="Ask about courses, requirements, or recommendations..."
          className="flex-1 resize-none"
          rows={2}
        />
        <Button type="submit" className="self-end bg-[#003c6c] hover:bg-[#00284a]">
          <Send size={18} />
        </Button>
      </form>
    </div>
  )
}

