import moment from "moment";
import { getCourseCompletedWeeks } from "./helpers";

describe("getCourseCompletedWeeks util", () => {
  test("getCourseCompletedWeeks correctly returns weeks for ongoing course", async () => {
    const courseStartDate = moment().subtract(5, "weeks");
    const completedWeeks = getCourseCompletedWeeks(courseStartDate, 3);
    expect(completedWeeks).toEqual(5);
  });

  test("getCourseCompletedWeeks correctly returns weeks for finished 3-months-course", async () => {
    const courseStartDate = moment().subtract(4, "months");
    const completedWeeks = getCourseCompletedWeeks(courseStartDate, 3);
    expect(completedWeeks).toEqual(14); // 14 weeks for 3 week course duration
  });

  test("getCourseCompletedWeeks correctly returns weeks for finished 6-months-course", async () => {
    const courseStartDate = moment().subtract(7, "months");
    const completedWeeks = getCourseCompletedWeeks(courseStartDate, 6);
    expect(completedWeeks).toEqual(28); // 28 weeks for 3 week course duration
  });

  test("getCourseCompletedWeeks correctly returns weeks for canceled course", async () => {
    const courseStartDate = moment().subtract(10, "weeks");
    const canceledDateTime = moment().subtract(5, "weeks");
    const completedWeeks = getCourseCompletedWeeks(
      courseStartDate,
      6,
      canceledDateTime
    );
    expect(completedWeeks).toEqual(5); // was cancled after 5 weeks of start date
  });
});
