export enum StudentCertificationStatus {
  Sent = "SENT",
  InProgress = "IN_PROGRESS",
  Cancelled = "CANCELLED",
  Unknown = "UNKNOWN",
}

export interface PartnerStudent {
  id: string
  email: string
  name: string
  phoneNumber?: number
  certificationStatus: StudentCertificationStatus
  organizationName: string
  testimonials: string[]
  totalCoursesAttended: number
}
