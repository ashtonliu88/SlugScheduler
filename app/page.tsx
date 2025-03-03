"use client"

import { useState } from "react"
import { DragDropContext } from "react-beautiful-dnd"
import Chat from "@/components/chat"
import CourseRecommendations from "@/components/course-recommendations"
import Schedule from "@/components/schedule"
import type { Course } from "@/types/course"

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([])
  const [schedule, setSchedule] = useState<Course[]>([])

  const onDragEnd = (result) => {
    if (!result.destination) return

    const { source, destination } = result

    if (source.droppableId === "recommendations") {
      const course = courses[source.index]
      if (destination.droppableId.includes("-")) {
        // Dropping into the schedule
        const [day, hour] = destination.droppableId.split("-")
        const courseTiming = getCourseTiming(course)

        if (
          courseTiming.days.includes(day[0]) &&
          courseTiming.start <= Number.parseInt(hour) &&
          courseTiming.end > Number.parseInt(hour)
        ) {
          addToSchedule(course)
        }
      }
    }
  }

  const getCourseTiming = (course: Course) => {
    const [startTime, endTime] = course.meetingInformation.time.split(" - ")
    const [startHour, startMinute] = startTime.split(":").map(Number)
    const [endHour, endMinute] = endTime.split(":").map(Number)
    return {
      start: startHour + startMinute / 60,
      end: endHour + endMinute / 60,
      days: course.meetingInformation.days.split(""),
    }
  }

  const addToSchedule = (course: Course) => {
    if (!schedule.some((scheduledCourse) => scheduledCourse.id === course.id)) {
      setSchedule((prevSchedule) => [...prevSchedule, course])
      setCourses((prevCourses) => prevCourses.filter((c) => c.id !== course.id))
    }
  }

  const removeFromSchedule = (course: Course) => {
    setSchedule((prevSchedule) => prevSchedule.filter((c) => c.id !== course.id))
    setCourses((prevCourses) => [...prevCourses, course])
  }

  const removeFromRecommendations = (course: Course) => {
    setCourses((prevCourses) => prevCourses.filter((c) => c.id !== course.id))
    addToSchedule(course)
  }

  const removeFromRecommendationsOnly = (course: Course) => {
    setCourses((prevCourses) => prevCourses.filter((c) => c.id !== course.id))
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <main className="flex h-screen overflow-hidden bg-gradient-to-br from-[#1b1c1d] via-[#313638] to-[#1c5162] text-foreground">
        <div className="w-1/3 flex flex-col border-r border-black">
          <Chat setCourses={setCourses} />
        </div>
        <div className="w-2/3 flex flex-col">
          <div className="h-1/3 overflow-y-auto border-b border-black bg-[#1c5162]/20">
            <CourseRecommendations
              courses={courses}
              addToSchedule={addToSchedule}
              removeFromRecommendations={removeFromRecommendations}
              removeFromRecommendationsOnly={removeFromRecommendationsOnly}
            />
          </div>
          <div className="flex-1 overflow-y-auto bg-[#313638]/30">
            <Schedule schedule={schedule} removeFromSchedule={removeFromSchedule} />
          </div>
        </div>
      </main>
    </DragDropContext>
  )
}

