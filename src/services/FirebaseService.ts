import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signOut, onAuthStateChanged, updateProfile, type Auth,
  GoogleAuthProvider, signInWithPopup
} from 'firebase/auth';
import { 
  getFirestore, doc, getDoc, setDoc, updateDoc, type Firestore 
} from 'firebase/firestore';
import eventBus from './EventBus';

export type UserRole = 'Admin' | 'Analyst' | 'Auditor' | 'Viewer';

export interface FirebaseUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  organizationId: string;
  photoURL?: string;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

const DEFAULT_USER: FirebaseUser = {
  uid: 'fb-usr-9018',
  email: 'chief.strategist@globalcorp.space',
  displayName: 'Alex Mercer',
  role: 'Admin',
  organizationId: 'GlobalCorp',
};

class FirebaseService {
  private currentUser: FirebaseUser | null = null;
  private storageKey = 'datum_s_firebase_session';
  private realAuth: Auth | null = null;
  private realDb: Firestore | null = null;
  private isConfigured = false;

  /**
   * Helper to load all simulated users from local storage.
   */
  private getSimulatedUsers(): FirebaseUser[] {
    const defaultUsers: FirebaseUser[] = [
      {
        uid: 'fb-usr-9018',
        email: 'chief.strategist@globalcorp.space',
        displayName: 'Alex Mercer',
        role: 'Admin',
        organizationId: 'GlobalCorp',
      },
      {
        uid: 'fb-usr-9019',
        email: 'logistics.director@globalcorp.space',
        displayName: 'Tareq Al-Mansoori',
        role: 'Analyst',
        organizationId: 'GlobalLogistics',
      },
      {
        uid: 'fb-usr-9020',
        email: 'compliance.lead@globalcorp.space',
        displayName: 'Rajesh K. Prasad',
        role: 'Auditor',
        organizationId: 'GlobalCompliance',
      },
      {
        uid: 'google-demo-sso',
        email: 'google.demo@globalcorp.space',
        displayName: 'Google Demo User',
        role: 'Viewer',
        organizationId: '',
        photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
      }
    ];

    try {
      const data = localStorage.getItem('datum_s_users_db');
      if (data) {
        return JSON.parse(data);
      } else {
        localStorage.setItem('datum_s_users_db', JSON.stringify(defaultUsers));
        return defaultUsers;
      }
    } catch (err) {
      return defaultUsers;
    }
  }

  /**
   * Helper to save simulated users list.
   */
  private saveSimulatedUsers(users: FirebaseUser[]): void {
    localStorage.setItem('datum_s_users_db', JSON.stringify(users));
  }

  constructor() {
    const success = this.initializeFirebase();
    if (!success) {
      this.restoreSession();
    }
  }

  /**
   * Attempts to initialize the actual Firebase app using credentials in environment or local storage.
   */
  initializeFirebase(): boolean {
    try {
      const config = this.getFirebaseConfig();
      if (!config) {
        this.isConfigured = false;
        this.realAuth = null;
        this.realDb = null;
        return false;
      }

      let app;
      if (getApps().length === 0) {
        app = initializeApp(config);
      } else {
        app = getApp();
      }

      this.realAuth = getAuth(app);
      this.realDb = getFirestore(app);
      this.isConfigured = true;

      // Bind real Firebase Auth state triggers
      onAuthStateChanged(this.realAuth, async (fbUser) => {
        if (fbUser) {
          try {
            const userDocRef = doc(this.realDb!, 'users', fbUser.uid);
            const userDoc = await getDoc(userDocRef);
            
            let role: UserRole = 'Viewer';
            let organizationId = 'GlobalCorp';
            let dispName = fbUser.displayName || fbUser.email?.split('@')[0] || 'User';
            const photoURL = fbUser.photoURL || undefined;

            if (userDoc.exists()) {
              const data = userDoc.data();
              role = data.role || 'Viewer';
              organizationId = data.organizationId !== undefined ? data.organizationId : 'GlobalCorp';
              dispName = data.displayName || dispName;
            } else {
              // Automatically provision a default Cloud user profile in Firestore
              await setDoc(userDocRef, {
                uid: fbUser.uid,
                email: fbUser.email || '',
                displayName: dispName,
                role,
                organizationId,
                photoURL: photoURL || '',
                createdAt: new Date().toISOString(),
              });
            }

            const synced: FirebaseUser = {
              uid: fbUser.uid,
              email: fbUser.email || '',
              displayName: dispName,
              role,
              organizationId,
              photoURL,
            };

            this.currentUser = synced;
            localStorage.setItem(this.storageKey, JSON.stringify(synced));
            eventBus.emit('AUTH_STATE_CHANGED', synced);
          } catch (err) {
            console.error('[FirebaseService] Firestore synchronization failure:', err);
          }
        } else {
          this.currentUser = null;
          localStorage.removeItem(this.storageKey);
          eventBus.emit('AUTH_STATE_CHANGED', null);
        }
      });

      return true;
    } catch (err) {
      console.warn('[FirebaseService] Firebase client initialization failed:', err);
      this.isConfigured = false;
      this.realAuth = null;
      this.realDb = null;
      return false;
    }
  }

