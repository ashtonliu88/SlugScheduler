"use client"

import { useState } from "react"
import { Droppable, Draggable } from "react-beautiful-dnd"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, X } from "lucide-react"
import type { Course } from "@/types/course"

export default function CourseRecommendations({
  courses,
  addToSchedule,
  removeFromRecommendations,
  removeFromRecommendationsOnly,
}: {
  courses: Course[]
  addToSchedule: (course: Course) => void
  removeFromRecommendations: (course: Course) => void
  removeFromRecommendationsOnly: (course: Course) => void
}) {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)

  const openCourseDetails = (course: Course) => {
    setSelectedCourse(course)
  }

  const closeCourseDetails = () => {
    setSelectedCourse(null)
  }

  return (
    <div className="p-6 bg-[#1c5162]/20 h-full overflow-hidden">
      {courses.length === 0 && <p className="text-[#e7e7e7]/70">No courses available. Add some courses in the chat.</p>}
      <h2 className="text-2xl font-bold mb-4 text-[#e7e7e7]">Recommended Courses</h2>
      <Droppable droppableId="recommendations" direction="horizontal">
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="flex space-x-4 overflow-x-auto pb-4 mt-4"
          >
            {courses.map((course, index) => (
              <Draggable key={course.id} draggableId={course.id} index={index}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className="flex-shrink-0"
                  >
                    <Card className="w-64 bg-[#313638] hover:bg-[#1c5162] cursor-pointer transition-all duration-200 ease-in-out shadow-md hover:shadow-lg relative group border-black">
                      <CardHeader onClick={() => openCourseDetails(course)}>
                        <CardTitle className="text-sm flex justify-between items-center">
                          <span className="text-[#e7e7e7]">{course.name}</span>
                          <Badge variant={course.status === "Open" ? "default" : "destructive"} className="ml-2">
                            {course.status}
                          </Badge>
                        </CardTitle>
                        <div className="text-xs text-[#e7e7e7]/70">
                          <div>
                            {course.id} • {course.credits} credits
                          </div>
                          <div>
                            {course.meetingInformation.days} {course.meetingInformation.time}
                          </div>
                        </div>
                      </CardHeader>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full bg-[#348AA7] text-[#e7e7e7] hover:bg-[#1c5162]"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeFromRecommendations(course)
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full bg-red-500 text-[#e7e7e7] hover:bg-red-600"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeFromRecommendationsOnly(course)
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <Dialog open={selectedCourse !== null} onOpenChange={closeCourseDetails}>
        <DialogContent className="sm:max-w-[600px] bg-[#1b1c1d] border-black">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#e7e7e7]">{selectedCourse?.name}</DialogTitle>
            <DialogDescription className="text-sm text-[#e7e7e7]/70">
              {selectedCourse?.id} • {selectedCourse?.credits} credits
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="mt-4 max-h-[60vh]">
            <div className="space-y-6 pr-4">
              <div>
                <h4 className="font-semibold text-[#e7e7e7]">Description</h4>
                <p className="text-sm text-[#e7e7e7]/70">{selectedCourse?.description}</p>
              </div>
              <div>
                <h4 className="font-semibold text-[#e7e7e7]">Meeting Information</h4>
                <p className="text-sm text-[#e7e7e7]/70">
                  {selectedCourse?.meetingInformation.days} {selectedCourse?.meetingInformation.time}
                  <br />
                  Location: {selectedCourse?.meetingInformation.location}
                  <br />
                  Instructor: {selectedCourse?.meetingInformation.instructor}
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-[#e7e7e7]">Enrollment</h4>
                <div className="text-sm text-[#e7e7e7]/70">
                  <div className="flex items-center gap-2">
                    Status:
                    <Badge variant={selectedCourse?.status === "default" ? "default" : "destructive"}>
                      {selectedCourse?.status}
                    </Badge>
                  </div>
                  <div>Available Seats: {selectedCourse?.availableSeats}</div>
                  <div>
                    Enrolled: {selectedCourse?.enrolled} / {selectedCourse?.enrollmentCapacity}
                  </div>
                  <div>
                    Waitlist: {selectedCourse?.waitListTotal} / {selectedCourse?.waitListCapacity}
                  </div>
                </div>
              </div>
              {selectedCourse?.enrollmentRequirements && (
                <div>
                  <h4 className="font-semibold text-[#e7e7e7]">Enrollment Requirements</h4>
                  <p className="text-sm text-[#e7e7e7]/70">{selectedCourse.enrollmentRequirements}</p>
                </div>
              )}
              {selectedCourse?.classNotes && (
                <div>
                  <h4 className="font-semibold text-[#e7e7e7]">Class Notes</h4>
                  <p className="text-sm text-[#e7e7e7]/70">{selectedCourse.classNotes}</p>
                </div>
              )}
              {selectedCourse?.generalEducation && selectedCourse.generalEducation.length > 0 && (
                <div>
                  <h4 className="font-semibold text-[#e7e7e7]">General Education</h4>
                  <p className="text-sm text-[#e7e7e7]/70">{selectedCourse.generalEducation.join(", ")}</p>
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="flex justify-between items-center mt-6">
            <Button
              variant="outline"
              onClick={closeCourseDetails}
              className="bg-[#313638] text-[#e7e7e7] hover:bg-[#1c5162] border-black"
            >
              Close
            </Button>
            <Button
              className="bg-[#348AA7] text-[#e7e7e7] hover:bg-[#1c5162]"
              onClick={() => {
                if (selectedCourse) {
                  addToSchedule(selectedCourse)
                  closeCourseDetails()
                }
              }}
            >
              Add to Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

