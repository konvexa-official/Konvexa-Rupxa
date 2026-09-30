/**
 * Firebase Authentication Error Message Formatter
 * Formats Firebase Auth error codes into friendly user messages.
 */

export function formatFirebaseAuthError(error: unknown): string {
  if (!error) return 'An unexpected error occurred. Please try again.';

  const code = (error as { code?: string })?.code || '';
  const message = error instanceof Error ? error.message : String(error);

  if (code === 'auth/operation-not-allowed' || message.includes('auth/operation-not-allowed')) {
    return 'Email and password sign-in is currently unavailable. Please enable Email/Password authentication in Firebase Console.';
  }
  if (code === 'auth/invalid-credential' || message.includes('auth/invalid-credential')) {
    return 'Invalid email or password. Please verify your credentials.';
  }
  if (code === 'auth/email-already-in-use' || message.includes('auth/email-already-in-use')) {
    return 'This email is already registered. Please sign in or use a different email.';
  }
  if (code === 'auth/weak-password' || message.includes('auth/weak-password')) {
    return 'Password is too weak. Please use at least 6 characters including numbers or symbols.';
  }
  if (code === 'auth/user-not-found' || message.includes('auth/user-not-found')) {
    return 'No account found with this email address. Please sign up.';
  }
  if (code === 'auth/wrong-password' || message.includes('auth/wrong-password')) {
    return 'Incorrect password. Please try again or reset your password.';
  }
  if (code === 'auth/invalid-email' || message.includes('auth/invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (code === 'auth/too-many-requests' || message.includes('auth/too-many-requests')) {
    return 'Too many attempts. Please try again in a few minutes.';
  }
  if (code === 'auth/network-request-failed' || message.includes('auth/network-request-failed')) {
    return 'Network error. Please check your internet connection.';
  }

  // Remove generic "Firebase: Error (auth/...)" prefix
  const cleanMsg = message.replace(/^Firebase:\s*(Error\s*)?(\(auth\/[^)]+\)\.?)?\s*/i, '').trim();
  return cleanMsg || 'Authentication failed. Please check your details and try again.';
}
