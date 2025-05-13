import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';

interface AuthContextType {
  user: { id: string; prolificId: string } | null;
  loading: boolean;
  login: (prolificId: string) => Promise<{ error: any } | { data: any }>;
  logout: () => Promise<void>;
  bypassLogin: () => Promise<{ error: any } | { data: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; prolificId: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for user in local storage on mount
    const checkUser = async () => {
      const storedUser = localStorage.getItem('coherence-user');
      
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
        } catch (error) {
          console.error('Error parsing stored user:', error);
          localStorage.removeItem('coherence-user');
        }
      }
      
      setLoading(false);
    };
    
    checkUser();
  }, []);

  const login = async (prolificId: string) => {
    try {
      setLoading(true);
      
      // Look for existing user with this prolific ID
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('prolific_id', prolificId)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 is the error code for "no rows returned"
        console.error('Error fetching user:', fetchError);
        return { error: fetchError };
      }
      
      let userId;
      
      if (existingUser) {
        // User exists, use their ID
        userId = existingUser.id;
      } else {
        // Create new user
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert([{ prolific_id: prolificId }])
          .select()
          .single();
        
        if (insertError) {
          console.error('Error creating user:', insertError);
          return { error: insertError };
        }
        
        userId = newUser.id;
      }
      
      // Set user in state and localStorage
      const userObject = { id: userId, prolificId };
      setUser(userObject);
      localStorage.setItem('coherence-user', JSON.stringify(userObject));
      
      // Log login event
      await logEvent(userId, 'login', { prolificId });
      
      return { data: userObject };
    } catch (error) {
      console.error('Unexpected error during login:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (user) {
      await logEvent(user.id, 'logout', {});
    }
    
    localStorage.removeItem('coherence-user');
    setUser(null);
  };

  const bypassLogin = async () => {
    try {
      // Create a mock user ID without trying to access the database
      const tempId = `test_${Date.now()}`;
      const tempProlificId = `test_${Date.now()}`;
      
      // Create a test user object directly
      const testUser = { id: tempId, prolificId: tempProlificId };
      
      // Set the user in state and localStorage
      setUser(testUser);
      localStorage.setItem('coherence-user', JSON.stringify(testUser));
      
      // Try to log the event, but don't worry if it fails
      try {
        await logEvent(tempId, 'login', { prolificId: tempProlificId, bypass: true });
      } catch (e) {
        console.warn('Could not log bypass login event, but continuing anyway');
      }
      
      return { data: testUser };
    } catch (error) {
      console.error('Error in bypass login:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  // Helper function to log events
  const logEvent = async (userId: string, eventType: string, eventData: any) => {
    try {
      await supabase
        .from('user_events')
        .insert([{
          user_id: userId,
          event_type: eventType,
          event_data: eventData
        }]);
    } catch (error) {
      console.error(`Error logging ${eventType} event:`, error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, bypassLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 