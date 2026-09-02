import { AppUser, EmailAccessInvitation } from '../types';
import { loadStoredUsers, saveStoredUsers } from './storage';

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
 * Generates an email body template ready to copy and paste to user
 */
export const getEmailInvitationText = (invitation: EmailAccessInvitation): string => {
  return `Subject: Secure Access Link to FAMOLA Excel Ninja PO & Invoice System

Dear ${invitation.name},

You have been granted access to the FAMOLA Excel Ninja Enterprise Purchase Order, Invoicing, and Delivery Management System.

Role: ${invitation.role}
Department: ${invitation.department}
Authorized Email: ${invitation.email}
Valid Until: ${invitation.expiresAt}

Click the secure link below to directly sign in and start working:
${invitation.accessUrl || `${window.location.origin}${window.location.pathname}?access_token=${invitation.token}&access_email=${encodeURIComponent(invitation.email)}`}

Note: Please do not forward this secure email link to unauthorized personnel.

Best regards,
FAMOLA Operations & Finance Team
`;
};
