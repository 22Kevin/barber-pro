import React, { createContext, useContext, useState } from "react";

interface AdminDrawerContextType {
  isOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

const AdminDrawerContext = createContext<AdminDrawerContextType>({
  isOpen: false,
  openDrawer: () => {},
  closeDrawer: () => {},
  toggleDrawer: () => {},
});

export function AdminDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <AdminDrawerContext.Provider
      value={{
        isOpen,
        openDrawer: () => setIsOpen(true),
        closeDrawer: () => setIsOpen(false),
        toggleDrawer: () => setIsOpen((v) => !v),
      }}
    >
      {children}
    </AdminDrawerContext.Provider>
  );
}

export function useAdminDrawer() {
  return useContext(AdminDrawerContext);
}
