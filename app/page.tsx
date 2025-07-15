"use client";

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import "./../app/app.css";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";
import { 
  signOut, 
  fetchUserAttributes, 
  updateUserAttribute, 
  updateUserAttributes, 
  confirmUserAttribute, 
  sendUserAttributeVerificationCode, 
  deleteUserAttributes, 
  signUp,
  confirmSignUp,
  signIn,
  getCurrentUser,
  fetchAuthSession,
  type VerifiableUserAttributeKey,
  type SignUpInput
} from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

Amplify.configure(outputs);

const client = generateClient<Schema>();

interface UserAttributes {
  email?: string;
  phone_number?: string;
  given_name?: string;
  family_name?: string;
  nickname?: string;
  name?: string;
  [key: string]: string | undefined;
}

interface AuthEvent {
  type: string;
  data?: any;
  timestamp: number;
}

export default function App() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [userAttributes, setUserAttributes] = useState<UserAttributes>({});
  const [showProfile, setShowProfile] = useState(false);
  const [isLoadingAttributes, setIsLoadingAttributes] = useState(false);
  const [isUpdatingAttribute, setIsUpdatingAttribute] = useState(false);
  const [showAttributeForm, setShowAttributeForm] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<string>("");
  const [attributeValue, setAttributeValue] = useState("");
  const [showConfirmationForm, setShowConfirmationForm] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState("");
  const [pendingAttributeKey, setPendingAttributeKey] = useState("");
  const [error, setError] = useState("");
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignUp, setShowSignUp] = useState(true);
  
  // Advanced features state
  const [authEvents, setAuthEvents] = useState<AuthEvent[]>([]);
  const [showAuthEvents, setShowAuthEvents] = useState(false);
  const [customSignUpData, setCustomSignUpData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
    organizationName: "",
    municipality: "",
    signUpForUpdates: false,
    clientMetadata: {
      source: "custom_signup",
      userType: "standard"
    }
  });
  const [customLoginData, setCustomLoginData] = useState({
    email: "",
    password: "",
    clientMetadata: {
      source: "custom_login"
    }
  });
  const [isCustomSigningUp, setIsCustomSigningUp] = useState(false);
  const [isCustomLoggingIn, setIsCustomLoggingIn] = useState(false);
  const [showSignUpConfirmation, setShowSignUpConfirmation] = useState(false);
  const [signUpConfirmationCode, setSignUpConfirmationCode] = useState("");

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Subscribe to authentication events
  useEffect(() => {
    const unsubscribe = Hub.listen('auth', (data) => {
      const event: AuthEvent = {
        type: data.payload.event,
        data: data.payload,
        timestamp: Date.now()
      };
      setAuthEvents(prev => [event, ...prev.slice(0, 9)]); // Keep last 10 events
      console.log('Auth event:', event);
      
      // Update authentication status based on events
      if (data.payload.event === 'signedIn') {
        setIsAuthenticated(true);
        checkAuthStatus();
      } else if (data.payload.event === 'signedOut') {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    });

    return unsubscribe;
  }, []);

  async function checkAuthStatus() {
    try {
      const session = await fetchAuthSession();
      if (session.tokens) {
        const user = await getCurrentUser();
        setIsAuthenticated(true);
        setCurrentUser(user);
        setShowLogin(false);
        setShowSignUp(false);
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    } catch (error) {
      setIsAuthenticated(false);
      setCurrentUser(null);
    }
  }

  // Custom Login
  async function handleCustomLogin() {
    setIsCustomLoggingIn(true);
    setError("");

    try {
      await signIn({
        username: customLoginData.email,
        password: customLoginData.password,
        options: {
          clientMetadata: customLoginData.clientMetadata
        }
      });

      await checkAuthStatus();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to sign in');
    } finally {
      setIsCustomLoggingIn(false);
    }
  }

  // Custom Sign-up
  async function handleCustomSignUp() {
    setIsCustomSigningUp(true);
    setError("");

    try {
      const userAttributes: Record<string, string> = {
        email: customSignUpData.email
      };

      if (customSignUpData.firstName) {
        userAttributes.given_name = customSignUpData.firstName;
      }
      if (customSignUpData.lastName) {
        userAttributes.family_name = customSignUpData.lastName;
      }
      if (customSignUpData.phoneNumber) {
        userAttributes.phone_number = customSignUpData.phoneNumber;
      }
      if (customSignUpData.organizationName) {
        userAttributes['custom:organization_name'] = customSignUpData.organizationName;
      }
      if (customSignUpData.municipality) {
        userAttributes['custom:municipality'] = customSignUpData.municipality;
      }
      if (customSignUpData.signUpForUpdates) {
        userAttributes['custom:signup_for_updates'] = 'true';
      }

      const signUpInput: SignUpInput = {
        username: customSignUpData.email,
        password: customSignUpData.password,
        options: {
          userAttributes,
          clientMetadata: {
            ...customSignUpData.clientMetadata,
            organizationName: customSignUpData.organizationName,
            municipality: customSignUpData.municipality,
            signUpForUpdates: customSignUpData.signUpForUpdates.toString()
          }
        }
      };

      const result = await signUp(signUpInput);
      
      if (result.nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        setShowSignUpConfirmation(true);
        setShowSignUp(false);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to sign up');
    } finally {
      setIsCustomSigningUp(false);
    }
  }

  async function handleConfirmSignUp() {
    setIsCustomSigningUp(true);
    setError("");

    try {
      await confirmSignUp({
        username: customSignUpData.email,
        confirmationCode: signUpConfirmationCode,
        options: {
          clientMetadata: {
            source: "custom_signup_confirmation"
          }
        }
      });

      // Auto sign-in after confirmation
      await signIn({
        username: customSignUpData.email,
        password: customSignUpData.password,
        options: {
          clientMetadata: {
            source: "auto_signin_after_confirmation"
          }
        }
      });

      setShowSignUpConfirmation(false);
      setSignUpConfirmationCode("");
      setCustomSignUpData({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        phoneNumber: "",
        organizationName: "",
        municipality: "",
        signUpForUpdates: false,
        clientMetadata: {
          source: "custom_signup",
          userType: "standard"
        }
      });
      
      await checkAuthStatus();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to confirm sign up');
    } finally {
      setIsCustomSigningUp(false);
    }
  }

  async function handleSignOut(global: boolean = false) {
    setIsSigningOut(true);
    try {
      await signOut({ global });
      setIsAuthenticated(false);
      setCurrentUser(null);
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      setIsSigningOut(false);
    }
  }

  async function loadUserAttributes() {
    setIsLoadingAttributes(true);
    try {
      const attributes = await fetchUserAttributes();
      setUserAttributes(attributes);
    } catch (error) {
      console.error('Failed to load user attributes:', error);
      setError('Failed to load user profile');
    } finally {
      setIsLoadingAttributes(false);
    }
  }

  async function handleUpdateAttribute(attributeKey: string, value: string) {
    setIsUpdatingAttribute(true);
    setError("");

    try {
      const output = await updateUserAttribute({
        userAttribute: {
          attributeKey,
          value
        },
        options: {
          clientMetadata: {
            source: "profile_update",
            attributeKey
          }
        }
      });

      if (output.nextStep.updateAttributeStep === 'CONFIRM_ATTRIBUTE_WITH_CODE') {
        setPendingAttributeKey(attributeKey);
        setShowConfirmationForm(true);
        setShowAttributeForm(false);
      } else if (output.nextStep.updateAttributeStep === 'DONE') {
        await loadUserAttributes();
        setShowAttributeForm(false);
        setEditingAttribute("");
        setAttributeValue("");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update attribute');
    } finally {
      setIsUpdatingAttribute(false);
    }
  }

  async function handleConfirmAttribute() {
    setIsUpdatingAttribute(true);
    setError("");

    try {
      await confirmUserAttribute({
        userAttributeKey: pendingAttributeKey as 'email' | 'phone_number',
        confirmationCode: confirmationCode
      });
      
      await loadUserAttributes();
      setShowConfirmationForm(false);
      setConfirmationCode("");
      setPendingAttributeKey("");
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to confirm attribute');
    } finally {
      setIsUpdatingAttribute(false);
    }
  }

  async function handleSendVerificationCode(attributeKey: string) {
    try {
      if (attributeKey === 'email' || attributeKey === 'phone_number') {
        await sendUserAttributeVerificationCode({
          userAttributeKey: attributeKey as 'email' | 'phone_number'
        });
        setPendingAttributeKey(attributeKey);
        setShowConfirmationForm(true);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to send verification code');
    }
  }

  async function handleDeleteAttribute(attributeKey: string) {
    try {
      await deleteUserAttributes({
        userAttributeKeys: [attributeKey]
      });
      await loadUserAttributes();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete attribute');
    }
  }

  const getAttributeDisplayName = (key: string) => {
    const displayNames: { [key: string]: string } = {
      email: 'Email',
      phone_number: 'Phone Number',
      given_name: 'First Name',
      family_name: 'Last Name',
      nickname: 'Nickname',
      name: 'Full Name',
      'custom:organization_name': 'Organization Name',
      'custom:municipality': 'Municipality',
      'custom:signup_for_updates': 'Sign Up for Updates',
      'custom:display_name': 'Display Name'
    };
    return displayNames[key] || key;
  };

  const isVerifiableAttribute = (key: string) => {
    return ['email', 'phone_number'].includes(key);
  };

  const getAuthEventDisplayName = (eventType: string) => {
    const displayNames: { [key: string]: string } = {
      signIn: 'Sign In',
      signOut: 'Sign Out',
      signUp: 'Sign Up',
      confirmSignUp: 'Confirm Sign Up',
      forgotPassword: 'Forgot Password',
      confirmForgotPassword: 'Confirm Forgot Password',
      tokenRefresh: 'Token Refresh',
      userDeleted: 'User Deleted',
      mfaSetup: 'MFA Setup',
      mfaSelect: 'MFA Select',
      mfaSubmit: 'MFA Submit',
      mfaComplete: 'MFA Complete',
      customState: 'Custom State',
      autoSignIn: 'Auto Sign In',
      autoSignIn_failure: 'Auto Sign In Failed'
    };
    return displayNames[eventType] || eventType;
  };

  // Authentication Forms
  if (!isAuthenticated) {
    return (
      <main style={{ maxWidth: "600px", margin: "50px auto", padding: "20px" }}>
        <h1 style={{ textAlign: "center", marginBottom: "30px" }}>Welcome to Green Space App</h1>
        
        {error && <div style={{ color: "red", marginBottom: "20px", padding: "10px", backgroundColor: "#ffe6e6", borderRadius: "4px" }}>{error}</div>}

        {/* Sign Up Form */}
        {showSignUp && (
          <div style={{ marginBottom: "20px", padding: "20px", border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#f8f9fa" }}>
            <h2>Create Account</h2>
            <p style={{ fontSize: "14px", color: "#666", marginBottom: "15px" }}>
              Sign up with your details and organization information
            </p>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "15px" }}>
              <div>
                <label>Email: *</label>
                <input
                  type="email"
                  value={customSignUpData.email}
                  onChange={(e) => setCustomSignUpData(prev => ({ ...prev, email: e.target.value }))}
                  style={{ width: "100%", padding: "8px" }}
                  required
                />
              </div>
              <div>
                <label>Password: *</label>
                <input
                  type="password"
                  value={customSignUpData.password}
                  onChange={(e) => setCustomSignUpData(prev => ({ ...prev, password: e.target.value }))}
                  style={{ width: "100%", padding: "8px" }}
                  required
                />
              </div>
              <div>
                <label>Organization Name: *</label>
                <input
                  type="text"
                  value={customSignUpData.organizationName}
                  onChange={(e) => setCustomSignUpData(prev => ({ ...prev, organizationName: e.target.value }))}
                  style={{ width: "100%", padding: "8px" }}
                  placeholder="Enter your organization name"
                  required
                />
              </div>
              <div>
                <label>Municipality (optional):</label>
                <input
                  type="text"
                  value={customSignUpData.municipality}
                  onChange={(e) => setCustomSignUpData(prev => ({ ...prev, municipality: e.target.value }))}
                  style={{ width: "100%", padding: "8px" }}
                  placeholder="Enter your municipality"
                />
              </div>
              <div>
                <label>First Name (optional):</label>
                <input
                  type="text"
                  value={customSignUpData.firstName}
                  onChange={(e) => setCustomSignUpData(prev => ({ ...prev, firstName: e.target.value }))}
                  style={{ width: "100%", padding: "8px" }}
                  placeholder="Enter your first name"
                />
              </div>
              <div>
                <label>Last Name (optional):</label>
                <input
                  type="text"
                  value={customSignUpData.lastName}
                  onChange={(e) => setCustomSignUpData(prev => ({ ...prev, lastName: e.target.value }))}
                  style={{ width: "100%", padding: "8px" }}
                  placeholder="Enter your last name"
                />
              </div>
              <div>
                <label>Phone Number (optional):</label>
                <input
                  type="tel"
                  value={customSignUpData.phoneNumber}
                  onChange={(e) => setCustomSignUpData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  style={{ width: "100%", padding: "8px" }}
                  placeholder="+1-555-123-4567"
                />
                <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                  Examples: +1-555-123-4567, +44-20-7946-0958, +81-3-1234-5678
                </div>
              </div>
              <div>
                <label>User Type:</label>
                <select
                  value={customSignUpData.clientMetadata.userType}
                  onChange={(e) => setCustomSignUpData(prev => ({ 
                    ...prev, 
                    clientMetadata: { ...prev.clientMetadata, userType: e.target.value }
                  }))}
                  style={{ width: "100%", padding: "8px" }}
                >
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  checked={customSignUpData.signUpForUpdates}
                  onChange={(e) => setCustomSignUpData(prev => ({ ...prev, signUpForUpdates: e.target.checked }))}
                />
                Sign up for updates and newsletters
              </label>
            </div>
            
            <div>
              <button 
                onClick={handleCustomSignUp}
                disabled={isCustomSigningUp || !customSignUpData.email || !customSignUpData.password || !customSignUpData.organizationName}
                style={{ marginRight: "10px", padding: "8px 16px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px" }}
              >
                {isCustomSigningUp ? "Creating Account..." : "Create Account"}
              </button>
              <button 
                onClick={() => {
                  setShowSignUp(false);
                  setShowLogin(true);
                }}
                style={{ padding: "8px 16px", backgroundColor: "#6c757d", color: "white", border: "none", borderRadius: "4px" }}
              >
                Already have an account? Sign In
              </button>
            </div>
          </div>
        )}

        {/* Login Form */}
        {showLogin && (
          <div style={{ marginBottom: "20px", padding: "20px", border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#f8f9fa" }}>
            <h2>Sign In</h2>
            <p style={{ fontSize: "14px", color: "#666", marginBottom: "15px" }}>
              Sign in to your account
            </p>
            
            <div style={{ marginBottom: "15px" }}>
              <div style={{ marginBottom: "10px" }}>
                <label>Email:</label>
                <input
                  type="email"
                  value={customLoginData.email}
                  onChange={(e) => setCustomLoginData(prev => ({ ...prev, email: e.target.value }))}
                  style={{ width: "100%", padding: "8px" }}
                />
              </div>
              <div>
                <label>Password:</label>
                <input
                  type="password"
                  value={customLoginData.password}
                  onChange={(e) => setCustomLoginData(prev => ({ ...prev, password: e.target.value }))}
                  style={{ width: "100%", padding: "8px" }}
                />
              </div>
            </div>
            
            <div>
              <button 
                onClick={handleCustomLogin}
                disabled={isCustomLoggingIn || !customLoginData.email || !customLoginData.password}
                style={{ marginRight: "10px", padding: "8px 16px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px" }}
              >
                {isCustomLoggingIn ? "Signing In..." : "Sign In"}
              </button>
              <button 
                onClick={() => {
                  setShowLogin(false);
                  setShowSignUp(true);
                }}
                style={{ padding: "8px 16px", backgroundColor: "#6c757d", color: "white", border: "none", borderRadius: "4px" }}
              >
                Need an account? Sign Up
              </button>
            </div>
          </div>
        )}

        {/* Sign-up Confirmation */}
        {showSignUpConfirmation && (
          <div style={{ marginBottom: "20px", padding: "20px", border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#f8f9fa" }}>
            <h3>Confirm Your Account</h3>
            <p>A confirmation code has been sent to {customSignUpData.email}.</p>
            
            <div>
              <label>Confirmation Code:</label>
              <input
                type="text"
                value={signUpConfirmationCode}
                onChange={(e) => setSignUpConfirmationCode(e.target.value)}
                placeholder="Enter confirmation code"
                style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
              />
            </div>
            <div>
              <button 
                onClick={handleConfirmSignUp}
                disabled={isCustomSigningUp || !signUpConfirmationCode}
                style={{ marginRight: "10px", padding: "8px 16px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px" }}
              >
                {isCustomSigningUp ? "Confirming..." : "Confirm Account"}
              </button>
              <button 
                onClick={() => {
                  setShowSignUpConfirmation(false);
                  setSignUpConfirmationCode("");
                  setShowSignUp(true);
                }}
                style={{ padding: "8px 16px", backgroundColor: "#6c757d", color: "white", border: "none", borderRadius: "4px" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>
    );
  }

  // Main App (Authenticated)
  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1>Hello {currentUser?.username}</h1>
        <div style={{ display: "flex", gap: "10px" }}>
          <button 
            onClick={() => setShowAuthEvents(!showAuthEvents)}
            style={{ padding: "8px 16px", backgroundColor: "#17a2b8", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
          >
            {showAuthEvents ? "Hide Events" : "Show Events"}
          </button>
          <button 
            onClick={() => {
              setShowProfile(!showProfile);
              if (!showProfile) {
                loadUserAttributes();
              }
            }}
            style={{ padding: "8px 16px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
          >
            {showProfile ? "Hide Profile" : "Show Profile"}
          </button>
          <button 
            onClick={() => handleSignOut(false)} 
            disabled={isSigningOut}
            style={{ padding: "8px 16px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
          <button 
            onClick={() => handleSignOut(true)} 
            disabled={isSigningOut}
            style={{ padding: "8px 16px", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
            title="Sign out from all devices"
          >
            {isSigningOut ? "Signing out..." : "Sign out (all devices)"}
          </button>
        </div>
      </div>

      {/* Auth Events Display */}
      {showAuthEvents && (
        <div style={{ marginBottom: "20px", padding: "20px", border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#f8f9fa" }}>
          <h2>Authentication Events</h2>
          <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>
            Real-time authentication events from Amplify Hub
          </p>
          {authEvents.length === 0 ? (
            <div>No events yet. Try signing in/out to see events.</div>
          ) : (
            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              {authEvents.map((event, index) => (
                <div key={index} style={{ 
                  padding: "8px", 
                  marginBottom: "5px", 
                  border: "1px solid #eee", 
                  borderRadius: "4px",
                  fontSize: "12px",
                  backgroundColor: "#fff"
                }}>
                  <strong>{getAuthEventDisplayName(event.type)}</strong>
                  <br />
                  <span style={{ color: "#666" }}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  {event.data && (
                    <div style={{ marginTop: "5px", fontSize: "11px", color: "#888" }}>
                      {JSON.stringify(event.data, null, 2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showProfile && (
        <div style={{ marginBottom: "20px", padding: "20px", border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#f8f9fa" }}>
          <h2>User Profile</h2>
          {error && <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>}
          
          {isLoadingAttributes ? (
            <div>Loading profile...</div>
          ) : (
            <div>
              {Object.keys(userAttributes).length === 0 ? (
                <div>
                  <p>No attributes found. Add some attributes to your profile!</p>
                  <p style={{ fontSize: "14px", color: "#666", marginTop: "10px" }}>
                    <strong>Tip:</strong> You can add attributes like First Name, Last Name, Phone Number, etc. 
                    These will be stored with your account and can be used for personalization.
                  </p>
                </div>
              ) : (
                <div>
                  {Object.entries(userAttributes).map(([key, value]) => (
                    <div key={key} style={{ marginBottom: "10px", padding: "10px", border: "1px solid #eee", borderRadius: "4px" }}>
                      <strong>{getAttributeDisplayName(key)}:</strong> {value}
                      <div style={{ marginTop: "5px" }}>
                        <button 
                          onClick={() => {
                            setEditingAttribute(key);
                            setAttributeValue(value || "");
                            setShowAttributeForm(true);
                          }}
                          style={{ marginRight: "5px", padding: "4px 8px", fontSize: "12px" }}
                        >
                          Edit
                        </button>
                        {isVerifiableAttribute(key) && (
                          <button 
                            onClick={() => handleSendVerificationCode(key)}
                            style={{ marginRight: "5px", padding: "4px 8px", fontSize: "12px", backgroundColor: "#ffc107" }}
                          >
                            Verify
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteAttribute(key)}
                          style={{ padding: "4px 8px", fontSize: "12px", backgroundColor: "#dc3545", color: "white" }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <button 
                onClick={() => {
                  setEditingAttribute("");
                  setAttributeValue("");
                  setShowAttributeForm(true);
                }}
                style={{ marginTop: "10px", padding: "8px 16px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px" }}
              >
                Add New Attribute
              </button>
            </div>
          )}
        </div>
      )}

      {showAttributeForm && (
        <div style={{ marginBottom: "20px", padding: "20px", border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#f8f9fa" }}>
          <h3>{editingAttribute ? `Edit ${getAttributeDisplayName(editingAttribute)}` : "Add New Attribute"}</h3>
          <div>
            <label>Attribute Key:</label>
            <input
              type="text"
              value={editingAttribute}
              onChange={(e) => setEditingAttribute(e.target.value)}
              placeholder="e.g., email, given_name, custom:display_name"
              style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
            />
          </div>
          <div>
            <label>Value:</label>
            <input
              type="text"
              value={attributeValue}
              onChange={(e) => setAttributeValue(e.target.value)}
              placeholder="Enter value"
              style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
            />
          </div>
          <div>
            <button 
              onClick={() => handleUpdateAttribute(editingAttribute, attributeValue)}
              disabled={isUpdatingAttribute || !editingAttribute || !attributeValue}
              style={{ marginRight: "10px", padding: "8px 16px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px" }}
            >
              {isUpdatingAttribute ? "Updating..." : "Update"}
            </button>
            <button 
              onClick={() => {
                setShowAttributeForm(false);
                setEditingAttribute("");
                setAttributeValue("");
              }}
              style={{ padding: "8px 16px", backgroundColor: "#6c757d", color: "white", border: "none", borderRadius: "4px" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showConfirmationForm && (
        <div style={{ marginBottom: "20px", padding: "20px", border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "#f8f9fa" }}>
          <h3>Confirm Attribute Update</h3>
          <p>A verification code has been sent to verify your {getAttributeDisplayName(pendingAttributeKey)}.</p>
          <div>
            <label>Confirmation Code:</label>
            <input
              type="text"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              placeholder="Enter verification code"
              style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
            />
          </div>
          <div>
            <button 
              onClick={handleConfirmAttribute}
              disabled={isUpdatingAttribute || !confirmationCode}
              style={{ marginRight: "10px", padding: "8px 16px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px" }}
            >
              {isUpdatingAttribute ? "Confirming..." : "Confirm"}
            </button>
            <button 
              onClick={() => {
                setShowConfirmationForm(false);
                setConfirmationCode("");
                setPendingAttributeKey("");
              }}
              style={{ padding: "8px 16px", backgroundColor: "#6c757d", color: "white", border: "none", borderRadius: "4px" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      <div style={{ marginBottom: "20px" }}>
        <h2>Welcome to Green Space Management</h2>
        <p>You are now signed in and can manage your green spaces and projects.</p>
      </div>
      
      <div>
        🥳 App successfully hosted. Your authentication is working properly.
        <br />
        <a href="https://docs.amplify.aws/nextjs/start/quickstart/nextjs-app-router-client-components/">
          Review next steps of this tutorial.
        </a>
      </div>
    </main>
  );
}
