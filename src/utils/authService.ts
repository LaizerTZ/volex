import { AppUser, EmailAccessInvitation, ScreenId } from '../types';
import { loadStoredUsers, saveStoredUsers, generateFourDigitPin, getUserScreenPermission, getDefaultScreenPermissionsForRole } from './storage';

const INVITATIONS_STORAGE_KEY = 'po_tracker_email_invitations_v1';
const CURRENT_USER_STORAGE_KEY = 'po_tracker_active_session_user_v1';

export const DEFAULT_INVITATIONS: EmailAccessInvitation[] = [
  {
    id: 'inv-1',
    email: 'admin@enterprisegroup.com',
    name: 'Famola Admin',
    role: 'Admin',
    department: 'Executive Management',
    token: 'token_famola_admin_secure_access_2026',
    accessUrl: '',
    createdAt: '2026-01-15',
    expiresAt: '2027-01-15',
    status: 'Active',
    lastUsedAt: '2026-03-01',
  },
  {
    id: 'inv-2',
    email: 'sarah.m@enterprisegroup.com',
    name: 'Sarah Mwangi',
    role: 'Finance Officer',
    department: 'Finance & Accounting',
    token: 'token_sarah_finance_officer_access',
    accessUrl: '',
    createdAt: '2026-02-01',
    expiresAt: '2027-02-01',
    status: 'Active',
    lastUsedAt: '2026-02-28',
  },
  {
    id: 'inv-3',
    email: 'james.k@enterprisegroup.com',
    name: 'James Kiprono',
    role: 'Logistics Manager',
    department: 'Supply Chain & Logistics',
    token: 'token_james_logistics_manager_access',
    accessUrl: '',
    createdAt: '2026-02-10',
    expiresAt: '2027-02-10',
    status: 'Active',
  },
];

