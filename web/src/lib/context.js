import {createContext, useContext} from 'react';

// Session data, polling refresh and job actions, available to every page.
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
