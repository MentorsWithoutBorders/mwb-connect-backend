import {filterRowsBySearchParams} from "./partner_student.model.utils";
import PartnerStudent, {StudentStatus} from "./partner_student.model";

// write 10 tests for the filterRowsBySearchParams function
describe("filterRowsBySearchParams", () => {
  const rows: PartnerStudent[] = [
    {
      name: "John anika",
      studentStatus: StudentStatus.InProgress,
      email: "anika@test.com",
      totalCoursesAttended: 0,
    },
    {
      name: "tester",
      studentStatus: StudentStatus.InProgress,
      email: "tester@test.com",
      totalCoursesAttended: 1,
    },
    {
      name: "John",
      studentStatus: StudentStatus.Sent,
      email: "John@test.com",
      totalCoursesAttended: 10,
    },
    {
      name: "Jane",
      studentStatus: StudentStatus.Sent,
      email: "jane@test.com",
      totalCoursesAttended: 0,
    }]

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
    expect(filterRowsBySearchParams({rows, searchParameters})).toEqual([rows[0],rows[2]])
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
