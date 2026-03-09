import React, { createContext, useContext, useEffect, useState } from 'react';
import { getContactConfig } from '../services';

const DEFAULT_WHATSAPP = '573016929622';

interface ContactConfigState {
  whatsappPhone: string;
}

const ContactConfigContext = createContext<ContactConfigState>({
  whatsappPhone: DEFAULT_WHATSAPP
});

export const ContactConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ContactConfigState>({ whatsappPhone: DEFAULT_WHATSAPP });

  useEffect(() => {
    getContactConfig().then((config) => {
      setState({ whatsappPhone: config.whatsappPhone || DEFAULT_WHATSAPP });
    });
  }, []);

  return (
    <ContactConfigContext.Provider value={state}>
      {children}
    </ContactConfigContext.Provider>
  );
};

export const useContactConfig = (): ContactConfigState => {
  return useContext(ContactConfigContext);
};
