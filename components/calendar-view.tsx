"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, CalendarIcon, X } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

interface CourseSchedule {
  id: string
  title: string
  day: string
  startTime: string
  endTime: string
  location: string
}

// Define interface for the recommended course data from the backend
interface RecommendedCourse {
  'Class Code': string
  'Course Name': string
  'Location'?: string
  // Add other properties as needed
}

export default function CalendarView() {
  const [currentTerm, setCurrentTerm] = useState("Winter 2025")
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [courseSchedule, setCourseSchedule] = useState<CourseSchedule[]>([])

  const terms = ["Fall 2024", "Winter 2025", "Spring 2025", "Summer 2025"]
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  const timeSlots = Array.from({ length: 13 }, (_, i) => `${i + 8}:00`)

  useEffect(() => {
    // Fetch recommended courses when the component mounts
    fetch('/upload')
      .then(response => response.json())
      .then(data => {
        if (data.success && data.data.recommended_courses) {
          // Extract course information from the recommended courses
          const recommendedCourseCodes = data.data.recommended_courses.map((course: RecommendedCourse) => course['Class Code'])
          setSelectedCourses(recommendedCourseCodes)

          // Transform backend course data to match our schedule interface
          const transformedSchedule = data.data.recommended_courses.flatMap((course: RecommendedCourse) => {
            // Note: You'll need to adjust this transformation based on your actual backend data
            return [
              {
                id: course['Class Code'],
                title: course['Course Name'],
                day: 'Monday', // Example day, replace with actual data
                startTime: '10:00',
                endTime: '11:45',
                location: course['Location'] || 'TBD'
              },
              {
                id: course['Class Code'],
                title: course['Course Name'],
                day: 'Wednesday', // Example day, replace with actual data
                startTime: '10:00',
                endTime: '11:45',
                location: course['Location'] || 'TBD'
              }
            ]
          })

          setCourseSchedule(transformedSchedule)

          toast({
            title: "Courses Loaded",
            description: `Loaded ${recommendedCourseCodes.length} recommended courses`,
            variant: "default"
          })
        }
      })
      .catch(error => {
        console.error('Error fetching courses:', error)
        toast({
          title: "Error",
          description: "Could not fetch recommended courses",
          variant: "destructive"
        })
      })
  }, [])

  const handleRemoveCourse = (courseId: string) => {
    setSelectedCourses(selectedCourses.filter((id) => id !== courseId))
    setCourseSchedule(courseSchedule.filter((course) => course.id !== courseId))
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
    (acc, courseId) => {
      const courseScheduleItems = courseSchedule.filter((item) => item.id === courseId)
      if (courseScheduleItems.length > 0) {
        acc[courseId] = courseScheduleItems
      }
      return acc
    },
    {} as Record<string, CourseSchedule[]>,
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
        <div className="flex gap-2">
          {Object.keys(courseGroups).map((courseId) => (
            <Badge key={courseId} variant="outline" className="flex items-center gap-1 px-2 py-1">
              {courseId}
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

      <Card>
        <CardHeader>
          <CardTitle>Weekly Schedule</CardTitle>
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
                  {Object.entries(courseGroups).map(([courseId, scheduleItems]) =>
                    scheduleItems
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
                        const colorIndex = selectedCourses.indexOf(courseId) % colors.length

                        return (
                          <div
                            key={`${courseId}-${day}-${index}`}
                            className={`absolute left-1 right-1 rounded-md border p-2 overflow-hidden ${colors[colorIndex]}`}
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                            }}
                          >
                            <div className="text-xs font-bold">{item.id}</div>
                            <div className="text-xs truncate">{item.title}</div>
                            <div className="text-xs mt-1 truncate">{item.location}</div>
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
    </div>
  )
}