"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, CalendarIcon, X } from "lucide-react"

interface Course {
  'Class Code': string
  'Class Name': string
  'Days & Times'?: string
  'Room'?: string
  [key: string]: string | undefined
}

interface ScheduleItem {
  id: string
  title: string
  day: string
  startTime: string
  endTime: string
  location: string
  isOnline?: boolean
}

const terms = ["Spring 2025"]
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
const timeSlots = Array.from({ length: 13 }, (_, i) => {
  const hour = i + 8
  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour > 12 ? hour - 12 : hour
  return `${displayHour}:00 ${period}`
})

const to12HourFormat = (time: string) => {
  const [hour, minute] = time.split(":").map(Number)
  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`
}

// Storage key for recommended courses
const STORAGE_KEY_RECOMMENDED_COURSES = 'course-assistant-recommended-courses'
console.log("STORAGE_KEY_RECOMMENDED_COURSES", STORAGE_KEY_RECOMMENDED_COURSES)

// Function to convert recommended courses to schedule format
const convertRecommendedCoursesToSchedule = (courses: Course[]): ScheduleItem[] => {
  const scheduleItems: ScheduleItem[] = []
  
  courses.forEach(course => {
    // Skip courses with empty Days & Times
    if (!course['Days & Times']) {
      // For online courses with no specific time, add a placeholder in the schedule
      if (course['Room']?.toLowerCase() === 'online') {
        scheduleItems.push({
          id: course['Class Code'],
          title: course['Class Name'],
          day: 'Monday', // Assign a default day
          startTime: '9:00',
          endTime: '10:00',
          location: 'Online / Asynchronous',
          isOnline: true
        })
      }
      return
    }
    
    // Parse days and times from the course data
    // Handling formats like "MWF 01:20PM-02:25PM" or "TuTh 05:20PM-06:55PM"
    const daysTimesPattern = /([MTWRFSu]+|[A-Za-z]+)\s+(\d+:\d+(?:AM|PM))-(\d+:\d+(?:AM|PM))/i
    const match = course['Days & Times']?.match(daysTimesPattern)
    
    if (match) {
      let daysCodes = match[1]
      const startTimeRaw = match[2]
      const endTimeRaw = match[3]
      
      // Convert AM/PM time to 24-hour format
      const convertTo24Hour = (timeStr: string) => {
        const [time, period] = [
          timeStr.slice(0, -2), 
          timeStr.slice(-2).toUpperCase()
        ]
        const [hours, minutes] = time.split(':').map(Number)
        let convertedHours = hours
        
        if (period === 'PM' && hours < 12) convertedHours += 12
        if (period === 'AM' && hours === 12) convertedHours = 0
        
        return `${convertedHours}:${minutes.toString().padStart(2, '0')}`
      }
      
      const startTime = convertTo24Hour(startTimeRaw)
      const endTime = convertTo24Hour(endTimeRaw)
      
      // Map day codes to full day names
      const dayMap: Record<string, string> = {
        'M': 'Monday',
        'T': 'Tuesday',
        'W': 'Wednesday',
        'R': 'Thursday',
        'F': 'Friday',
        'Tu': 'Tuesday',
        'Th': 'Thursday',
        'Su': 'Sunday'
      }
      
      // Handle "TuTh" format by splitting into individual days
      if (daysCodes === 'TuTh') {
        daysCodes = 'TR'
      }
      
      // Create schedule entry for each day
      for (let i = 0; i < daysCodes.length; i++) {
        let dayCode = daysCodes[i]
        
        // Handle two-character codes like "Tu" and "Th"
        if (i < daysCodes.length - 1 && daysCodes[i] === 'T' && daysCodes[i+1] === 'u') {
          dayCode = 'Tu'
          i++
        } else if (i < daysCodes.length - 1 && daysCodes[i] === 'T' && daysCodes[i+1] === 'h') {
          dayCode = 'Th'
          i++
        }
        
        const day = dayMap[dayCode]
        if (day) {
          scheduleItems.push({
            id: course['Class Code'],
            title: course['Class Name'],
            day,
            startTime,
            endTime,
            location: course['Room'] || 'TBA'
          })
        }
      }
    }
  })
  
  return scheduleItems
}

export default function CalendarView() {
  const [currentTerm, setCurrentTerm] = useState("Spring 2025")
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([])

  // Retrieve recommended courses from sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCourses = sessionStorage.getItem(STORAGE_KEY_RECOMMENDED_COURSES)
      if (savedCourses) {
        try {
          const parsedCourses: Course[] = JSON.parse(savedCourses)
          const convertedSchedule = convertRecommendedCoursesToSchedule(parsedCourses)
          setScheduleItems(convertedSchedule)
          
          const courseIds = Array.from(new Set(convertedSchedule.map(item => item.id)))
          setSelectedCourses(courseIds)
        } catch (error) {
          console.error('Error parsing recommended courses:', error)
        }
      }
    }
  }, [])

  const handleRemoveCourse = (courseId: string) => {
    setSelectedCourses(selectedCourses.filter((id) => id !== courseId))
  }

  const handlePrevTerm = () => {
    const currentIndex = terms.indexOf(currentTerm)
    if (currentIndex > 0) {
      setCurrentTerm(terms[currentIndex - 1])
    }
  }

  const handleNextTerm = () => {
    const currentIndex = terms.indexOf(currentTerm)
    if (currentIndex < terms.length - 1) {
      setCurrentTerm(terms[currentIndex + 1])
    }
  }

  // Group schedule items by course ID
  const courseGroups = selectedCourses.reduce(
    (acc: Record<string, ScheduleItem[]>, courseId) => {
      const courseSchedule = scheduleItems.filter((item) => item.id === courseId)
      if (courseSchedule.length > 0) {
        acc[courseId] = courseSchedule
      }
      return acc
    },
    {}
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevTerm}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            {currentTerm}
          </h2>
          <Button variant="outline" size="icon" onClick={handleNextTerm}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.keys(courseGroups).map((courseId) => (
            <Badge 
              key={courseId} 
              variant="outline" 
              className="flex items-center gap-1 px-2 py-1 bg-green-50 border-green-300"
            >
              {courseId} ⭐
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 p-0"
                onClick={() => handleRemoveCourse(courseId)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      </div>

      {scheduleItems.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p>No recommended courses available. Please upload your transcript in the Course Assistant chat.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recommended Courses Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr] gap-1 overflow-x-auto">
              {/* Time column */}
              <div className="col-span-1">
                <div className="h-12 border-b flex items-end justify-center font-medium">Time</div>
                {timeSlots.map((time, index) => (
                  <div key={index} className="h-20 border-b flex items-center justify-center text-sm text-gray-500">
                    {time}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {days.map((day, dayIndex) => (
                <div key={dayIndex} className="col-span-1 min-w-[150px]">
                  <div className="h-12 border-b flex items-end justify-center font-medium">{day}</div>
                  <div className="relative">
                    {timeSlots.map((_, timeIndex) => (
                      <div key={timeIndex} className="h-20 border-b"></div>
                    ))}

                    {/* Course blocks */}
                    {Object.entries(courseGroups).map(([courseId, courseItems]) =>
                      courseItems
                        .filter((item) => item.day === day)
                        .map((item, index) => {
                          const startHour = Number.parseInt(item.startTime.split(":")[0])
                          const endHour = Number.parseInt(item.endTime.split(":")[0])
                          const startMinutes = Number.parseInt(item.startTime.split(":")[1]) / 60
                          const endMinutes = Number.parseInt(item.endTime.split(":")[1]) / 60
                          const duration = endHour + endMinutes - (startHour + startMinutes)
                          const top = (startHour - 8 + startMinutes) * 80 // 80px per hour
                          const height = duration * 80

                          // Different colors for different courses
                          const colors = [
                            "bg-blue-100 border-blue-300 text-blue-800",
                            "bg-green-100 border-green-300 text-green-800",
                            "bg-purple-100 border-purple-300 text-purple-800",
                            "bg-amber-100 border-amber-300 text-amber-800",
                          ]
                          
                          const colorClass = colors[selectedCourses.indexOf(courseId) % colors.length]
                          const onlineClass = item.isOnline ? "border-dashed" : ""

                          return (
                            <div
                              key={`${courseId}-${day}-${index}`}
                              className={`absolute left-1 right-1 rounded-md border p-2 overflow-hidden ${colorClass} ${onlineClass}`}
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                              }}
                            >
                              <div className="text-xs font-bold flex items-center">
                                {item.id} <span className="ml-1">⭐</span>
                              </div>
                              <div className="text-xs truncate">{item.title}</div>
                              <div className="text-xs">{to12HourFormat(item.startTime)} - {to12HourFormat(item.endTime)}</div>
                              <div className="text-xs mt-1 truncate">{item.location}</div>
                              {item.isOnline && (
                                <div className="text-xs italic mt-1">Asynchronous</div>
                              )}
                            </div>
                          )
                        }),
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}