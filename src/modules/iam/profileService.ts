import { auth, db } from '../../../services/firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, Timestamp, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { User as FirebaseUser, signOut } from 'firebase/auth';
import { UserProfileDoc } from './types';

const COLLECTION = 'user_profiles';
// Hardcoded Super Admin Emails
const SUPER_ADMINS = ['antonio.silva@grupodr.com.br'];

export const getUserProfile = async (uid: string): Promise<UserProfileDoc | null> => {
    try {
        const ref = doc(db, COLLECTION, uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data() as UserProfileDoc;

            // Normalization: translate legacy HC roles to CH
            if (data.modules?.human_capital?.role) {
                const role = data.modules.human_capital.role as string;
                if (role.startsWith('HC_')) {
                    data.modules.human_capital.role = role.replace('HC_', 'CH_') as any;
                }
            }

            return data;
        }
        return null;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        throw error;
    }
};

export const getOrCreateUserProfile = async (authUser: FirebaseUser): Promise<UserProfileDoc> => {
    if (!authUser) throw new Error("No authenticated user");

    const existing = await getUserProfile(authUser.uid);
    if (existing) {
        if (existing.status === 'disabled') {
            await signOut(auth);
            throw new Error('Conta desativada pelo administrador.');
        }
        return existing;
    }

    // Create Initial Profile
    const isSuperAdmin = SUPER_ADMINS.includes(authUser.email || '');

    const newProfile: UserProfileDoc = {
        uid: authUser.uid,
        email: authUser.email || '',
        displayName: authUser.displayName || authUser.email?.split('@')[0] || 'User',
        isSuperAdmin,
        status: isSuperAdmin ? 'active' : 'invited',
        modules: {
            commercial: {
                enabled: isSuperAdmin, // Default disabled unless super admin
                role: isSuperAdmin ? 'COMMERCIAL_ADMIN' : 'COMMERCIAL_VIEWER' // Default role (if enabled later)
            },
            human_capital: {
                enabled: isSuperAdmin,
                role: isSuperAdmin ? 'CH_ADMIN' : 'CH_AUDITOR_VIEWER',
                scope: { type: 'ALL' } // Default scope
            },
            construction_vli: {
                enabled: isSuperAdmin,
                role: isSuperAdmin ? 'CONSTRUCTION_ADMIN' : 'CONSTRUCTION_VIEWER'
            },
            construction_rdo: {
                enabled: isSuperAdmin,
                role: isSuperAdmin ? 'CONSTRUCTION_ADMIN' : 'CONSTRUCTION_VIEWER'
            },
            bi_reports: isSuperAdmin ? ['Financeiro', 'Gestão de Contratos', 'Obras'] : []
        },
        createdAt: new Date().toISOString(),
        createdBy: 'system',
        updatedAt: new Date().toISOString(),
        updatedBy: 'system'
    };

    // If strictly regular user, disable modules explicitly just to be safe
    if (!isSuperAdmin) {
        newProfile.modules.commercial!.enabled = false;
        newProfile.modules.human_capital!.enabled = false;
        newProfile.modules.construction_vli!.enabled = false;
        newProfile.modules.construction_rdo!.enabled = false;
        newProfile.modules.bi_reports = [];
    }

    try {
        await setDoc(doc(db, COLLECTION, authUser.uid), newProfile);
        return newProfile;
    } catch (error) {
        console.error("Error creating user profile:", error);
        throw error;
    }
};

export const createUserProfile = async (uid: string, email: string, displayName: string): Promise<void> => {
    try {
        const existing = await getUserProfile(uid);
        if (existing) throw new Error("Perfil de usuário já existe.");

        const newProfile: UserProfileDoc = {
            uid,
            email,
            displayName,
            isSuperAdmin: false,
            status: 'invited',
            modules: {
                commercial: { enabled: false, role: 'COMMERCIAL_VIEWER' },
                human_capital: { enabled: false, role: 'CH_AUDITOR_VIEWER', scope: { type: 'ALL' } },
                construction_vli: { enabled: false, role: 'CONSTRUCTION_VIEWER' },
                construction_rdo: { enabled: false, role: 'CONSTRUCTION_VIEWER' },
                bi_reports: []
            },
            createdAt: new Date().toISOString(),
            createdBy: 'admin_manual_sync',
            updatedAt: new Date().toISOString(),
            updatedBy: 'admin_manual_sync'
        };

        await setDoc(doc(db, COLLECTION, uid), newProfile);
    } catch (error) {
        console.error("Error creating manual profile:", error);
        throw error;
    }
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfileDoc>) => {
    const ref = doc(db, COLLECTION, uid);
    await updateDoc(ref, {
        ...data,
        updatedAt: new Date().toISOString()
    });
};

export const getAllProfiles = async (): Promise<UserProfileDoc[]> => {
    try {
        const snapshot = await getDocs(collection(db, COLLECTION));
        return snapshot.docs.map(d => {
            const data = d.data() as UserProfileDoc;
            // Normalization: translate legacy HC roles to CH
            if (data.modules?.human_capital?.role) {
                const role = data.modules.human_capital.role as string;
                if (role.startsWith('HC_')) {
                    data.modules.human_capital.role = role.replace('HC_', 'CH_') as any;
                }
            }
            return data;
        });
    } catch (error) {
        console.error("Error fetching all profiles:", error);
        throw error;
    }
};

export const getUsersDirectory = async (): Promise<any[]> => {
    try {
        const snapshot = await getDocs(collection(db, 'user_directory'));
        return snapshot.docs.map(d => d.data());
    } catch (error) {
        console.error("Error fetching user directory:", error);
        throw error;
    }
};

export const updateUserRoles = async (uid: string, iamUpdates: {
    commercial?: { enabled: boolean; role: 'COMMERCIAL_ADMIN' | 'COMMERCIAL_VIEWER' | 'IAM_ADMIN' };
    human_capital?: { enabled: boolean; role: import('./types').CHRole; scope: any };
    construction_vli?: { enabled: boolean; role: 'CONSTRUCTION_ADMIN' | 'CONSTRUCTION_MANAGER' | 'CONSTRUCTION_VIEWER' };
    construction_rdo?: { enabled: boolean; role: 'CONSTRUCTION_ADMIN' | 'CONSTRUCTION_MANAGER' | 'CONSTRUCTION_VIEWER' };
    bi_reports?: string[];
}) => {
    const ref = doc(db, COLLECTION, uid);
    const updates: any = {};
    if (iamUpdates.commercial) updates['modules.commercial'] = iamUpdates.commercial;
    if (iamUpdates.human_capital) updates['modules.human_capital'] = iamUpdates.human_capital;
    if (iamUpdates.construction_vli) updates['modules.construction_vli'] = iamUpdates.construction_vli;
    if (iamUpdates.construction_rdo) updates['modules.construction_rdo'] = iamUpdates.construction_rdo;
    if (iamUpdates.bi_reports !== undefined) updates['modules.bi_reports'] = iamUpdates.bi_reports;

    updates['updatedAt'] = new Date().toISOString();
    await updateDoc(ref, updates);
};

export const deleteUserProfile = async (uid: string) => {
    try {
        const ref = doc(db, COLLECTION, uid);
        await deleteDoc(ref);
    } catch (error) {
        console.error("Error deleting user profile:", error);
        throw error;
    }
};
