import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

// --- Helper Functions ---

/**
 * Verifies if the caller is an IAM Admin or Super Admin.
 */
async function verifyAdmin(context: functions.https.CallableContext) {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "O usuário deve estar logado.");
    }
    const uid = context.auth.uid;
    const email = context.auth.token.email || "unknown";

    const profileSnap = await db.collection("user_profiles").doc(uid).get();
    const profile = profileSnap.data();

    if (!profile) {
        throw new functions.https.HttpsError("permission-denied", "Perfil de usuário não encontrado.");
    }

    const isSuperAdmin = profile.isSuperAdmin === true;
    const isIamAdmin = profile.modules?.commercial?.role === 'IAM_ADMIN';
    const isHcAdmin = profile.modules?.human_capital?.role === 'HC_ADMIN';

    // Se o usuário não tiver nível suficiente, barre
    if (!isSuperAdmin && !isIamAdmin && !isHcAdmin) {
        throw new functions.https.HttpsError("permission-denied", "Acesso negado. Requer permissão de Administrador IAM.");
    }

    return { uid, email };
}

/**
 * Logs an audit event to the database.
 */
async function logAudit(type: string, actorUid: string, actorEmail: string, targetUid: string, targetEmail: string, extra?: any) {
    await db.collection("audit_logs").add({
        type,
        actorUid,
        actorEmail,
        targetUid,
        targetEmail,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ...extra
    });
}

// --- Cloud Functions ---

export const adminCreateUserInvite = functions.https.onCall(async (data, context) => {
    const adminUser = await verifyAdmin(context);

    // Validate inputs
    const { email, displayName, jobTitle, modules } = data;
    if (!email || !displayName) {
        throw new functions.https.HttpsError("invalid-argument", "Email e Nome são obrigatórios.");
    }

    try {
        // Create user in Auth
        const newAuthUser = await auth.createUser({
            email,
            displayName,
            disabled: false,
        });

        // Generate password reset link for the invite
        const passwordResetLink = await auth.generatePasswordResetLink(email);

        // Create user profile in Firestore
        const newProfile = {
            uid: newAuthUser.uid,
            email,
            displayName,
            jobTitle: jobTitle || "",
            status: "invited",
            modules: modules || {
                commercial: { enabled: false, role: 'COMMERCIAL_VIEWER' },
                human_capital: { enabled: false, role: 'HC_AUDITOR_VIEWER', scope: { type: 'ALL' } },
                construction: { enabled: false, role: 'CONSTRUCTION_VIEWER' }
            },
            createdAt: new Date().toISOString(),
            createdBy: adminUser.uid,
            updatedAt: new Date().toISOString(),
            updatedBy: adminUser.uid
        };

        await db.collection("user_profiles").doc(newAuthUser.uid).set(newProfile);

        // Audit log
        await logAudit("USER_INVITED", adminUser.uid, adminUser.email, newAuthUser.uid, email);

        return { uid: newAuthUser.uid, status: "invited", passwordResetLink };
    } catch (error: any) {
        console.error("Erro no adminCreateUserInvite:", error);
        throw new functions.https.HttpsError("internal", error.message || "Erro ao criar usuário.");
    }
});

export const adminDisableUser = functions.https.onCall(async (data, context) => {
    const adminUser = await verifyAdmin(context);
    const { uid, reason } = data;

    if (!uid) throw new functions.https.HttpsError("invalid-argument", "UID é obrigatório.");

    try {
        const targetUser = await auth.getUser(uid);

        await auth.updateUser(uid, { disabled: true });
        await auth.revokeRefreshTokens(uid);

        await db.collection("user_profiles").doc(uid).update({
            status: "disabled",
            disabledAt: new Date().toISOString(),
            disabledBy: adminUser.uid,
            disableReason: reason || "Revogado pelo administrador",
            updatedAt: new Date().toISOString(),
            updatedBy: adminUser.uid
        });

        await logAudit("USER_DISABLED", adminUser.uid, adminUser.email, uid, targetUser.email || "unknown", { reason });
        return { success: true };
    } catch (error: any) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});

export const adminEnableUser = functions.https.onCall(async (data, context) => {
    const adminUser = await verifyAdmin(context);
    const { uid } = data;

    if (!uid) throw new functions.https.HttpsError("invalid-argument", "UID é obrigatório.");

    try {
        const targetUser = await auth.getUser(uid);

        await auth.updateUser(uid, { disabled: false });

        await db.collection("user_profiles").doc(uid).update({
            status: "active",
            disabledAt: admin.firestore.FieldValue.delete(),
            disabledBy: admin.firestore.FieldValue.delete(),
            disableReason: admin.firestore.FieldValue.delete(),
            updatedAt: new Date().toISOString(),
            updatedBy: adminUser.uid
        });

        await logAudit("USER_ENABLED", adminUser.uid, adminUser.email, uid, targetUser.email || "unknown");
        return { success: true };
    } catch (error: any) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});

export const adminDeleteUser = functions.https.onCall(async (data, context) => {
    const adminUser = await verifyAdmin(context);
    const { uid } = data;

    if (!uid) throw new functions.https.HttpsError("invalid-argument", "UID é obrigatório.");

    try {
        const targetUser = await auth.getUser(uid);

        await auth.deleteUser(uid);

        await db.collection("user_profiles").doc(uid).delete();
        // Ignore avatar deleting for now as safe-fallback

        await logAudit("USER_DELETED", adminUser.uid, adminUser.email, uid, targetUser.email || "unknown");
        return { success: true };
    } catch (error: any) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});

