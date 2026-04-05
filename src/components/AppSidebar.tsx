import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Upload,
  MessageSquare,
  Bell,
  Sparkles,
  Wand2,
  Settings2,
  BookOpen,
  Shield,
  FileText,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const mainNavItems = [
  { title: 'Tableau de bord', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Analyse de rapport', url: '/upload', icon: Upload },
  { title: 'Générer Rapport', url: '/generate-template', icon: Wand2 },
  { title: 'Génération prédictive', url: '/predictions', icon: Sparkles },
  { title: 'Chat IA', url: '/chat', icon: MessageSquare },
  { title: 'Alertes', url: '/alerts', icon: Bell, badgeKey: 'alerts' as const },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const navigate = useNavigate();
  const location = useLocation();
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
        checkAdmin(user.id);
        loadProfile(user.id);
        loadUnreadAlerts();
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (location.pathname === '/alerts') return;
    loadUnreadAlerts();
  }, [location.pathname]);

  useEffect(() => {
    const channel = supabase
      .channel('alert-badge-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'report_alerts' },
        () => {
          loadUnreadAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAdmin = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'super_admin']);
    setIsAdmin(!!(data && data.length > 0));
  };

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, full_name, avatar_url')
      .eq('user_id', userId)
      .maybeSingle();
    if (data) {
      setDisplayName(data.display_name || data.full_name || '');
      setAvatarUrl(data.avatar_url || '');
    }
  };

  const loadUnreadAlerts = async () => {
    const { count } = await supabase
      .from('report_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('is_acknowledged', false);
    setUnreadAlerts(count || 0);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const getInitials = () => {
    if (displayName) {
      return displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return userEmail?.charAt(0).toUpperCase() || 'U';
  };

  const linkClass = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent";
  const activeClass = "bg-sidebar-accent text-sidebar-primary font-medium";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate('/')}
          title="Retour à l'accueil"
        >
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-accent shadow-md shrink-0">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h2 className="text-base font-bold bg-gradient-to-r from-sidebar-foreground to-sidebar-foreground/70 bg-clip-text">
                Analyse IA
              </h2>
              <p className="text-xs text-muted-foreground truncate">Report Whisperer</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={linkClass} activeClassName={activeClass}>
                      <div className="relative shrink-0">
                        <item.icon className="h-4 w-4" />
                        {item.badgeKey === 'alerts' && unreadAlerts > 0 && collapsed && (
                          <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center">
                            {unreadAlerts > 9 ? '9+' : unreadAlerts}
                          </span>
                        )}
                      </div>
                      {!collapsed && (
                        <span className="flex-1 flex items-center justify-between">
                          <span>{item.title}</span>
                          {item.badgeKey === 'alerts' && unreadAlerts > 0 && (
                            <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center px-1.5 text-[10px]">
                              {unreadAlerts > 99 ? '99+' : unreadAlerts}
                            </Badge>
                          )}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3 space-y-2">
        {!collapsed && <ThemeToggle />}

        <Collapsible open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center gap-3 rounded-lg p-2 cursor-pointer hover:bg-sidebar-accent transition-colors">
              <Avatar className="h-8 w-8 shrink-0">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="Avatar" />}
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="min-w-0 flex-1 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{displayName || 'Mon profil'}</p>
                    <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} />
                </div>
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-1">
            <NavLink to="/profile" end className={`${linkClass} text-xs`} activeClassName={activeClass}>
              <span>Mon profil</span>
            </NavLink>
            <NavLink to="/arena-settings" end className={`${linkClass} text-xs`} activeClassName={activeClass}>
              <Settings2 className="h-3.5 w-3.5 shrink-0" />
              <span>Paramètres Arena</span>
            </NavLink>
            <NavLink to="/documentation" end className={`${linkClass} text-xs`} activeClassName={activeClass}>
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              <span>Documentation</span>
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin" end className={`${linkClass} text-xs`} activeClassName={activeClass}>
                <Shield className="h-3.5 w-3.5 shrink-0" />
                <span>Administration</span>
              </NavLink>
            )}
          </CollapsibleContent>
        </Collapsible>

        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Déconnexion</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
