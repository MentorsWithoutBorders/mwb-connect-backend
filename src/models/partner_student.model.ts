export enum StudentStatus {
  Sent = "SENT",
  InProgress = "IN_PROGRESS",
  Cancelled = "CANCELLED",
  Unknown = "UNKNOWN",
}

export default interface PartnerStudent {
  name: string,
  email: string
  totalCoursesAttended: number
  phoneNumber?: number
  studentStatus: StudentStatus
}