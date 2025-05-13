import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function Login() {
  const [prolificId, setProlificId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, bypassLogin } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prolificId.trim()) {
      toast.error('Please enter your Prolific ID');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(prolificId.trim());
      if ('error' in result && result.error) {
        toast.error('Failed to login. Please try again.');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBypass = async () => {
    setIsLoading(true);
    try {
      const result = await bypassLogin();
      if ('error' in result && result.error) {
        toast.error('Failed to bypass login. Please try again.');
      } else {
        toast.success('Successfully logged in with test account');
      }
    } catch (error) {
      toast.error('Failed to bypass login');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <Link to="/" className="flex items-center text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span className="text-sm">Back to home</span>
            </Link>
          </div>
          <CardTitle className="text-xl">Welcome to Coherence</CardTitle>
          <CardDescription>
            Please enter your Prolific ID to continue.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prolific-id">Prolific ID</Label>
                <Input
                  id="prolific-id"
                  value={prolificId}
                  onChange={(e) => setProlificId(e.target.value)}
                  placeholder="Enter your Prolific ID"
                  disabled={isLoading}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
            <Button 
              type="button"
              variant="outline"
              className="w-full" 
              onClick={handleBypass}
              disabled={isLoading}
            >
              Bypass Login (Testing)
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 