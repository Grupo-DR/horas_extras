import { OFFICIAL_USERS } from '../constants';
import { useCrm } from '../contexts/CrmContext';

export const useEntityLookup = () => {
    const { clients, contacts } = useCrm();

    const getInternalUser = (id: string) => OFFICIAL_USERS.find(u => u.id === id);
    const getClient = (id: string) => clients.find(c => c.id === id);
    const getContact = (id: string) => contacts.find(c => c.id === id);

    return { getInternalUser, getClient, getContact };
};
