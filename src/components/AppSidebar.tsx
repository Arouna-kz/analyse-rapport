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
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

const mainNavItems = [
  { title: 'Tableau de bord', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Importer', url: '/upload', icon: Upload },
  { title: 'Chat IA', url: '/chat', icon: MessageSquare },
  { title: 'Alertes', url: '/alerts', icon: Bell, badgeKey: 'alerts' as const },
  { title: 'Prédictions', url: '/predictions', icon: Sparkles },
];

const toolsNavItems = [
  { title: 'Générer Rapport', url: '/generate-template', icon: Wand2 },
  { title: 'Paramètres Arena', url: '/arena-settings', icon: Settings2 },
  { title: 'Documentation', url: '/documentation', icon: BookOpen },
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

  // Refresh unread count when navigating back from alerts
  useEffect(() => {
    if (location.pathname === '/alerts') return;
    loadUnreadAlerts();
  }, [location.pathname]);

  // Realtime subscription for alert badge updates
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
        <div className="flex items-center gap-3">
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

        <SidebarGroup>
          <SidebarGroupLabel>Outils</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolsNavItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={linkClass} activeClassName={activeClass}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/admin" end className={linkClass} activeClassName={activeClass}>
                      <Shield className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Administration</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3 space-y-2">
        {!collapsed && <ThemeToggle />}
        
        <div
          className="flex items-center gap-3 rounded-lg p-2 cursor-pointer hover:bg-sidebar-accent transition-colors"
          onClick={() => navigate('/profile')}
        >
          <Avatar className="h-8 w-8 shrink-0">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="Avatar" />}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{displayName || 'Mon profil'}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
          )}
        </div>

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
