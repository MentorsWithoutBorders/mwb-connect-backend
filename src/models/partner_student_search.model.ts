export default interface PartnerStudentSearch {
  courseFromDate?: string;
  courseToDate?: string;

  searchString?: string;
  searchByName?: boolean;
  searchByEmail?: boolean;
  searchByStudentStatus?: boolean;
  searchByStudentOrganization?: boolean;
}
