"use client"

import React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send, Upload, Bot, User, FileCheck, GraduationCap, Calendar } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface RecommendedCourse {
  'Class Code': string
  'Class Name': string
  'Class Type'?: string
  'Credits'?: string
  'Days & Times': string
  'Room'?: string
  'Instructors'?: string
  'Description'?: string
  'Prereqs'?: string
  [key: string]: string | undefined
}

interface StudentInfo {
  major: string
  type: string
  upper_div_electives_taken: number
  remaining_upper_div_courses: string[]
  remaining_required_courses: string[][]
}

// Use sessionStorage instead of localStorage to maintain state only for current session
const STORAGE_KEYS = {
  MESSAGES: 'course-assistant-messages',
  TRANSCRIPT_UPLOADED: 'course-assistant-transcript-uploaded',
  RECOMMENDED_COURSES: 'course-assistant-recommended-courses',
  STUDENT_INFO: 'course-assistant-student-info'
}

// Check if a message is requesting recommendations
const isRecommendationRequest = (message: string): boolean => {
  const recommendationKeywords = [
    "recommend", "suggest", "courses", "classes", "next quarter", 
    "should take", "good classes", "what classes", "which courses",
    "looking for classes", "need a class", "find me", "course recommendation"
  ]
  
  const messageLower = message.toLowerCase()
  return recommendationKeywords.some(keyword => messageLower.includes(keyword))
}

// Check if a message is asking about preferences
const isPreferenceQuestion = (message: string): boolean => {
  const preferenceKeywords = ["prefer", "like", "enjoy", "interested in"]
  const messageLower = message.toLowerCase()
  return preferenceKeywords.some(keyword => messageLower.includes(keyword))
}

