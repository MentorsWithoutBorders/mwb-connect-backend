import {PartnerStudentSearch} from "./partner_student_search.model";
import {PartnerStudent} from "./partner_student.model";


export const filterRowsBySearchParams = ({rows, searchParameters}: {
  rows: PartnerStudent[],
  searchParameters: PartnerStudentSearch
}) => {
  const { searchString } = searchParameters;
  const searchByName = searchParameters.searchByName === "true";
  const searchByEmail = searchParameters.searchByEmail === "true";
  const searchByStudentStatus =
    searchParameters.searchByStudentStatus === "true";
  const searchByStudentOrganization =
    searchParameters.searchByStudentOrganization === "true";

  const lowerSearchString = searchString ? searchString.toLowerCase() : null;
  if (!lowerSearchString) {
    return rows; // we don't need to filter if there is no search string
  }

  const noneOfTheSearchParametersExists = !searchByName && !searchByEmail && !searchByStudentStatus && !searchByStudentOrganization
  return rows
    .filter(({name, certificationStatus, email, organizationName}) => {
      let condition = false
      if (noneOfTheSearchParametersExists) {
        condition = name.toLowerCase().includes(lowerSearchString)
      }
      if (searchByName && name.toLowerCase().includes(lowerSearchString)) {
        condition = true
      }
      if (searchByEmail && email.toLowerCase().includes(lowerSearchString)) {
        condition = true
      }
      if (searchByStudentStatus && certificationStatus.toLowerCase().includes(lowerSearchString)) {
        condition = true
      }
      if (searchByStudentOrganization && organizationName.toLowerCase().includes(lowerSearchString)) {
        condition = true
      }
      return condition
    })
}
