export default interface PartnerMentorsSearch {
  searchString?: string;
  courseFromDate?: string;
  courseToDate?: string;
  searchByName?: boolean;
  searchByEmail?: boolean;
  searchByStudent?: boolean;
  searchByStudentOrganization?: boolean;
}
