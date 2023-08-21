import {filterRowsBySearchParams} from "./partner_student.model.utils";
import {PartnerStudent, StudentCertificationStatus} from "./partner_student.model";

describe("filterRowsBySearchParams", () => {
  const rows: PartnerStudent[] = [
    {
      id: "1",
      name: "John anika",
      certificationStatus: StudentCertificationStatus.InProgress,
      email: "anika@test.com",
      totalCoursesAttended: 0,
      testimonials: ['https://awesomeTestimonial'],
      organizationName: "test organization"
    },
    {
      id: "2",
      name: "tester",
      certificationStatus: StudentCertificationStatus.InProgress,
      email: "tester@test.com",
      totalCoursesAttended: 1,
      testimonials: ['https://awesomeTestimonial0'],
      organizationName: "Some organization"
    },
    {
      id: "3",
      name: "John",
      certificationStatus: StudentCertificationStatus.Sent,
      email: "John@test.com",
      totalCoursesAttended: 10,
      testimonials: ["https://magic", "https://magic2",],
      organizationName: "test organization"
    },
    {
      id: "4",
      name: "Jane",
      certificationStatus: StudentCertificationStatus.Sent,
      email: "jane@test.com",
      totalCoursesAttended: 0,
      testimonials: ["https://youtubetest1", "https://youtubetest2",],
      organizationName: "testing John"
    }]
  describe("only 1 or less search queries are on", () => {

    it("should return rows if there is no search string", () => {
      const searchParameters = {
        searchString: "",
        searchByName: false,
        searchByEmail: false,
        searchByStudentStatus: false,
        searchByStudentOrganization: false
      }
      expect(filterRowsBySearchParams({rows, searchParameters})).toEqual(rows)
    })

    it("should search by name when all the searching values are false", () => {
      const searchParameters = {
        searchString: "Anika",
        searchByName: false,
        searchByEmail: false,
        searchByStudentStatus: false,
        searchByStudentOrganization: false
      }
      expect(filterRowsBySearchParams({rows, searchParameters})).toEqual([rows[0]])
    })

    it("should return the correct rows when searching by name", () => {
      const searchParameters = {
        searchString: "John",
        searchByName: true,
        searchByEmail: false,
        searchByStudentStatus: false,
        searchByStudentOrganization: false
      }
      expect(filterRowsBySearchParams({rows, searchParameters})).toEqual([rows[0], rows[2]])
    })

    it("should return empty array when searching by name dont match any row", () => {
      const searchParameters = {
        searchString: "Not matching name",
        searchByName: true,
        searchByEmail: false,
        searchByStudentStatus: false,
        searchByStudentOrganization: false
      }
      expect(filterRowsBySearchParams({rows, searchParameters})).toEqual([])
    })

    it("should return the correct rows when searching by name", () => {
      const searchParameters = {
        searchString: "jane@test.com",
        searchByName: false,
        searchByEmail: true,
        searchByStudentStatus: false,
        searchByStudentOrganization: false
      }
      expect(filterRowsBySearchParams({rows, searchParameters})).toEqual([rows[3]])
    })

    it("should return empty array when searching by email dont match any row", () => {
      const searchParameters = {
        searchString: "Not matching email",
        searchByName: false,
        searchByEmail: true,
        searchByStudentStatus: false,
        searchByStudentOrganization: false
      }
      expect(filterRowsBySearchParams({rows, searchParameters})).toEqual([])
    })

    it("should return the correct rows when searching by student status", () => {
      const searchParameters = {
        searchString: "Not matching email",
        searchByName: false,
        searchByEmail: false,
        searchByStudentStatus: true,
        searchByStudentOrganization: false
      }
      expect(filterRowsBySearchParams({rows, searchParameters})).toEqual([])
    })
    it("should return empty array when when searching by student status dont match any rows", () => {
      const searchParameters = {
        searchString: "Not matching STATUS",
        searchByName: false,
        searchByEmail: false,
        searchByStudentStatus: true,
        searchByStudentOrganization: false
      }
      expect(filterRowsBySearchParams({rows, searchParameters})).toEqual([])
    })
  })
  describe("more than one search queries are on", () => {
    it("should return multiple matching rows", () => {
      const searchParameters = {
        searchString: "John",
        searchByName: true,
        searchByEmail: true,
        searchByStudentStatus: true,
        searchByStudentOrganization: false
      }
      expect(filterRowsBySearchParams({rows, searchParameters})).toEqual([rows[0],rows[2]])
    })

    it("should return multiple matching rows", () => {
      const searchParameters = {
        searchString: "John",
        searchByName: true,
        searchByEmail: true,
        searchByStudentStatus: false,
        searchByStudentOrganization: true
      }
      expect(filterRowsBySearchParams({rows, searchParameters})).toEqual([rows[0],rows[2],rows[3]])
    })

  })
})

