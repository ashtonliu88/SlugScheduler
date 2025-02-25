"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { PaperclipIcon as PaperClip, Send } from "lucide-react"

export default function Chat({ setCourses }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (input.trim()) {
      setMessages([...messages, { text: input, sender: "user" }])

      const response = await fetch("http://localhost:5000/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: input }),
      })

      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            text: `I've analyzed your input: "${input}" and found some recommended courses.`,
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
      setInput("")
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      handleSubmit(e)
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
      <div className="p-4 border-t border-black">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <Textarea
            placeholder="Upload transcript or enter completed courses..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="resize-none bg-[#313638] text-[#e7e7e7] placeholder-[#e7e7e7]/50 border-black focus:border-[#348AA7] transition-all duration-300"
            rows={3}
          />
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-full bg-[#313638] text-[#e7e7e7] hover:bg-[#1c5162] border-black"
            >
              <PaperClip className="h-4 w-4" />
              <span className="sr-only">Attach transcript</span>
            </Button>
            <Button type="submit" size="icon" className="rounded-full bg-[#348AA7] text-[#e7e7e7] hover:bg-[#1c5162]">
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
