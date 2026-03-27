import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { FileText, Upload, Loader2, BarChart3, TrendingUp, FileCheck, RefreshCw, Search, CalendarIcon, ArrowUp, ArrowDown } from 'lucide-react';
import { ReportActions } from '@/components/ReportActions';
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';

interface Report {
  id: string;
  title: string;
  report_type: 'past' | 'current' | 'future';
  status: 'pending' | 'processing' | 'completed' | 'error';
  created_at: string;
  file_path?: string | null;
}

const Dashboard = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const navigate = useNavigate();
  const { toast } = useToast();

  const filteredReports = reports
    .filter(report => {
      const matchesSearch = report.title.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!dateRange?.from) return matchesSearch;
      
      const reportDate = new Date(report.created_at);
      const fromDate = startOfDay(dateRange.from);
      const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      
      const matchesDate = !isBefore(reportDate, fromDate) && !isAfter(reportDate, toDate);
      
      return matchesSearch && matchesDate;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les rapports",
        variant: "destructive",
      });
    } else {
      setReports(data || []);
    }
    setLoading(false);
  };

  const handleReanalyze = async (reportId: string) => {
    setReanalyzing(reportId);
    try {
      const { error } = await supabase.functions.invoke('analyze-report', {
        body: { reportId }
      });

      if (error) throw error;

      toast({
        title: "Ré-analyse lancée",
        description: "L'analyse du rapport a été relancée",
      });

      setTimeout(() => {
        fetchReports();
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setReanalyzing(null);
    }
  };

  const getStatusBadge = (status: Report['status']) => {
    const styles = {
      pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      processing: 'bg-primary/10 text-primary border-primary/20 animate-pulse',
      completed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      error: 'bg-destructive/10 text-destructive border-destructive/20',
    };
    
    const labels = {
      pending: 'En attente',
      processing: 'En cours',
      completed: 'Terminé',
      error: 'Erreur',
    };
    
    return (
      <Badge variant="outline" className={`${styles[status]} ml-2`}>
        {labels[status]}
      </Badge>
    );
  };

  const getReportIcon = (type: Report['report_type']) => {
    if (type === 'past') return <BarChart3 className="h-5 w-5" />;
    if (type === 'current') return <FileCheck className="h-5 w-5" />;
    return <TrendingUp className="h-5 w-5" />;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Hero Section */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          Gérez et analysez vos rapports avec l'intelligence artificielle
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="border-primary/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{reports.length}</p>
              <p className="text-xs text-muted-foreground">Rapports</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <FileCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{reports.filter(r => r.status === 'completed').length}</p>
              <p className="text-xs text-muted-foreground">Terminés</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Loader2 className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{reports.filter(r => r.status === 'processing' || r.status === 'pending').length}</p>
              <p className="text-xs text-muted-foreground">En cours</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{reports.filter(r => r.report_type === 'future').length}</p>
              <p className="text-xs text-muted-foreground">Futurs</p>
            </div>
          </CardContent>
        </Card>
      </div>
        <Tabs defaultValue="all" className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:flex h-auto">
              <TabsTrigger value="all" className="text-xs sm:text-sm py-2">Tous</TabsTrigger>
              <TabsTrigger value="past" className="text-xs sm:text-sm py-2">Passés</TabsTrigger>
              <TabsTrigger value="current" className="text-xs sm:text-sm py-2">Actuels</TabsTrigger>
              <TabsTrigger value="future" className="text-xs sm:text-sm py-2">Futurs</TabsTrigger>
            </TabsList>
            <div className="flex flex-1 gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un rapport..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2 min-w-[140px]">
                    <CalendarIcon className="h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <span className="text-xs">
                          {format(dateRange.from, 'dd/MM', { locale: fr })} - {format(dateRange.to, 'dd/MM', { locale: fr })}
                        </span>
                      ) : (
                        <span className="text-xs">{format(dateRange.from, 'dd MMM yyyy', { locale: fr })}</span>
                      )
                    ) : (
                      <span className="text-xs">Filtrer par date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    locale={fr}
                    numberOfMonths={1}
                  />
                  {dateRange?.from && (
                    <div className="p-2 border-t">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full" 
                        onClick={() => setDateRange(undefined)}
                      >
                        Effacer le filtre
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                title={sortOrder === 'desc' ? 'Plus récents en premier' : 'Plus anciens en premier'}
              >
                {sortOrder === 'desc' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <TabsContent value="all" className="space-y-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : reports.length === 0 ? (
              <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-dashed border-2">
                <CardContent className="py-8 sm:py-12 text-center">
                  <FileText className="h-10 sm:h-12 w-10 sm:w-12 mx-auto text-primary/50 mb-4" />
                  <p className="text-sm sm:text-base text-muted-foreground mb-4">
                    Aucun rapport pour le moment. Commencez par en créer un !
                  </p>
                  <Button onClick={() => navigate('/upload')} className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
                    <Upload className="h-4 w-4 mr-2" />
                    Créer un rapport
                  </Button>
                </CardContent>
              </Card>
            ) : filteredReports.length === 0 ? (
              <Card className="bg-muted/30 border-dashed">
                <CardContent className="py-8 text-center">
                  <Search className="h-10 w-10 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Aucun rapport trouvé pour "{searchQuery}"
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[400px] sm:h-[500px] rounded-lg border bg-card/50">
                <div className="p-3 sm:p-4 space-y-3">
                  {filteredReports.map((report) => (
                    <Card 
                      key={report.id} 
                      className="transition-all duration-300 hover:shadow-md hover:border-primary/20 cursor-pointer group"
                      onClick={() => navigate(`/report/${report.id}`)}
                    >
                      <CardHeader className="p-3 sm:p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                            <div className="p-1.5 sm:p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors flex-shrink-0">
                              {getReportIcon(report.report_type)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <CardTitle className="flex flex-wrap items-center gap-2 text-sm sm:text-base">
                                <span className="truncate">{report.title}</span>
                                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                  {getStatusBadge(report.status)}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReanalyze(report.id);
                                    }}
                                    disabled={reanalyzing === report.id || report.status === 'processing'}
                                    className="h-6 w-6 sm:h-8 sm:w-8 p-0"
                                    title="Ré-analyser ce rapport"
                                  >
                                    <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${reanalyzing === report.id ? 'animate-spin' : ''}`} />
                                  </Button>
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <ReportActions
                                      reportId={report.id}
                                      reportTitle={report.title}
                                      filePath={report.file_path}
                                      onDelete={fetchReports}
                                      size="icon"
                                    />
                                  </div>
                                </div>
                              </CardTitle>
                              <CardDescription className="text-xs sm:text-sm mt-1">
                                {new Date(report.created_at).toLocaleDateString('fr-FR', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </CardDescription>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {['past', 'current', 'future'].map((type) => {
            const typeReports = filteredReports.filter((r) => r.report_type === type);
            return (
              <TabsContent key={type} value={type} className="space-y-0">
                {typeReports.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 sm:py-12 text-center">
                      <p className="text-sm sm:text-base text-muted-foreground">
                        Aucun rapport {type === 'past' ? 'passé' : type === 'current' ? 'actuel' : 'futur'}.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <ScrollArea className="h-[400px] sm:h-[500px] rounded-lg border bg-card/50">
                    <div className="p-3 sm:p-4 space-y-3">
                      {typeReports.map((report) => (
                        <Card 
                          key={report.id} 
                          className="transition-all duration-300 hover:shadow-md hover:border-primary/20 cursor-pointer group"
                          onClick={() => navigate(`/report/${report.id}`)}
                        >
                          <CardHeader className="p-3 sm:p-6">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                                <div className="p-1.5 sm:p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors flex-shrink-0">
                                  {getReportIcon(report.report_type)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <CardTitle className="flex flex-wrap items-center gap-2 text-sm sm:text-base">
                                    <span className="truncate">{report.title}</span>
                                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                      {getStatusBadge(report.status)}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleReanalyze(report.id);
                                        }}
                                        disabled={reanalyzing === report.id || report.status === 'processing'}
                                        className="h-6 w-6 sm:h-8 sm:w-8 p-0"
                                        title="Ré-analyser ce rapport"
                                      >
                                        <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${reanalyzing === report.id ? 'animate-spin' : ''}`} />
                                      </Button>
                                      <div onClick={(e) => e.stopPropagation()}>
                                        <ReportActions
                                          reportId={report.id}
                                          reportTitle={report.title}
                                          filePath={report.file_path}
                                          onDelete={fetchReports}
                                          size="icon"
                                        />
                                      </div>
                                    </div>
                                  </CardTitle>
                                  <CardDescription className="text-xs sm:text-sm mt-1">
                                    {new Date(report.created_at).toLocaleDateString('fr-FR', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </CardDescription>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
    </div>
  );
};

export default Dashboard;
