"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { PaperclipIcon as PaperClip } from "lucide-react"

export default function Chat({ setCourses }) {
  const [messages, setMessages] = useState([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Handle file selection and upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
  
    setSelectedFile(file)
    setMessages([...messages, { text: `Uploaded file: ${file.name}`, sender: "user" }])
  
    const formData = new FormData()
    formData.append("file", file)
  
    try {
      const response = await fetch("http://127.0.0.1:5000/upload", { // Ensure correct API URL
        method: "POST",
        body: formData,
      })
  
      // Ensure the response is valid JSON
      const text = await response.text()
      let result
      try {
        result = JSON.parse(text)
      } catch {
        throw new Error(`Invalid JSON response: ${text.substring(0, 200)}`)
      }
  
      if (!response.ok) {
        throw new Error(result.error || "Unknown error")
      }
  
      setMessages((prev) => [
        ...prev,
        { text: `Analyzed file: ${file.name} and found recommended courses.`, sender: "bot" },
      ])
      const yearOfAdmission = Object.keys(result.data.courses_by_quarter)[0].split(" ")[0]
      setMessages((prev) => [
        ...prev,
        { text: `Extracted data: Major - ${result.data.major}, Year of Admission - ${yearOfAdmission}`, sender: "bot" },
      ])
      
    } catch (error) {
      console.error("Error uploading file:", error)
      setMessages((prev) => [
        ...prev,
        { text: `Error processing file: ${error.message}`, sender: "bot" },
      ])
    }
  }
  
  
  

  return (
    <div className="flex flex-col h-full bg-[#1b1c1d]">
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <Card
            key={index}
            className={`p-3 max-w-[80%] ${
              message.sender === "user" ? "ml-auto bg-[#348AA7] text-[#e7e7e7]" : "bg-[#1c5162] text-[#e7e7e7]"
            } shadow-lg transition-all duration-300 ease-in-out hover:shadow-xl`}
          >
            {message.text}
          </Card>
        ))}
      </div>
      <div className="p-4 border-t border-black flex flex-col items-center gap-2">
        {/* File Input */}
        <input
          type="file"
          id="file-upload"
          className="hidden"
          onChange={handleFileUpload}
          accept=".pdf" // Restrict to PDF files
        />
        {/* Button to Trigger File Input */}
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="rounded-full bg-[#313638] text-[#e7e7e7] hover:bg-[#1c5162] border-black p-4">
            <PaperClip className="h-5 w-5" />
            <span className="sr-only">Upload transcript</span>
          </div>
        </label>
        {/* Display Selected File Name */}
        {selectedFile && <span className="text-[#e7e7e7] mt-2">Selected file: {selectedFile.name}</span>}
      </div>
    </div>
  )
}