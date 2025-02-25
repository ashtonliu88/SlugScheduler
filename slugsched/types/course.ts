export type Course = {
  id: string
  name: string
  quarterOffered: string
  career: string
  grading: string
  classNumber: string
  type: string
  instructionMode: string
  credits: number
  generalEducation: string[]
  status: string
  availableSeats: number
  enrollmentCapacity: number
  enrolled: number
  waitListCapacity: number
  waitListTotal: number
  description: string
  enrollmentRequirements: string
  classNotes: string
  meetingInformation: {
    days: string
    time: string
    location: string
    instructor: string
  }
  associatedSections: {
    type: string
    number: string
    days: string
    time: string
    location: string
  }[]
}