export const adminGeneratePasswordResetLink = functions.https.onCall(async (data, context) => {
    const adminUser = await verifyAdmin(context);
    const { email } = data;

    if (!email) throw new functions.https.HttpsError("invalid-argument", "Email é obrigatório.");

    try {
        const targetUser = await auth.getUserByEmail(email);
        const link = await auth.generatePasswordResetLink(email);

        await logAudit("PASSWORD_RESET_LINK_CREATED", adminUser.uid, adminUser.email, targetUser.uid, email);
        return { link };
    } catch (error: any) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});

export const adminRevokeSessions = functions.https.onCall(async (data, context) => {
    const adminUser = await verifyAdmin(context);
    const { uid } = data;

    if (!uid) throw new functions.https.HttpsError("invalid-argument", "UID é obrigatório.");

    try {
        const targetUser = await auth.getUser(uid);
        await auth.revokeRefreshTokens(uid);

        await logAudit("SESSIONS_REVOKED", adminUser.uid, adminUser.email, uid, targetUser.email || "unknown");
        return { success: true };
    } catch (error: any) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});

export const adminBackfillUserProfiles = functions.https.onCall(async (data, context) => {
    const adminUser = await verifyAdmin(context);

    if (adminUser.email !== 'antonio.silva@grupodr.com.br') {
        throw new functions.https.HttpsError("permission-denied", "Operação restrita.");
    }

    try {
        const snapshot = await db.collection("user_profiles").get();
        const batch = db.batch();
        let migratedCount = 0;

        snapshot.docs.forEach((docSnap) => {
            const profile = docSnap.data();
            let changed = false;

            if (!profile.status) {
                profile.status = "active";
                changed = true;
            }

            if (profile.email === 'antonio.silva@grupodr.com.br' && !profile.isSuperAdmin) {
                profile.isSuperAdmin = true;
                changed = true;
            }

            if (changed) {
                batch.update(docSnap.ref, {
                    status: profile.status,
                    isSuperAdmin: profile.isSuperAdmin ?? false,
                    updatedAt: new Date().toISOString()
                });
                migratedCount++;
            }
        });

        if (migratedCount > 0) {
            await batch.commit();
        }

        await logAudit("MIGRATION", adminUser.uid, adminUser.email, "system", "all", { type: "backfill_status", count: migratedCount });

        return { success: true, migratedCount };
    } catch (error: any) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});

/**
 * Triggers when a user_profile is created, updated, or deleted.
 * Keeps the user_directory collection in sync with safe, display-only data.
 */
export const syncUserDirectory = functions.firestore
    .document('user_profiles/{uid}')
    .onWrite(async (change, context) => {
        const uid = context.params.uid;
        const directoryRef = db.collection('user_directory').doc(uid);

        // If deleted, remove from directory
        if (!change.after.exists) {
            await directoryRef.delete();
            return null;
        }

        const profile = change.after.data() as any;

        // Ensure we have minimal valid data to sync
        if (!profile || !profile.email) {
            console.warn(`Profile ${uid} is malformed. Skipping directory sync.`);
            return null;
        }

        // Extract minimal safe fields
        const directoryData = {
            uid: uid,
            email: profile.email,
            displayName: profile.displayName || profile.email.split('@')[0] || "Usuário",
            jobTitle: profile.jobTitle || null,
            avatarUrl: profile.avatarUrl || null,
            status: profile.status || "active", // fallback for legacy
            modules: {
                commercial: {
                    enabled: profile.modules?.commercial?.enabled || false
                }
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Upsert into directory without deleting unrecognized fields, but we overwrite what matters
        await directoryRef.set(directoryData, { merge: true });

        return null;
    });

/**
 * Callable function to manually backfill the new user_directory collection
 * reading from all existing user_profiles. One-time use mostly.
 */
export const adminBackfillUserDirectory = functions.https.onCall(async (data, context) => {
    const adminUser = await verifyAdmin(context);

    try {
        const snapshot = await db.collection("user_profiles").get();
        let migratedCount = 0;
        let batch = db.batch();
        let batchCount = 0;

        for (const docSnap of snapshot.docs) {
            const profile = docSnap.data() as any;
            const directoryRef = db.collection("user_directory").doc(docSnap.id);

            const directoryData = {
                uid: docSnap.id,
                email: profile.email,
                displayName: profile.displayName || profile.email.split('@')[0] || "Usuário",
                jobTitle: profile.jobTitle || null,
                avatarUrl: profile.avatarUrl || null,
                status: profile.status || "active",
                modules: {
                    commercial: {
                        enabled: profile.modules?.commercial?.enabled || false
                    }
                },
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            batch.set(directoryRef, directoryData, { merge: true });
            migratedCount++;
            batchCount++;

            // Firestore batches are limited to 500 operations
            if (batchCount === 450) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
            }
        }

        if (batchCount > 0) {
            await batch.commit();
        }

        await logAudit("MIGRATION_USER_DIRECTORY", adminUser.uid, adminUser.email, "system", "all", { count: migratedCount });

        return { success: true, count: migratedCount, message: `O diretório foi sincronizado com sucesso (${migratedCount} perfis).` };
    } catch (error: any) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});
