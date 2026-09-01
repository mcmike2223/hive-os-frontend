import type { Metadata } from "next";
import { VacancyManagementClient } from "./vacancy-management-client";
export const metadata:Metadata={title:"Vacancy Management | HIVE.OS"};
export default function Page(){return <VacancyManagementClient/>}
