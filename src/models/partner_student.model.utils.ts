import {PartnerStudentSearch} from "./partner_student_search.model";
import {PartnerStudent} from "./partner_student.model";


export const filterRowsBySearchParams = ({rows, searchParameters}: {
  rows: PartnerStudent[],
  searchParameters: PartnerStudentSearch
}) => {
  const {
    searchString,
    searchByName,
    searchByEmail,
    searchByStudentStatus,
    searchByStudentOrganization
  } = searchParameters;
  const lowerSearchString = searchString ? searchString.toLowerCase() : null;
  if (!lowerSearchString) {
    return rows // we don't need to filter if there is no search string
  }

  const noneOfTheSearchParametersExists = !searchByName && !searchByEmail && !searchByStudentStatus && !searchByStudentOrganization
  return rows
    .filter(({name, certificationStatus, email}) => {
      if (noneOfTheSearchParametersExists) {
        return name.toLowerCase().includes(lowerSearchString)
      }
      if (searchByName) {
        return name.toLowerCase().includes(lowerSearchString)
      }
      if (searchByEmail) {
        return email.toLowerCase().includes(lowerSearchString)
      }
      if (searchByStudentStatus) {
        return certificationStatus.toLowerCase().includes(lowerSearchString)
      }
      return false
    })
}
