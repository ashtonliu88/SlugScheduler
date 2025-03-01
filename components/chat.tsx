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
      const response = await fetch("https://slugschedulerrenderhost.onrender.com/upload", { // Ensure correct API URL
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
      const previousCourses = Object.values(result.data.courses_by_quarter)
        .flat()
        .map((course: { course_code: string }) => course.course_code)
        .join(", ") || "No courses found"
      setMessages((prev) => [
        ...prev,
        { text: `Previous courses: ${previousCourses}`, sender: "bot" },
      ])
      
      //output how many upper courses taken
      const numUpperCourses = result.data.upper_div_electives_taken
      setMessages((prev) => [
        ...prev,
        { text: `Number of upper division electives taken: ${numUpperCourses}`, sender: "bot" },
      ])
      
      const restUpperCourses = result.data.remaining_upper_div_courses
      setMessages((prev) => [
        ...prev,
        { text: `Remaining upper division courses: ${restUpperCourses}`, sender: "bot" },
      ])

      const remainRequiredCourses = result.data.remaining_required_courses
      setMessages((prev) => [
        ...prev,
        { text: `Remaining required courses: ${remainRequiredCourses}`, sender: "bot" },
      ])

      

      setCourses((prevCourses) => {
        const courseTimings = [
          { days: "MWF", time: "07:05 - 08:45" },
          { days: "TTH", time: "09:00 - 10:30" },
          { days: "MWF", time: "11:00 - 12:15" },
        ]
        
        const newCourses = Array.from({ length: 3 }, (_, index) => ({
          id: `CS${prevCourses.length + 101 + index}`,
          name: `Computer Science ${prevCourses.length + 101 + index}`,
          quarterOffered: "Fall 2024",
          career: "Undergraduate",
          grading: "Letter Grade",
          classNumber: `${12345 + prevCourses.length + index}`,
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
            ...courseTimings[(prevCourses.length + index) % courseTimings.length],
            location: "Science Center 101",
            instructor: "Dr. Smith",
          },
          associatedSections: [
            {
              type: "Lab",
              number: `LA${index + 1}`,
              days: "T",
              time: "14:00 - 15:50",
              location: "Computer Lab 204",
            },
          ],
        }))
        return [...prevCourses, ...newCourses]
      })
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