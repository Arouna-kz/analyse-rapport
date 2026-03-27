import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, User, Mail, Building2, Briefcase, Phone, Camera, Trash2 } from 'lucide-react';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';
import { AvatarCropDialog } from '@/components/AvatarCropDialog';

interface ProfileData {
  full_name: string;
  display_name: string;
  phone: string;
  company: string;
  job_title: string;
  avatar_url: string;
}

const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState('');
  const [profile, setProfile] = useState<ProfileData>({
    full_name: '',
    display_name: '',
    phone: '',
    company: '',
    job_title: '',
    avatar_url: '',
  });
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || '');
      setUserId(user.id);

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, display_name, phone, company, job_title, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setProfile({
          full_name: data.full_name || '',
          display_name: data.display_name || '',
          phone: data.phone || '',
          company: data.company || '',
          job_title: data.job_title || '',
          avatar_url: data.avatar_url || '',
        });
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Format non supporté', description: 'Utilisez JPG, PNG, WebP ou GIF.', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Fichier trop volumineux', description: 'Taille max : 5 Mo.', variant: 'destructive' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCroppedUpload = async (blob: Blob) => {
    if (!userId) return;
    setUploadingAvatar(true);
    try {
      const filePath = `${userId}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({ user_id: userId, avatar_url: avatarUrl }, { onConflict: 'user_id' });

      if (updateError) throw updateError;

      setProfile(p => ({ ...p, avatar_url: avatarUrl }));
      toast({ title: 'Avatar mis à jour' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
      setCropDialogOpen(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!userId) return;
    setUploadingAvatar(true);
    try {
      // List and remove files in user folder
      const { data: files } = await supabase.storage.from('avatars').list(userId);
      if (files && files.length > 0) {
        await supabase.storage.from('avatars').remove(files.map(f => `${userId}/${f.name}`));
      }

      await supabase.from('profiles').update({ avatar_url: null }).eq('user_id', userId);
      setProfile(p => ({ ...p, avatar_url: '' }));
      toast({ title: 'Avatar supprimé' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { avatar_url, ...profileData } = profile;
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          ...profileData,
        }, { onConflict: 'user_id' });

      if (error) throw error;
      toast({ title: 'Profil mis à jour avec succès' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getInitials = () => {
    if (profile.display_name || profile.full_name) {
      const name = profile.display_name || profile.full_name;
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.charAt(0).toUpperCase() || 'U';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mon profil</h1>
        <p className="text-muted-foreground">Gérez vos informations personnelles</p>
      </div>

      {/* Avatar Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Avatar className="h-20 w-20">
                {profile.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt="Avatar" />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg">
                {profile.display_name || profile.full_name || 'Utilisateur'}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {email}
              </p>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  <Camera className="h-3.5 w-3.5 mr-1" />
                  Changer l'avatar
                </Button>
                {profile.avatar_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Supprimer
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Informations personnelles
          </CardTitle>
          <CardDescription>Modifiez vos informations de profil</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nom complet</Label>
              <Input
                id="full_name"
                value={profile.full_name}
                onChange={(e) => setProfile(p => ({ ...p, full_name: e.target.value }))}
                placeholder="Jean Dupont"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_name">Nom d'affichage</Label>
              <Input
                id="display_name"
                value={profile.display_name}
                onChange={(e) => setProfile(p => ({ ...p, display_name: e.target.value }))}
                placeholder="Jean"
                maxLength={50}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              Téléphone
            </Label>
            <Input
              id="phone"
              value={profile.phone}
              onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))}
              placeholder="+33 6 12 34 56 78"
              maxLength={20}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company" className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Entreprise
              </Label>
              <Input
                id="company"
                value={profile.company}
                onChange={(e) => setProfile(p => ({ ...p, company: e.target.value }))}
                placeholder="Ma Société"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job_title" className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" />
                Poste
              </Label>
              <Input
                id="job_title"
                value={profile.job_title}
                onChange={(e) => setProfile(p => ({ ...p, job_title: e.target.value }))}
                placeholder="Analyste de données"
                maxLength={100}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle>Sécurité</CardTitle>
          <CardDescription>Gérez votre mot de passe</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordDialog />
        </CardContent>
      </Card>

      <AvatarCropDialog
        open={cropDialogOpen}
        imageSrc={cropImageSrc}
        onClose={() => setCropDialogOpen(false)}
        onCropComplete={handleCroppedUpload}
        saving={uploadingAvatar}
      />
    </div>
  );
};

export default Profile;