  /**
   * Retrieves active credentials config from Vite env vars or local storage.
   */
  getFirebaseConfig(): FirebaseConfig | null {
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || localStorage.getItem('datum_s_firebase_api_key') || '';
    const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || localStorage.getItem('datum_s_firebase_auth_domain') || '';
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || localStorage.getItem('datum_s_firebase_project_id') || '';
    const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || localStorage.getItem('datum_s_firebase_storage_bucket') || '';
    const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || localStorage.getItem('datum_s_firebase_messaging_sender_id') || '';
    const appId = import.meta.env.VITE_FIREBASE_APP_ID || localStorage.getItem('datum_s_firebase_app_id') || '';

    if (apiKey && authDomain && projectId) {
      return { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId };
    }
    return null;
  }

  /**
   * Saves custom credentials config to browser storage and dynamically hot-reloads Firebase app.
   */
  saveFirebaseConfig(config: Partial<FirebaseConfig>): boolean {
    try {
      if (config.apiKey) localStorage.setItem('datum_s_firebase_api_key', config.apiKey);
      if (config.authDomain) localStorage.setItem('datum_s_firebase_auth_domain', config.authDomain);
      if (config.projectId) localStorage.setItem('datum_s_firebase_project_id', config.projectId);
      if (config.storageBucket) localStorage.setItem('datum_s_firebase_storage_bucket', config.storageBucket);
      if (config.messagingSenderId) localStorage.setItem('datum_s_firebase_messaging_sender_id', config.messagingSenderId);
      if (config.appId) localStorage.setItem('datum_s_firebase_app_id', config.appId);

      const success = this.initializeFirebase();
      if (success) {
        eventBus.emit('AUDIT_LOG', {
          action: 'AUTH_CONFIG_SUCCESS',
          details: 'Production Cloud Firebase Auth dynamically initialized. Mode: CLOUD VAULT.',
          status: 'success'
        });
        return true;
      } else {
        this.purgeFirebaseConfig();
        return false;
      }
    } catch (err) {
      console.error('[FirebaseService] Save Firebase Config exception:', err);
      this.purgeFirebaseConfig();
      return false;
    }
  }

  /**
   * Clears custom configs and hot-reverts to developer simulation sandbox.
   */
  purgeFirebaseConfig(): void {
    localStorage.removeItem('datum_s_firebase_api_key');
    localStorage.removeItem('datum_s_firebase_auth_domain');
    localStorage.removeItem('datum_s_firebase_project_id');
    localStorage.removeItem('datum_s_firebase_storage_bucket');
    localStorage.removeItem('datum_s_firebase_messaging_sender_id');
    localStorage.removeItem('datum_s_firebase_app_id');
    localStorage.removeItem(this.storageKey);

    this.isConfigured = false;
    this.realAuth = null;
    this.realDb = null;
    this.currentUser = null;

    this.restoreSession();
    
    eventBus.emit('AUTH_STATE_CHANGED', this.currentUser);
    eventBus.emit('AUDIT_LOG', {
      action: 'AUTH_CONFIG_PURGE',
      details: 'Firebase Auth Config cleared. Hot-reverted to Local Simulation Sandbox Mode.',
      status: 'info'
    });
  }

  /**
   * Determines if Firebase is initialized in Production Cloud mode.
   */
  isFirebaseConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Restores simulated session cache in offline mode.
   */
  private restoreSession(): void {
    try {
      const cached = localStorage.getItem(this.storageKey);
      if (cached) {
        this.currentUser = JSON.parse(cached);
      } else {
        this.currentUser = { ...DEFAULT_USER };
        localStorage.setItem(this.storageKey, JSON.stringify(this.currentUser));
      }
    } catch (err) {
      console.error('[FirebaseService] Failed to load cached simulated session:', err);
      this.currentUser = { ...DEFAULT_USER };
    }
  }

  /**
   * Retrieves active authenticated user context.
   */
  getCurrentUser(): FirebaseUser | null {
    return this.currentUser;
  }

