"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { PaperclipIcon as PaperClip } from "lucide-react"

export default function Chat({ setCourses }) {
  const [messages, setMessages] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)

  // Handle file selection and upload
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
  
    setSelectedFile(file)
    setMessages([...messages, { text: `Uploaded file: ${file.name}`, sender: "user" }])
  
    const formData = new FormData()
    formData.append("file", file)
  
    try {
      const response = await fetch("http://127.0.0.1:5000/upload", {
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
        .map((course) => course.course_code)
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
        { text: `Remaining upper division courses: ${restUpperCourses.join(", ")}`, sender: "bot" },
      ])

      const remainRequiredCourses = result.data.remaining_required_courses
      setMessages((prev) => [
        ...prev,
        { text: `Remaining required courses: ${remainRequiredCourses.join(", ")}`, sender: "bot" },
      ])

      // Map MongoDB course data to the expected format
      if (result.data.recommended_courses && result.data.recommended_courses.length > 0) {
        const formattedCourses = result.data.recommended_courses.map(course => {
          // Parse meeting information
          let days = "";
          let time = "";
          let location = "";
          
          if (course["Days & Times"]) {
            const meetingParts = course["Days & Times"].split(" ");
            days = meetingParts[0];
            time = meetingParts.slice(1).join(" ");
          }
          
          return {
            id: course["Class Code"],
            name: course["Class Name"],
            quarterOffered: "Winter 2025", // Based on Meeting Dates
            career: course["Class Type"],
            grading: course["Grading"],
            classNumber: course["Class Number"],
            type: course["Type"],
            instructionMode: course["Instruction"],
            credits: parseInt(course["Credits"]) || 5,
            generalEducation: course["GE"] ? course["GE"].split("") : [],
            status: course["Status"],
            availableSeats: parseInt(course["Available Seats"]) || 0,
            enrollmentCapacity: parseInt(course["Enrollment Capacity"]) || 0,
            enrolled: parseInt(course["Enrolled"]) || 0,
            waitListCapacity: parseInt(course["Wait List Capacity"]) || 0,
            waitListTotal: parseInt(course["Wait List Total"]) || 0,
            description: course["Description"] || "No description available.",
            enrollmentRequirements: course["Prereqs"] || "None",
            classNotes: "",
            meetingInformation: {
              days: days,
              time: time,
              location: course["Room"] || "TBA",
              instructor: course["Instructors"] || "TBA",
            },
            associatedSections: []
          }
        });
        
        // Set the formatted courses
        setCourses(formattedCourses);
        
        setMessages((prev) => [
          ...prev,
          { text: `Found ${formattedCourses.length} recommended courses based on your transcript.`, sender: "bot" },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { text: "No recommended courses found for your major and requirements.", sender: "bot" },
        ]);
      }
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