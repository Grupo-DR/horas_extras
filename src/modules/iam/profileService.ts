import { db } from '@/services/firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, Timestamp, collection, getDocs } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfileDoc } from './types';

const COLLECTION = 'user_profiles';
// Hardcoded Super Admin Emails
const SUPER_ADMINS = ['antonio.silva@grupodr.com.br'];

export const getUserProfile = async (uid: string): Promise<UserProfileDoc | null> => {
    try {
        const ref = doc(db, COLLECTION, uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            return snap.data() as UserProfileDoc;
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
    if (existing) return existing;

    // Create Initial Profile
    const isSuperAdmin = SUPER_ADMINS.includes(authUser.email || '');

    const newProfile: UserProfileDoc = {
        uid: authUser.uid,
        email: authUser.email || '',
        displayName: authUser.displayName || authUser.email?.split('@')[0] || 'User',
        isSuperAdmin,
        modules: {
            commercial: {
                enabled: isSuperAdmin, // Default disabled unless super admin
                role: isSuperAdmin ? 'COMMERCIAL_ADMIN' : 'COMMERCIAL_VIEWER' // Default role (if enabled later)
            },
            human_capital: {
                enabled: isSuperAdmin,
                role: isSuperAdmin ? 'HC_ADMIN' : 'HC_AUDITOR_VIEWER',
                scope: { type: 'ALL' } // Default scope
            },
            construction: {
                enabled: isSuperAdmin,
                role: isSuperAdmin ? 'CONSTRUCTION_ADMIN' : 'CONSTRUCTION_VIEWER' // Default role
            }
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
        newProfile.modules.construction!.enabled = false;
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
            modules: {
                commercial: { enabled: false, role: 'COMMERCIAL_VIEWER' },
                human_capital: { enabled: false, role: 'HC_AUDITOR_VIEWER', scope: { type: 'ALL' } },
                construction: { enabled: false, role: 'CONSTRUCTION_VIEWER' }
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
        return snapshot.docs.map(d => d.data() as UserProfileDoc);
    } catch (error) {
        console.error("Error fetching all profiles:", error);
        throw error;
    }
};

export const updateUserRoles = async (uid: string, iamUpdates: {
    commercial?: { enabled: boolean; role: 'COMMERCIAL_ADMIN' | 'COMMERCIAL_VIEWER' | 'IAM_ADMIN' };
    human_capital?: { enabled: boolean; role: 'HC_ADMIN' | 'HC_MANAGER' | 'HC_COSTCENTER_PLANNER' | 'HC_AUDITOR_VIEWER'; scope: any };
    construction?: { enabled: boolean; role: 'CONSTRUCTION_ADMIN' | 'CONSTRUCTION_MANAGER' | 'CONSTRUCTION_VIEWER' };
}) => {
    const ref = doc(db, COLLECTION, uid);
    const updates: any = {};
    if (iamUpdates.commercial) updates['modules.commercial'] = iamUpdates.commercial;
    if (iamUpdates.human_capital) updates['modules.human_capital'] = iamUpdates.human_capital;
    if (iamUpdates.construction) updates['modules.construction'] = iamUpdates.construction;

    updates['updatedAt'] = new Date().toISOString();
    await updateDoc(ref, updates);
};
