import { createContext, useContext } from 'react';

/** projectId → finished sub-tasks in Done; provided by TodoPage */
export const FinishedCounts = createContext<Map<string, number>>(new Map());
export const useFinished = (projectId: string) => useContext(FinishedCounts).get(projectId) ?? 0;
