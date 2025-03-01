"use client"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import type { Course } from "@/types/course"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7) // 7 AM to 10 PM

const DAY_MAP = {
  M: "Monday",
  T: "Tuesday",
  W: "Wednesday",
  H: "Thursday",
  F: "Friday",
}

// Array of colors for course blocks
const COURSE_COLORS = [
  "bg-[#4a90e2]", // Blue
  "bg-[#50c878]", // Emerald
  "bg-[#f39c12]", // Orange
  "bg-[#e74c3c]", // Red
  "bg-[#9b59b6]", // Purple
  "bg-[#1abc9c]", // Turquoise
  "bg-[#f1c40f]", // Yellow
  "bg-[#e67e22]", // Carrot
]

export default function Schedule({
  schedule,
  removeFromSchedule,
}: { schedule: Course[]; removeFromSchedule: (course: Course) => void }) {
  const parseTime = (timeStr) => {
    // Handle different time formats: "HH:MM" or "HH:MMAM/PM"
    if (!timeStr) return 0;
    
    // For MongoDB format like "12:00PM-01:05PM"
    if (timeStr.includes("AM") || timeStr.includes("PM")) {
      // Extract the start time portion (before the dash)
      const startTime = timeStr.split("-")[0].trim();
      
      // Parse 12-hour format
      let hours = parseInt(startTime.match(/\d+/)[0]);
      const minutes = parseInt(startTime.match(/:(\d+)/)[1] || 0);
      const isPM = startTime.includes("PM");
      
      // Convert to 24-hour format
      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      
      return hours + minutes / 60;
    } 
    
    // For original format "HH:MM"
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours + minutes / 60;
  }

  const getCourseTiming = (course: Course) => {
    const [startTime, endTime] = course.meetingInformation.time.split(" - ")
    return {
      start: parseTime(startTime),
      end: parseTime(endTime),
      days: course.meetingInformation.days
        .split("")
        .map((day) => {
          if (day === "T" && course.meetingInformation.days.includes("H")) {
            return course.meetingInformation.days.includes("T", course.meetingInformation.days.indexOf("T") + 1)
              ? "Tuesday"
              : null
          }
          return DAY_MAP[day] || null
        })
        .filter(Boolean) as string[],
    }
  }

  const getGridPosition = (time: number) => {
    const hour = Math.floor(time)
    const minute = (time - hour) * 60
    return {
      top: `${((hour - 7) * 60 + minute) * 0.8}px`, // 0.8px per minute
      height: `${48}px`, // Default height for one hour
    }
  }

  const getCourseStyle = (course: Course) => {
    const timing = getCourseTiming(course)
    const startPos = getGridPosition(timing.start)
    const duration = (timing.end - timing.start) * 60 // Duration in minutes
    const colorIndex = Number.parseInt(course.id.replace(/\D/g, "")) % COURSE_COLORS.length
    return {
      top: startPos.top,
      height: `${duration * 0.8}px`, // 0.8px per minute
      backgroundColor: COURSE_COLORS[colorIndex].replace("bg-", ""),
    }
  }

  return (
    <div className="flex-1 p-4 overflow-auto bg-[#313638]">
      <h2 className="text-2xl font-bold mb-4 text-[#e7e7e7]">Your Schedule</h2>
      <div className="bg-[#1b1c1d] rounded-lg shadow-lg overflow-hidden">
        <div className="grid grid-cols-6 gap-[1px] bg-black">
          <div className="col-span-1 bg-transparent"></div>
          {DAYS.map((day) => (
            <div key={day} className="text-center py-3 font-medium bg-[#1c5162] text-[#e7e7e7]">
              {day}
            </div>
          ))}

          <div className="col-span-6 grid grid-cols-6">
            <div className="relative" style={{ height: `${16 * 60 * 0.8}px` }}>
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute w-full border-t border-black text-sm text-right pr-2 text-[#e7e7e7]/70"
                  style={{ top: `${(hour - 7) * 60 * 0.8}px` }}
                >
                  {hour % 12 || 12}
                </div>
              ))}
            </div>

            {DAYS.map((day) => (
              <div key={day} className="relative border-l border-black" style={{ height: `${16 * 60 * 0.8}px` }}>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#1c5162]/10 opacity-50 pointer-events-none"></div>
                {schedule
                  .filter((course) => getCourseTiming(course).days.includes(day))
                  .map((course) => (
                    <div
                      key={`${course.id}-${day}`}
                      className="absolute inset-x-1 rounded-lg p-2 cursor-pointer transition-all duration-200 ease-in-out hover:shadow-md group"
                      style={getCourseStyle(course)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="text-xs font-medium text-[#e7e7e7]">{course.id}</div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 text-[#e7e7e7] opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/20"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeFromSchedule(course)
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-xs text-[#e7e7e7] mt-1">{course.meetingInformation.time}</div>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

