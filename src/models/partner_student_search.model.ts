export interface PartnerStudentSearch {
  courseFromDate?: string;
  courseToDate?: string;

  searchString?: string;
  searchByName?: "true" | "false";
  searchByEmail?: "true" | "false";
  searchByStudentStatus?: "true" | "false";
  searchByStudentOrganization?: "true" | "false";
}
