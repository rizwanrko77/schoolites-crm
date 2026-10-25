'use client';

import { createContext, useContext } from 'react';

export const AdminSessionContext = createContext(false);

export function useAdminReady() {
  return useContext(AdminSessionContext);
}