export default function ChatInterface() {
  // Initialize state from sessionStorage if available
  const [transcriptUploaded, setTranscriptUploaded] = useState<boolean>(() => {
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
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(STORAGE_KEYS.STUDENT_INFO)
      return saved ? JSON.parse(saved) : null
    }
    return null
  })
  
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

  useEffect(() => {
    if (typeof window !== 'undefined' && studentInfo) {
      sessionStorage.setItem(STORAGE_KEYS.STUDENT_INFO, JSON.stringify(studentInfo))
    }
  }, [studentInfo])

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
              content: `Transcript Upload Error: ${data.error || 'Unknown error occurred'}`, 
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
          
          // Store student info
          setStudentInfo({
            major: parsedData.major,
            type: parsedData.type,
            upper_div_electives_taken: parsedData.upper_div_electives_taken,
            remaining_upper_div_courses: parsedData.remaining_upper_div_courses,
            remaining_required_courses: parsedData.remaining_required_courses
          })
          
          // Construct a detailed message about parsed transcript
          const detailedMessage = `
            🎓 Transcript Analysis:
            • Major: ${parsedData.major} (${parsedData.type})
            • Upper Division Electives Taken: ${parsedData.upper_div_electives_taken}
            • Remaining Required Courses: ${parsedData.remaining_required_courses.flat().join(', ')}
            • Possible Upper Division Courses to Take: ${parsedData.remaining_upper_div_courses.length}
          `

          setMessages(prevMessages => [
            ...prevMessages, 
            { 
              role: 'assistant', 
              content: detailedMessage,
              type: 'transcript-analysis' 
            }
          ])

          // Add course recommendations to chat
          if (parsedData.recommended_courses && parsedData.recommended_courses.length > 0) {
            const recommendedCourses = parsedData.recommended_courses
            const recommendationMessage = `Based on your transcript, here are some course recommendations for next quarter:\n\n` + 
              recommendedCourses.map((course: RecommendedCourse) => 
                `• **${course['Class Code']}**: ${course['Class Name']}\n  ${course['Days & Times'] || 'Schedule TBA'}`
              ).join('\n\n') +
              `\n\nYou can ask me for more specific recommendations based on your preferences for time of day, workload, or subject areas.`

            // Store recommendations for calendar view
            sessionStorage.setItem(
              STORAGE_KEYS.RECOMMENDED_COURSES, 
              JSON.stringify(recommendedCourses)
            )

            setMessages(prevMessages => [
              ...prevMessages, 
              { 
                role: 'assistant', 
                content: recommendationMessage,
                type: 'course-recommendations' 
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
    
    const currentInput = input
    setInput("")
    setIsLoading(true)

    try {
      // Determine if this is a recommendation request or preference question
      // to handle it properly on the backend
      const endpoint = 'http://127.0.0.1:5000/chat'
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: currentInput })
      })

      if (!response.ok) {
        throw new Error('Network response was not ok')
      }

      const data = await response.json()
      
      // Process response based on message type
      let responseType = 'general'
      if (isRecommendationRequest(currentInput)) {
        responseType = 'course-recommendations'
        
        // If this was a course recommendation, check if we need to update the stored courses
        if (data.courses) {
          const currentCourses = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.RECOMMENDED_COURSES) || '[]')
          const updatedCourses = [...currentCourses, ...data.courses]
          sessionStorage.setItem(STORAGE_KEYS.RECOMMENDED_COURSES, JSON.stringify(updatedCourses))
        }
      } else if (isPreferenceQuestion(currentInput)) {
        responseType = 'preferences'
      }
      
      // Add assistant's response to chat
      setMessages(prevMessages => [
        ...prevMessages, 
        { role: 'assistant', content: data.response, type: responseType }
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

  const getRecommendedCoursesCount = (): number => {
    try {
      const courses = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.RECOMMENDED_COURSES) || '[]')
      return courses.length
    } catch {
      return 0
    }
  }

  return (
    <div className="flex flex-col h-[70vh]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Course Assistant</h2>
        <div className="flex gap-2">
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
                      accept=".pdf" 
                      onChange={handleFileUpload} 
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {getRecommendedCoursesCount() > 0 && (
            <Button variant="outline" className="flex gap-2" onClick={() => window.location.href = '/calendar-view'}>
              <Calendar size={16} />
              View Calendar ({getRecommendedCoursesCount()})
            </Button>
          )}
        </div>
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
              {transcriptUploaded 
                ? "Ask me about courses, requirements, or for recommendations based on your preferences."
                : "Upload your transcript for personalized recommendations, or ask me general questions about courses and requirements."}
            </p>
            {transcriptUploaded && (
              <div className="mt-4 space-y-2 w-full max-w-md">
                <p className="font-medium">Try asking:</p>
                <Button 
                  variant="ghost" 
                  className="w-full text-left justify-start" 
                  onClick={() => {
                    setInput("Can you recommend courses for next quarter?")
                    handleSubmit({ preventDefault: () => {} } as React.FormEvent)
                  }}
                >
                  &quot;Can you recommend courses for next quarter?&quot;
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full text-left justify-start" 
                  onClick={() => {
                    setInput("I prefer morning classes on MWF. What would you suggest?")
                    handleSubmit({ preventDefault: () => {} } as React.FormEvent)
                  }}
                >
                  &quot;I prefer morning classes on MWF. What would you suggest?&quot;
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full text-left justify-start" 
                  onClick={() => {
                    setInput("What remaining required courses do I need to graduate?")
                    handleSubmit({ preventDefault: () => {} } as React.FormEvent)
                  }}
                >
                  &quot;What remaining required courses do I need to graduate?&quot;
                </Button>
              </div>
            )}
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
                    message.role === "assistant" && message.type === "course-recommendations" ? "bg-yellow-50" :
                    message.role === "assistant" && message.type === "preferences" ? "bg-indigo-50" :
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
                        message.role === "assistant" && message.type === "course-recommendations" ? "bg-yellow-100" :
                        message.role === "assistant" && message.type === "preferences" ? "bg-indigo-100" :
                        "bg-gray-100"
                      }
                    >
                      <AvatarFallback>
                        {message.role === "user" ? <User size={18} /> : 
                         message.role === "system" && message.type === "file-upload" ? <FileCheck size={18} /> : 
                         message.role === "assistant" && message.type === "transcript-analysis" ? <GraduationCap size={18} /> : 
                         <Bot size={18} />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium mb-1">
                        {message.role === "user" ? "You" : 
                         message.role === "system" && message.type === "file-upload" ? "System" : 
                         message.role === "assistant" && message.type === "transcript-analysis" ? "Transcript Analysis" :
                         message.role === "assistant" && message.type === "course-recommendations" ? "Course Recommendations" :
                         message.role === "assistant" && message.type === "preferences" ? "Preferences" :
                         "Course Assistant"}
                      </p>
                      <div className="text-sm whitespace-pre-wrap markdown">
                        {message.content.split('\n').map((line, i) => (
                          <React.Fragment key={i}>
                            {line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
                            {i < message.content.split('\n').length - 1 && <br />}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {isLoading && (
          <div className="flex justify-center items-center mt-4">
            <div className="animate-pulse flex space-x-2">
              <div className="h-2 w-2 bg-blue-400 rounded-full"></div>
              <div className="h-2 w-2 bg-blue-400 rounded-full"></div>
              <div className="h-2 w-2 bg-blue-400 rounded-full"></div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={input}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder={
            transcriptUploaded 
              ? "Ask about course recommendations, requirements, or your preferences..." 
              : "Ask about courses or upload your transcript for personalized recommendations..."
          }
          className="flex-1 resize-none"
          rows={2}
        />
        <Button 
          type="submit" 
          className="self-end bg-[#003c6c] hover:bg-[#00284a]" 
          disabled={isLoading}
        >
          <Send size={18} />
        </Button>
      </form>
    </div>
  )
}