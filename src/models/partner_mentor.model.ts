export default interface PartnerMentor {
  id: string;
  name: string;
  email: string;
  courses: number;
  students: number;
  hours: number;
}

export interface MentorDetailsResponse {
  id: string;
  name: string;
  email: string;
  courses: {
    id: string;
    startDate: string;
    canceledDate: string | null;
    duration: 3 | 6;
    completedHours: number;
    project: {
      id: string;
      name: string;
    } | null;
    students: {
      id: string;
      name: string;
      email: string;
      testimonials: {
        id: string;
        url: string;
        uploadDate: string;
      }[];
    }[];
  }[];
}

export interface MentorDetailsDbRawResult {
  id: string;
  name: string;
  email: string;
  courses: {
    id: string;
    project: {
      id: string;
      name: string;
    } | null;
    duration: 3 | 6;
    students: {
      id: string;
      name: string;
      email: string;
      testimonials: {
        id: string;
        url: string;
        uploaded_date_time: string;
      }[];
    }[];
    start_date_time: string;
    canceled_date_time: string | null;
  }[];
}
