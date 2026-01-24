import { Client, ClientContact, Bid, Interaction, Task } from '../types';
import { ClientService } from '../services/clientService';
import { ClientContactService } from '../services/clientContactService'; // Canonical
import { BidService } from '../services/bidService';
import { InteractionService } from '../services/interactionService';
import { TaskService } from '../services/taskService';

interface CrmContextData {
    clients: Client[];
    contacts: ClientContact[];
    bids: Bid[]; // Canonical "bids"
    tasks: Task[]; // Linked Actions

    interactions: Interaction[]; // Global recent
    loading: boolean;

    addClient: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateClient: (id: string, client: Partial<Client>) => Promise<void>;
    addContact: (contact: Omit<ClientContact, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateContact: (id: string, contact: Partial<ClientContact>) => Promise<void>;
    addInteraction: (data: Omit<Interaction, 'id' | 'createdAt'>) => Promise<void>;
    addTask: (task: Omit<Task, 'id'>) => Promise<void>;
    updateTask: (id: string, task: Partial<Task>) => Promise<void>;
    removeClient: (id: string) => Promise<void>;
    removeContact: (id: string) => Promise<void>;
    getContactsByClientId: (clientId: string) => ClientContact[];
    refresh: () => void;
}

const CrmContext = createContext<CrmContextData>({} as CrmContextData);

export const CrmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // State
    const [clients, setClients] = useState<Client[]>([]);
    const [contacts, setContacts] = useState<ClientContact[]>([]);
    const [bids, setBids] = useState<Bid[]>([]);
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const refresh = () => setRefreshTrigger(prev => prev + 1);

    // Initial Fetch (Ideally switch to realtime subscriptions later)
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Initialize Subscriptions or simple Fetch
                const [fetchedClients, fetchedContacts, fetchedBids, fetchedTasks] = await Promise.all([
                    ClientService.getAll(),
                    ClientContactService.getAll(),
                    BidService.getAll(),
                    TaskService.getAll()
                ]);

                // Interactions: fetch recent global (e.g., 6 months)
                const fetchedRecents = await new Promise<Interaction[]>(resolve => {
                    const unsubscribe = InteractionService.subscribeRecentGlobal(6, (data) => {
                        resolve(data);
                        unsubscribe();
                    });
                });

                setClients(fetchedClients);
                setContacts(fetchedContacts);
                setBids(fetchedBids);
                setTasks(fetchedTasks);
                setInteractions(fetchedRecents);

            } catch (error) {
                console.error("Failed to fetch CRM data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [refreshTrigger]);

    // --- ACTIONS ---

    const addClient = async (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
        // ... existing code
        try { await ClientService.create(clientData); refresh(); } catch (e) { throw e; }
    };

    // ... (Add Task Actions below) -> We will insert them via next replace or manually if I missed cleaning up existing functions.
    // Ideally I keep existing functions and just ADD new ones.

    // Let's redo this part carefully to NOT remove existing functions.
    // I will primarily target the STATE declaration and FETCH logic first.

    // State Declaration
    /*
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    */


    // --- ACTIONS ---

    const addClient = async (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
        try {
            await ClientService.create(clientData);
            refresh();
        } catch (error) {
            console.error("Error adding client:", error);
            throw error;
        }
    };

    const addContact = async (contactData: Omit<ClientContact, 'id' | 'createdAt' | 'updatedAt'>) => {
        try {
            await ClientContactService.create(contactData);
            refresh();
        } catch (error) {
            console.error("Error adding contact:", error);
            throw error;
        }
    };

    const addInteraction = async (data: Omit<Interaction, 'id' | 'createdAt'>) => {
        try {
            await InteractionService.create(data);
            refresh();
        } catch (error) {
            console.error("Error adding interaction:", error);
            throw error;
        }
    }

    const addTask = async (task: Omit<Task, 'id'>) => {
        try {
            await TaskService.create(task);
            refresh();
        } catch (error) {
            console.error("Error adding task:", error);
            throw error;
        }
    };

    const updateTask = async (id: string, task: Partial<Task>) => {
        try {
            await TaskService.update(id, task);
            refresh();
        } catch (error) {
            console.error("Error updating task:", error);
            throw error;
        }
    };

    const updateClient = async (id: string, clientData: Partial<Client>) => {
        try {
            await ClientService.update(id, clientData);
            refresh();
        } catch (error) {
            console.error("Error updating client:", error);
            throw error;
        }
    };

    const updateContact = async (id: string, contactData: Partial<ClientContact>) => {
        try {
            await ClientContactService.update(id, contactData);
            refresh();
        } catch (error) {
            console.error("Error updating contact:", error);
            throw error;
        }
    };

    const removeClient = async (id: string) => {
        try {
            await ClientService.delete(id);
            setClients(prev => prev.filter(c => c.id !== id));
            setContacts(prev => prev.filter(c => c.clientId !== id));
        } catch (error) {
            console.error("Error removing client:", error);
            throw error;
        }
    };

    const removeContact = async (id: string) => {
        try {
            await ClientContactService.delete(id);
            setContacts(prev => prev.filter(c => c.id !== id));
        } catch (error) {
            console.error("Error removing contact:", error);
            throw error;
        }
    };

    const getContactsByClientId = (clientId: string) => {
        return contacts.filter(c => c.clientId === clientId);
    };

    return (
        <CrmContext.Provider value={{
            clients,
            contacts,
            bids,

            interactions,
            tasks,
            loading,
            addClient,
            addContact,
            updateClient,
            updateContact,
            addInteraction,
            addTask,
            updateTask,
            removeClient,
            removeContact,
            getContactsByClientId,
            refresh
        }}>
            {children}
        </CrmContext.Provider>
    );
};

export const useCrm = () => useContext(CrmContext);
