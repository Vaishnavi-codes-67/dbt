import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Users, Eye, MousePointerClick, Globe, Clock, ArrowUpRight, ArrowDownRight, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setLoading(false);
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Redirect to auth if not logged in
    if (!loading && !session) {
      navigate("/auth");
    }
  }, [session, loading, navigate]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Fetch traffic events data
  const { data: trafficEvents, isLoading: dataLoading, error } = useQuery({
    queryKey: ['traffic-events', session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('traffic_events')
        .select('*')
        .eq('user_id', session?.user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!session?.user?.id,
  });

  // Process data for analytics
  const analyticsData = useMemo(() => {
    if (!trafficEvents) return null;

    const totalVisitors = new Set(trafficEvents.map(event => event.session_id)).size;
    const totalPageViews = trafficEvents.length;

    // Calculate bounce rate (sessions with only one page view)
    const sessionPageCounts = trafficEvents.reduce((acc, event) => {
      acc[event.session_id] = (acc[event.session_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const bouncedSessions = Object.values(sessionPageCounts).filter(count => count === 1).length;
    const bounceRate = totalVisitors > 0 ? (bouncedSessions / totalVisitors) * 100 : 0;

    // Calculate average session duration (simplified - using time between first and last event per session)
    const sessionDurations = trafficEvents.reduce((acc, event) => {
      if (!acc[event.session_id]) {
        acc[event.session_id] = { first: new Date(event.created_at), last: new Date(event.created_at) };
      } else {
        const eventTime = new Date(event.created_at);
        if (eventTime < acc[event.session_id].first) acc[event.session_id].first = eventTime;
        if (eventTime > acc[event.session_id].last) acc[event.session_id].last = eventTime;
      }
      return acc;
    }, {} as Record<string, { first: Date; last: Date }>);
    const avgSessionDuration = Object.values(sessionDurations).reduce((sum, session) => {
      return sum + (session.last.getTime() - session.first.getTime());
    }, 0) / Object.keys(sessionDurations).length / 1000; // in seconds

    // Top pages
    const pageStats = trafficEvents.reduce((acc, event) => {
      if (!acc[event.page_path]) {
        acc[event.page_path] = { views: 0, uniqueSessions: new Set() };
      }
      acc[event.page_path].views++;
      acc[event.page_path].uniqueSessions.add(event.session_id);
      return acc;
    }, {} as Record<string, { views: number; uniqueSessions: Set<string> }>);

    const topPages = Object.entries(pageStats)
      .map(([page, stats]) => ({
        page,
        views: stats.views,
        unique: stats.uniqueSessions.size,
        bounceRate: stats.uniqueSessions.size > 0 ? ((stats.views - stats.uniqueSessions.size) / stats.views) * 100 : 0,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    // Traffic sources
    const sourceStats = trafficEvents.reduce((acc, event) => {
      const source = event.referrer ? (event.referrer.includes('google') ? 'Organic Search' :
                                      event.referrer.includes('facebook') || event.referrer.includes('twitter') ? 'Social Media' :
                                      'Referral') : 'Direct';
      if (!acc[source]) acc[source] = new Set();
      acc[source].add(event.session_id);
      return acc;
    }, {} as Record<string, Set<string>>);

    const totalSessions = totalVisitors;
    const trafficSources = Object.entries(sourceStats)
      .map(([source, sessions]) => ({
        source,
        visitors: sessions.size,
        percentage: totalSessions > 0 ? ((sessions.size / totalSessions) * 100).toFixed(1) + '%' : '0%',
      }))
      .sort((a, b) => b.visitors - a.visitors);

    // Locations
    const locationStats = trafficEvents.reduce((acc, event) => {
      const country = event.country || 'Unknown';
      if (!acc[country]) acc[country] = new Set();
      acc[country].add(event.session_id);
      return acc;
    }, {} as Record<string, Set<string>>);

    const locations = Object.entries(locationStats)
      .map(([country, sessions]) => ({
        country,
        visitors: sessions.size,
        flag: getCountryFlag(country),
      }))
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 5);

    return {
      stats: [
        { title: "Total Visitors", value: totalVisitors.toLocaleString(), change: "+12.5%", trend: "up", icon: Users },
        { title: "Page Views", value: totalPageViews.toLocaleString(), change: "+8.2%", trend: "up", icon: Eye },
        { title: "Bounce Rate", value: `${bounceRate.toFixed(1)}%`, change: "-3.1%", trend: "down", icon: MousePointerClick },
        { title: "Avg. Session", value: formatDuration(avgSessionDuration), change: "+15.3%", trend: "up", icon: Clock },
      ],
      topPages,
      trafficSources,
      locations,
    };
  }, [trafficEvents]);

  const getCountryFlag = (country: string) => {
    const flags: Record<string, string> = {
      'United States': '🇺🇸',
      'United Kingdom': '🇬🇧',
      'Canada': '🇨🇦',
      'Germany': '🇩🇪',
      'France': '🇫🇷',
      'Unknown': '🌍',
    };
    return flags[country] || '🌍';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  if (loading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-red animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-red-500">Error loading analytics data</p>
        </div>
      </div>
    );
  }

  const stats = analyticsData?.stats || [];
  const topPages = analyticsData?.topPages || [];
  const trafficSources = analyticsData?.trafficSources || [];
  const locations = analyticsData?.locations || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-red" />
              <h1 className="text-2xl font-bold text-foreground">Web Traffic Analyzer</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{session.user.email}</span>
              <Button variant="outline">Export Data</Button>
              <Button className="bg-red text-red-foreground hover:bg-red/90">
                <TrendingUp className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
              <Button variant="outline" size="icon" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                  <div className="flex items-center gap-1 mt-2">
                    {stat.trend === "up" ? (
                      <ArrowUpRight className="h-4 w-4 text-green-500" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-red" />
                    )}
                    <span className={stat.trend === "up" ? "text-green-500 text-sm" : "text-red text-sm"}>
                      {stat.change}
                    </span>
                    <span className="text-muted-foreground text-sm">vs last period</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Analytics Tabs */}
        <Tabs defaultValue="pages" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-3">
            <TabsTrigger value="pages">Top Pages</TabsTrigger>
            <TabsTrigger value="sources">Traffic Sources</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
          </TabsList>

          {/* Top Pages */}
          <TabsContent value="pages">
            <Card>
              <CardHeader>
                <CardTitle>Most Visited Pages</CardTitle>
                <CardDescription>Pages with highest traffic in the last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topPages.map((page, index) => (
                    <div key={page.page} className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex items-center gap-4 flex-1">
                        <Badge variant="outline" className="font-mono">{index + 1}</Badge>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{page.page}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8 text-sm">
                        <div className="text-right">
                          <p className="text-muted-foreground">Views</p>
                          <p className="font-semibold text-foreground">{page.views}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">Unique</p>
                          <p className="font-semibold text-foreground">{page.unique}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">Bounce</p>
                          <p className="font-semibold text-red">{page.bounceRate}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Traffic Sources */}
          <TabsContent value="sources">
            <Card>
              <CardHeader>
                <CardTitle>Traffic Sources</CardTitle>
                <CardDescription>Where your visitors are coming from</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {trafficSources.map((source) => (
                    <div key={source.source} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">{source.source}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">{source.visitors} visitors</span>
                          <Badge className="bg-red text-red-foreground">{source.percentage}</Badge>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-red h-2 rounded-full transition-all duration-500"
                          style={{ width: source.percentage }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Locations */}
          <TabsContent value="locations">
            <Card>
              <CardHeader>
                <CardTitle>Visitor Locations</CardTitle>
                <CardDescription>Geographic distribution of your audience</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {locations.map((location, index) => (
                    <div key={location.country} className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">{location.flag}</span>
                        <div>
                          <p className="font-medium text-foreground">{location.country}</p>
                          <p className="text-sm text-muted-foreground">Rank #{index + 1}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-foreground">{location.visitors}</p>
                        <p className="text-sm text-muted-foreground">visitors</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