  /**
   * Retrieves the Cloud Firestore DB instance.
   */
  getFirestoreDb(): Firestore | null {
    return this.realDb;
  }

  /**
   * Performs Google SSO authentication.
   */
  async loginWithGoogle(): Promise<FirebaseUser> {
    if (this.isConfigured && this.realAuth && this.realDb) {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(this.realAuth, provider);
      const fbUser = userCredential.user;

      const userDocRef = doc(this.realDb, 'users', fbUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      let syncedRole: UserRole = 'Viewer';
      let syncedOrg = ''; // Empty by default for new Google SSO users to trigger overlay setup popup
      let dispName = fbUser.displayName || fbUser.email?.split('@')[0] || 'User';
      const photoURL = fbUser.photoURL || undefined;

      if (userDoc.exists()) {
        const data = userDoc.data();
        syncedRole = data.role || 'Viewer';
        syncedOrg = data.organizationId !== undefined ? data.organizationId : '';
        dispName = data.displayName || dispName;
      } else {
        // Provision SSO user profile in Firestore
        await setDoc(userDocRef, {
          uid: fbUser.uid,
          email: fbUser.email || '',
          displayName: dispName,
          role: syncedRole,
          organizationId: syncedOrg,
          photoURL: photoURL || '',
          createdAt: new Date().toISOString(),
        });
      }

      const syncedUser: FirebaseUser = {
        uid: fbUser.uid,
        email: fbUser.email || '',
        displayName: dispName,
        role: syncedRole,
        organizationId: syncedOrg,
        photoURL,
      };

      this.currentUser = syncedUser;
      localStorage.setItem(this.storageKey, JSON.stringify(syncedUser));
      
      eventBus.emit('AUTH_STATE_CHANGED', syncedUser);
      eventBus.emit('AUDIT_LOG', {
        action: 'AUTH_LOGIN',
        details: `Cloud user '${syncedUser.email}' signed in safely via Google SSO.`,
        status: 'success'
      });

      return syncedUser;
    } else {
      // OFFLINE SIMULATOR AUTHENTICATION SSO - Pass empty organization name to trigger setup overlay popup!
      return this.login('google.demo@globalcorp.space', 'Viewer', '', 'Google Demo User');
    }
  }

  /**
   * Performs dynamic multi-tenant cloud/simulated login.
   */
  async login(email: string, role: UserRole, organizationId: string, displayName?: string, password?: string): Promise<FirebaseUser> {
    if (this.isConfigured && this.realAuth && this.realDb && password) {
      // REAL CLOUD AUTH SIGN IN
      const userCredential = await signInWithEmailAndPassword(this.realAuth, email, password);
      const fbUser = userCredential.user;

      const userDocRef = doc(this.realDb, 'users', fbUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      let syncedRole: UserRole = role;
      let syncedOrg = organizationId;
      let dispName = displayName || fbUser.displayName || email.split('@')[0];

      if (userDoc.exists()) {
        const data = userDoc.data();
        syncedRole = data.role || 'Viewer';
        syncedOrg = data.organizationId || 'GlobalCorp';
        dispName = data.displayName || dispName;
      } else {
        // Document missing, provision it now
        await setDoc(userDocRef, {
          uid: fbUser.uid,
          email,
          displayName: dispName,
          role: syncedRole,
          organizationId: syncedOrg,
          createdAt: new Date().toISOString(),
        });
      }

      const syncedUser: FirebaseUser = {
        uid: fbUser.uid,
        email: fbUser.email || email,
        displayName: dispName,
        role: syncedRole,
        organizationId: syncedOrg,
      };

      this.currentUser = syncedUser;
      localStorage.setItem(this.storageKey, JSON.stringify(syncedUser));
      
      eventBus.emit('AUTH_STATE_CHANGED', syncedUser);
      eventBus.emit('AUDIT_LOG', {
        action: 'AUTH_LOGIN',
        details: `Cloud user '${syncedUser.email}' signed in safely via Secure Firebase Auth. Role: '${syncedUser.role}'.`,
        status: 'success'
      });

      return syncedUser;
    } else {
      // OFFLINE SIMULATOR AUTHENTICATION
      return new Promise((resolve) => {
        setTimeout(() => {
          const dbUsers = this.getSimulatedUsers();
          let existingUser = dbUsers.find(u => u.email === email);
          
          if (!existingUser) {
            // Find if org has users
            const orgHasUsers = dbUsers.some(u => u.organizationId.toLowerCase() === organizationId.toLowerCase());
            let finalRole = role;
            if (!orgHasUsers) {
              finalRole = 'Admin';
            } else if (finalRole === 'Admin') {
              finalRole = 'Analyst';
            }

            existingUser = {
              uid: `fb-usr-${Math.floor(1000 + Math.random() * 9000)}`,
              email,
              displayName: displayName || email.split('@')[0].replace('.', ' '),
              role: finalRole,
              organizationId,
            };
            dbUsers.push(existingUser);
            this.saveSimulatedUsers(dbUsers);
          }

          this.currentUser = existingUser;
          localStorage.setItem(this.storageKey, JSON.stringify(existingUser));
          
          eventBus.emit('AUTH_STATE_CHANGED', existingUser);
          eventBus.emit('AUDIT_LOG', {
            action: 'AUTH_LOGIN',
            details: `Simulated user '${existingUser.email}' signed in (Role: '${existingUser.role}', Organization: '${existingUser.organizationId}').`,
            status: 'success'
          });

          resolve(existingUser);
        }, 300);
      });
    }
  }

  /**
   * Registers a brand-new cloud auth user and registers custom role clearances.
   */
  async register(email: string, role: UserRole, organizationId: string, displayName: string, password?: string): Promise<FirebaseUser> {
    if (this.isConfigured && this.realAuth && this.realDb && password) {
      // REAL CLOUD AUTH REGISTRATION
      const userCredential = await createUserWithEmailAndPassword(this.realAuth, email, password);
      const fbUser = userCredential.user;

      await updateProfile(fbUser, { displayName });

      // 1. Check if organization document exists in organizations collection to enforce first-user admin rules
      const orgRef = doc(this.realDb, 'organizations', organizationId);
      const orgDoc = await getDoc(orgRef);
      
      let finalRole = role;
      if (!orgDoc.exists()) {
        // First user in the org is automatically the Admin
        finalRole = 'Admin';
      } else if (finalRole === 'Admin') {
        // Enforce that subsequent registrations cannot hijack Admin clearance
        finalRole = 'Analyst';
      }

      const userProfile = {
        uid: fbUser.uid,
        email,
        displayName,
        role: finalRole,
        organizationId,
        createdAt: new Date().toISOString(),
      };
      
      await setDoc(doc(this.realDb, 'users', fbUser.uid), userProfile);

      // Provision organization document in Cloud Firestore if it didn't exist
      if (!orgDoc.exists()) {
        await setDoc(orgRef, {
          id: organizationId,
          creatorUid: fbUser.uid,
          createdAt: new Date().toISOString()
        });
      }

      const finalUser: FirebaseUser = {
        uid: fbUser.uid,
        email,
        displayName,
        role: finalRole,
        organizationId,
      };

      this.currentUser = finalUser;
      localStorage.setItem(this.storageKey, JSON.stringify(finalUser));
      
      eventBus.emit('AUTH_STATE_CHANGED', finalUser);
      eventBus.emit('AUDIT_LOG', {
        action: 'AUTH_REGISTER',
        details: `Cloud user profile '${email}' created in organization '${organizationId}' as Role: '${finalRole}'.`,
        status: 'success'
      });

      return finalUser;
    } else {
      // simulated registration
      return new Promise((resolve) => {
        setTimeout(() => {
          const dbUsers = this.getSimulatedUsers();
          
          // Check if organization already has users in our simulated database
          const orgHasUsers = dbUsers.some(u => u.organizationId.toLowerCase() === organizationId.toLowerCase());
          let finalRole = role;
          if (!orgHasUsers) {
            // First user in organization gets Admin
            finalRole = 'Admin';
          } else if (finalRole === 'Admin') {
            // Prevent others from registering as Admin
            finalRole = 'Analyst';
          }

          const newUser: FirebaseUser = {
            uid: `fb-usr-${Math.floor(1000 + Math.random() * 9000)}`,
            email,
            displayName,
            role: finalRole,
            organizationId,
          };

          dbUsers.push(newUser);
          this.saveSimulatedUsers(dbUsers);

          this.currentUser = newUser;
          localStorage.setItem(this.storageKey, JSON.stringify(newUser));
          
          eventBus.emit('AUTH_STATE_CHANGED', newUser);
          eventBus.emit('AUDIT_LOG', {
            action: 'AUTH_REGISTER',
            details: `Simulated profile '${newUser.email}' registered in organization '${organizationId}' as Role: '${newUser.role}'.`,
            status: 'success'
          });

          resolve(newUser);
        }, 300);
      });
    }
  }

  /**
   * Logs out user from cloud/simulation session.
   */
  async logout(): Promise<void> {
    if (this.isConfigured && this.realAuth) {
      await signOut(this.realAuth);
      this.currentUser = null;
      localStorage.removeItem(this.storageKey);
      eventBus.emit('AUTH_STATE_CHANGED', null);
    } else {
      return new Promise((resolve) => {
        setTimeout(() => {
          const oldUser = this.currentUser;
          this.currentUser = null;
          localStorage.removeItem(this.storageKey);

          eventBus.emit('AUTH_STATE_CHANGED', null);
          if (oldUser) {
            eventBus.emit('AUDIT_LOG', {
              action: 'AUTH_LOGOUT',
              details: `Simulated user '${oldUser.email}' logged out. Session closed.`,
              status: 'success'
            });
          }
          resolve();
        }, 200);
      });
    }
  }

  /**
   * Evaluates if user context holds clearances.
   */
  hasRole(allowedRoles: UserRole[]): boolean {
    if (!this.currentUser) return false;
    return allowedRoles.includes(this.currentUser.role);
  }

  /**
   * Administrative role shifts (dynamically updates local or Firestore doc).
   */
  async updateRoleAndTenant(role: UserRole, organizationId: string): Promise<void> {
    if (!this.currentUser) return;

    const updated = {
      ...this.currentUser,
      role,
      organizationId,
    };

    this.currentUser = updated;
    localStorage.setItem(this.storageKey, JSON.stringify(updated));
    eventBus.emit('AUTH_STATE_CHANGED', updated);

    if (this.isConfigured && this.realDb && this.realAuth?.currentUser) {
      try {
        const userDocRef = doc(this.realDb, 'users', this.realAuth.currentUser.uid);
        await updateDoc(userDocRef, { role, organizationId });
        
        eventBus.emit('AUDIT_LOG', {
          action: 'AUTH_TENANT_SHIFT',
          details: `Cloud profile synchronised: Role updated to '${role}', Organization to '${organizationId}'.`,
          status: 'success'
        });
      } catch (err) {
        console.error('[FirebaseService] Failed to update Firestore profile doc:', err);
      }
    } else {
      eventBus.emit('AUDIT_LOG', {
        action: 'AUTH_TENANT_SHIFT',
        details: `Administrative identity shift: Role updated to '${role}', Organization to '${organizationId}'.`,
        status: 'success'
      });
    }
  }

  /**
   * Safe organizational setup and joining route. Enforces creator-admin rules.
   */
  async joinOrganization(organizationId: string, preferredRole: UserRole): Promise<FirebaseUser> {
    if (!this.currentUser) throw new Error('No user is currently signed in.');

    let finalRole = preferredRole;

    if (this.isConfigured && this.realDb && this.realAuth?.currentUser) {
      // 1. Check if organization exists in organizations collection to enforce creator-admin rules
      const orgRef = doc(this.realDb, 'organizations', organizationId);
      const orgDoc = await getDoc(orgRef);

      if (!orgDoc.exists()) {
        finalRole = 'Admin';
      } else if (finalRole === 'Admin') {
        finalRole = 'Analyst';
      }

      // Update Firestore user document
      const userDocRef = doc(this.realDb, 'users', this.realAuth.currentUser.uid);
      await updateDoc(userDocRef, { organizationId, role: finalRole });

      // Provision organization document in Cloud Firestore if it didn't exist
      if (!orgDoc.exists()) {
        await setDoc(orgRef, {
          id: organizationId,
          creatorUid: this.realAuth.currentUser.uid,
          createdAt: new Date().toISOString()
        });
      }
    } else {
      // Simulated
      const dbUsers = this.getSimulatedUsers();

      // Check if organization already has users in our simulated database
      const orgHasUsers = dbUsers.some(u => u.organizationId.toLowerCase() === organizationId.toLowerCase());
      if (!orgHasUsers) {
        finalRole = 'Admin';
      } else if (finalRole === 'Admin') {
        finalRole = 'Analyst';
      }

      // Update user in simulated database
      const targetUser = dbUsers.find(u => u.uid === this.currentUser!.uid);
      if (targetUser) {
        targetUser.organizationId = organizationId;
        targetUser.role = finalRole;
        this.saveSimulatedUsers(dbUsers);
      }
    }

    const updated: FirebaseUser = {
      ...this.currentUser,
      role: finalRole,
      organizationId,
    };

    this.currentUser = updated;
    localStorage.setItem(this.storageKey, JSON.stringify(updated));
    eventBus.emit('AUTH_STATE_CHANGED', updated);

    eventBus.emit('AUDIT_LOG', {
      action: 'AUTH_TENANT_JOIN',
      details: `User joined organization '${organizationId}' as Role: '${finalRole}'.`,
      status: 'success'
    });

    return updated;
  }
}

export const firebaseService = new FirebaseService();
export default firebaseService;