export const loadStoredInvitations = (): EmailAccessInvitation[] => {
  try {
    const raw = localStorage.getItem(INVITATIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load Invitations', e);
  }
  saveStoredInvitations(DEFAULT_INVITATIONS);
  return DEFAULT_INVITATIONS;
};

export const saveStoredInvitations = (invitations: EmailAccessInvitation[]) => {
  try {
    localStorage.setItem(INVITATIONS_STORAGE_KEY, JSON.stringify(invitations));
  } catch (e) {
    console.error('Failed to save Invitations', e);
  }
};

/**
 * Generates an encrypted/tokenized Magic Email Access Link
 */
export const generateEmailAccessLink = (
  email: string,
  name: string,
  role: AppUser['role'],
  department: string = 'Operations',
  invitedBy: string = 'Famola Admin'
): { invitation: EmailAccessInvitation; accessLink: string } => {
  const cleanEmail = email.trim().toLowerCase();
  const randomSalt = Math.random().toString(36).substring(2, 10);
  const token = `famola_${btoa(`${cleanEmail}:${Date.now()}:${randomSalt}`).replace(/=/g, '')}`;

  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const accessLink = `${origin}${pathname}?access_token=${token}&access_email=${encodeURIComponent(cleanEmail)}`;

  const now = new Date();
  const expiryDate = new Date();
  expiryDate.setDate(now.getDate() + 90); // 90 days validity

  const invitation: EmailAccessInvitation = {
    id: `inv-${Date.now()}`,
    email: cleanEmail,
    name: name.trim(),
    role,
    department: department.trim(),
    token,
    accessUrl: accessLink,
    createdAt: now.toISOString().slice(0, 10),
    expiresAt: expiryDate.toISOString().slice(0, 10),
    status: 'Active',
    invitedBy,
  };

  const stored = loadStoredInvitations();
  // Replace if exists for same email or append
  const filtered = stored.filter((i) => i.email !== cleanEmail);
  const updated = [invitation, ...filtered];
  saveStoredInvitations(updated);

  // Also ensure user is registered in the users directory
  const users = loadStoredUsers();
  const existingUserIndex = users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
  if (existingUserIndex >= 0) {
    users[existingUserIndex].name = name;
    users[existingUserIndex].role = role;
    users[existingUserIndex].department = department;
    users[existingUserIndex].status = 'Active';
    users[existingUserIndex].accessToken = token;
    saveStoredUsers(users);
  } else {
    const newUser: AppUser = {
      id: `usr-${Date.now()}`,
      name: name.trim(),
      email: cleanEmail,
      role,
      department,
      status: 'Active',
      createdAt: now.toISOString().slice(0, 10),
      accessToken: token,
    };
    saveStoredUsers([newUser, ...users]);
  }

  return { invitation, accessLink };
};

/**
 * Validates access token and email from URL parameters
 */
export const validateEmailAccessToken = (
  token: string,
  emailParam?: string | null
): { success: boolean; user?: AppUser; message: string } => {
  const invitations = loadStoredInvitations();
  const users = loadStoredUsers();

  // Find matching invitation by token or token+email
  const inv = invitations.find(
    (i) =>
      i.token === token &&
      i.status === 'Active' &&
      (!emailParam || i.email.toLowerCase() === emailParam.toLowerCase())
  );

  if (!inv) {
    // Check if token matches a user directly
    const userMatch = users.find(
      (u) =>
        (u.accessToken === token || (emailParam && u.email.toLowerCase() === emailParam.toLowerCase())) &&
        u.status === 'Active'
    );
    if (userMatch) {
      setCurrentSessionUser(userMatch);
      return {
        success: true,
        user: userMatch,
        message: `Welcome back, ${userMatch.name}! You are authenticated as ${userMatch.role}.`,
      };
    }

    return {
      success: false,
      message: 'Invalid, expired, or revoked email access link. Please request a new invitation link.',
    };
  }

  // Update invitation last used
  inv.lastUsedAt = new Date().toISOString().slice(0, 10);
  saveStoredInvitations(invitations);

  // Get or construct active user
  let activeUser = users.find((u) => u.email.toLowerCase() === inv.email.toLowerCase());
  if (!activeUser) {
    activeUser = {
      id: `usr-${Date.now()}`,
      name: inv.name,
      email: inv.email,
      role: inv.role,
      department: inv.department,
      status: 'Active',
      createdAt: new Date().toISOString().slice(0, 10),
      lastLoginAt: new Date().toISOString(),
    };
    saveStoredUsers([activeUser, ...users]);
  } else {
    activeUser.lastLoginAt = new Date().toISOString();
    saveStoredUsers(users);
  }

  setCurrentSessionUser(activeUser);
  return {
    success: true,
    user: activeUser,
    message: `Access granted for ${activeUser.name} (${activeUser.role} - ${activeUser.department}).`,
  };
};

/**
 * Current Session User management
 */
export const getCurrentSessionUser = (): AppUser => {
  try {
    const raw = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to get session user', e);
  }
  // Default to Admin
  const defaultAdmin = loadStoredUsers()[0] || {
    id: 'usr-1',
    name: 'Famola Admin',
    email: 'admin@enterprisegroup.com',
    role: 'Admin',
    department: 'Executive Management',
    status: 'Active',
    createdAt: '2026-01-15',
  };
  setCurrentSessionUser(defaultAdmin);
  return defaultAdmin;
};

export const setCurrentSessionUser = (user: AppUser) => {
  try {
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
  } catch (e) {
    console.error('Failed to save session user', e);
  }
};

export const clearSessionUser = () => {
  localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
};

/**
 * Role-Based Access Control (RBAC) helpers
 */
export const isAdminUser = (user?: AppUser | null): boolean => {
  if (!user) return false;
  return user.role === 'Admin';
};

export const isUserOnHold = (user?: AppUser | null): boolean => {
  if (!user) return false;
  return user.status === 'On Hold';
};

/**
 * Database loading and exporting is strictly limited to Admin users only!
 */
export const canLoadDatabase = (user?: AppUser | null): boolean => {
  return isAdminUser(user);
};

export const canExportDatabase = (user?: AppUser | null): boolean => {
  return isAdminUser(user);
};

export const canAccessDatabaseOperations = (user?: AppUser | null): boolean => {
  return isAdminUser(user);
};

export const canAccessSettings = (user?: AppUser | null): boolean => {
  return isAdminUser(user);
};

export const canAccessGoogleSheetsData = (user?: AppUser | null): boolean => {
  return isAdminUser(user);
};

/**
 * Screen-level View & Edit permissions
 */
export const canViewScreen = (user?: AppUser | null, screenId?: ScreenId): boolean => {
  if (!user || !screenId) return false;
  if (user.status === 'On Hold') return false;
  if (isAdminUser(user)) return true;
  const level = getUserScreenPermission(user, screenId);
  return level === 'view' || level === 'edit';
};

export const canEditScreen = (user?: AppUser | null, screenId?: ScreenId): boolean => {
  if (!user || !screenId) return false;
  if (user.status === 'On Hold') return false;
  if (isAdminUser(user)) return true;
  const level = getUserScreenPermission(user, screenId);
  return level === 'edit';
};

export const canRecordInvoice = (user?: AppUser | null): boolean => {
  return canEditScreen(user, 'create_invoice');
};

export const canRecordDelivery = (user?: AppUser | null): boolean => {
  return canEditScreen(user, 'delivery_notes');
};

export const canRecordPayment = (user?: AppUser | null): boolean => {
  return canEditScreen(user, 'payments');
};

export const canUploadPOData = (user?: AppUser | null): boolean => {
  return canLoadDatabase(user);
};

/**
 * PIN-based Authentication & Hold management
 */
export const validateUserPin = (
  userIdOrEmail: string,
  pin: string
): { success: boolean; user?: AppUser; message: string; isOnHold?: boolean } => {
  const users = loadStoredUsers();
  const target = users.find(
    (u) => u.id === userIdOrEmail || u.email.toLowerCase() === userIdOrEmail.toLowerCase()
  );

  if (!target) {
    return { success: false, message: 'User account not found in system.' };
  }

  if (target.status === 'On Hold') {
    return {
      success: false,
      user: target,
      isOnHold: true,
      message: `Account On Hold: Access for ${target.name} is currently suspended by Administrator.`,
    };
  }

  if (target.status === 'Inactive') {
    return {
      success: false,
      user: target,
      message: `Account Inactive: Access for ${target.name} has been deactivated.`,
    };
  }

  const expectedPin = (target.pinCode || '1234').trim();
  if (pin.trim() !== expectedPin) {
    return {
      success: false,
      user: target,
      message: 'Incorrect 4-digit PIN password. Please verify the code generated by Administrator.',
    };
  }

  // Success - update lastLoginAt and active session
  target.lastLoginAt = new Date().toISOString();
  saveStoredUsers(users);
  setCurrentSessionUser(target);

  return {
    success: true,
    user: target,
    message: `Authenticated successfully as ${target.name} (${target.role})`,
  };
};

export const toggleUserHoldStatus = (userId: string): AppUser | null => {
  const users = loadStoredUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) return null;

  const currentStatus = users[index].status;
  const newStatus: AppUser['status'] = currentStatus === 'On Hold' ? 'Active' : 'On Hold';
  users[index].status = newStatus;

  saveStoredUsers(users);

  // If the user currently in session was put on hold, update session state
  const sessionUser = getCurrentSessionUser();
  if (sessionUser?.id === userId) {
    setCurrentSessionUser(users[index]);
  }

  return users[index];
};

