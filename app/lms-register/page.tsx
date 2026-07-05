import { Suspense } from "react";

import LmsStudentRegisterPage from "@/modules/Lms/pages/LmsStudentRegisterPage";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LmsStudentRegisterPage />
    </Suspense>
  );
}
