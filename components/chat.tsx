"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PaperclipIcon as PaperClip } from "lucide-react"

export default function Chat({ setCourses }) {
  const [messages, setMessages] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      setSelectedFile(file)
      setMessages([...messages, { text: `Uploaded file: ${file.name}`, sender: "user" }])

      // Simulate processing and generating course recommendations
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            text: `Analyzed file: ${file.name} and found recommended courses.`,
            sender: "bot",
          },
        ])
        setCourses((prevCourses) => {
          const courseTimings = [
            { days: "MWF", time: "07:05 - 08:45" },
            { days: "TTH", time: "09:00 - 10:30" },
            { days: "MWF", time: "11:00 - 12:15" },
          ]

          const newCourse = {
            id: `CS${prevCourses.length + 101}`,
            name: `Computer Science ${prevCourses.length + 101}`,
            quarterOffered: "Fall 2024",
            career: "Undergraduate",
            grading: "Letter Grade",
            classNumber: `${12345 + prevCourses.length}`,
            type: "Lecture",
            instructionMode: "In Person",
            credits: 4,
            generalEducation: ["Quantitative Reasoning"],
            status: "Open",
            availableSeats: 15,
            enrollmentCapacity: 120,
            enrolled: 105,
            waitListCapacity: 20,
            waitListTotal: 0,
            description: "An introduction to computer science and programming.",
            enrollmentRequirements: "None",
            classNotes: "Laptop required for in-class exercises",
            meetingInformation: {
              ...courseTimings[prevCourses.length % courseTimings.length],
              location: "Science Center 101",
              instructor: "Dr. Smith",
            },
            associatedSections: [
              {
                type: "Lab",
                number: "LA1",
                days: "T",
                time: "14:00 - 15:50",
                location: "Computer Lab 204",
              },
            ],
          }
          return [...prevCourses, newCourse]
        })
      }, 1000)
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
          accept=".pdf,.txt,.doc,.docx" // Optional: Restrict file types
        />
        {/* Button to Trigger File Input */}
        <label htmlFor="file-upload" className="cursor-pointer">
          <Button
            type="button"
            size="icon"
            className="rounded-full bg-[#313638] text-[#e7e7e7] hover:bg-[#1c5162] border-black p-4"
          >
            <PaperClip className="h-5 w-5" />
            <span className="sr-only">Upload transcript</span>
          </Button>
        </label>
        {/* Display Selected File Name */}
        {selectedFile && <span className="text-[#e7e7e7] mt-2">Selected file: {selectedFile.name}</span>}
      </div>
    </div>
  )
}