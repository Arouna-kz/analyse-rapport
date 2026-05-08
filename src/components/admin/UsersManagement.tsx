import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Search, ShieldCheck, ShieldOff, Trash2, UserCheck, UserX, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AdminUser {
  user_id: string;
  email: string;
  signed_up_at: string;
  last_sign_in_at: string | null;
  full_name: string | null;
  display_name: string | null;
  company: string | null;
  job_title: string | null;
  is_approved: boolean;
  approved_at: string | null;
  is_admin: boolean;
  is_super_admin: boolean;
}

export function UsersManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || '');

    const [{ data: usersData, error: usersError }, { data: configData }] = await Promise.all([
      supabase.rpc('admin_list_users'),
      supabase.from('ai_config').select('config_value').eq('config_key', 'AUTO_APPROVE_NEW_USERS').maybeSingle(),
    ]);

    if (usersError) {
      toast.error('Erreur de chargement des utilisateurs');
    } else {
      setUsers((usersData as AdminUser[]) || []);
    }
    setAutoApprove(configData?.config_value === 'true');
    setLoading(false);
  };

  const toggleAutoApprove = async (enabled: boolean) => {
    setSavingAuto(true);
    const { data: existing } = await supabase
      .from('ai_config')
      .select('id')
      .eq('config_key', 'AUTO_APPROVE_NEW_USERS')
      .maybeSingle();

    const value = enabled ? 'true' : 'false';
    const { error } = existing
      ? await supabase.from('ai_config').update({ config_value: value }).eq('id', existing.id)
      : await supabase.from('ai_config').insert({
          config_key: 'AUTO_APPROVE_NEW_USERS',
          config_value: value,
          description: 'Auto-approbation des nouveaux inscrits',
        });

    if (error) {
      toast.error('Erreur de mise à jour');
    } else {
      setAutoApprove(enabled);
      toast.success(enabled ? 'Auto-approbation activée' : 'Auto-approbation désactivée');
    }
    setSavingAuto(false);
  };

  const setApproval = async (u: AdminUser, approved: boolean) => {
    setActionLoading(u.user_id);
    const { error } = await supabase.rpc('admin_set_user_approval', {
      _target_user_id: u.user_id,
      _approved: approved,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(approved ? 'Accès accordé' : 'Accès révoqué');
      await loadAll();
    }
    setActionLoading(null);
  };

  const setAdmin = async (u: AdminUser, makeAdmin: boolean) => {
    setActionLoading(u.user_id);
    const { error } = await supabase.rpc('admin_set_user_role', {
      _target_user_id: u.user_id,
      _make_admin: makeAdmin,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(makeAdmin ? 'Admin accordé' : 'Admin retiré');
      await loadAll();
    }
    setActionLoading(null);
  };

  const deleteUser = async () => {
    if (!deleteTarget) return;
    setActionLoading(deleteTarget.user_id);
    const { error } = await supabase.rpc('admin_delete_user', {
      _target_user_id: deleteTarget.user_id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Utilisateur supprimé');
      await loadAll();
    }
    setDeleteTarget(null);
    setActionLoading(null);
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      !q ||
      u.email?.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q) ||
      u.display_name?.toLowerCase().includes(q) ||
      u.company?.toLowerCase().includes(q)
    );
  });

  const pendingCount = users.filter((u) => !u.is_approved && !u.is_admin && !u.is_super_admin).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Auto-approbation des nouveaux inscrits
          </CardTitle>
          <CardDescription>
            Si activée, les nouveaux comptes obtiennent l'accès immédiatement. Sinon, ils doivent attendre votre validation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <Label htmlFor="auto-approve" className="cursor-pointer">
              {autoApprove ? 'Activée — accès immédiat' : 'Désactivée — approbation manuelle requise'}
            </Label>
            <div className="flex items-center gap-2">
              {savingAuto && <Loader2 className="h-4 w-4 animate-spin" />}
              <Switch id="auto-approve" checked={autoApprove} onCheckedChange={toggleAutoApprove} disabled={savingAuto} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Utilisateurs ({users.length})</CardTitle>
              <CardDescription>
                {pendingCount > 0
                  ? `${pendingCount} en attente d'approbation`
                  : 'Tous les utilisateurs sont gérés'}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Inscrit le</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => {
                    const isSelf = u.user_id === currentUserId;
                    const isLoading = actionLoading === u.user_id;
                    return (
                      <TableRow key={u.user_id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{u.display_name || u.full_name || '—'}</span>
                            <span className="text-xs text-muted-foreground">{u.email}</span>
                            {u.company && (
                              <span className="text-xs text-muted-foreground">{u.company}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(u.signed_up_at), 'dd MMM yyyy', { locale: fr })}
                        </TableCell>
                        <TableCell>
                          {u.is_approved || u.is_admin || u.is_super_admin ? (
                            <Badge variant="default" className="gap-1">
                              <ShieldCheck className="h-3 w-3" />
                              Approuvé
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <ShieldOff className="h-3 w-3" />
                              En attente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {u.is_super_admin ? (
                            <Badge variant="destructive" className="gap-1">
                              <Crown className="h-3 w-3" />
                              Super admin
                            </Badge>
                          ) : u.is_admin ? (
                            <Badge variant="default" className="gap-1">
                              <Crown className="h-3 w-3" />
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="outline">Utilisateur</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {!u.is_super_admin && (
                              <>
                                {u.is_approved ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setApproval(u, false)}
                                    disabled={isLoading || isSelf}
                                    title="Révoquer l'accès"
                                  >
                                    <UserX className="h-3.5 w-3.5" />
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => setApproval(u, true)}
                                    disabled={isLoading}
                                  >
                                    <UserCheck className="h-3.5 w-3.5 mr-1" />
                                    Approuver
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setAdmin(u, !u.is_admin)}
                                  disabled={isLoading || isSelf}
                                  title={u.is_admin ? 'Retirer admin' : 'Promouvoir admin'}
                                >
                                  <Crown className={`h-3.5 w-3.5 ${u.is_admin ? 'text-primary' : ''}`} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDeleteTarget(u)}
                                  disabled={isLoading || isSelf}
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </>
                            )}
                            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Aucun utilisateur trouvé
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'utilisateur <strong>{deleteTarget?.email}</strong> et toutes ses données seront supprimés définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={deleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