export const regenerateUserPin = (userId: string): { user: AppUser; newPin: string } | null => {
  const users = loadStoredUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) return null;

  const newPin = generateFourDigitPin();
  users[index].pinCode = newPin;
  saveStoredUsers(users);

  const sessionUser = getCurrentSessionUser();
  if (sessionUser?.id === userId) {
    setCurrentSessionUser(users[index]);
  }

  return { user: users[index], newPin };
};

export const updateUserScreenPermission = (
  userId: string,
  screenId: ScreenId,
  level: 'none' | 'view' | 'edit'
): AppUser | null => {
  const users = loadStoredUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) return null;

  if (!users[index].screenPermissions) {
    users[index].screenPermissions = getDefaultScreenPermissionsForRole(users[index].role);
  }
  users[index].screenPermissions![screenId] = level;
  saveStoredUsers(users);

  const sessionUser = getCurrentSessionUser();
  if (sessionUser?.id === userId) {
    setCurrentSessionUser(users[index]);
  }

  return users[index];
};

export const generateShareableLoginLink = (user: AppUser): string => {
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  return `${origin}${pathname}?login_user=${encodeURIComponent(user.id)}&email=${encodeURIComponent(user.email)}`;
};

export const getUserLoginInvitationText = (user: AppUser): string => {
  const loginUrl = generateShareableLoginLink(user);
  return `Subject: Access Link & 4-Digit PIN for FAMOLA PO & Invoicing System (TZS)

Dear ${user.name},

You have been granted access to the FAMOLA Enterprise PO, Invoicing & Delivery Management System.

Your Login Details:
- Name: ${user.name}
- Department: ${user.department}
- Role: ${user.role}
- Status: ${user.status}
- 4-Digit Password (PIN): ${user.pinCode || '1234'}

Direct Login Link:
${loginUrl}

Instructions:
1. Click or open the link above in your web browser.
2. Enter your 4-digit PIN (${user.pinCode || '1234'}) to securely sign in.
3. Your screen permissions (Can View / Can Edit) are configured by Administrator.

Best regards,
FAMOLA System Administrator
`;
};

/**
 * Generates an email body template ready to copy and paste to user
 */
export const getEmailInvitationText = (invitation: EmailAccessInvitation): string => {
  const users = loadStoredUsers();
  const user = users.find((u) => u.email.toLowerCase() === invitation.email.toLowerCase());
  const pin = user?.pinCode || '1234';
  const loginUrl = user ? generateShareableLoginLink(user) : invitation.accessUrl;

  return `Subject: Secure Access Link & 4-Digit PIN to FAMOLA Excel Ninja (TZS)

Dear ${invitation.name},

You have been granted access to the FAMOLA Excel Ninja Enterprise Purchase Order, Invoicing, and Delivery Management System.

Role: ${invitation.role}
Department: ${invitation.department}
Authorized Email: ${invitation.email}
4-Digit Password (PIN): ${pin}

Click the secure link below to directly sign in:
${loginUrl}

Enter your 4-digit PIN password when prompted to authenticate.

Best regards,
FAMOLA Administrator
`;
};
