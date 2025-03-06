//chat-interface.tsx
"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, Upload, Bot, User, FileCheck, GraduationCap } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface RecommendedCourse {
  'Class Code': string
  'Class Name': string
  'Days & Times': string
  [key: string]: string | undefined

}

// Use sessionStorage instead of localStorage to maintain state only for current session
const STORAGE_KEYS = {
  MESSAGES: 'course-assistant-messages',
  TRANSCRIPT_UPLOADED: 'course-assistant-transcript-uploaded',
  RECOMMENDED_COURSES: 'course-assistant-recommended-courses'
}

export default function ChatInterface() {
  // Initialize state from sessionStorage if available
  const [transcriptUploaded, setTranscriptUploaded] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(STORAGE_KEYS.TRANSCRIPT_UPLOADED)
      return saved ? JSON.parse(saved) : false
    }
    return false
  })
  
  const [messages, setMessages] = useState<{ role: string, content: string, type?: string }[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(STORAGE_KEYS.MESSAGES)
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  
  // Create a ref for the chat container
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Save to sessionStorage whenever relevant state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages))
    }
  }, [messages])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEYS.TRANSCRIPT_UPLOADED, JSON.stringify(transcriptUploaded))
    }
  }, [transcriptUploaded])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      
      // Create FormData for file upload
      const formData = new FormData()
      formData.append('file', file)
      
      fetch('http://127.0.0.1:5000/upload', {
        method: 'POST',
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        if (!data.success) {
          // Handle server-side errors
          setMessages(prevMessages => [
            ...prevMessages, 
            { 
              role: 'system', 
              content: `❌ Transcript Upload Error: ${data.error || 'Unknown error occurred'}`, 
              type: 'file-upload-error' 
            }
          ])
          return
        }

        console.log('File uploaded successfully', data)
        
        // Update states
        setTranscriptUploaded(true)
        setUploadDialogOpen(false)
        
        // Add a system message about file upload to chat
        setMessages(prevMessages => [
          ...prevMessages, 
          { 
            role: 'system', 
            content: `Transcript uploaded: ${file.name}`, 
            type: 'file-upload' 
          }
        ])

        // Detailed parsing results message
        if (data.success && data.data) {
          const parsedData = data.data
          
          // Construct a detailed message about parsed transcript
          const detailedMessage = `
            🎓 Transcript Analysis:
            • Major: ${parsedData.major} (${parsedData.type})
            • Upper Division Electives Taken: ${parsedData.upper_div_electives_taken}
            • Remaining Required Courses: ${parsedData.remaining_required_courses.flat().join(', ')}
            • Possibl Upper Division Courses to Take: ${parsedData.remaining_upper_div_courses.length}
          `

          setMessages(prevMessages => [
            ...prevMessages, 
            { 
              role: 'assistant', 
              content: detailedMessage,
              type: 'transcript-analysis' 
            }
          ])

          // Add course recommendations to cha
          if (parsedData.recommended_courses) {
            const recommendedCourses = parsedData.recommended_courses
            const recommendedCoursesOutput = parsedData.recommended_courses.map((course: RecommendedCourse) => {
              return `${course['Class Code']} - ${course['Class Name']} - ${course['Days & Times']}`
            })

            sessionStorage.setItem(
              STORAGE_KEYS.RECOMMENDED_COURSES, 
              JSON.stringify([...JSON.parse(sessionStorage.getItem(STORAGE_KEYS.RECOMMENDED_COURSES) || '[]'), ...recommendedCourses])
            )

            setMessages(prevMessages => [
              ...prevMessages, 
              { 
                role: 'assistant', 
                content: `🎓 Recommended Courses: ${recommendedCoursesOutput.join(', ')}`,
                type: 'transcript-analysis' 
              }
            ])
          }

        }
      })
      .catch(error => {
        console.error('Error uploading file:', error)
        // Optionally add an error message to chat
        setMessages(prevMessages => [
          ...prevMessages, 
          { 
            role: 'system', 
            content: `Error uploading transcript: ${error.message}`, 
            type: 'file-upload-error' 
          }
        ])
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!input.trim()) return

    // Add user message to chat
    const newMessages = [...messages, { role: 'user', content: input }]
    setMessages(newMessages)
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch('http://127.0.0.1:5000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: input })
      })

      if (!response.ok) {
        throw new Error('Network response was not ok')
      }

      const data = await response.json()
      
      // Add assistant's response to chat
      setMessages(prevMessages => [
        ...prevMessages, 
        { role: 'assistant', content: data.response }
      ])
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages(prevMessages => [
        ...prevMessages, 
        { role: 'assistant', content: 'Sorry, there was an error processing your request.' }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  return (
    <div className="flex flex-col h-[70vh]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Course Assistant</h2>
        {!transcriptUploaded && (
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
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
                  <Input 
                    id="transcript" 
                    type="file" 
                    accept=".pdf,.doc,.docx" 
                    onChange={handleFileUpload} 
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Apply the ref to your chat container */}
      <div 
        ref={chatContainerRef} 
        className="flex-1 overflow-y-auto mb-4 p-4 border rounded-lg"
      >
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
              <Card 
                key={index} 
                className={`
                  ${message.role === "user" ? "bg-blue-50" : 
                    message.role === "system" && message.type === "file-upload" ? "bg-green-50" : 
                    message.role === "assistant" && message.type === "transcript-analysis" ? "bg-purple-50" :
                    "bg-white"}
                `}
              >
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <Avatar 
                      className={
                        message.role === "user" ? "bg-blue-100" : 
                        message.role === "system" && message.type === "file-upload" ? "bg-green-100" : 
                        message.role === "assistant" && message.type === "transcript-analysis" ? "bg-purple-100" :
                        "bg-yellow-100"
                      }
                    >
                      <AvatarFallback>
                        {message.role === "user" ? <User size={18} /> : 
                         message.role === "system" && message.type === "file-upload" ? <FileCheck size={18} /> : 
                         message.role === "assistant" && message.type === "transcript-analysis" ? <GraduationCap size={18} /> : 
                         <Bot size={18} />}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium mb-1">
                        {message.role === "user" ? "You" : 
                         message.role === "system" && message.type === "file-upload" ? "System" : 
                         message.role === "assistant" && message.type === "transcript-analysis" ? "Transcript Analysis" :
                         "Course Assistant"}
                      </p>
                      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {isLoading && (
          <div className="flex justify-center items-center mt-4">
            <p>Loading...</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={input}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Ask about courses, requirements, or recommendations..."
          className="flex-1 resize-none"
          rows={2}
        />
        <Button type="submit" className="self-end bg-[#003c6c] hover:bg-[#00284a]" disabled={isLoading}>
          <Send size={18} />
        </Button>
      </form>
    </div>
  )
}