export default interface PartnerMentorsSearch {
  searchString?: string;
  courseFromDate?: string;
  courseToDate?: string;
  searchByName?: "true" | "false";
  searchByEmail?: "true" | "false";
  searchByStudent?: "true" | "false";
  searchByStudentOrganization?: "true" | "false";
}
