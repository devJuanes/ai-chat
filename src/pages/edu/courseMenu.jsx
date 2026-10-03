import { createContext, useContext, useMemo, useState } from 'react';

const CourseMenuContext = createContext(null);

export function CourseMenuProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const value = useMemo(
    () => ({ open, setOpen, ready, setReady }),
    [open, ready]
  );
  return <CourseMenuContext.Provider value={value}>{children}</CourseMenuContext.Provider>;
}

export function useCourseMenu() {
  return useContext(CourseMenuContext);
}
