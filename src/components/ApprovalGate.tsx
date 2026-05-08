import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Clock, LogOut, RefreshCw } from 'lucide-react';

interface ApprovalGateProps {
  children: React.ReactNode;
}

export function ApprovalGate({ children }: ApprovalGateProps) {
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState(false);
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const check = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }
    setEmail(user.email || '');
    const { data, error } = await supabase.rpc('is_user_approved', { _user_id: user.id });
    if (error) {
      console.error(error);
      setApproved(false);
    } else {
      setApproved(!!data);
    }
    setLoading(false);
  };

  useEffect(() => {
    check();
    const channel = supabase
      .channel('user-access-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_access' }, () => {
        check();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!approved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit mb-3">
              <Clock className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Accès en attente d'approbation</CardTitle>
            <CardDescription className="text-base mt-2">
              Bonjour <strong>{email}</strong>, votre compte a bien été créé.
              <br />
              Un administrateur doit valider votre accès avant que vous puissiez utiliser la plateforme.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              Vous recevrez un accès dès qu'un administrateur aura approuvé votre compte. Vous pouvez actualiser cette page régulièrement.
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" onClick={check}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Vérifier
              </Button>
              <Button variant="ghost" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Se déconnecter
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
